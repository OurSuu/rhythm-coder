// src/components/GameStage.tsx
import React, { useEffect, useRef, useState } from 'react';
import { AudioController } from '../utils/AudioAnalyzer';
import { CyberCharacter } from './CyberCharacter';
import type { Song } from './SongMenu';

// --- TYPES ---
interface Note { id: number; lane: 0 | 1 | 2 | 3; y: number; hit: boolean; missed: boolean; }
type JudgementType = 'PERFECT' | 'GOOD' | 'BAD' | 'MISS';
interface Judgement { text: JudgementType; color: string; id: number; }
interface HitEffect { id: number; lane: 0 | 1 | 2 | 3; type: 'PERFECT' | 'GOOD' | 'BAD'; }
interface GameProps { song: Song; onBack: () => void; }

// --- CONSTANTS ---
const LANES = ['D', 'F', 'J', 'K'];
const LANE_COLORS = [
    'bg-neon-pink/90 border-2 border-neon-pink shadow-[0_0_30px_#ff00ff]', 
    'bg-neon-blue/90 border-2 border-neon-blue shadow-[0_0_30px_#00f3ff]', 
    'bg-neon-blue/90 border-2 border-neon-blue shadow-[0_0_30px_#00f3ff]', 
    'bg-neon-pink/90 border-2 border-neon-pink shadow-[0_0_30px_#ff00ff]'
];

const HIT_ZONE_Y = 85; 
const MAX_HP = 100;
const HP_PENALTY_MISS = 10; 
const HP_PENALTY_BAD = 5;
const HP_RECOVER_PERFECT = 3; 
const HP_RECOVER_GOOD = 1;

