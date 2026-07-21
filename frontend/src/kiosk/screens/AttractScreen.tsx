import React from 'react';
import { useKiosk } from '../context/KioskContext';

export default function AttractScreen() {
  const { setScreen, session } = useKiosk();

  return (
    <div className="screen active" style={{ display: 'flex' }}>
      {session && session.logo_path && (
        <div id="session-brand-header" style={{ position: 'fixed', top: '20px', left: 0, right: 0, textAlign: 'center', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', pointerEvents: 'none' }}>
          <img src={`/api/events/${session.id}/logo?t=${Date.now()}`} style={{ height: '40px', borderRadius: '6px', objectFit: 'contain', boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }} alt="Logo" />
          <h2 style={{ color: 'white', margin: 0, textShadow: '1px 1px 4px black', fontFamily: 'sans-serif' }}>{session.name}</h2>
        </div>
      )}
      
      <div className="attract-content">
        <h1 className="logo">PhotoLab</h1>
        <p className="tagline">AI Photo Booth</p>
        <button className="btn-start" onClick={() => setScreen('styles')}>
          Touch to Start
        </button>
      </div>
    </div>
  );
}
