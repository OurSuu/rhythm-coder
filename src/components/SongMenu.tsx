// src/components/SongMenu.tsx
import React, { useState, useEffect, useRef } from 'react';

export interface Song {
  id: number;
  title: string;
  artist: string;
  bpm: number;
  src: string;
  difficulty: 'EASY' | 'HARD';
}

interface Props {
  songs: Song[];
  onSelect: (song: Song) => void;
  onBack?: () => void;
  bgmRef: React.RefObject<HTMLAudioElement>;
}

const BGM_PLAYLIST = [
  '/audio/menu-bgm1.mp3',
  '/audio/menu-bgm2.mp3',
];

export const SongMenu: React.FC<Props> = ({ songs, onSelect, onBack, bgmRef }) => {
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  // For parallax/3D
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // For BGM fading control
  const fadeIntervalRef = useRef<number | null>(null);

  // For preview audio element (per-component, hidden)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // --- 3D Tilt Parallax ---
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX / window.innerWidth - 0.5),
        y: (e.clientY / window.innerHeight - 0.5)
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // --- BGM Fade on hover logic ---
  useEffect(() => {
    const bgm = bgmRef.current;
    const clearFade = () => {
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
      }
    };

    // When hover: fade main BGM down, play preview
    if (hoveredId !== null) {
      clearFade();
      // Fade out main App BGM
      if (bgm && !bgm.paused) {
        fadeIntervalRef.current = window.setInterval(() => {
          if (bgm.volume > 0.05) {
            bgm.volume = Math.max(0, bgm.volume - 0.03); // fade slower
          } else {
            bgm.volume = 0;
            bgm.pause();
            clearFade();
          }
        }, 60);
      }
      // --- PLAY preview audio ---
      const hoveredSong = songs.find(s => s.id === hoveredId);
      if (hoveredSong && previewAudioRef.current) {
        // Load and play the song's preview
        previewAudioRef.current.src = hoveredSong.src;
        previewAudioRef.current.currentTime = 0;
        previewAudioRef.current.volume = 0.93;
        previewAudioRef.current.play().catch(() => {});
      }
    } else {
      // On unhover: fade App BGM back in, stop preview
      clearFade();
      // Stop preview audio
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current.currentTime = 0;
        previewAudioRef.current.src = '';
      }
      // Resume bgm
      if (bgm) {
        if (bgm.paused) {
          bgm.volume = 0;
          bgm.play().catch(() => { /* ignore error if replay fails */ });
        }
        fadeIntervalRef.current = window.setInterval(() => {
          if (bgm.volume < 0.4) {
            bgm.volume = Math.min(0.4, bgm.volume + 0.015);
          } else {
            bgm.volume = 0.4;
            clearFade();
          }
        }, 60);
      }
    }
    return () => { clearFade(); };
  }, [hoveredId, songs, bgmRef]);

  // Unload on destroy
  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current.src = '';
      }
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    };
  }, []);

  const handleBack = () => {
    if (onBack) onBack(); else window.location.reload();
  };

  // Styles remain, with responsive tweak for hiding the disc on small screens
  const styleSheet = `
    @keyframes float-up {
      0% { transform: translateY(0) scale(1) translateZ(var(--z)); opacity: 0.7;}
      40% { opacity: 1;}
      100% { transform: translateY(-120vh) scale(1.2) translateZ(var(--z)); opacity: 0.2;}
    }
    .scanlines {
      pointer-events: none;
      position: absolute;
      inset: 0;
      z-index: 40;
      background: repeating-linear-gradient(transparent 0px,transparent 2px,rgba(255,255,255,0.04) 2px,rgba(255,255,255,0.04) 4px);
      mix-blend-mode: overlay;
    }
    .noise-overlay {
      pointer-events: none;position: absolute;inset:0;z-index:39;background-image:url("data:image/svg+xml,%3Csvg width='40' height='80' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.08' numOctaves='2' result='t'/%3E%3CfeColorMatrix type='saturate' values='0' result='c'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='table' tableValues='0 0 0.18 0.12 0 0.08 0.19 0 0.1 0'/%3E%3C/feComponentTransfer%3E%3CfeMerge%3E%3CfeMergeNode in='c'/%3E%3CfeMergeNode in='SourceGraphic'/%3E%3C/feMerge%3E%3C/filter%3E%3Crect width='40' height='80' filter='url(%23n)' /%3E%3C/svg%3E");
      opacity: 0.28;
      mix-blend-mode: overlay;
      animation: noise-move 4s steps(8) infinite;
    }
    @keyframes noise-move {
      0% { background-position: 0 0;}
      100% { background-position: 30px 15px;}
    }
    .glitch-text {
      position: relative;
      color: #fff;
    }
    .glitch-text::before, .glitch-text::after {
      content: attr(data-text);
      position: absolute;
      left: 0; top: 0; width: 100%; height: 100%;
      opacity: 0.5;
      pointer-events: none;
    }
    .glitch-text::before {
      color: #0ff;
      transform: translate(2px, 0);
      mix-blend-mode: lighten;
      z-index:1;
    }
    .glitch-text::after {
      color: #f0f;
      transform: translate(-2px, 1.5px);
      mix-blend-mode: lighten;
      z-index:2;
    }
    .animate-spin-slow {
      animation: spin 4.5s linear infinite;
    }
    @keyframes spin { 
      100% { transform: rotate(360deg);} 
    }
    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
    @media (max-width: 767px) {
      .hide-on-mobile { display: none !important; }
    }
  `;

  // Responsive layout: vertical stacking & hide 3D disc on small screens
  return (
    <div className="relative w-full h-screen bg-black overflow-hidden flex justify-center items-center font-mono perspective-[1000px]">
      <style>{styleSheet}</style>
      {/* Hidden audio for previews */}
      <audio
        ref={previewAudioRef}
        style={{ display: 'none' }}
        preload="auto"
      />
      {/* GLOBAL EFFECTS */}
      <div className="scanlines"></div>
      <div className="noise-overlay"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#1a1a2e] via-black to-black"></div>
      {/* Floating digital particles */}
      {Array.from({ length: 30 }).map((_, i) => {
        const left = Math.random() * 100;
        const top = Math.random() * 100;
        const size = Math.random() * 3 + 2;
        const d = Math.random() * 140 - 70;
        const dur = Math.random() * 6 + 5;
        return (
          <div
            key={i}
            className="particle absolute bg-neon-blue rounded-full opacity-60 pointer-events-none"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: `${size}px`,
              height: `${size}px`,
              filter: 'blur(1.5px)',
              zIndex: 2,
              '--z': `${d}px`,
              animation: `float-up ${dur}s linear infinite`,
              animationDelay: `${-dur * Math.random()}s`
            } as any}
          ></div>
        );
      })}

      {/* BACK BUTTON */}
      <button
        onClick={handleBack}
        className="absolute top-8 left-8 z-50 px-6 py-2 border border-white/30 text-white/50 hover:text-white hover:border-white hover:bg-white/10 transition-all font-mono text-xs tracking-widest backdrop-blur-md"
      >
        [ ESC ] SYSTEM RETURN
      </button>

      {/* 3D UNIFIED CONTAINER */}
      <div
        className={`
          relative w-full max-w-7xl h-[80vh] flex gap-10 items-center justify-center transition-transform duration-100 ease-out transform-style-3d 
          flex-col md:flex-row
        `}
        style={{
          transform: `rotateY(${mousePos.x * 10}deg) rotateX(${-mousePos.y * 10}deg) translateZ(0)`
        }}
      >
        {/* 3D DISC - Floating panel, hidden on mobile */}
        <div className="hide-on-mobile hidden md:flex flex-col items-center justify-center w-1/3 h-full transform translate-z-[50px]">
          {/* Blue holographic "cyber" ring */}
          <div className="absolute w-[500px] h-[500px] border border-neon-blue/20 rounded-full animate-spin-slow pointer-events-none"></div>
          <div className="relative transition-all duration-500 transform hover:scale-105">
            {/* Rotating Vinyl */}
            <div className={`relative w-80 h-80 rounded-full bg-black border-4 border-gray-800 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex justify-center items-center ${hoveredId ? 'animate-spin-slow' : ''}`}>
              <div className="absolute inset-0 rounded-full bg-[repeating-radial-gradient(#333_0px,#111_2px,#111_4px)] opacity-50"></div>
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-neon-pink to-purple-600 flex justify-center items-center shadow-[0_0_30px_#ff00ff]">
                <div className="w-3 h-3 bg-black rounded-full"></div>
              </div>
            </div>
            {/* Song Info Overlay */}
            <div className={`
              absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 text-center
              transition-all duration-300
              ${hoveredId ? 'opacity-100 scale-110 translate-z-[20px]' : 'opacity-50 scale-100 blur-sm'}
            `}>
              {hoveredId ? (
                <div className="bg-black/80 backdrop-blur-md p-6 border border-white/10 rounded-lg shadow-2xl">
                  <h2 className="text-3xl font-black text-white leading-none mb-2 glitch-text uppercase" data-text={songs.find(s => s.id === hoveredId)?.title}>
                    {songs.find(s => s.id === hoveredId)?.title}
                  </h2>
                  <p className="text-neon-blue tracking-[0.5em] text-xs">{songs.find(s => s.id === hoveredId)?.artist}</p>
                  <div className="mt-4 flex justify-center gap-4 text-xs font-bold text-gray-500">
                    <span>BPM {songs.find(s => s.id === hoveredId)?.bpm}</span>
                    <span>•</span>
                    <span className={songs.find(s => s.id === hoveredId)?.difficulty === 'HARD' ? 'text-red-500' : 'text-neon-green'}>
                      {songs.find(s => s.id === hoveredId)?.difficulty}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-white/20 font-bold tracking-widest text-sm">HOVER TO PREVIEW</div>
              )}
            </div>
          </div>
        </div>
        {/* SONG LIST */}
        <div className="w-full md:w-1/2 h-full overflow-y-auto scrollbar-hide pr-4 relative transform translate-z-[20px]">
          <div className="sticky top-0 bg-gradient-to-b from-black to-transparent pb-10 pt-4 z-20 mb-4 border-b border-neon-green/30">
            <h1 className="text-5xl font-black text-white glitch-text" data-text="SELECT_TRACK">SELECT_TRACK</h1>
            <p className="text-neon-green text-xs font-mono mt-2">/// SECURE CONNECTION ESTABLISHED</p>
          </div>
          <div className="space-y-6 pb-20">
            {songs.map((song, index) => (
              <div
                key={song.id}
                onMouseEnter={() => setHoveredId(song.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => onSelect(song)}
                className={`
                  group relative w-full p-6 cursor-pointer border transition-all duration-300 transform-style-3d
                  ${hoveredId === song.id 
                      ? 'bg-white/10 border-neon-pink scale-105 translate-x-4 z-50' 
                      : 'bg-white/5 border-white/10 hover:border-white/30 hover:bg-white/10'}
                `}
                style={{
                  clipPath: 'polygon(0 0, 100% 0, 100% 85%, 95% 100%, 0 100%)'
                }}
              >
                {/* Glowing Bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 transition-all duration-300 ${hoveredId === song.id ? 'bg-neon-pink shadow-[0_0_20px_#ff00ff]' : 'bg-transparent'}`}></div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className={`text-2xl font-black transition-colors ${hoveredId === song.id ? 'text-neon-pink' : 'text-gray-600'}`}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <h3 className={`text-xl font-bold uppercase transition-colors ${hoveredId === song.id ? 'text-white' : 'text-gray-400'}`}>
                        {song.title}
                      </h3>
                      <p className="text-xs text-gray-500 tracking-wider">{song.artist}</p>
                    </div>
                  </div>
                  <div className={`
                    px-3 py-1 text-[10px] font-bold border rounded
                    ${song.difficulty === 'HARD' ? 'border-red-500 text-red-500' : 'border-neon-green text-neon-green'}
                    ${hoveredId === song.id ? 'bg-white/10' : ''}
                  `}>
                    {song.difficulty}
                  </div>
                </div>
                <div className="absolute inset-0 bg-neon-blue/5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};