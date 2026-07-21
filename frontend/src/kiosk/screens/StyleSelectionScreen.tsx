import React, { useEffect, useState } from 'react';
import { useKiosk } from '../context/KioskContext';

interface StyleData {
  id: string;
  name: string;
  thumbnail: string;
  max_people: number;
}

export default function StyleSelectionScreen() {
  const { setScreen, session, setSelectedStyleId, lang } = useKiosk();
  const isZh = lang === 'zh-Hant';

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
        setError(isZh ? '無法載入風格' : 'Could not load styles');
      });
  }, [session, isZh]);

  const handleSelectStyle = (id: string) => {
    setSelectedStyleId(id);
    setScreen('capture');
  };

  return (
    <div className="screen active" style={{ display: 'flex' }}>
      <h2>{isZh ? '選擇風格' : 'Choose Your Style'}</h2>
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
              }}
            />
            <div className="style-name">{s.name}</div>
            <div className="style-badge">
              {s.max_people > 1 
                ? (isZh ? `最多 ${s.max_people} 人` : `Up to ${s.max_people} people`) 
                : (isZh ? '單人' : 'Solo (1 person)')}
            </div>
          </div>
        ))}
      </div>
      <button className="btn-back" onClick={() => setScreen('attract')} style={{ marginTop: '20px' }}>
        {isZh ? '返回' : 'Back'}
      </button>
    </div>
  );
}
