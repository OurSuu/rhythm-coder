// src/components/TransitionLayer.tsx
import React from 'react';

interface Props {
  isActive: boolean; // ถ้า true คือประตูปิด (บังจอ), false คือเปิด
  loadingText?: string;
}

export const TransitionLayer: React.FC<Props> = ({ isActive, loadingText = "SYSTEM LOADING..." }) => {
  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none flex flex-col">
      
      {/* --- TOP SHUTTER --- */}
      <div 
        className={`
            shutter-panel flex-1 bg-black border-b-2 border-neon-green/50 relative overflow-hidden
            ${isActive ? 'translate-y-0' : '-translate-y-full'}
        `}
      >
          {/* Decorative Grid */}
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(0,255,159,0.05)_50%,transparent_100%)] bg-[length:50px_100%]"></div>
          
          {/* Content (Visible only when active) */}
          <div className={`absolute bottom-4 left-10 transition-opacity duration-300 ${isActive ? 'opacity-100 delay-300' : 'opacity-0'}`}>
              <div className="text-neon-green font-mono text-xs tracking-widest shutter-text">/// SYSTEM_OVERRIDE</div>
          </div>
      </div>

      {/* --- LOADING BAR (CENTER) --- */}
      <div className={`
          absolute top-1/2 left-0 w-full h-[2px] z-50 flex justify-center items-center
          transition-opacity duration-200
          ${isActive ? 'opacity-100' : 'opacity-0'}
      `}>
          {/* Loading Container */}
          <div className="bg-black border border-neon-blue px-8 py-2 flex flex-col items-center gap-1 min-w-[300px]">
              <div className="text-neon-blue font-black tracking-[0.5em] text-sm glitch-text" data-text={loadingText}>
                  {loadingText}
              </div>
              <div className="w-full h-1 bg-gray-800">
                  {/* Bar fills up when active */}
                  {isActive && <div className="h-full bg-neon-blue shadow-[0_0_10px_#00f3ff] animate-loader"></div>}
              </div>
          </div>
      </div>

      {/* --- BOTTOM SHUTTER --- */}
      <div 
        className={`
            shutter-panel flex-1 bg-black border-t-2 border-neon-green/50 relative overflow-hidden
            ${isActive ? 'translate-y-0' : 'translate-y-full'}
        `}
      >
           <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(0,255,159,0.05)_50%,transparent_100%)] bg-[length:50px_100%]"></div>
           
           <div className={`absolute top-4 right-10 transition-opacity duration-300 ${isActive ? 'opacity-100 delay-300' : 'opacity-0'}`}>
              <div className="text-neon-green font-mono text-xs tracking-widest text-right shutter-text">/// DATA_STREAMING</div>
          </div>
      </div>

    </div>
  );
};