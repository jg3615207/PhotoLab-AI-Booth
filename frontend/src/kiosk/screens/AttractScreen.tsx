import React from 'react';
import { useKiosk } from '../context/KioskContext';

export default function AttractScreen() {
  const { setScreen, session, lang, toggleLang, setRetakeCount } = useKiosk();
  const isZh = lang === 'zh-Hant';

  const handleStart = () => {
    setRetakeCount(0);
    setScreen('styles');
  };

  return (
    <div className="screen active" style={{ display: 'flex' }}>
      {session && session.logo_path && (
        <div id="session-brand-header" style={{ position: 'fixed', top: '20px', left: 0, right: 0, textAlign: 'center', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', pointerEvents: 'none' }}>
          <img src={`/api/events/${session.id}/logo?t=${Date.now()}`} style={{ height: '40px', borderRadius: '6px', objectFit: 'contain', boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }} alt="Logo" />
          <h2 style={{ color: 'white', margin: 0, textShadow: '1px 1px 4px black', fontFamily: 'sans-serif' }}>{session.name}</h2>
        </div>
      )}
      
      <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 110 }}>
        <button onClick={toggleLang} style={{ background: 'rgba(26,26,46,0.8)', border: '1px solid rgba(102,126,234,0.5)', color: '#fff', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer' }}>
          {isZh ? 'English' : '繁體中文'}
        </button>
      </div>

      <div className="attract-content" style={{ textAlign: 'center' }}>
        <h1 className="logo">PhotoLab</h1>
        <p className="tagline">{isZh ? 'AI 智能照相亭' : 'AI Photo Booth'}</p>
        <button className="btn-start" onClick={handleStart}>
          {isZh ? '觸屏開始' : 'Touch to Start'}
        </button>
      </div>
    </div>
  );
}
