import React, { useEffect, useState } from 'react';
import { useKiosk } from '../context/KioskContext';

interface StyleData {
  id: string;
  name: string;
  thumbnail: string;
  max_people: number;
  animated_thumbnail?: string;
  aspect_ratio?: string;
  mode?: string;
  filter_preset?: string;
}

export default function StyleSelectionScreen() {
  const { setScreen, session, setSelectedStyleId, setSelectedStyle, lang } = useKiosk();
  const isZh = lang === 'zh-Hant';

  const [styles, setStyles] = useState<StyleData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hoveredStyleId, setHoveredStyleId] = useState<string | null>(null);

  useEffect(() => {
    const boothMode = session?.booth_mode || 'ai';
    const fetchUrl = `/api/styles?mode=${boothMode}`;
    fetch(fetchUrl)
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

  const handleSelectStyle = (styleObj: StyleData) => {
    setSelectedStyleId(styleObj.id);
    setSelectedStyle(styleObj);
    setScreen('capture');
  };

  return (
    <div className="screen active" style={{ display: 'flex' }}>
      <h2>{isZh ? '選擇風格' : 'Choose Your Style'}</h2>
      {error && <p>{error}</p>}
      <div className="style-grid">
        {styles.map(s => {
          const isHovered = hoveredStyleId === s.id;
          const hasVideo = s.animated_thumbnail && (s.animated_thumbnail.endsWith('.mp4') || s.animated_thumbnail.endsWith('.webm'));
          const aspectStyle = s.aspect_ratio ? { aspectRatio: s.aspect_ratio.replace(':', '/') } : {};
          const isNormalStyle = s.mode === 'normal';

          return (
            <div 
              key={s.id} 
              className="style-card" 
              onClick={() => handleSelectStyle(s)}
              onMouseEnter={() => setHoveredStyleId(s.id)}
              onMouseLeave={() => setHoveredStyleId(null)}
              onPointerEnter={() => setHoveredStyleId(s.id)}
              onPointerLeave={() => setHoveredStyleId(null)}
              onTouchStart={() => setHoveredStyleId(s.id)}
              onTouchEnd={() => setTimeout(() => setHoveredStyleId(null), 3000)}
            >
              {isHovered && s.animated_thumbnail ? (
                hasVideo ? (
                  <video 
                    className="style-thumb"
                    src={s.animated_thumbnail}
                    autoPlay
                    loop
                    muted
                    playsInline
                    style={{ objectFit: 'cover', width: '100%', ...aspectStyle }}
                  />
                ) : (
                  <img 
                    className="style-thumb" 
                    src={s.animated_thumbnail} 
                    alt={s.name}
                    style={aspectStyle}
                  />
                )
              ) : (
                <img 
                  className="style-thumb" 
                  src={s.thumbnail} 
                  alt={s.name}
                  style={aspectStyle}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              )}
              <div className="style-name">{s.name}</div>
              <div className="style-badge" style={isNormalStyle ? { background: 'rgba(72, 187, 120, 0.25)', color: '#68d391', borderColor: 'rgba(72, 187, 120, 0.4)' } : {}}>
                {isNormalStyle 
                  ? (isZh ? '📷 快照相亭' : '📷 Instant Photo') 
                  : (s.max_people > 1 
                      ? (isZh ? `最多 ${s.max_people} 人` : `Up to ${s.max_people} people`) 
                      : (isZh ? '單人' : 'Solo (1 person)'))}
              </div>
            </div>
          );
        })}
      </div>
      <button className="btn-back" onClick={() => setScreen('attract')} style={{ marginTop: '20px' }}>
        {isZh ? '返回' : 'Back'}
      </button>
    </div>
  );
}
