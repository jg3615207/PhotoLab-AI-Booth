import React, { useState } from 'react';
import SessionsTab from './SessionsTab';
import StylesTab from './StylesTab';
import AnalyticsTab from './AnalyticsTab';
import WikiTab from './WikiTab';
import SystemTab from './SystemTab';
import LiveJobsTab from './LiveJobsTab';
import { AdminLangProvider, useAdminLang } from '../context/AdminLangContext';

function DashboardContent() {
  const [activeTab, setActiveTab] = useState('styles');
  const { lang, toggleLang } = useAdminLang();

  const isZh = lang === 'zh-Hant';

  return (
    <div className="layout" style={{ display: 'flex', minHeight: '100vh', background: '#07070b', color: '#ddd' }}>
      <div className="sidebar" style={{ width: '260px', background: 'rgba(15, 15, 25, 0.8)', backdropFilter: 'blur(20px)', padding: '24px', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ margin: '0 0 28px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', color: '#fff', fontWeight: 700 }}>
            {isZh ? 'PhotoLab 管理員' : 'PhotoLab Admin'}
          </h2>
          <span style={{ fontSize: '11px', background: 'rgba(102,126,234,0.2)', color: '#667eea', border: '1px solid rgba(102,126,234,0.4)', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>v0.12.0</span>
        </div>
        
        <div className={`nav-item ${activeTab === 'styles' ? 'active' : ''}`} onClick={() => setActiveTab('styles')}>
          🎨 {isZh ? '風格庫' : 'Style Library'}
        </div>
        <div className={`nav-item ${activeTab === 'sessions' ? 'active' : ''}`} onClick={() => setActiveTab('sessions')}>
          📅 {isZh ? '場次管理' : 'Session Manager'}
        </div>
        <div className={`nav-item ${activeTab === 'jobs' ? 'active' : ''}`} onClick={() => setActiveTab('jobs')}>
          ⚙️ {isZh ? '即時任務' : 'Live Jobs'}
        </div>
        <div className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>
          📊 {isZh ? '數據分析' : 'Analytics'}
        </div>
        <div className={`nav-item ${activeTab === 'wiki' ? 'active' : ''}`} onClick={() => setActiveTab('wiki')}>
          📖 {isZh ? '使用手冊與維基' : 'User Guide & Wiki'}
        </div>
        <div className={`nav-item ${activeTab === 'system' ? 'active' : ''}`} onClick={() => setActiveTab('system')}>
          ⚙️ {isZh ? '全域設定' : 'Global Settings'}
        </div>

        <div className="lang-toggle" style={{ marginTop: 'auto' }}>
          <button onClick={toggleLang} style={{ width: '100%' }}>
            {isZh ? 'English' : '繁體中文'}
          </button>
        </div>
      </div>

      <div className="main-content" style={{ flexGrow: 1, padding: '36px', maxWidth: '1200px', margin: '0 auto' }}>
        {activeTab === 'styles' && <StylesTab />}
        {activeTab === 'sessions' && <SessionsTab />}
        {activeTab === 'jobs' && <LiveJobsTab />}
        {activeTab === 'analytics' && <AnalyticsTab />}
        {activeTab === 'wiki' && <WikiTab />}
        {activeTab === 'system' && <SystemTab />}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <AdminLangProvider>
      <DashboardContent />
    </AdminLangProvider>
  );
}


