import React, { useState, useEffect, lazy, Suspense } from 'react';
import { AdminLangProvider, useAdminLang } from '../context/AdminLangContext';

const SessionsTab = lazy(() => import('./SessionsTab'));
const StylesTab = lazy(() => import('./StylesTab'));
const AnalyticsTab = lazy(() => import('./AnalyticsTab'));
const WikiTab = lazy(() => import('./WikiTab'));
const SystemTab = lazy(() => import('./SystemTab'));
const TransitionsTab = lazy(() => import('./TransitionsTab'));
const JobHistoryTab = lazy(() => import('./JobHistoryTab'));
const PrintQueueTab = lazy(() => import('./PrintQueueTab'));
const ToolsTab = lazy(() => import('./ToolsTab'));
const AgentTabLazy = lazy(() => import('./AgentTab').then(m => ({ default: m.AgentTab })));

function DashboardContent() {
  const getHashTab = () => {
    const hash = window.location.hash.replace('#', '').trim();
    const validTabs = ['agent', 'styles', 'sessions', 'jobs', 'print_queue', 'transitions', 'analytics', 'tools', 'wiki', 'system'];
    return validTabs.includes(hash) ? hash : 'styles';
  };

  const [activeTab, setActiveTabState] = useState(getHashTab);
  const [liveJobsCount, setLiveJobsCount] = useState(0);
  const [printQueueCount, setPrintQueueCount] = useState(0);
  const { lang, toggleLang } = useAdminLang();

  const isZh = lang === 'zh-Hant';

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    window.location.hash = `#${tab}`;
  };

  useEffect(() => {
    const handleHashChange = () => {
      setActiveTabState(getHashTab());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const fetchCounts = () => {
      fetch('/api/admin/maintenance/live-jobs')
        .then(r => r.json())
        .then(data => Array.isArray(data) && setLiveJobsCount(data.length))
        .catch(() => {});

      fetch('/api/admin/print-queue')
        .then(r => r.json())
        .then(data => Array.isArray(data) && setPrintQueueCount(data.filter((q: any) => q.status === 'queued').length))
        .catch(() => {});
    };

    fetchCounts();
    const timer = setInterval(fetchCounts, 10000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="layout">
      <div className="sidebar">
        <div style={{ margin: '0 0 24px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: '20px', color: '#fff', fontWeight: 700 }}>
              {isZh ? 'PhotoLab 管理員' : 'PhotoLab Admin'}
            </h2>
            <button 
              onClick={toggleLang} 
              style={{ 
                padding: '4px 10px', 
                fontSize: '12px', 
                borderRadius: '6px', 
                background: 'rgba(255,255,255,0.06)', 
                border: '1px solid rgba(255,255,255,0.15)', 
                color: '#fff',
                cursor: 'pointer'
              }}
            >
              🌐 {isZh ? 'English' : '繁體中文'}
            </button>
          </div>

          <div>
            <span style={{ fontSize: '11px', background: 'rgba(102,126,234,0.2)', color: '#a3b8ff', border: '1px solid rgba(102,126,234,0.4)', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>v{__APP_VERSION__}</span>
          </div>
        </div>
        
        <div className="nav-menu-container">
          <div className={`nav-item ${activeTab === 'agent' ? 'active' : ''}`} onClick={() => setActiveTab('agent')}>
            🤖 {isZh ? 'AI 創作 Agent' : 'AI Style Agent'}
          </div>
          <div className={`nav-item ${activeTab === 'styles' ? 'active' : ''}`} onClick={() => setActiveTab('styles')}>
            🎨 {isZh ? '風格庫' : 'Style Library'}
          </div>
          <div className={`nav-item ${activeTab === 'sessions' ? 'active' : ''}`} onClick={() => setActiveTab('sessions')}>
            📅 {isZh ? '場次管理' : 'Session Manager'}
          </div>
          <div className={`nav-item ${activeTab === 'jobs' ? 'active' : ''}`} onClick={() => setActiveTab('jobs')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>⚙️ {isZh ? '任務管理 (Jobs)' : 'Jobs Manager'}</span>
            {liveJobsCount > 0 && (
              <span style={{ background: '#f43f5e', color: '#fff', fontSize: '10px', padding: '1px 6px', borderRadius: '10px', fontWeight: 700 }}>
                {liveJobsCount}
              </span>
            )}
          </div>
          <div className={`nav-item ${activeTab === 'print_queue' ? 'active' : ''}`} onClick={() => setActiveTab('print_queue')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>🖨️ {isZh ? '列印隊列' : 'Print Queue'}</span>
            {printQueueCount > 0 && (
              <span style={{ background: '#6366f1', color: '#fff', fontSize: '10px', padding: '1px 6px', borderRadius: '10px', fontWeight: 700 }}>
                {printQueueCount}
              </span>
            )}
          </div>
          <div className={`nav-item ${activeTab === 'transitions' ? 'active' : ''}`} onClick={() => setActiveTab('transitions')}>
            ⚡ {isZh ? '過渡特效' : 'Transitions'}
          </div>
          <div className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>
            📊 {isZh ? '數據分析' : 'Analytics'}
          </div>
          <div className={`nav-item ${activeTab === 'tools' ? 'active font-semibold' : ''}`} onClick={() => setActiveTab('tools')}>
            🛠️ {isZh ? '工具與資源' : 'Tools & Links'}
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
        <Suspense fallback={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#a3b8ff', gap: '8px' }}>
            <div style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <span>{isZh ? '載入模組中...' : 'Loading module...'}</span>
          </div>
        }>
          {activeTab === 'agent' && <AgentTabLazy onNavigateToStyles={() => setActiveTab('styles')} />}
          {activeTab === 'styles' && <StylesTab />}
          {activeTab === 'sessions' && <SessionsTab />}
          {activeTab === 'jobs' && <JobHistoryTab />}
          {activeTab === 'print_queue' && <PrintQueueTab />}
          {activeTab === 'transitions' && <TransitionsTab />}
          {activeTab === 'analytics' && <AnalyticsTab />}
          {activeTab === 'tools' && <ToolsTab onOpenAgent={() => setActiveTab('agent')} />}
          {activeTab === 'wiki' && <WikiTab />}
          {activeTab === 'system' && <SystemTab />}
        </Suspense>
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
