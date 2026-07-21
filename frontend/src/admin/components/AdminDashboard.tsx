import React, { useState } from 'react';
import SessionsTab from './SessionsTab';
import StylesTab from './StylesTab';
import AnalyticsTab from './AnalyticsTab';
import WikiTab from './WikiTab';
import SystemTab from './SystemTab';
import LiveJobsTab from './LiveJobsTab';
import TransitionsTab from './TransitionsTab';
import { AdminLangProvider, useAdminLang } from '../context/AdminLangContext';

function DashboardContent() {
  const [activeTab, setActiveTab] = useState('styles');
  const { lang, toggleLang } = useAdminLang();

  const isZh = lang === 'zh-Hant';

  return (
    <div className="layout">
      <div className="sidebar">
        <div style={{ margin: '0 0 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', color: '#fff', fontWeight: 700 }}>
              {isZh ? 'PhotoLab 管理員' : 'PhotoLab Admin'}
            </h2>
            <span style={{ fontSize: '11px', background: 'rgba(102,126,234,0.2)', color: '#667eea', border: '1px solid rgba(102,126,234,0.4)', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>v0.16.0</span>
          </div>

          <div className="lang-toggle" style={{ display: 'flex', alignItems: 'center' }}>
            <button onClick={toggleLang} style={{ padding: '4px 10px', fontSize: '12px' }}>
              {isZh ? 'English' : '繁體中文'}
            </button>
          </div>
        </div>
        
        <div className="nav-menu-container">
          <div className={`nav-item ${activeTab === 'styles' ? 'active' : ''}`} onClick={() => setActiveTab('styles')}>
            🎨 {isZh ? '風格庫' : 'Style Library'}
          </div>
          <div className={`nav-item ${activeTab === 'sessions' ? 'active' : ''}`} onClick={() => setActiveTab('sessions')}>
            📅 {isZh ? '場次管理' : 'Session Manager'}
          </div>
          <div className={`nav-item ${activeTab === 'transitions' ? 'active' : ''}`} onClick={() => setActiveTab('transitions')}>
            ⚡ {isZh ? '過渡特效' : 'Transitions'}
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
        </div>
      </div>

      <div className="main-content">
        {activeTab === 'styles' && <StylesTab />}
        {activeTab === 'sessions' && <SessionsTab />}
        {activeTab === 'transitions' && <TransitionsTab />}
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
