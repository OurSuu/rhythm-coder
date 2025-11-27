// src/components/GameStage.tsx
import React, { useEffect, useRef, useState } from 'react';
import { AudioController } from '../utils/AudioAnalyzer';
import { CyberCharacter } from './CyberCharacter';
import type { Song } from './SongMenu';

// --- TYPES ---
type NoteType = 'NORMAL' | 'HOLD';

interface Note {
  id: number;
  lane: 0 | 1 | 2 | 3;
  y: number;
  type: NoteType;
  length: number;       
  isHolding: boolean;   
  hit: boolean;         
  missed: boolean;
}

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
const HP_RECOVER_PERFECT = 2; 

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
  const [gameState, setGameState] = useState<'IDLE' | 'COUNTDOWN' | 'PLAYING' | 'PAUSED' | 'GAMEOVER' | 'RESULTS'>('IDLE');
  const [countdown, setCountdown] = useState(3);
  const [lastJudgement, setLastJudgement] = useState<Judgement | null>(null);
  const [hitEffects, setHitEffects] = useState<HitEffect[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.5);

  // --- REFS ---
  const isPlayingRef = useRef(false);
  const notesRef = useRef<Note[]>([]); 
  const heldLanesRef = useRef<boolean[]>([false, false, false, false]); 
  const audioRef = useRef<HTMLAudioElement>(null);
  const controllerRef = useRef<AudioController>(new AudioController());
  
  const lastBeatTimeRef = useRef<number>(0);
  const currentSpeedRef = useRef(0.2); 
  const lastFrameTimeRef = useRef<number>(0);
  const spawnDelayRef = useRef<number>(0); 

  const START_SPEED = 0.2; 
  const WINDOW_PERFECT = 5; const WINDOW_GOOD = 12; const WINDOW_BAD = 18;

  // --- SETTINGS ---
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVol = parseFloat(e.target.value);
      setVolume(newVol);
      if (audioRef.current) audioRef.current.volume = newVol;
  };

  // --- AUDIO SFX ---
  const playSfx = (type: 'HIT' | 'MISS' | 'HOLD') => {
      if (type === 'HOLD' && Math.random() > 0.3) return; 
      const sfxUrl = type === 'HIT' || type === 'HOLD' ? '/audio/hit.mp3' : '/audio/miss.mp3';
      const audio = new Audio(sfxUrl);
      audio.volume = type === 'HOLD' ? 0.2 : 0.6; 
      audio.play().catch(() => {}); 
  };

  const triggerHitEffect = (lane: 0 | 1 | 2 | 3, type: 'PERFECT' | 'GOOD' | 'BAD') => {
      const id = Date.now();
      setHitEffects(prev => [...prev, { id, lane, type }]);
      setTimeout(() => setHitEffects(prev => prev.filter(e => e.id !== id)), 300); 
  };

  const showJudgement = (type: JudgementType) => {
      let color = 'text-white';
      if (type === 'PERFECT') color = 'text-yellow-400 drop-shadow-[0_0_20px_gold]';
      if (type === 'GOOD') color = 'text-neon-green drop-shadow-[0_0_20px_#00ff9f]';
      if (type === 'BAD') color = 'text-red-500';
      if (type === 'MISS') color = 'text-gray-500';
      setLastJudgement({ text: type, color, id: Date.now() });
  };

  const updateHealth = (amount: number) => {
      setHealth(prev => {
          const newHealth = Math.min(MAX_HP, Math.max(0, prev + amount));
          if (newHealth <= 0) setTimeout(() => triggerGameOver(), 0);
          return newHealth;
      });
  };

  const triggerGameOver = () => {
      if (gameState === 'GAMEOVER') return;
      setGameState('GAMEOVER'); isPlayingRef.current = false;
      if (audioRef.current) audioRef.current.pause();
      playSfx('MISS');
  };

  // --- CORE GAME LOGIC ---
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
    
    lastFrameTimeRef.current = performance.now();
    lastBeatTimeRef.current = Date.now();

    try {
      controllerRef.current.resume();
      await audioRef.current.play();
      requestAnimationFrame(gameLoop);
    } catch (e) { console.error(e); }
  };

  // ** DEFINED HERE TO BE ACCESSIBLE EVERYWHERE **
  const togglePause = () => {
      if (isPlayingRef.current) {
          setGameState('PAUSED'); isPlayingRef.current = false;
          if (audioRef.current) audioRef.current.pause();
      } else if (gameState === 'PAUSED') {
          startCountdown();
      }
  };

  const startNewGame = () => {
    notesRef.current = []; setScore(0); setCombo(0); setHealth(MAX_HP);
    spawnDelayRef.current = 0; 
    currentSpeedRef.current = START_SPEED;
    if(audioRef.current) { controllerRef.current.setup(audioRef.current); audioRef.current.currentTime = 0; audioRef.current.volume = volume; }
    startCountdown();
  };

  // --- GAME LOOP ---
  const gameLoop = () => {
    if (!isPlayingRef.current) return;

    const now = performance.now();
    const deltaTime = now - lastFrameTimeRef.current;
    lastFrameTimeRef.current = now;
    const dtFactor = Math.min(deltaTime, 100) / 16.667; 

    // Audio Sync
    if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
        if (audioRef.current.ended && notesRef.current.length === 0) {
             setGameState('RESULTS');
             isPlayingRef.current = false;
             return;
        }
    }

    const analysis = controllerRef.current.getAnalysis();
    setAudioIntensity(analysis.bass); 

    // DYNAMIC SPEED
    const IS_HARD = song.difficulty === 'HARD';
    const baseSpeed = IS_HARD ? 0.4 : 0.25;
    const speedMultiplier = IS_HARD ? 1.0 : 0.5;
    const targetSpeed = baseSpeed + ((analysis.bass / 255) * speedMultiplier);
    currentSpeedRef.current += (targetSpeed - currentSpeedRef.current) * 0.05 * dtFactor;

    // === SPAWN LOGIC ===
    const timeNow = Date.now();
    
    if (timeNow < spawnDelayRef.current) {
        // Skip spawn if delayed
    } else {
        const timeSinceLastNote = timeNow - lastBeatTimeRef.current;
        const spawnThreshold = IS_HARD ? 130 : 160; 
        const minNoteGap = (60000 / song.bpm / (analysis.bass > 200 ? 2 : 1));

        if (timeSinceLastNote > minNoteGap || timeSinceLastNote > 1200) {
            if (analysis.bass > spawnThreshold || Math.random() > (IS_HARD ? 0.3 : 0.6)) {
                
                const lane = Math.floor(Math.random() * 4) as 0|1|2|3;
                const rand = Math.random();
                let type: NoteType = 'NORMAL';
                let length = 0;

                if (IS_HARD && rand > 0.8) {
                    type = 'HOLD';
                    length = 30 + Math.random() * 40; 
                    spawnDelayRef.current = timeNow + (length * 15); 
                }

                notesRef.current.push({
                    id: timeNow + Math.random(),
                    lane, y: -20, type, length,
                    isHolding: false, hit: false, missed: false
                });
                lastBeatTimeRef.current = timeNow;
            }
        }
    }

    // --- MOVE NOTES ---
    notesRef.current = notesRef.current.map(note => {
        let nextY = note.y;

        if (note.type === 'HOLD') {
            if (note.isHolding) {
                if (heldLanesRef.current[note.lane]) {
                    setScore(s => s + 5); 
                    playSfx('HOLD');
                    note.length -= (currentSpeedRef.current * dtFactor);
                    nextY = HIT_ZONE_Y; 

                    if (note.length <= 0) {
                        note.hit = true; 
                        triggerHitEffect(note.lane, 'PERFECT');
                        showJudgement('PERFECT');
                    }
                } else {
                    note.missed = true; note.isHolding = false;
                    setCombo(0); showJudgement('MISS'); updateHealth(-10);
                }
            } else {
                nextY += (currentSpeedRef.current * dtFactor);
            }
        } else {
            nextY += (currentSpeedRef.current * dtFactor);
        }

        if (nextY > 110 && !note.hit && !note.missed) {
            note.missed = true;
            setCombo(0);
            showJudgement('MISS');
            updateHealth(-HP_PENALTY_MISS); // *** ใช้งาน HP_PENALTY_MISS ตรงนี้ ***
            playSfx('MISS');
        }

        return { ...note, y: nextY };
    }).filter(note => note.y < 120 && !note.hit && !note.missed); 

    requestAnimationFrame(gameLoop);
  };

  // --- INPUT HANDLER ---
  const handleInputStart = (lane: number) => {
      if (lane < 0 || lane > 3) return;
      
      heldLanesRef.current[lane] = true; 
      const laneEl = document.getElementById(`lane-${lane}`);
      laneEl?.classList.add('bg-white/20');

      if (!isPlayingRef.current) return;

      const hitNote = notesRef.current.find(n => n.lane === lane && !n.hit && !n.missed && Math.abs(n.y - HIT_ZONE_Y) < WINDOW_GOOD);

      if (hitNote) {
          if (hitNote.type === 'NORMAL') {
              const distance = Math.abs(hitNote.y - HIT_ZONE_Y);
              hitNote.hit = true;
              if (distance <= WINDOW_PERFECT) {
                  setScore(s => s + 500); setCombo(c => c + 1);
                  triggerHitEffect(lane as 0|1|2|3, 'PERFECT'); playSfx('HIT');
                  showJudgement('PERFECT'); updateHealth(HP_RECOVER_PERFECT);
              } else {
                  setScore(s => s + 200); setCombo(c => c + 1);
                  triggerHitEffect(lane as 0|1|2|3, 'GOOD'); playSfx('HIT');
                  showJudgement('GOOD'); updateHealth(1);
              }
          } 
          else if (hitNote.type === 'HOLD') {
              hitNote.isHolding = true; 
              playSfx('HIT');
              triggerHitEffect(lane as 0|1|2|3, 'GOOD');
          }
      }
  };

  const handleInputEnd = (lane: number) => {
      if (lane < 0 || lane > 3) return;
      heldLanesRef.current[lane] = false; 
      const laneEl = document.getElementById(`lane-${lane}`);
      laneEl?.classList.remove('bg-white/20');
  };

  // --- LISTENERS ---
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
        if(e.repeat) return;
        const keyMap: {[key:string]:number} = {'d':0, 'f':1, 'j':2, 'k':3};
        if(keyMap[e.key] !== undefined) handleInputStart(keyMap[e.key]);
        if(e.key === 'Escape') togglePause();
    };
    const onKeyUp = (e: KeyboardEvent) => {
        const keyMap: {[key:string]:number} = {'d':0, 'f':1, 'j':2, 'k':3};
        if(keyMap[e.key] !== undefined) handleInputEnd(keyMap[e.key]);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
    };
  }, [gameState]); // Re-bind when gamestate changes to ensure togglePause is fresh

  return (
    <div className="relative w-full h-screen bg-dark-bg overflow-hidden font-mono select-none outline-none">
      
      {/* GLOBAL FX */}
      <div className="scanlines"></div>
      <div className="noise-overlay"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#1a1a2e] via-black to-black"></div>

      {/* --- HUD --- */}
      <div className="z-50 w-full p-4 absolute top-0 flex justify-between items-center text-white pointer-events-none">
          <div className="text-left pointer-events-auto">
              <div className="flex items-center gap-4">
                  <button onClick={togglePause} className="w-10 h-10 border border-neon-blue rounded-full flex items-center justify-center text-neon-blue hover:bg-neon-blue hover:text-black">||</button>
                  <div>
                      <h1 className="font-bold tracking-widest uppercase">{song.title}</h1>
                      <p className="text-xs text-neon-blue tracking-wider">{song.difficulty}</p>
                  </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                  <div className="w-32 h-2 bg-gray-800 border border-white/20 relative">
                      <div className={`h-full transition-all duration-100 ${health > 30 ? 'bg-neon-green' : 'bg-red-500'}`} style={{ width: `${health}%` }}></div>
                  </div>
                  <span className="text-xs">{health.toFixed(0)}%</span>
              </div>
          </div>
          <div className="text-right">
              <div className="text-5xl font-black italic">{score.toLocaleString()}</div>
              <div className="text-2xl text-neon-blue">{combo} COMBO</div>
              <div className="text-xs text-gray-500 mt-1">{formatTime(currentTime)} / {formatTime(duration)}</div>
          </div>
      </div>

      {/* --- 3D STAGE --- */}
      <div className="relative w-full h-full flex justify-center items-end pb-0 perspective-[400px] overflow-hidden">
        <div className="relative w-full max-w-2xl h-[130%] transform-style-3d rotate-x-[55deg] origin-bottom flex justify-center">
            
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a1a] to-black border-x-2 border-neon-blue/30">
                <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(0,243,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,243,255,0.1)_1px,transparent_1px)] bg-[length:100px_100px] animate-grid-scroll"></div>
            </div>

            <div className="absolute w-full h-4 bg-white/20 z-10 shadow-[0_0_20px_white]" style={{ top: `${HIT_ZONE_Y}%` }}></div>

            {/* Lanes */}
            {LANES.map((key, i) => (
                <div key={i} id={`lane-${i}`} className="relative w-1/4 h-full border-r border-white/10 last:border-r-0 flex flex-col justify-end items-center pb-10">
                    <div className="text-4xl font-black text-white/20 transform rotate-x-[-55deg] mb-4">{key}</div>
                    <div className="absolute bottom-0 w-full h-full flex justify-center pointer-events-none">
                        {hitEffects.map(ef => ef.lane === i && (
                            <div key={ef.id} className="absolute bottom-[5%] w-full h-[150%] bg-gradient-to-t from-neon-blue/50 to-transparent animate-pulse"></div>
                        ))}
                    </div>
                </div>
            ))}

            {/* NOTES RENDERER */}
            {notesRef.current.map((note) => {
                if (note.hit || note.missed) return null;

                if (note.type === 'NORMAL') {
                    return (
                        <div key={note.id} className={`absolute w-[20%] h-16 rounded-sm z-30 ${LANE_COLORS[note.lane]}`}
                             style={{ top: `${note.y}%`, left: `${note.lane * 25 + 2.5}%`, transform: `translateZ(0)`, boxShadow: `0 0 20px currentColor` }}>
                            <div className="absolute top-0 left-0 w-full h-4 bg-white/70 rounded-t-sm"></div>
                        </div>
                    );
                }
                else if (note.type === 'HOLD') {
                    return (
                        <div key={note.id} className={`absolute w-[20%] z-20 bg-white/20 border-x-2 border-white/50 backdrop-blur-sm`}
                             style={{ 
                                 top: `${note.y - note.length}%`, 
                                 height: `${note.length}%`,
                                 left: `${note.lane * 25 + 2.5}%`,
                                 boxShadow: `0 0 15px ${note.lane % 2 === 0 ? '#ff00ff' : '#00f3ff'}`
                             }}>
                            <div className={`absolute bottom-0 w-full h-16 ${LANE_COLORS[note.lane]} rounded-b-sm`}>
                                <div className="absolute top-0 left-0 w-full h-4 bg-white/70"></div>
                            </div>
                            <div className="absolute top-0 w-full h-2 bg-white shadow-[0_0_10px_white]"></div>
                        </div>
                    );
                }
            })}
        </div>
      </div>

      {/* --- TOUCH ZONES (SWIPE) --- */}
      <div className="absolute inset-0 z-40 flex md:hidden">
          {[0, 1, 2, 3].map((lane) => (
              <div 
                key={lane} 
                className="flex-1 h-full active:bg-white/5"
                onTouchStart={(e) => { e.preventDefault(); handleInputStart(lane); }}
                onTouchEnd={(e) => { e.preventDefault(); handleInputEnd(lane); }}
                onTouchMove={(e) => {
                    e.preventDefault();
                    const touch = e.touches[0];
                    const width = window.innerWidth / 4;
                    const targetLane = Math.floor(touch.clientX / width);
                    if (targetLane !== lane && targetLane >= 0 && targetLane <= 3) {
                       handleInputStart(targetLane);
                    }
                }}
              ></div>
          ))}
      </div>

      {/* --- CHARACTER --- */}
      <div className="absolute top-[15%] left-1/2 -translate-x-1/2 z-10 pointer-events-none transform scale-90">
        <CyberCharacter intensity={audioIntensity} />
      </div>

      {/* Judgement */}
      {lastJudgement && gameState === 'PLAYING' && (
          <div key={lastJudgement.id} className="absolute top-[40%] left-1/2 -translate-x-1/2 z-50 pointer-events-none">
              <div className={`text-6xl font-black italic transform -skew-x-12 animate-bounce ${lastJudgement.color} drop-shadow-[0_0_30px_currentColor]`}>
                  {lastJudgement.text}
              </div>
          </div>
      )}

      {/* Overlays */}
      {gameState === 'IDLE' && (
        <div className="absolute inset-0 z-50 flex justify-center items-center bg-black/80">
          <button onClick={startNewGame} className="px-16 py-4 border-2 border-neon-blue text-neon-blue font-black text-2xl hover:bg-neon-blue hover:text-black">START MISSION</button>
        </div>
      )}
      
      {/* PAUSE MENU */}
      {gameState === 'PAUSED' && (
        <div className="absolute inset-0 z-50 flex justify-center items-center bg-black/60">
           <div className="bg-black border border-neon-blue p-10 text-center shadow-[0_0_50px_rgba(0,243,255,0.2)] w-96">
               <h2 className="text-4xl font-black text-white mb-8 glitch-text">PAUSED</h2>
               
               {/* Volume Slider */}
               <div className="mb-8">
                   <div className="flex justify-between text-neon-green mb-2 text-sm font-bold">
                       <span>VOLUME</span>
                       <span>{(volume * 100).toFixed(0)}%</span>
                   </div>
                   <input 
                       type="range" min="0" max="1" step="0.1" 
                       value={volume} onChange={handleVolumeChange} 
                       className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-neon-green"
                   />
               </div>

               <div className="flex flex-col gap-4">
                   <button onClick={togglePause} className="px-8 py-3 border border-neon-blue text-neon-blue hover:bg-neon-blue hover:text-black font-bold">RESUME</button>
                   <button onClick={onBack} className="px-8 py-3 border border-red-500 text-red-500 hover:bg-red-500 hover:text-black font-bold">ABORT</button>
               </div>
           </div>
        </div>
      )}

      {gameState === 'GAMEOVER' && (
        <div className="absolute inset-0 z-50 flex flex-col justify-center items-center bg-black/90 crt-overlay">
           <h2 className="text-8xl font-black text-red-500 mb-4 glitch-text">FAILURE</h2>
           <div className="text-2xl text-white mb-8">SCORE: {score.toLocaleString()}</div>
           <div className="flex gap-4"><button onClick={startNewGame} className="px-8 py-3 bg-white text-black font-bold">RETRY</button><button onClick={onBack} className="px-8 py-3 border border-white text-white font-bold">EXIT</button></div>
        </div>
      )}
      {gameState === 'RESULTS' && (
        <div className="absolute inset-0 z-50 flex flex-col justify-center items-center bg-black/90">
           <h2 className="text-6xl font-black text-neon-green mb-4">COMPLETE</h2>
           <div className="text-4xl text-white mb-8">SCORE: {score.toLocaleString()}</div>
           <button onClick={onBack} className="px-8 py-3 border border-white text-white font-bold">CONTINUE</button>
        </div>
      )}
      {gameState === 'COUNTDOWN' && (
        <div className="absolute inset-0 z-50 flex justify-center items-center">
           <div className="text-[150px] font-black text-white">{countdown}</div>
        </div>
      )}

      <audio 
        ref={audioRef} 
        src={song.src} 
        crossOrigin="anonymous" 
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
      />
    </div>
  );
};