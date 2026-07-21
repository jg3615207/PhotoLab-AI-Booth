import React, { useEffect, useState } from 'react';
import { useAdminLang } from '../context/AdminLangContext';

export default function SystemTab() {
  const { lang } = useAdminLang();
  const isZh = lang === 'zh-Hant';

  const [apiBase, setApiBase] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [customCss, setCustomCss] = useState('');
  const [localSaveDir, setLocalSaveDir] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ text: string; color: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [watchdog, setWatchdog] = useState<any>(null);

  useEffect(() => {
    fetch('/api/styles/settings')
      .then(res => res.json())
      .then(data => {
        setApiBase(data.openai_base_url || '');
        setApiKey(data.openai_api_key || '');
        setModel(data.openai_model || '');
        setCustomCss(data.custom_css || '');
        setLocalSaveDir(data.local_save_dir || '');
      })
      .catch(err => console.error("Failed to load settings:", err));

    const fetchWatchdog = () => {
      fetch('/api/admin/maintenance/watchdog/status')
        .then(res => res.json())
        .then(data => setWatchdog(data))
        .catch(err => console.error("Failed to load watchdog status:", err));
    };

    fetchWatchdog();
    const interval = setInterval(fetchWatchdog, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleTest = async () => {
    if (!apiBase || !apiKey || !model) {
      alert(isZh ? "請填寫所有設定欄位" : "Please fill in all settings fields.");
      return;
    }
    setTesting(true);
    setStatusMsg({ text: isZh ? '測試連線中...' : 'Testing connection...', color: '#667eea' });
    try {
      const form = new FormData();
      form.append('api_key', apiKey);
      form.append('base_url', apiBase);
      form.append('model', model);

      const r = await fetch('/api/styles/settings/test', { method: 'POST', body: form });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Test failed');

      setStatusMsg({ text: (isZh ? '連線測試成功！回應: ' : 'Connection successful! Response: ') + `"${data.response}"`, color: '#4f4' });
    } catch (e: any) {
      setStatusMsg({ text: (isZh ? '連線測試失敗: ' : 'Connection test failed: ') + e.message, color: '#f44' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!apiBase || !apiKey || !model) {
      alert(isZh ? "請填寫所有設定欄位" : "Please fill in all settings fields.");
      return;
    }
    setSaving(true);
    setStatusMsg({ text: isZh ? '儲存設定中...' : 'Saving settings...', color: '#667eea' });
    try {
      const form = new FormData();
      form.append('api_key', apiKey);
      form.append('base_url', apiBase);
      form.append('model', model);
      form.append('custom_css', customCss);
      form.append('local_save_dir', localSaveDir);

      const r = await fetch('/api/styles/settings/save', { method: 'POST', body: form });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Save failed');

      setStatusMsg({ text: isZh ? '設定已成功儲存！' : 'Settings saved successfully!', color: '#4f4' });
    } catch (e: any) {
      setStatusMsg({ text: (isZh ? '儲存失敗: ' : 'Save failed: ') + e.message, color: '#f44' });
    } finally {
      setSaving(false);
    }
  };

  const handleClearCache = async () => {
    if (!confirm(isZh ? "確定要清理所有上傳與快取的臨時相片嗎？" : "Are you sure you want to clear all uploads and cached images?")) return;
    try {
      const r = await fetch('/api/admin/maintenance/clear-cache', { method: 'POST' });
      const data = await r.json();
      if (r.ok) {
        alert(isZh ? `快取清理成功！共刪除 ${data.cleared_files} 個檔案。` : `Cache cleared successfully! Deleted ${data.cleared_files} files.`);
      } else {
        alert(`Failed: ${data.detail}`);
      }
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleBackupDb = () => {
    window.open('/api/health', '_blank');
  };

  return (
    <div style={{ background: 'rgba(26, 26, 46, 0.8)', padding: '32px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
      <h1 style={{ fontSize: '28px', color: '#fff', marginBottom: '24px' }}>⚙️ {isZh ? '全域 AI 設定與系統維護' : 'Global AI Settings & Maintenance'}</h1>

      {statusMsg && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', color: statusMsg.color, marginBottom: '20px', fontWeight: 500 }}>
          {statusMsg.text}
        </div>
      )}

      <div style={{ display: 'grid', gap: '16px', marginBottom: '28px' }}>
        <div>
          <label style={{ display: 'block', color: '#aaa', fontSize: '14px', marginBottom: '6px' }}>{isZh ? '視覺 AI / LLM 基礎網址 (Base URL)' : 'Vision AI / LLM Base URL'}</label>
          <input 
            type="text" 
            value={apiBase} 
            onChange={e => setApiBase(e.target.value)} 
            placeholder="https://api.openai.com/v1" 
            style={{ width: '100%', padding: '10px 14px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '8px', color: '#fff' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', color: '#aaa', fontSize: '14px', marginBottom: '6px' }}>{isZh ? '視覺 AI / LLM API 金鑰 (API Key)' : 'Vision AI / LLM API Key'}</label>
          <input 
            type="password" 
            value={apiKey} 
            onChange={e => setApiKey(e.target.value)} 
            placeholder="sk-..." 
            style={{ width: '100%', padding: '10px 14px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '8px', color: '#fff' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', color: '#aaa', fontSize: '14px', marginBottom: '6px' }}>{isZh ? '多模態模型名稱' : 'Multimodal Model Name'}</label>
          <input 
            type="text" 
            value={model} 
            onChange={e => setModel(e.target.value)} 
            placeholder="gpt-4o-mini" 
            style={{ width: '100%', padding: '10px 14px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '8px', color: '#fff' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', color: '#aaa', fontSize: '14px', marginBottom: '6px' }}>{isZh ? '自訂照相亭 CSS 覆寫' : 'Custom Kiosk CSS Overrides'}</label>
          <textarea 
            value={customCss} 
            onChange={e => setCustomCss(e.target.value)} 
            placeholder="body { background: #000 !important; }" 
            rows={5} 
            style={{ width: '100%', padding: '10px 14px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '8px', color: '#fff', fontFamily: 'monospace' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', color: '#aaa', fontSize: '14px', marginBottom: '6px' }}>{isZh ? '本地相片儲存路徑 (Local Save Path)' : 'Local Photo Save Path'}</label>
          <input 
            type="text" 
            value={localSaveDir} 
            onChange={e => setLocalSaveDir(e.target.value)} 
            placeholder={isZh ? "例如: D:\\PhotoBooth_Outputs" : "e.g., D:\\PhotoBooth_Outputs"} 
            style={{ width: '100%', padding: '10px 14px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '8px', color: '#fff' }}
          />
          <small style={{ display: 'block', color: '#888', marginTop: '6px', fontSize: '12px' }}>
            {isZh ? "設定後，系統將在每次生成完成時複製一份成果照片至該目錄，並自動依據 Session ID (活動代碼) 分配子資料夾。" 
                  : "If set, the system will save a copy of each completed photo here, organized into subdirectories by Session ID."}
          </small>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '40px' }}>
        <button 
          onClick={handleTest} 
          disabled={testing} 
          className="btn-secondary" 
          style={{ padding: '10px 24px', borderRadius: '8px', cursor: 'pointer' }}
        >
          {testing ? (isZh ? '測試中...' : 'Testing...') : (isZh ? '🧪 測試連線' : '🧪 Test Connection')}
        </button>
        <button 
          onClick={handleSave} 
          disabled={saving} 
          className="btn-primary" 
          style={{ padding: '10px 24px', borderRadius: '8px', cursor: 'pointer' }}
        >
          {saving ? (isZh ? '儲存中...' : 'Saving...') : (isZh ? '💾 儲存設定' : '💾 Save Settings')}
        </button>
      </div>

      <h2 style={{ fontSize: '20px', color: '#fff', marginBottom: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '24px' }}>
        🛠️ {isZh ? '系統維護' : 'System Maintenance'}
      </h2>
      <div style={{ display: 'flex', gap: '16px' }}>
        <button 
          onClick={handleBackupDb} 
          className="btn-secondary" 
          style={{ padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}
        >
          💾 {isZh ? '備份系統資訊' : 'Backup System Info'}
        </button>
        <button 
          onClick={handleClearCache} 
          style={{ padding: '10px 20px', borderRadius: '8px', background: '#8b2020', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}
        >
          🗑️ {isZh ? '清理快取與上傳檔案' : 'Clear Cache & Uploads'}
        </button>
      </div>

      {/* Watchdog Auto-Restarter Status Panel */}
      {watchdog && (
        <div style={{ marginTop: '28px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '24px' }}>
          <h2 style={{ fontSize: '20px', color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🐕 {isZh ? '看門狗自動重啟器' : 'Watchdog Auto-Restarter'}
            <span style={{ 
              fontSize: '11px', 
              padding: '2px 8px', 
              borderRadius: '10px', 
              background: watchdog.status === 'healthy' ? 'rgba(79,255,79,0.15)' : 'rgba(255,165,0,0.15)',
              color: watchdog.status === 'healthy' ? '#4f4' : '#ffa500',
              fontWeight: 600
            }}>
              {watchdog.status === 'healthy' ? (isZh ? '運行健康' : 'HEALTHY') : (isZh ? '重啟中' : 'RESTARTING')}
            </span>
          </h2>
          
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '18px' }}>
              <div>
                <span style={{ color: '#888', fontSize: '13px', display: 'block', marginBottom: '4px' }}>{isZh ? '程序 PID' : 'Process PID'}</span>
                <span style={{ color: '#fff', fontWeight: 600, fontSize: '16px' }}>{watchdog.pid || 'N/A'}</span>
              </div>
              <div>
                <span style={{ color: '#888', fontSize: '13px', display: 'block', marginBottom: '4px' }}>{isZh ? '最後檢查時間' : 'Last Checked'}</span>
                <span style={{ color: '#fff', fontSize: '15px' }}>{watchdog.last_check_time || 'Never'}</span>
              </div>
              <div>
                <span style={{ color: '#888', fontSize: '13px', display: 'block', marginBottom: '4px' }}>{isZh ? '最後重啟時間' : 'Last Restart'}</span>
                <span style={{ color: '#fff', fontSize: '15px' }}>{watchdog.last_restart_time || (isZh ? '無記錄' : 'Never')}</span>
              </div>
            </div>

            {/* Memory Bar */}
            <div style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span style={{ color: '#888' }}>{isZh ? '記憶體使用率' : 'Memory Usage'}</span>
                <span style={{ color: '#fff', fontWeight: 600 }}>
                  {watchdog.memory_mb ? (watchdog.memory_mb / 1024).toFixed(2) : '0'} GB / 2.00 GB
                </span>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ 
                  width: `${Math.min(100, ((watchdog.memory_mb || 0) / 2048) * 100)}%`, 
                  height: '100%', 
                  background: (watchdog.memory_mb || 0) > 1638 ? 'linear-gradient(90deg, #f857a6, #ff5858)' : 'linear-gradient(90deg, #667eea, #764ba2)',
                  transition: 'width 0.5s ease'
                }} />
              </div>
            </div>

            {watchdog.last_restart_reason && (
              <div style={{ marginTop: '16px', padding: '10px 14px', background: 'rgba(255,79,79,0.05)', border: '1px solid rgba(255,79,79,0.15)', borderRadius: '6px', fontSize: '13px', color: '#ff7f7f' }}>
                <strong>{isZh ? '最近重啟原因: ' : 'Last Restart Reason: '}</strong> {watchdog.last_restart_reason}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
