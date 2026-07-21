import React, { useEffect, useState } from 'react';

export default function SystemTab() {
  const [apiBase, setApiBase] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [customCss, setCustomCss] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ text: string; color: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/styles/settings')
      .then(res => res.json())
      .then(data => {
        setApiBase(data.openai_base_url || '');
        setApiKey(data.openai_api_key || '');
        setModel(data.openai_model || '');
        setCustomCss(data.custom_css || '');
      })
      .catch(err => console.error("Failed to load settings:", err));
  }, []);

  const handleTest = async () => {
    if (!apiBase || !apiKey || !model) {
      alert("Please fill in all settings fields.");
      return;
    }
    setTesting(true);
    setStatusMsg({ text: 'Testing connection...', color: '#667eea' });
    try {
      const form = new FormData();
      form.append('api_key', apiKey);
      form.append('base_url', apiBase);
      form.append('model', model);

      const r = await fetch('/api/styles/settings/test', { method: 'POST', body: form });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Test failed');

      setStatusMsg({ text: `Connection successful! Response: "${data.response}"`, color: '#4f4' });
    } catch (e: any) {
      setStatusMsg({ text: `Connection test failed: ${e.message}`, color: '#f44' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!apiBase || !apiKey || !model) {
      alert("Please fill in all settings fields.");
      return;
    }
    setSaving(true);
    setStatusMsg({ text: 'Saving settings...', color: '#667eea' });
    try {
      const form = new FormData();
      form.append('api_key', apiKey);
      form.append('base_url', apiBase);
      form.append('model', model);
      form.append('custom_css', customCss);

      const r = await fetch('/api/styles/settings/save', { method: 'POST', body: form });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Save failed');

      setStatusMsg({ text: 'Settings saved successfully!', color: '#4f4' });
    } catch (e: any) {
      setStatusMsg({ text: `Save failed: ${e.message}`, color: '#f44' });
    } finally {
      setSaving(false);
    }
  };

  const handleClearCache = async () => {
    if (!confirm("Are you sure you want to clear all uploads and cached images?")) return;
    try {
      const r = await fetch('/api/admin/maintenance/clear-cache', { method: 'POST' });
      const data = await r.json();
      if (r.ok) {
        alert(`Cache cleared successfully! Deleted ${data.cleared_files} files.`);
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
      <h1 style={{ fontSize: '28px', color: '#fff', marginBottom: '24px' }}>⚙️ Global AI Settings & Maintenance</h1>

      {statusMsg && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', color: statusMsg.color, marginBottom: '20px', fontWeight: 500 }}>
          {statusMsg.text}
        </div>
      )}

      <div style={{ display: 'grid', gap: '16px', marginBottom: '28px' }}>
        <div>
          <label style={{ display: 'block', color: '#aaa', fontSize: '14px', marginBottom: '6px' }}>Vision AI / LLM Base URL</label>
          <input 
            type="text" 
            value={apiBase} 
            onChange={e => setApiBase(e.target.value)} 
            placeholder="https://api.openai.com/v1" 
            style={{ width: '100%', padding: '10px 14px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '8px', color: '#fff' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', color: '#aaa', fontSize: '14px', marginBottom: '6px' }}>Vision AI / LLM API Key</label>
          <input 
            type="password" 
            value={apiKey} 
            onChange={e => setApiKey(e.target.value)} 
            placeholder="sk-..." 
            style={{ width: '100%', padding: '10px 14px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '8px', color: '#fff' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', color: '#aaa', fontSize: '14px', marginBottom: '6px' }}>Multimodal Model Name</label>
          <input 
            type="text" 
            value={model} 
            onChange={e => setModel(e.target.value)} 
            placeholder="gpt-4o-mini" 
            style={{ width: '100%', padding: '10px 14px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '8px', color: '#fff' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', color: '#aaa', fontSize: '14px', marginBottom: '6px' }}>Custom Kiosk CSS Overrides</label>
          <textarea 
            value={customCss} 
            onChange={e => setCustomCss(e.target.value)} 
            placeholder="body { background: #000 !important; }" 
            rows={5} 
            style={{ width: '100%', padding: '10px 14px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '8px', color: '#fff', fontFamily: 'monospace' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '40px' }}>
        <button 
          onClick={handleTest} 
          disabled={testing} 
          className="btn-secondary" 
          style={{ padding: '10px 24px', borderRadius: '8px', cursor: 'pointer' }}
        >
          {testing ? 'Testing...' : '🧪 Test Connection'}
        </button>
        <button 
          onClick={handleSave} 
          disabled={saving} 
          className="btn-primary" 
          style={{ padding: '10px 24px', borderRadius: '8px', cursor: 'pointer' }}
        >
          {saving ? 'Saving...' : '💾 Save Settings'}
        </button>
      </div>

      <h2 style={{ fontSize: '20px', color: '#fff', marginBottom: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '24px' }}>
        🛠️ System Maintenance
      </h2>
      <div style={{ display: 'flex', gap: '16px' }}>
        <button 
          onClick={handleBackupDb} 
          className="btn-secondary" 
          style={{ padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}
        >
          💾 Backup System Info
        </button>
        <button 
          onClick={handleClearCache} 
          style={{ padding: '10px 20px', borderRadius: '8px', background: '#8b2020', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}
        >
          🗑️ Clear Cache & Uploads
        </button>
      </div>
    </div>
  );
}
