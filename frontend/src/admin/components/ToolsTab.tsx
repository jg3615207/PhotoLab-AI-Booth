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

interface ToolsTabProps {
  onOpenAgent?: () => void;
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

export default function ToolsTab({ onOpenAgent }: ToolsTabProps) {
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
            {isZh ? '管理員精選實用網站、AI Agent 助手與開發輔助連結' : 'Handy developer resources, AI agents, and curated links for PhotoLab operators'}
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

      {/* Featured AI Style Agent Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2))',
        border: '1px solid rgba(168, 85, 247, 0.4)',
        padding: '24px',
        borderRadius: '16px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
      }}>
        <div style={{ flex: 1, minWidth: '280px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '20px' }}>🤖</span>
            <span style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>
              {isZh ? 'PhotoLab AI Style Agent (全功能視覺與 Prompt AI 助手)' : 'PhotoLab AI Style Agent (Vision & Prompt AI)'}
            </span>
            <span style={{ fontSize: '11px', background: 'rgba(74, 222, 128, 0.2)', color: '#4ade80', border: '1px solid rgba(74, 222, 128, 0.3)', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
              {isZh ? '強大推薦' : 'Featured Agent'}
            </span>
          </div>
          <p style={{ color: '#cbd5e1', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
            {isZh 
              ? '具備圖片視覺分析 (Vision AI)、提示詞生成與優化 (Prompt Engineering)、RunningHub 參考圖自動繪製與一鍵建立風格庫的對話式 AI 助手。支援多會話持久儲存與雙語溝通！' 
              : 'Conversational AI agent capable of Vision image analysis, PhotoLab-compliant prompt engineering, RunningHub T2I reference photo rendering, and multi-session style creation!'}
          </p>
        </div>

        {onOpenAgent && (
          <button
            onClick={onOpenAgent}
            style={{
              padding: '12px 24px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '14px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(168, 85, 247, 0.4)',
              transition: 'transform 0.2s, filter 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            ⚡ {isZh ? '立即開啟 AI 創作 Agent' : 'Launch AI Style Agent'}
          </button>
        )}
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
                justifyContent: 'space-between',
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
