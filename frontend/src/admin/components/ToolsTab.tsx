import React, { useState } from 'react';
import { useAdminLang } from '../context/AdminLangContext';

interface UsefulLink {
  id: string;
  name: string;
  url: string;
  badge: string;
  descZh: string;
  descEn: string;
  icon: string;
}

const USEFUL_WEBSITES: UsefulLink[] = [
  {
    id: 'agentpedia',
    name: 'Agentpedia',
    url: 'https://agentpedia.codes/',
    badge: 'AI Agent & Code',
    icon: '🤖',
    descZh: '匯集最新 AI Agent 技術、框架與代理編程範例的完整資源指南與代碼庫目錄。',
    descEn: 'Comprehensive index of AI agent frameworks, coding patterns, and agentic automation tools.'
  },
  {
    id: 'opennana',
    name: 'OpenNana',
    url: 'https://opennana.com/',
    badge: 'AI Tools Platform',
    icon: '🌐',
    descZh: '開放式 AI 創新應用與工具平臺，提供豐富的 AI 解決方案與開發者社群資源。',
    descEn: 'Open AI ecosystem platform featuring cutting-edge AI tools and developer resources.'
  }
];

export default function ToolsTab() {
  const { lang } = useAdminLang();
  const isZh = lang === 'zh-Hant';
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredWebsites = USEFUL_WEBSITES.filter(site => {
    const q = searchTerm.toLowerCase();
    return (
      site.name.toLowerCase().includes(q) ||
      site.url.toLowerCase().includes(q) ||
      site.descZh.toLowerCase().includes(q) ||
      site.descEn.toLowerCase().includes(q)
    );
  });

  const handleCopy = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div style={{ background: 'rgba(26, 26, 46, 0.8)', padding: '32px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', lineHeight: 1.6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            🛠️ {isZh ? '工具與資源箱' : 'Tools & Useful Resources'}
          </h1>
          <p style={{ color: '#aaa', fontSize: '14px', marginTop: '6px', margin: 0 }}>
            {isZh ? '管理員精選實用網站、開發工具與系統輔助連結' : 'Handy developer resources, useful tools, and curated links for PhotoLab operators'}
          </p>
        </div>

        <input
          type="text"
          placeholder={isZh ? '🔍 搜尋工具或網頁...' : '🔍 Search tools or links...'}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: '10px 16px',
            borderRadius: '8px',
            background: 'rgba(13, 13, 26, 0.9)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff',
            fontSize: '14px',
            minWidth: '240px'
          }}
        />
      </div>

      {/* Useful Websites Section */}
      <div style={{ background: 'rgba(13, 13, 26, 0.8)', padding: '24px', borderRadius: '12px', marginBottom: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ color: '#4ecdc4', fontSize: '20px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            🌐 {isZh ? '實用網站推薦 (Useful Websites)' : 'Useful Websites'}
          </h3>
          <span style={{ fontSize: '12px', background: 'rgba(78,205,196,0.15)', color: '#4ecdc4', border: '1px solid rgba(78,205,196,0.3)', padding: '2px 10px', borderRadius: '12px', fontWeight: 600 }}>
            {filteredWebsites.length} {isZh ? '個網站' : 'Sites'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {filteredWebsites.map((site) => (
            <div
              key={site.id}
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '10px',
                padding: '20px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                justify: 'space-between',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '24px' }}>{site.icon}</span>
                    <h4 style={{ color: '#fff', fontSize: '18px', margin: 0, fontWeight: 700 }}>{site.name}</h4>
                  </div>
                  <span style={{ fontSize: '11px', background: 'rgba(102,126,234,0.2)', color: '#a3b8ff', border: '1px solid rgba(102,126,234,0.4)', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
                    {site.badge}
                  </span>
                </div>

                <p style={{ color: '#bbb', fontSize: '13px', lineHeight: '1.5', marginBottom: '16px' }}>
                  {isZh ? site.descZh : site.descEn}
                </p>

                <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', color: '#888', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '16px' }}>
                  {site.url}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <a
                  href={site.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flex: 1,
                    textDecoration: 'none',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 600,
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  🔗 {isZh ? '開啟網站' : 'Visit Website'}
                </a>

                <button
                  type="button"
                  onClick={() => handleCopy(site.id, site.url)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: copiedId === site.id ? 'rgba(56,239,125,0.2)' : 'rgba(255,255,255,0.06)',
                    border: copiedId === site.id ? '1px solid rgba(56,239,125,0.4)' : '1px solid rgba(255,255,255,0.15)',
                    color: copiedId === site.id ? '#38ef7d' : '#ccc',
                    fontSize: '12px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {copiedId === site.id ? (isZh ? '✓ 已複製' : '✓ Copied') : (isZh ? '📋 複製' : '📋 Copy')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