// --- HELPER ---
function formatTime(sec: number) {
  if (isNaN(sec)) return "00:00";
  const min = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${min.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export const GameStage: React.FC<GameProps> = ({ song, onBack }) => {
  // --- STATE ---
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [health, setHealth] = useState(MAX_HP);
  const [audioIntensity, setAudioIntensity] = useState(0);
  const [gameState, setGameState] = useState<'IDLE' | 'COUNTDOWN' | 'PLAYING' | 'PAUSED' | 'GAMEOVER'>('IDLE');
  const [countdown, setCountdown] = useState(3);
  const [lastJudgement, setLastJudgement] = useState<Judgement | null>(null);
  const [hitEffects, setHitEffects] = useState<HitEffect[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume] = useState(0.5);

  // --- REFS ---
  const isPlayingRef = useRef(false);
  const comboRef = useRef(0);
  const healthRef = useRef(MAX_HP);
  const gameStateRef = useRef(gameState);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const controllerRef = useRef<AudioController>(new AudioController());
  const notesRef = useRef<Note[]>([]); 
  const lastBeatTimeRef = useRef<number>(0);
  const currentSpeedRef = useRef(0.2);
  const targetSpeedRef = useRef(0); 
  
  // *** NEW: เพิ่ม Ref เก็บเวลาเฟรมล่าสุด เพื่อคำนวณ Delta Time ***
  const lastFrameTimeRef = useRef<number>(0);

  const START_SPEED = 0.2; 
  const WINDOW_PERFECT = 5; const WINDOW_GOOD = 12; const WINDOW_BAD = 18;

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // --- AUDIO SFX ---
  const playSfx = (type: 'HIT' | 'MISS') => {
      const sfxUrl = type === 'HIT' ? '/audio/hit.mp3' : '/audio/miss.mp3';
      const audio = new Audio(sfxUrl);
      audio.volume = type === 'HIT' ? 0.4 : 0.6; 
      audio.play().catch(() => {}); 
  };

  const updateHealth = (amount: number) => {
      let newHealth = healthRef.current + amount;
      if (newHealth > MAX_HP) newHealth = MAX_HP;
      if (newHealth <= 0) { newHealth = 0; triggerGameOver(); }
      healthRef.current = newHealth;
      setHealth(newHealth);
  };

  const triggerGameOver = () => {
      setGameState('GAMEOVER'); isPlayingRef.current = false;
      if (audioRef.current) audioRef.current.pause();
      playSfx('MISS');
  };

  const triggerHitEffect = (lane: 0 | 1 | 2 | 3, type: 'PERFECT' | 'GOOD' | 'BAD') => {
      const id = Date.now();
      setHitEffects(prev => [...prev, { id, lane, type }]);
      setTimeout(() => setHitEffects(prev => prev.filter(e => e.id !== id)), 300); 
  };

  // --- GAME LOOP ---
  const gameLoop = () => {
    if (!isPlayingRef.current) return;

    // --- DELTA TIME CALCULATION (หัวใจสำคัญแก้ปัญหา Lag) ---
    const now = performance.now(); // ใช้ performance.now() แม่นกว่า Date.now()
    const deltaTime = now - lastFrameTimeRef.current;
    lastFrameTimeRef.current = now;

    // ป้องกันกรณี Delta Time เยอะผิดปกติ (เช่น สลับแท็บไปมา) ให้ Lock ไว้ที่ max 100ms
    // เพื่อไม่ให้โน้ตวาร์ปข้ามจักรวาล
    const dtFactor = Math.min(deltaTime, 100) / 16.667; // Normalize กับ 60FPS (16.667ms)
    
    // ----------------------------------------------------

    if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
        if (audioRef.current.ended) { isPlayingRef.current = false; return; }
    }

    const analysis = controllerRef.current.getAnalysis();
    setAudioIntensity(analysis.bass); 

    // Dynamic Speed Logic
    const baseSpeed = song.difficulty === 'HARD' ? 0.5 : 0.3; // เพิ่ม Base Speed ขึ้นนิดนึงเพราะใช้ dtFactor แล้ว
    const speedMultiplier = song.difficulty === 'HARD' ? 1.0 : 0.7;
    const bassRatio = analysis.bass / 255;
    const targetSpeed = baseSpeed + (bassRatio * speedMultiplier);

    // Lerp Speed
    currentSpeedRef.current += (targetSpeed - currentSpeedRef.current) * 0.05 * dtFactor;

    // Spawn Logic
    const timeSinceLastNote = Date.now() - lastBeatTimeRef.current;
    const MAX_SILENCE_DURATION = song.difficulty === 'HARD' ? 800 : 1200; 
    const spawnThreshold = song.difficulty === 'HARD' ? 140 : 160;

    const shouldSpawn = (analysis.bass > spawnThreshold && timeSinceLastNote > (60000 / song.bpm / 2)) || timeSinceLastNote > MAX_SILENCE_DURATION;

    if (shouldSpawn) {
      const randomLane = Math.floor(Math.random() * 4) as 0 | 1 | 2 | 3;
      if (analysis.bass > spawnThreshold || Math.random() > 0.2) {
          notesRef.current.push({ id: Date.now() + Math.random(), lane: randomLane, y: -10, hit: false, missed: false });
          lastBeatTimeRef.current = Date.now();
      }
    }

    // Move Notes (คูณ dtFactor เข้าไป)
    notesRef.current = notesRef.current.map(note => {
        // สูตรใหม่: speed * DeltaTime Factor
        // ถ้าเครื่องช้า (dtFactor > 1) โน้ตจะขยับเยอะขึ้นเพื่อชดเชย
        const nextY = note.y + (currentSpeedRef.current * dtFactor);
        
        if (nextY > HIT_ZONE_Y + WINDOW_BAD && !note.hit && !note.missed) {
            note.missed = true; 
            setCombo(0); comboRef.current = 0;
            showJudgement('MISS'); 
            updateHealth(-HP_PENALTY_MISS);
            playSfx('MISS'); 
        }
        return { ...note, y: nextY };
    }).filter(note => note.y < 120); 

    requestAnimationFrame(gameLoop);
  };

  // --- CONTROLS ---
  const startNewGame = () => {
    notesRef.current = []; setScore(0); setCombo(0); comboRef.current = 0;
    setHealth(MAX_HP); healthRef.current = MAX_HP;
    
    currentSpeedRef.current = START_SPEED;
    
    if (audioRef.current) {
        controllerRef.current.setup(audioRef.current);
        audioRef.current.currentTime = 0; 
        audioRef.current.volume = volume;
    }
    startCountdown();
  };

  const startCountdown = () => {
    setGameState('COUNTDOWN');
    let count = 3; setCountdown(3);
    const timer = setInterval(() => {
        count--;
        if (count > 0) setCountdown(count);
        else { clearInterval(timer); enterGameplay(); }
    }, 800);
  };

  const enterGameplay = async () => {
    if (!audioRef.current) return;
    setGameState('PLAYING'); isPlayingRef.current = true; 
    
    // Reset Last Frame Time เพื่อไม่ให้ dt พุ่งสูงตอนเริ่มเกม
    lastFrameTimeRef.current = performance.now();
    lastBeatTimeRef.current = Date.now();

    try {
      controllerRef.current.resume();
      await audioRef.current.play();
      requestAnimationFrame(gameLoop);
    } catch (e) { console.error(e); }
  };

  const togglePause = () => {
      if (isPlayingRef.current) {
          setGameState('PAUSED'); isPlayingRef.current = false;
          if (audioRef.current) audioRef.current.pause();
      } else if (gameState === 'PAUSED') startCountdown();
  };

  const showJudgement = (type: JudgementType) => {
      let color = 'text-white';
      if (type === 'PERFECT') color = 'text-yellow-400 drop-shadow-[0_0_20px_gold]';
      if (type === 'GOOD') color = 'text-neon-green drop-shadow-[0_0_20px_#00ff9f]';
      if (type === 'BAD') color = 'text-red-500 drop-shadow-[0_0_20px_red]';
      if (type === 'MISS') color = 'text-gray-500';
      setLastJudgement({ text: type, color, id: Date.now() });
  };

  const handleInput = (lane: number) => {
      if (lane === undefined || lane < 0 || lane > 3) return;

      const laneEl = document.getElementById(`lane-${lane}`);
      if (laneEl) {
          laneEl.classList.add('bg-white/20');
          setTimeout(() => laneEl.classList.remove('bg-white/20'), 100);
      }

      if (!isPlayingRef.current) { 
          if(gameState === 'PLAYING') playSfx('MISS'); 
          return; 
      }

      const hitNote = notesRef.current.filter(n => n.lane === lane && !n.hit && !n.missed).sort((a, b) => b.y - a.y)[0];
      
      if (hitNote) {
         const distance = Math.abs(hitNote.y - HIT_ZONE_Y);
         if (distance <= WINDOW_BAD) {
             hitNote.hit = true;
             const currentCombo = comboRef.current + 1;
             
             if (distance <= WINDOW_PERFECT) {
                 comboRef.current = currentCombo; setCombo(currentCombo);
                 setScore(s => s + 300 + (currentCombo * 10)); showJudgement('PERFECT');
                 updateHealth(HP_RECOVER_PERFECT);
                 triggerHitEffect(lane as 0 | 1 | 2 | 3, 'PERFECT'); 
                 playSfx('HIT');
             } else if (distance <= WINDOW_GOOD) {
                 comboRef.current = currentCombo; setCombo(currentCombo);
                 setScore(s => s + 100 + (currentCombo * 5)); showJudgement('GOOD');
                 updateHealth(HP_RECOVER_GOOD);
                 triggerHitEffect(lane as 0 | 1 | 2 | 3, 'GOOD');
                 playSfx('HIT');
             } else {
                 setScore(s => s + 50); setCombo(0); comboRef.current = 0;
                 showJudgement('BAD'); updateHealth(-HP_PENALTY_BAD);
                 triggerHitEffect(lane as 0 | 1 | 2 | 3, 'BAD');
                 playSfx('MISS');
             }
         } else { playSfx('MISS'); }
      } else { playSfx('MISS'); }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'Escape') { togglePause(); return; }
      const keyMap: { [key: string]: number } = { 'd': 0, 'f': 1, 'j': 2, 'k': 3 };
      handleInput(keyMap[e.key.toLowerCase()]);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  return (
    <div className="relative w-full h-screen bg-dark-bg overflow-hidden font-mono select-none outline-none" tabIndex={0}>
      
      {/* --- GLOBAL EFFECTS --- */}
      <div className="scanlines"></div>
      <div className="noise-overlay"></div>
      <div className={`absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#1a1a2e] via-black to-black transition-all duration-500 ${gameState === 'PAUSED' ? 'blur-md' : ''}`}></div>

      {/* --- HUD --- */}
      <div className={`z-50 w-full p-4 absolute top-0 pointer-events-none transition-all duration-300 ${gameState === 'PAUSED' ? 'opacity-20 blur-sm' : 'opacity-100'}`}>
        <div className="flex flex-col md:flex-row justify-between items-center max-w-7xl mx-auto gap-4">
            <div className="pointer-events-auto flex items-center gap-4 w-full md:w-auto">
                <button onClick={togglePause} className="w-10 h-10 flex items-center justify-center border border-neon-blue/50 bg-black/50 backdrop-blur rounded-full text-neon-blue hover:bg-neon-blue hover:text-black transition-all">||</button>
                <div>
                    <h1 className="text-white font-bold tracking-widest text-sm uppercase">{song.title}</h1>
                    <p className="text-neon-blue text-[10px] tracking-[0.2em]">{song.artist}</p>
                </div>
            </div>
            <div className="flex-1 w-full md:px-20 flex flex-col items-center gap-1">
                <div className="w-full h-3 bg-gray-900 border border-white/20 relative overflow-hidden skew-x-[-10deg]">
                    <div className={`h-full transition-all duration-200 ease-out ${health > 30 ? 'bg-neon-green shadow-[0_0_10px_#00ff9f]' : 'bg-red-600 animate-pulse'}`} style={{ width: `${health}%` }}></div>
                </div>
                <div className="flex justify-between w-full text-[10px] text-gray-500">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
            </div>
            <div className="text-right w-full md:w-auto pointer-events-auto">
                <div className="text-4xl md:text-5xl font-black italic text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">{score.toLocaleString()}</div>
                <div className={`text-xl font-black italic ${combo > 10 ? 'text-neon-pink animate-pulse' : 'text-gray-600'}`}>COMBO {combo}</div>
            </div>
        </div>
      </div>

      {/* --- CHARACTER --- */}
      <div className={`absolute top-[15%] left-1/2 -translate-x-1/2 z-10 pointer-events-none transition-all duration-500 transform scale-75 md:scale-90 ${gameState === 'PAUSED' ? 'opacity-20 grayscale' : 'opacity-80'}`}>
        <CyberCharacter intensity={audioIntensity} />
      </div>

      {/* --- 3D STAGE --- */}
      <div className={`relative w-full h-full flex justify-center items-end pb-0 perspective-[400px] overflow-hidden transition-all duration-500 ${gameState === 'PAUSED' ? 'opacity-30 blur-sm' : ''}`}>
        
        {/* Side Buildings */}
        <div className="absolute left-0 bottom-0 w-1/4 h-full perspective-[500px] hidden md:block pointer-events-none">
            <div className="absolute bottom-0 right-0 w-20 h-[90%] bg-black/80 border-r border-neon-blue/20 transform rotate-y-12 translate-z-[-100px]">
                 <div className={`w-full h-full bg-[linear-gradient(transparent_90%,rgba(0,243,255,0.1)_90%)] bg-[length:100%_40px] ${isPlayingRef.current ? 'animate-grid-scroll' : ''}`}></div>
            </div>
        </div>
        <div className="absolute right-0 bottom-0 w-1/4 h-full perspective-[500px] hidden md:block pointer-events-none">
            <div className="absolute bottom-0 left-0 w-20 h-[90%] bg-black/80 border-l border-neon-pink/20 transform -rotate-y-12 translate-z-[-100px]">
                 <div className={`w-full h-full bg-[linear-gradient(transparent_90%,rgba(0,243,255,0.1)_90%)] bg-[length:100%_40px] ${isPlayingRef.current ? 'animate-grid-scroll' : ''}`}></div>
            </div>
        </div>

        {/* Main Highway */}
        <div className="relative w-full max-w-2xl h-[130%] bg-gradient-to-b from-transparent via-[#0a0a1a] to-black transform-style-3d rotate-x-[55deg] origin-bottom border-x-2 border-neon-blue/20 flex justify-center shadow-[0_0_50px_rgba(0,243,255,0.05)]">
            <div className={`absolute inset-0 bg-[linear-gradient(0deg,transparent_0%,rgba(0,243,255,0.1)_1%,transparent_2%),linear-gradient(90deg,transparent_0%,rgba(0,243,255,0.05)_1%,transparent_2%)] bg-[length:100px_100px] opacity-40 ${isPlayingRef.current ? 'animate-grid-scroll' : ''}`}></div>
            
            {/* Hit Line */}
            <div className="absolute w-full h-3 bg-white/30 z-20 shadow-[0_0_30px_white] border-y border-white/50" style={{ top: `${HIT_ZONE_Y}%` }}></div>
            
            {/* Lanes */}
            <div className="relative w-full h-full flex">
                {LANES.map((key, index) => (
                    <div key={index} id={`lane-${index}`} className="relative w-1/4 h-full border-r border-neon-blue/5 last:border-r-0 flex flex-col justify-end items-center pb-10 transition-colors duration-75">
                        <div className="text-4xl font-black text-white/20 transform rotate-x-[-55deg] mb-4">{key}</div>
                        <div className="absolute bottom-0 w-full h-full flex justify-center pointer-events-none overflow-hidden">
                             {hitEffects.map(effect => effect.lane === index && (
                                 <div key={effect.id} className="absolute bottom-[5%] w-full flex justify-center items-end">
                                     <div className={`absolute w-32 h-32 border-4 rounded-full animate-ping opacity-0 ${effect.type === 'PERFECT' ? 'border-yellow-400' : 'border-neon-blue'}`} style={{ animationDuration: '0.6s' }}></div>
                                     <div className={`absolute w-full h-32 bg-gradient-to-t from-white to-transparent opacity-80 animate-pulse blur-md`}></div>
                                     <div className="absolute w-2 h-2 bg-white rounded-full animate-ping" style={{ left: '20%', bottom: '20%', animationDuration: '0.3s' }}></div>
                                     <div className="absolute w-2 h-2 bg-white rounded-full animate-ping" style={{ right: '20%', bottom: '30%', animationDuration: '0.4s' }}></div>
                                 </div>
                             ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Judgement */}
            {lastJudgement && gameState === 'PLAYING' && (
                <div key={lastJudgement.id} className="absolute top-[40%] left-1/2 -translate-x-1/2 z-50 pointer-events-none">
                    <div className={`text-6xl font-black italic transform -skew-x-12 animate-judgement ${lastJudgement.color} drop-shadow-[0_0_30px_currentColor] tracking-tighter`}>
                        {lastJudgement.text}
                    </div>
                </div>
            )}

            {/* NOTES */}
            {notesRef.current.map((note) => !note.hit && (
                <div
                    key={note.id}
                    className={`absolute w-[20%] h-16 rounded-sm z-30 ${LANE_COLORS[note.lane]}`}
                    style={{ 
                        top: `${note.y}%`, 
                        left: `${note.lane * 25 + 2.5}%`, 
                        opacity: note.missed ? 0.5 : 0.95,
                        transform: `translateZ(0)`,
                        boxShadow: `0 0 ${30 + (note.y/5)}px currentColor`
                    }}
                >
                    <div className="absolute top-0 left-0 w-full h-4 bg-white/70 rounded-t-sm"></div>
                    <div className="absolute inset-x-2 top-4 bottom-2 bg-white/30 blur-sm"></div>
                </div>
            ))}
        </div>
      </div>

      {/* --- TOUCH ZONES --- */}
      <div className="absolute inset-0 z-40 flex md:hidden">
          {[0, 1, 2, 3].map((lane) => (
              <div key={lane} className="flex-1 h-full active:bg-white/5 transition-colors"
                  onTouchStart={(e) => { e.preventDefault(); handleInput(lane); }}></div>
          ))}
      </div>

      {/* --- OVERLAYS --- */}
      {gameState === 'IDLE' && (
        <div className="absolute inset-0 z-50 flex justify-center items-center bg-black/80 backdrop-blur-sm animate-fade-in">
          <button onClick={startNewGame} className="px-16 py-4 border-2 border-neon-blue text-neon-blue font-black text-2xl hover:bg-neon-blue hover:text-black transition-all">INITIALIZE</button>
        </div>
      )}
      {gameState === 'PAUSED' && (
        <div className="absolute inset-0 z-50 flex justify-center items-center bg-black/60">
           <div className="bg-black border border-neon-blue p-10 text-center shadow-[0_0_50px_rgba(0,243,255,0.2)]">
               <h2 className="text-4xl font-black text-white mb-8 glitch-text">SYSTEM PAUSED</h2>
               <div className="flex flex-col gap-4">
                   <button onClick={togglePause} className="px-8 py-3 border border-neon-blue text-neon-blue hover:bg-neon-blue hover:text-black font-bold">RESUME</button>
                   <button onClick={onBack} className="px-8 py-3 border border-red-500 text-red-500 hover:bg-red-500 hover:text-black font-bold">ABORT</button>
               </div>
           </div>
        </div>
      )}
      {gameState === 'GAMEOVER' && (
        <div className="absolute inset-0 z-50 flex justify-center items-center bg-black/90 crt-overlay">
           <div className="text-center">
               <h2 className="text-8xl font-black text-red-500 mb-4 drop-shadow-[0_0_30px_red]">FAILURE</h2>
               <div className="text-3xl text-white mb-8">SCORE: {score.toLocaleString()}</div>
               <div className="flex gap-4 justify-center">
                    <button onClick={startNewGame} className="px-8 py-3 bg-white text-black font-bold hover:scale-105 transition-all">RETRY</button>
                    <button onClick={onBack} className="px-8 py-3 border border-white text-white font-bold hover:bg-white hover:text-black transition-all">EXIT</button>
               </div>
           </div>
        </div>
      )}
      {gameState === 'COUNTDOWN' && (
        <div className="absolute inset-0 z-50 flex justify-center items-center">
           <div key={countdown} className="text-[150px] font-black text-white animate-countdown drop-shadow-[0_0_50px_#00f3ff]">{countdown}</div>
        </div>
      )}

      <audio ref={audioRef} src={song.src} crossOrigin="anonymous" />
    </div>
  );
};