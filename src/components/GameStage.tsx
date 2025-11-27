// src/components/GameStage.tsx
import React, { useEffect, useRef, useState } from 'react';
import { AudioController } from '../utils/AudioAnalyzer';
import { CyberCharacter } from './CyberCharacter';
import type { Song } from './SongMenu';

// --- TYPES ---
type NoteType = 'NORMAL' | 'HOLD' | 'RAPID';

interface Note {
  id: number;
  lane: 0 | 1 | 2 | 3;
  y: number;
  type: NoteType;
  length: number;       // ความยาวสำหรับ Hold Note
  requiredHits: number; // จำนวนครั้งที่ต้องกดสำหรับ Rapid Note
  currentHits: number;  // จำนวนที่กดไปแล้ว
  isHolding: boolean;   // กำลังกดค้างอยู่ไหม
  hit: boolean;         // โดนกดหรือยัง (สำหรับ Normal)
  missed: boolean;
}

type JudgementType = 'PERFECT' | 'GOOD' | 'BAD' | 'MISS';
interface Judgement { text: JudgementType; color: string; id: number; }
interface HitEffect { id: number; lane: 0 | 1 | 2 | 3; type: 'PERFECT' | 'GOOD' | 'BAD'; }
interface GameProps { song: Song; onBack: () => void; }

// --- CONSTANTS ---
const LANES = ['D', 'F', 'J', 'K'];
const LANE_COLORS = [
    'bg-neon-pink/90 shadow-[0_0_20px_#ff00ff]', 
    'bg-neon-blue/90 shadow-[0_0_20px_#00f3ff]', 
    'bg-neon-blue/90 shadow-[0_0_20px_#00f3ff]', 
    'bg-neon-pink/90 shadow-[0_0_20px_#ff00ff]'
];

const HIT_ZONE_Y = 85; 
const MAX_HP = 100;
const HP_PENALTY_MISS = 10; 
const HP_RECOVER_PERFECT = 2; 

