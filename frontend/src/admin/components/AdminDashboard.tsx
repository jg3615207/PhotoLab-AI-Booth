import React, { useState } from 'react';
import SessionsTab from './SessionsTab';
import StylesTab from './StylesTab';
import AnalyticsTab from './AnalyticsTab';
import WikiTab from './WikiTab';
import SystemTab from './SystemTab';
import LiveJobsTab from './LiveJobsTab';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('styles');

  return (
    <div className="layout" style={{ display: 'flex', minHeight: '100vh', background: '#07070b', color: '#ddd' }}>
      <div className="sidebar" style={{ width: '260px', background: 'rgba(15, 15, 25, 0.8)', backdropFilter: 'blur(20px)', padding: '24px', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh' }}>
        <h2 style={{ margin: '0 0 32px 0', fontSize: '20px', color: '#fff', fontWeight: 700 }}>PhotoLab Admin</h2>
        
        <div className={`nav-item ${activeTab === 'styles' ? 'active' : ''}`} onClick={() => setActiveTab('styles')}>
          🎨 Style Library
        </div>
        <div className={`nav-item ${activeTab === 'sessions' ? 'active' : ''}`} onClick={() => setActiveTab('sessions')}>
          📅 Session Manager
        </div>
        <div className={`nav-item ${activeTab === 'jobs' ? 'active' : ''}`} onClick={() => setActiveTab('jobs')}>
          ⚙️ Live Jobs
        </div>
        <div className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>
          📊 Analytics
        </div>
        <div className={`nav-item ${activeTab === 'wiki' ? 'active' : ''}`} onClick={() => setActiveTab('wiki')}>
          📖 User Guide & Wiki
        </div>
        <div className={`nav-item ${activeTab === 'system' ? 'active' : ''}`} onClick={() => setActiveTab('system')}>
          ⚙️ Global Settings
        </div>

        <div className="lang-toggle" style={{ marginTop: 'auto' }}>
          <button style={{ width: '100%' }}>English</button>
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

