import React, { useState } from 'react';
import { useKiosk } from '../context/KioskContext';

export default function JoinScreen() {
  const [sessionId, setSessionId] = useState('');
  const [error, setError] = useState('');

  const handleJoin = () => {
    if (!sessionId.trim()) return;
    window.location.href = `?session=${sessionId.trim()}`;
  };

  return (
    <div className="screen active" style={{ display: 'flex' }}>
      <div className="attract-content" style={{ background: '#1a1a2e', padding: '40px', borderRadius: '12px', border: '1px solid #333', maxWidth: '400px', width: '90%' }}>
        <h2 style={{ color: '#fff', marginBottom: '16px' }}>Welcome to PhotoLab</h2>
        <p style={{ color: '#aaa', marginBottom: '24px' }}>Please enter your Session ID to continue.</p>
        <input 
          type="text" 
          placeholder="e.g. summer-party" 
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #445', background: '#0d0d1a', color: '#fff', marginBottom: '24px', fontSize: '16px', textAlign: 'center' }} 
        />
        <button 
          className="btn-primary" 
          onClick={handleJoin}
          style={{ width: '100%', padding: '12px', fontSize: '16px', border: 'none', borderRadius: '8px', background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff', cursor: 'pointer' }}
        >
          Join Session
        </button>
        {error && <p style={{ color: '#f44', marginTop: '16px' }}>{error}</p>}
      </div>
    </div>
  );
}