function formatTime(sec: number) {
  if (isNaN(sec)) return "00:00";
  const min = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${min.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export const GameStage: React.FC<GameProps> = ({ song, onBack }) => {
  // State
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

  // Refs
  const isPlayingRef = useRef(false);
  const notesRef = useRef<Note[]>([]); 
  const heldLanesRef = useRef<boolean[]>([false, false, false, false]); // เก็บสถานะปุ่มที่ถูกกดค้างไว้
  const audioRef = useRef<HTMLAudioElement>(null);
  const controllerRef = useRef<AudioController>(new AudioController());
  
  const lastBeatTimeRef = useRef<number>(0);
  const currentSpeedRef = useRef(0.2); 
  const lastFrameTimeRef = useRef<number>(0);

  const START_SPEED = 0.2; 
  const WINDOW_GOOD = 15; // Hit window

  // --- AUDIO SFX ---
  const playSfx = (type: 'HIT' | 'MISS' | 'HOLD') => {
      // ลดเสียง Spam หน่อยถ้าเป็น Hold
      if (type === 'HOLD' && Math.random() > 0.3) return; 
      const sfxUrl = type === 'HIT' || type === 'HOLD' ? '/audio/hit.mp3' : '/audio/miss.mp3';
      const audio = new Audio(sfxUrl);
      audio.volume = type === 'HOLD' ? 0.2 : 0.5; 
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

    // Dynamic Speed
    const baseSpeed = song.difficulty === 'HARD' ? 0.4 : 0.3;
    const targetSpeed = baseSpeed + (analysis.bass / 255);
    currentSpeedRef.current += (targetSpeed - currentSpeedRef.current) * 0.05 * dtFactor;

    // --- SPAWN LOGIC ---
    const timeNow = Date.now();
    if (timeNow - lastBeatTimeRef.current > (60000 / song.bpm / (analysis.bass > 200 ? 2 : 1)) || timeNow - lastBeatTimeRef.current > 1200) {
        const spawnThreshold = song.difficulty === 'HARD' ? 140 : 160;
        
        if (analysis.bass > spawnThreshold || Math.random() > 0.4) {
            const lane = Math.floor(Math.random() * 4) as 0|1|2|3;
            const rand = Math.random();
            
            let type: NoteType = 'NORMAL';
            let length = 0;
            let requiredHits = 0;

            // สุ่มประเภทโน้ต
            if (rand > 0.85) {
                type = 'HOLD';
                length = 30 + Math.random() * 50; // ความยาวสุ่ม
            } else if (rand > 0.75 && song.difficulty === 'HARD') {
                type = 'RAPID';
                requiredHits = 5; // ต้องกด 5 ที
            }

            notesRef.current.push({
                id: timeNow + Math.random(),
                lane, y: -20, type, length, requiredHits,
                currentHits: 0, isHolding: false, hit: false, missed: false
            });
            lastBeatTimeRef.current = timeNow;
        }
    }

    // --- MOVE & PROCESS NOTES ---
    notesRef.current = notesRef.current.map(note => {
        let nextY = note.y;

        // 1. RAPID NOTE LOGIC: หยุดรอที่เส้น
        if (note.type === 'RAPID' && !note.hit && !note.missed) {
            if (note.y < HIT_ZONE_Y) {
                nextY += (currentSpeedRef.current * dtFactor);
            } else {
                // หยุดที่เส้น รอให้กดครบ
                nextY = HIT_ZONE_Y;
                // ถ้าอยู่นานเกินไป (เช่น 2 วิ) ให้ถือว่า Miss
                // (ในโค้ดจริงควรจับเวลา แต่ขอละไว้เพื่อความง่าย)
            }
        } 
        // 2. HOLD NOTE LOGIC:
        else if (note.type === 'HOLD') {
            if (note.isHolding) {
                // ถ้ากดค้างอยู่ ให้ลดความยาวลงเรื่อยๆ (เหมือนกินโน้ต)
                // หรือขยับ y ลง แต่ตรึงหัวไว้ที่เส้น (Visual Trick)
                if (heldLanesRef.current[note.lane]) {
                    // กำลังกดอยู่: ได้คะแนนเรื่อยๆ
                    setScore(s => s + 10);
                    playSfx('HOLD'); // เสียงรัวๆ
                    
                    // ลดความยาว (Visual)
                    note.length -= (currentSpeedRef.current * dtFactor);
                    nextY = HIT_ZONE_Y; // ตรึงหัวไว้ที่เส้น

                    if (note.length <= 0) {
                        note.hit = true; // หมดแล้ว = ชนะ
                        triggerHitEffect(note.lane, 'PERFECT');
                        showJudgement('PERFECT');
                    }
                } else {
                    // ปล่อยมือกลางคัน = MISS
                    note.missed = true;
                    note.isHolding = false;
                    setCombo(0); showJudgement('MISS');
                }
            } else {
                nextY += (currentSpeedRef.current * dtFactor);
            }
        }
        // 3. NORMAL NOTE
        else {
            nextY += (currentSpeedRef.current * dtFactor);
        }

        // Check Miss (หลุดจอ)
        if (nextY > 110 && !note.hit && !note.missed) {
            note.missed = true;
            setCombo(0);
            showJudgement('MISS');
            setHealth(h => Math.max(0, h - HP_PENALTY_MISS));
            playSfx('MISS');
        }

        return { ...note, y: nextY };
    }).filter(note => note.y < 120 && !note.hit && !note.missed); // ลบเมื่อจบ

    requestAnimationFrame(gameLoop);
  };

  // --- INPUT HANDLER (Unified) ---
  const handleInputStart = (lane: number) => {
      if (lane < 0 || lane > 3) return;
      
      // Update Held Status
      heldLanesRef.current[lane] = true; 

      // Visual
      const laneEl = document.getElementById(`lane-${lane}`);
      laneEl?.classList.add('bg-white/20');

      if (!isPlayingRef.current) return;

      // Find Target Note
      const hitNote = notesRef.current.find(n => n.lane === lane && !n.hit && !n.missed && Math.abs(n.y - HIT_ZONE_Y) < WINDOW_GOOD);

      if (hitNote) {
          if (hitNote.type === 'NORMAL') {
              hitNote.hit = true;
              setScore(s => s + 500);
              setCombo(c => c + 1);
              triggerHitEffect(lane as 0|1|2|3, 'PERFECT');
              playSfx('HIT');
              setHealth(h => Math.min(MAX_HP, h + HP_RECOVER_PERFECT));
          } 
          else if (hitNote.type === 'RAPID') {
              hitNote.currentHits++;
              playSfx('HIT');
              triggerHitEffect(lane as 0|1|2|3, 'GOOD');
              if (hitNote.currentHits >= hitNote.requiredHits) {
                  hitNote.hit = true;
                  setScore(s => s + 1000);
                  setCombo(c => c + 1);
                  showJudgement('PERFECT');
              }
          }
          else if (hitNote.type === 'HOLD') {
              hitNote.isHolding = true; // เริ่มเข้าโหมด Hold
              playSfx('HIT');
          }
      }
  };

  const handleInputEnd = (lane: number) => {
      if (lane < 0 || lane > 3) return;
      heldLanesRef.current[lane] = false; // ปล่อยปุ่ม

      const laneEl = document.getElementById(`lane-${lane}`);
      laneEl?.classList.remove('bg-white/20');
  };

  // --- LISTENERS ---
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
        if(e.repeat) return;
        const keyMap: {[key:string]:number} = {'d':0, 'f':1, 'j':2, 'k':3};
        if(keyMap[e.key] !== undefined) handleInputStart(keyMap[e.key]);
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
  }, []);

  // --- CONTROLS ---
  const startNewGame = () => {
    // Reset Logic...
    notesRef.current = []; setScore(0); setCombo(0); setHealth(MAX_HP);
    if(audioRef.current) { controllerRef.current.setup(audioRef.current); audioRef.current.currentTime = 0; }
    setGameState('COUNTDOWN');
    let c = 3; setCountdown(3);
    const t = setInterval(() => { c--; if(c>0) setCountdown(c); else { clearInterval(t); setGameState('PLAYING'); isPlayingRef.current = true; audioRef.current?.play(); requestAnimationFrame(gameLoop); } }, 800);
  };

  return (
    <div className="relative w-full h-screen bg-dark-bg overflow-hidden font-mono select-none outline-none">
      
      {/* GLOBAL FX */}
      <div className="scanlines"></div>
      <div className="noise-overlay"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#1a1a2e] via-black to-black"></div>

      {/* --- HUD --- */}
      <div className="z-50 w-full p-4 absolute top-0 flex justify-between items-center text-white pointer-events-none">
          <div className="text-left">
              <h1 className="font-bold tracking-widest">{song.title}</h1>
              <div className="w-48 h-3 bg-gray-900 border border-white/50 skew-x-[-10deg] mt-2 relative overflow-hidden">
                  <div className={`h-full transition-all duration-100 ${health > 30 ? 'bg-neon-green' : 'bg-red-500'}`} style={{ width: `${health}%` }}></div>
              </div>
          </div>
          <div className="text-right">
              <div className="text-5xl font-black italic">{score.toLocaleString()}</div>
              <div className="text-2xl text-neon-blue">{combo} COMBO</div>
          </div>
      </div>

      {/* --- 3D STAGE --- */}
      <div className="relative w-full h-full flex justify-center items-end pb-0 perspective-[400px] overflow-hidden">
        <div className="relative w-full max-w-2xl h-[130%] transform-style-3d rotate-x-[55deg] origin-bottom flex justify-center">
            
            {/* Floor & Grid */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a1a] to-black border-x-2 border-neon-blue/30">
                <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(0,243,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,243,255,0.1)_1px,transparent_1px)] bg-[length:100px_100px] animate-grid-scroll"></div>
            </div>

            {/* Hit Line */}
            <div className="absolute w-full h-4 bg-white/20 z-10 shadow-[0_0_20px_white]" style={{ top: `${HIT_ZONE_Y}%` }}></div>

            {/* Lanes */}
            {LANES.map((key, i) => (
                <div key={i} id={`lane-${i}`} className="relative w-1/4 h-full border-r border-white/10 last:border-r-0 flex flex-col justify-end items-center pb-10">
                    <div className="text-4xl font-black text-white/20 transform rotate-x-[-55deg] mb-4">{key}</div>
                    {/* Hit Effect */}
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

                // --- 1. NORMAL NOTE ---
                if (note.type === 'NORMAL') {
                    return (
                        <div key={note.id} className={`absolute w-[20%] h-12 rounded-sm z-30 ${LANE_COLORS[note.lane]}`}
                             style={{ top: `${note.y}%`, left: `${note.lane * 25 + 2.5}%`, transform: `translateZ(0)`, boxShadow: `0 0 20px currentColor` }}>
                            <div className="absolute top-0 left-0 w-full h-4 bg-white/70 rounded-t-sm"></div>
                        </div>
                    );
                }
                // --- 2. HOLD NOTE (LONG BAR) ---
                else if (note.type === 'HOLD') {
                    return (
                        <div key={note.id} className={`absolute w-[20%] z-20 bg-white/20 border-x-2 border-white/50 backdrop-blur-sm`}
                             style={{ 
                                 top: `${note.y - note.length}%`, 
                                 height: `${note.length}%`,
                                 left: `${note.lane * 25 + 2.5}%`,
                                 boxShadow: `0 0 15px ${note.lane % 2 === 0 ? '#ff00ff' : '#00f3ff'}`
                             }}>
                            {/* Head */}
                            <div className={`absolute bottom-0 w-full h-12 ${LANE_COLORS[note.lane]} rounded-b-sm`}></div>
                            {/* Tail */}
                            <div className="absolute top-0 w-full h-2 bg-white"></div>
                        </div>
                    );
                }
                // --- 3. RAPID NOTE (CIRCLE) ---
                else if (note.type === 'RAPID') {
                    return (
                        <div key={note.id} className="absolute w-[20%] aspect-square z-40 flex justify-center items-center"
                             style={{ top: `${note.y}%`, left: `${note.lane * 25 + 2.5}%` }}>
                            <div className="w-full h-full rounded-full bg-yellow-400 border-4 border-white animate-pulse shadow-[0_0_30px_gold] flex justify-center items-center text-black font-black text-2xl">
                                {note.requiredHits - note.currentHits}
                            </div>
                        </div>
                    );
                }
            })}
        </div>
      </div>

      {/* --- TOUCH ZONES (SWIPE SUPPORT) --- */}
      <div className="absolute inset-0 z-40 flex md:hidden">
          {[0, 1, 2, 3].map((lane) => (
              <div 
                key={lane} 
                className="flex-1 h-full active:bg-white/5"
                onTouchStart={(e) => { e.preventDefault(); handleInputStart(lane); }}
                onTouchEnd={(e) => { e.preventDefault(); handleInputEnd(lane); }}
                // เพิ่ม onTouchMove เพื่อรองรับการลากนิ้วข้ามเลน (Swipe)
                onTouchMove={(e) => {
                    e.preventDefault();
                    const touch = e.touches[0];
                    const width = window.innerWidth / 4;
                    const targetLane = Math.floor(touch.clientX / width);
                    // ถ้าลากไปเลนใหม่ ให้ trigger เลนนั้น
                    if (targetLane !== lane && targetLane >= 0 && targetLane <= 3) {
                       // Logic นี้อาจต้องปรับจูนให้ไม่ spam input รัวเกินไป
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

      {/* Overlays (Start, Game Over, etc.) */}
      {gameState === 'IDLE' && (
        <div className="absolute inset-0 z-50 flex justify-center items-center bg-black/80">
          <button onClick={startNewGame} className="px-16 py-4 border-2 border-neon-blue text-neon-blue font-black text-2xl hover:bg-neon-blue hover:text-black">START MISSION</button>
        </div>
      )}
      {gameState === 'GAMEOVER' && (
        <div className="absolute inset-0 z-50 flex flex-col justify-center items-center bg-black/90 crt-overlay">
           <h2 className="text-8xl font-black text-red-500 mb-4 glitch-text">FAILURE</h2>
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

      <audio ref={audioRef} src={song.src} crossOrigin="anonymous" />
    </div>
  );
};