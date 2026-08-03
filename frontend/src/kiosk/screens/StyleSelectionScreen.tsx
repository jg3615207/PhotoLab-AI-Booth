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
          const matched = data.filter(s => session.allowed_styles!.includes(s.id));
          if (matched.length > 0) {
            filteredStyles = matched;
          }
        }
        setStyles(filteredStyles);
      })
      .catch(err => {
        console.error(err);
        setError(isZh ? '無法載入風格' : 'Could not load styles');
      });
  }, [session, isZh]);

  const triggerPreload = (styleObj: StyleData) => {
    fetch('/api/styles/preload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ style_id: styleObj.id, filter_preset: styleObj.filter_preset })
    }).catch(() => {});
  };

  const handleSelectStyle = (styleObj: StyleData) => {
    triggerPreload(styleObj);
    setSelectedStyleId(styleObj.id);
    setSelectedStyle(styleObj);
    setScreen('capture');
  };

  const handleHoverStyle = (styleObj: StyleData) => {
    setHoveredStyleId(styleObj.id);
    triggerPreload(styleObj);
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
              onMouseEnter={() => handleHoverStyle(s)}
              onMouseLeave={() => setHoveredStyleId(null)}
              onPointerEnter={() => handleHoverStyle(s)}
              onPointerLeave={() => setHoveredStyleId(null)}
              onTouchStart={() => handleHoverStyle(s)}
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
                <div style={{ position: 'relative', width: '100%', minHeight: '180px', background: 'linear-gradient(135deg, #1a1a3a 0%, #0d0d1a 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...aspectStyle }}>
                  <img 
                    className="style-thumb" 
                    src={s.thumbnail} 
                    alt={s.name}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', ...aspectStyle }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                  <div style={{ fontSize: '48px', opacity: 0.85, textShadow: '0 0 20px rgba(102, 126, 234, 0.6)' }}>
                    {s.name.includes('✨') ? '✨' : (isNormalStyle ? '📷' : '🎨')}
                  </div>
                </div>
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
