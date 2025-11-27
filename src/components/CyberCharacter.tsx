// src/components/CyberCharacter.tsx
import React from 'react';

interface Props {
  intensity: number; // รับค่าความแรงของเพลง (0-255)
}

export const CyberCharacter: React.FC<Props> = ({ intensity }) => {
  // แปลงความดังเป็นขนาด (Scale) เพื่อให้ตัวละคร "เต้น"
  const scale = 1 + (intensity / 255) * 0.2;
  
  // ถ้าเสียงดังมาก ให้เปลี่ยนสีเงา
  const isHighIntensity = intensity > 200;
  const shadowColor = isHighIntensity ? '#ff00ff' : '#00f3ff';

  return (
    <div 
      className="relative w-32 h-32 flex justify-center items-center transition-transform duration-75 ease-out"
      style={{ transform: `scale(${scale})` }}
    >
      {/* 1. ส่วนหัว (ใช้ Clip-path ตัดเป็นทรง 6 เหลี่ยม) */}
      <div className="w-20 h-24 bg-slate-800 relative z-10 flex flex-col items-center pt-6 overflow-hidden"
           style={{ 
             clipPath: 'polygon(20% 0%, 80% 0%, 100% 20%, 100% 80%, 80% 100%, 20% 100%, 0% 80%, 0% 20%)',
             boxShadow: `inset 0 0 20px ${shadowColor}`
           }}>
        
        {/* ตา (Visor) */}
        <div className={`w-16 h-4 ${isHighIntensity ? 'bg-red-500' : 'bg-neon-blue'} rounded-sm animate-pulse mb-4 shadow-[0_0_10px_currentColor]`} />
             
        {/* ปาก (Audio Visualizer จำลอง) */}
        <div className="flex gap-1 h-4 items-end">
            {[1,2,3,4].map(i => (
                <div key={i} 
                     className="w-1 bg-white transition-all duration-75" 
                     // สุ่มความสูงปากตามเสียง
                     style={{ height: `${Math.min(100, (intensity/255) * 100 * Math.random() + 20)}%` }}>
                </div>
            ))}
        </div>
      </div>

      {/* 2. หูฟัง / วงแหวนด้านหลัง */}
      <div className="absolute w-32 h-32 border-4 border-neon-blue rounded-full opacity-60 border-t-transparent animate-spin-slow"></div>
      
      {/* 3. เอฟเฟกต์ Glow รอบตัว */}
      <div className="absolute w-full h-full rounded-full opacity-30 blur-xl"
           style={{ backgroundColor: shadowColor }}></div>
    </div>
  );
};