// src/App.tsx
import { useState, useRef, useEffect } from 'react';
import { GameStage } from './components/GameStage';
import { SongMenu } from './components/SongMenu';
import type { Song } from './components/SongMenu';
import { TitleScreen } from './components/TitleScreen';
import { TransitionLayer } from './components/TransitionLayer'; // Import ตัวใหม่

// Mock Data
const SONG_LIST: Song[] = [
  { id: 1, title: 'I Hate Me', artist: 'Lily.μ', bpm: 128, src: '/song/FirstMusic.mp3', difficulty: 'EASY' },
  { id: 2, title: 'Miuri', artist: 'Roce', bpm: 150, src: '/song/SecondMusic.mp3', difficulty: 'HARD' },
  { id: 3, title: 'NOTHING', artist: 'NULL_POINTER', bpm: 175, src: '/song/music.mp3', difficulty: 'HARD' },
];

const BGM_PLAYLIST = [
    '/audio/menu-bgm1.mp3',
    '/audio/menu-bgm2.mp3',
];

type ScreenState = 'TITLE' | 'MENU' | 'GAME';

function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenState>('TITLE');
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);

  // --- TRANSITION STATE ---
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [loadingText, setLoadingText] = useState("LOADING...");

  // --- GLOBAL BGM SYSTEM ---
  const bgmRef = useRef<HTMLAudioElement>(null);
  const [currentBgmSrc, setCurrentBgmSrc] = useState(() => {
     if (BGM_PLAYLIST.length === 0) return '/music.mp3'; 
     return BGM_PLAYLIST[Math.floor(Math.random() * BGM_PLAYLIST.length)];
  });

  const playNextRandomBgm = () => {
      if (BGM_PLAYLIST.length <= 1) return;
      let nextIndex;
      let nextSrc;
      do {
          nextIndex = Math.floor(Math.random() * BGM_PLAYLIST.length);
          nextSrc = BGM_PLAYLIST[nextIndex];
      } while (nextSrc === currentBgmSrc);
      setCurrentBgmSrc(nextSrc);
  };

  useEffect(() => {
      if (bgmRef.current && currentScreen !== 'GAME') {
          bgmRef.current.volume = 0.5;
          bgmRef.current.play().catch(() => {});
      }
  }, [currentBgmSrc, currentScreen]); // BUG: Should retrigger on screen change for correct BGM play/resume.

  // === FUNCTION เปลี่ยนหน้าพร้อม Animation ===
  const navigateTo = (screen: ScreenState, song: Song | null = null, customText: string = "LOADING...") => {
      if (isTransitioning) return; // กันกดรัวๆ

      // 1. เริ่ม Animation ปิดประตู
      setLoadingText(customText);
      setIsTransitioning(true);

      // 2. รอเวลา (600ms ให้ตรงกับ CSS transition) แล้วค่อยเปลี่ยนหน้า
      setTimeout(() => {
          setSelectedSong(song);
          setCurrentScreen(screen);
          
          // Logic หยุด/เล่นเพลง ตามหน้า
          if (screen === 'GAME') {
              if (bgmRef.current) bgmRef.current.pause();
          } else {
              if (bgmRef.current) {
                  bgmRef.current.volume = 0.5;
                  bgmRef.current.play().catch(() => {});
              }
          }

          // 3. รออีกนิด (โหลดเสร็จ) แล้วเปิดประตูออก
          setTimeout(() => {
              setIsTransitioning(false);
          }, 800); // รอ Loader วิ่งเกือบเสร็จค่อยเปิด

      }, 800); // ระยะเวลาประตูปิด + Loader วิ่ง
  };


  // --- HANDLERS ที่เปลี่ยนมาใช้ navigateTo ---
  
  const handleStart = () => {
    // เริ่ม BGM ถ้ายังไม่เริ่ม
    if (bgmRef.current && bgmRef.current.paused) {
        bgmRef.current.volume = 0.5;
        bgmRef.current.play().catch(() => {});
    }
    navigateTo('MENU', null, "INITIALIZING...");
  };

  const handleSongSelect = (song: Song) => {
    navigateTo('GAME', song, "SYNCING BEAT...");
  };

  const handleBackToMenu = () => {
    navigateTo('MENU', null, "DISCONNECTING...");
  };

  const handleBackToTitle = () => {
    navigateTo('TITLE', null, "LOGGING OUT...");
  };

  const shouldLoop = BGM_PLAYLIST.length <= 1;

  return (
    <>
      {/* --- TRANSITION OVERLAY (อยู่บนสุดเสมอ) --- */}
      <TransitionLayer isActive={isTransitioning} loadingText={loadingText} />

      {/* --- GLOBAL AUDIO --- */}
      <audio 
          ref={bgmRef} 
          src={currentBgmSrc} 
          loop={shouldLoop} 
          onEnded={shouldLoop ? undefined : playNextRandomBgm} 
      />

      {/* --- SCREENS --- */}
      {/* ใช้ div ซ่อนหน้าเก่าแทนการ unmount ทันที เพื่อให้ไม่กระพริบตอนประตูปิด (Optional, แต่ React สลับไวอยู่แล้ว) */}
      
      {currentScreen === 'TITLE' && (
        <TitleScreen onStart={handleStart} />
      )}

      {currentScreen === 'MENU' && (
        <SongMenu 
          songs={SONG_LIST} 
          onSelect={handleSongSelect} 
          onBack={handleBackToTitle}
          bgmRef={bgmRef as React.RefObject<HTMLAudioElement>} 
        />
      )}

      {currentScreen === 'GAME' && selectedSong && (
        <GameStage 
          song={selectedSong} 
          onBack={handleBackToMenu} 
        />
      )}
    </>
  );
}

export default App;