import React, { useEffect, useState } from 'react';
import { useKiosk } from '../context/KioskContext';

interface StyleData {
  id: string;
  name: string;
  thumbnail: string;
  max_people: number;
}

export default function StyleSelectionScreen() {
  const { setScreen, session, setSelectedStyleId } = useKiosk();
  const [styles, setStyles] = useState<StyleData[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/styles')
      .then(r => r.json())
      .then((data: StyleData[]) => {
        let filteredStyles = data;
        if (session?.allowed_styles && session.allowed_styles.length > 0) {
          filteredStyles = data.filter(s => session.allowed_styles!.includes(s.id));
        }
        setStyles(filteredStyles);
      })
      .catch(err => {
        console.error(err);
        setError('Could not load styles');
      });
  }, [session]);

  const handleSelectStyle = (id: string) => {
    setSelectedStyleId(id);
    setScreen('capture');
  };

  return (
    <div className="screen active" style={{ display: 'flex' }}>
      <h2>Choose Your Style</h2>
      {error && <p>{error}</p>}
      <div className="style-grid">
        {styles.map(s => (
          <div key={s.id} className="style-card" onClick={() => handleSelectStyle(s.id)}>
            <img 
              className="style-thumb" 
              src={s.thumbnail} 
              alt={s.name}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.parentElement!.innerHTML = `<div class='style-thumb' style='background:#2a2a4e;display:flex;align-items:center;justify-content:center;color:#666'>${s.name[0]}</div>` + target.parentElement!.innerHTML;
              }}
            />
            <div className="style-name">{s.name}</div>
            <div className="style-badge">{s.max_people > 1 ? `Up to ${s.max_people} people` : 'Solo (1 person)'}</div>
          </div>
        ))}
      </div>
      <button className="btn-back" onClick={() => setScreen('attract')} style={{ marginTop: '20px' }}>
        Back
      </button>
    </div>
  );
}
