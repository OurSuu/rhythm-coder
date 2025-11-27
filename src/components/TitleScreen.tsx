// src/components/TitleScreen.tsx

import React, { useEffect, useState } from 'react';

interface Props {
  onStart: () => void;
}

export const TitleScreen: React.FC<Props> = ({ onStart }) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [bootSequence, setBootSequence] = useState(0);

  // Parallax Logic + Boot Sequence
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX / window.innerWidth) - 0.5,
        y: (e.clientY / window.innerHeight) - 0.5
      });
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Boot up animation
    const interval = setInterval(() => {
      setBootSequence(prev => (prev < 100 ? prev + 2 : 100));
    }, 20);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearInterval(interval);
    }
  }, []);

  return (
    <div
      className="relative w-full min-h-screen h-screen bg-black overflow-hidden cursor-pointer group perspective-[1000px] px-2 sm:px-0"
      onClick={onStart}
    >
      {/* --- CRT Overlays & Noise --- */}
      <div className="scanlines"></div>
      <div className="scanline-bar"></div>
      <div className="noise-overlay"></div>

      {/* --- PARALLAX CONTAINER --- */}
      <div
        className="relative w-full h-full flex flex-col justify-center items-center transition-transform duration-100 ease-out transform-style-3d"
        style={{
          transform: `rotateY(${mousePos.x * 20}deg) rotateX(${-mousePos.y * 20}deg)`
        }}
      >
        {/* Parallax Background Layers */}
        <div className="absolute inset-0 cyber-grid opacity-30 transform translate-z-[-100px] scale-150"></div>

        {/* Animated Particles */}
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="particle"
            style={{
              left: `${Math.random() * 100}%`,
              width: `${Math.random() * 4 + 1}px`,
              height: `${Math.random() * 4 + 1}px`,
              animationDuration: `${Math.random() * 5 + 3}s`,
              animationDelay: `${Math.random() * 2}s`
            }}
          ></div>
        ))}

        {/* --- MAIN CONTENT --- */}
        <div className="relative z-10 flex flex-col items-center justify-center transform translate-z-[50px] w-full max-w-full px-2 md:px-0">
          {/* Holographic/Cyber Rings */}
          <div className="absolute -inset-20 border-2 border-neon-blue/30 rounded-full animate-spin-slow pointer-events-none"></div>
          <div className="absolute -inset-24 border border-neon-pink/30 rounded-full animate-spin-slow pointer-events-none" style={{ animationDirection: 'reverse' }}></div>

          {/* Glitch Logo */}
          <h1
            className="text-6xl md:text-9xl font-black leading-none text-transparent bg-clip-text bg-gradient-to-b from-white via-gray-200 to-gray-500 drop-shadow-[0_0_20px_rgba(255,255,255,0.5)] glitch-text mix-blend-overlay max-w-full break-words text-center"
            data-text="RHYTHM"
          >
            RHYTHM
          </h1>
          <h1
            className="text-4xl md:text-7xl font-black leading-none text-neon-blue drop-shadow-[0_0_30px_#00f3ff] glitch-text tracking-widest max-w-full break-words text-center"
            data-text="CODER"
          >
            CODER
          </h1>

          {/* Boot Sequence Loader */}
          <div className="mt-12 w-full max-w-xs h-2 bg-gray-800 rounded-full overflow-hidden border border-white/20">
            <div
              className="h-full bg-neon-green shadow-[0_0_10px_#00ff9f]"
              style={{ width: `${bootSequence}%` }}
            ></div>
          </div>
          <p className="mt-2 text-xs text-neon-green font-mono">
            SYSTEM LOADING... {bootSequence}%
          </p>

          {/* Start Button */}
          {bootSequence === 100 && (
            <div className="mt-16 animate-pulse w-full flex justify-center">
              <div className="px-8 py-2 bg-white/10 border border-white/50 backdrop-blur-md text-white font-bold tracking-[0.5em] hover:bg-white hover:text-black transition-all transform hover:scale-110 shadow-[0_0_30px_rgba(255,255,255,0.2)] max-w-xs text-center text-sm md:text-base">
                CLICK TO START
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Decorative Corners */}
      <div className="absolute top-4 left-4 w-16 h-16 md:top-10 md:left-10 md:w-32 md:h-32 border-t-4 border-l-4 border-white/20"></div>
      <div className="absolute bottom-4 right-4 w-16 h-16 md:bottom-10 md:right-10 md:w-32 md:h-32 border-b-4 border-r-4 border-white/20"></div>
    </div>
  );
};