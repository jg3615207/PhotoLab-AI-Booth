import React, { useEffect, useState } from 'react';
import { useAdminLang } from '../context/AdminLangContext';
import confetti from 'canvas-confetti';

interface TransitionItem {
  id: string;
  name: string;
  duration: number;
  css_code: string;
  active: number;
}

export default function TransitionsTab() {
  const { lang } = useAdminLang();
  const isZh = lang === 'zh-Hant';

  const [transitions, setTransitions] = useState<TransitionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<TransitionItem | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form Fields
  const [fId, setFId] = useState('');
  const [fName, setFName] = useState('');
  const [fDuration, setFDuration] = useState(1400);
  const [fCssCode, setFCssCode] = useState('');
  const [fActive, setFActive] = useState(1);

  // Simulation State
  const [simulatingItem, setSimulatingItem] = useState<TransitionItem | null>(null);
  const [simStep, setSimStep] = useState<'idle' | 'countdown' | 'processing' | 'transition' | 'result'>('idle');
  const [simCountdown, setSimCountdown] = useState(3);

  const loadTransitions = async () => {
    try {
      const r = await fetch('/api/admin/transitions');
      const data = await r.json();
      setTransitions(data || []);
    } catch (e) {
      console.error("Failed to load transitions", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransitions();
  }, []);

  const resetForm = () => {
    setFId('');
    setFName('');
    setFDuration(1400);
    setFCssCode('');
    setFActive(1);
  };

  const handleCreate = async () => {
    if (!fId.trim() || !fName.trim()) {
      alert(isZh ? "請填寫 ID 與名稱" : "Please fill ID and Name");
      return;
    }
    const form = new FormData();
    form.append('id', fId.trim());
    form.append('name', fName.trim());
    form.append('duration', fDuration.toString());
    form.append('css_code', fCssCode);

    try {
      const r = await fetch('/api/admin/transitions', { method: 'POST', body: form });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Failed to create');
      
      alert(isZh ? "新增轉換特效成功！" : "Transition created successfully!");
      setShowAddForm(false);
      resetForm();
      loadTransitions();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleUpdate = async () => {
    if (!editingItem) return;
    const form = new FormData();
    form.append('name', fName);
    form.append('duration', fDuration.toString());
    form.append('css_code', fCssCode);
    form.append('active', fActive.toString());

    try {
      const r = await fetch(`/api/admin/transitions/${editingItem.id}`, { method: 'PUT', body: form });
      if (!r.ok) throw new Error('Failed to update');

      alert(isZh ? "更新轉換特效成功！" : "Transition updated successfully!");
      setEditingItem(null);
      resetForm();
      loadTransitions();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (['glitch', 'flash', 'swipe', 'zoom'].includes(id)) {
      alert(isZh ? "內建特效不支援刪除" : "Cannot delete built-in transition");
      return;
    }
    if (!confirm(isZh ? "確定要刪除此特效嗎？" : "Are you sure you want to delete this transition?")) return;

    try {
      const r = await fetch(`/api/admin/transitions/${id}`, { method: 'DELETE' });
      if (r.ok) {
        alert(isZh ? "刪除成功！" : "Deleted successfully!");
        loadTransitions();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const openEdit = (item: TransitionItem) => {
    setEditingItem(item);
    setFId(item.id);
    setFName(item.name);
    setFDuration(item.duration);
    setFCssCode(item.css_code);
    setFActive(item.active);
  };

  // Start Simulator Flow
  const startSimulation = (item: TransitionItem) => {
    setSimulatingItem(item);
    setSimStep('countdown');
    setSimCountdown(3);

    // Inject temporary transition CSS styles
    let styleTag = document.getElementById('temp-simulation-style');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'temp-simulation-style';
      document.head.appendChild(styleTag);
    }
    styleTag.innerHTML = item.css_code;

    // Countdown Interval
    let count = 3;
    const cdInterval = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(cdInterval);
        // Capture placeholder -> processing
        setSimStep('processing');
        startProcessingDelay(item);
      } else {
        setSimCountdown(count);
      }
    }, 1000);
  };

  const startProcessingDelay = (item: TransitionItem) => {
    // Wait 5 seconds to simulate pipeline processing
    setTimeout(() => {
      setSimStep('transition');
      // Wait for transition duration
      setTimeout(() => {
        setSimStep('result');
        // Confetti explosion
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 }
        });
        // Auto end simulation after 3.5 seconds
        setTimeout(() => {
          endSimulation();
        }, 3500);
      }, item.duration);
    }, 5000);
  };

  const endSimulation = () => {
    setSimStep('idle');
    setSimulatingItem(null);
    const styleTag = document.getElementById('temp-simulation-style');
    if (styleTag) {
      styleTag.innerHTML = '';
    }
  };

  return (
    <div style={{ background: 'rgba(26, 26, 46, 0.8)', padding: '32px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ color: '#fff', margin: 0, fontSize: '28px' }}>⚡ {isZh ? '過渡特效管理' : 'Transitions Manager'}</h1>
        <button 
          className="btn-primary" 
          onClick={() => { resetForm(); setShowAddForm(true); }}
          style={{ padding: '10px 20px', borderRadius: '8px' }}
        >
          + {isZh ? '新增自訂特效' : 'New Transition'}
        </button>
      </div>

      {loading ? (
        <div style={{ color: '#aaa' }}>Loading...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {transitions.map(t => (
            <div 
              key={t.id} 
              style={{ 
                background: 'rgba(255,255,255,0.03)', 
                border: '1px solid rgba(255,255,255,0.06)', 
                borderRadius: '12px', 
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ color: '#fff', margin: 0, fontSize: '18px' }}>{t.name}</h3>
                  <span style={{ 
                    fontSize: '11px', 
                    padding: '2px 8px', 
                    borderRadius: '10px', 
                    background: t.active ? 'rgba(79,255,79,0.15)' : 'rgba(255,79,79,0.15)',
                    color: t.active ? '#4f4' : '#f44',
                    fontWeight: 600
                  }}>
                    {t.active ? (isZh ? '已啟用' : 'Active') : (isZh ? '已停用' : 'Inactive')}
                  </span>
                </div>
                
                <p style={{ color: '#aaa', fontSize: '14px', margin: '4px 0' }}>
                  <strong>ID:</strong> <code style={{ color: '#667eea', fontSize: '13px' }}>{t.id}</code>
                </p>
                <p style={{ color: '#aaa', fontSize: '14px', margin: '4px 0 16px 0' }}>
                  <strong>{isZh ? '持續時間' : 'Duration'}:</strong> {t.duration}ms
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => openEdit(t)} 
                  className="btn-secondary" 
                  style={{ flex: 1, padding: '8px 0', borderRadius: '6px', fontSize: '13px' }}
                >
                  ✏️ {isZh ? '編輯' : 'Edit'}
                </button>
                <button 
                  onClick={() => startSimulation(t)} 
                  className="btn-primary" 
                  style={{ flex: 1, padding: '8px 0', borderRadius: '6px', fontSize: '13px', background: 'linear-gradient(135deg, #11998e, #38ef7d)' }}
                >
                  🧪 {isZh ? '模擬測試' : 'Test Run'}
                </button>
                {!['glitch', 'flash', 'swipe', 'zoom'].includes(t.id) && (
                  <button 
                    onClick={() => handleDelete(t.id)} 
                    style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(255,79,79,0.2)', border: '1px solid rgba(255,79,79,0.4)', color: '#ff4f4f', cursor: 'pointer' }}
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Form Modal */}
      {(showAddForm || editingItem) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#151525', padding: '28px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', width: '680px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ color: '#fff', marginTop: 0, marginBottom: '20px' }}>
              {editingItem ? (isZh ? '編輯轉換特效' : 'Edit Transition') : (isZh ? '新增轉換特效' : 'Create New Transition')}
            </h2>

            <div style={{ display: 'grid', gap: '14px' }}>
              {!editingItem && (
                <div>
                  <label style={{ display: 'block', color: '#aaa', fontSize: '13px', marginBottom: '6px' }}>{isZh ? '特效 ID (英文小寫)' : 'Transition ID (lowercase)'}</label>
                  <input 
                    type="text" 
                    value={fId} 
                    onChange={e => setFId(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))} 
                    placeholder="e.g., my-fade-effect" 
                    style={{ width: '100%', padding: '10px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '6px', color: '#fff' }} 
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', color: '#aaa', fontSize: '13px', marginBottom: '6px' }}>{isZh ? '顯示名稱' : 'Display Name'}</label>
                <input 
                  type="text" 
                  value={fName} 
                  onChange={e => setFName(e.target.value)} 
                  placeholder={isZh ? "淡入淡出" : "Fade In Out"} 
                  style={{ width: '100%', padding: '10px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '6px', color: '#fff' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#aaa', fontSize: '13px', marginBottom: '6px' }}>{isZh ? '特效持續時間 (毫秒)' : 'Transition Duration (ms)'}</label>
                <input 
                  type="number" 
                  value={fDuration} 
                  onChange={e => setFDuration(parseInt(e.target.value) || 1000)} 
                  style={{ width: '100%', padding: '10px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '6px', color: '#fff' }} 
                />
              </div>

              {editingItem && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input 
                    type="checkbox" 
                    id="transition-active"
                    checked={fActive === 1} 
                    onChange={e => setFActive(e.target.checked ? 1 : 0)} 
                    style={{ cursor: 'pointer' }}
                  />
                  <label htmlFor="transition-active" style={{ color: '#fff', fontSize: '14px', cursor: 'pointer' }}>
                    {isZh ? '啟用此特效' : 'Enable Transition'}
                  </label>
                </div>
              )}

              <div>
                <label style={{ display: 'block', color: '#aaa', fontSize: '13px', marginBottom: '6px' }}>
                  {isZh ? '自訂 CSS 樣式與 @keyframes' : 'Custom CSS rules & @keyframes'}
                </label>
                <div style={{ color: '#888', fontSize: '11px', marginBottom: '6px' }}>
                  {isZh 
                    ? `提示: 特效觸發時，系統將建立 class 名稱為 .transition-[ID]-custom 的 full-screen div。` 
                    : `Tip: When triggered, a full-screen div with class .transition-[ID]-custom is created.`}
                </div>
                <textarea 
                  value={fCssCode} 
                  onChange={e => setFCssCode(e.target.value)} 
                  rows={12} 
                  placeholder={`.transition-fade-custom {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: #000;
  animation: my-fade-anim 1.2s forwards;
}
@keyframes my-fade-anim {
  0% { opacity: 1; }
  100% { opacity: 0; }
}`} 
                  style={{ width: '100%', padding: '10px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontFamily: 'monospace', fontSize: '13px' }} 
                />
              </div>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                className="btn-secondary" 
                onClick={() => { setShowAddForm(false); setEditingItem(null); resetForm(); }}
                style={{ padding: '8px 18px', borderRadius: '8px' }}
              >
                {isZh ? '取消' : 'Cancel'}
              </button>
              <button 
                className="btn-primary" 
                onClick={editingItem ? handleUpdate : handleCreate}
                style={{ padding: '8px 18px', borderRadius: '8px' }}
              >
                {editingItem ? (isZh ? '儲存變更' : 'Save Changes') : (isZh ? '新增' : 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simulator Modal (The Interactive Kiosk Simulator Overlay) */}
      {simulatingItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120 }}>
          <div style={{ position: 'relative', width: '420px', height: '740px', background: '#0d0d1a', border: '3px solid #333', borderRadius: '24px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            
            {/* Close Simulator */}
            <button 
              onClick={endSimulation} 
              style={{ position: 'absolute', top: '15px', right: '15px', zIndex: 130, background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', fontSize: '20px', width: '32px', height: '32px', borderRadius: '16px', cursor: 'pointer' }}
            >
              ×
            </button>

            {/* Header branding info */}
            <div style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'center', background: '#121225' }}>
              <span style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
                🎥 {isZh ? 'Kiosk 特效模擬器' : 'Kiosk Simulator'} — {simulatingItem.name}
              </span>
            </div>

            {/* Main view container */}
            <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              
              {/* Countdown Screen */}
              {simStep === 'countdown' && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  {/* Placeholder camera feed input */}
                  <div style={{ position: 'absolute', inset: 0, opacity: 0.35, background: 'radial-gradient(circle, #2a2b4d 0%, #0d0d1a 100%)' }} />
                  
                  {/* Smiley line-art portrait SVG */}
                  <svg width="140" height="140" viewBox="0 0 24 24" fill="none" stroke="#667eea" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8, zIndex: 10 }}>
                    <path d="M18 21a6 6 0 0 0-12 0" />
                    <circle cx="12" cy="10" r="4" />
                    <circle cx="12" cy="12" r="10" />
                  </svg>

                  <div style={{ zIndex: 10, marginTop: '24px', fontSize: '18px', color: '#fff', fontWeight: 600 }}>
                    {isZh ? '擺好姿勢！' : 'Strike a Pose!'}
                  </div>

                  {/* Gigantic overlay countdown text */}
                  <div style={{ 
                    position: 'absolute', 
                    fontSize: '90px', 
                    fontWeight: 800, 
                    color: '#fff', 
                    textShadow: '0 0 20px #667eea', 
                    animation: 'scalePulse 1.0s infinite',
                    zIndex: 20
                  }}>
                    {simCountdown}
                  </div>
                </div>
              )}

              {/* Waiting / Processing UI */}
              {simStep === 'processing' && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0a14' }}>
                  <div className="spinner" style={{ width: '50px', height: '50px', border: '4px solid rgba(255,255,255,0.05)', borderTop: '4px solid #667eea', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '24px' }}></div>
                  <h3 style={{ color: '#fff', margin: '0 0 10px 0', fontSize: '18px' }}>
                    {isZh ? 'AI 智能畫筆調配中...' : 'AI Masterpiece creation...'}
                  </h3>
                  <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>
                    {isZh ? '模擬 AI 生成管線 (請等待 5 秒)' : 'Simulating pipeline (Wait 5s)'}
                  </p>
                </div>
              )}

              {/* Transition effect phase */}
              {simStep === 'transition' && (
                <div style={{ position: 'absolute', inset: 0, background: '#0d0d1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {/* Triggers the dynamic CSS class class we generated */}
                  <div className={`transition-overlay transition-${simulatingItem.id}-custom`} style={{ position: 'absolute', inset: 0 }} />
                  <span style={{ color: '#888', fontSize: '13px', zIndex: 10 }}>Running Transition Animation...</span>
                </div>
              )}

              {/* Final styled AI result view */}
              {simStep === 'result' && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#121225', padding: '24px', animation: 'fadeIn 0.5s forwards' }}>
                  {/* Composed Styled Neon Output SVG */}
                  <div style={{ background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)', width: '100%', height: '360px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', marginBottom: '24px', border: '4px solid #fff' }}>
                    <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.6))' }}>
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                  </div>

                  <h3 style={{ color: '#fff', margin: '0 0 6px 0', fontSize: '20px', fontWeight: 700 }}>
                    {isZh ? 'AI 肖像繪製完成！' : 'AI Portrait Ready!'}
                  </h3>
                  <p style={{ color: '#aaa', fontSize: '13px', margin: 0, textAlign: 'center' }}>
                    {isZh ? '掃描 QR Code 取得高畫質影像' : 'Scan QR code to get your picture'}
                  </p>
                </div>
              )}
            </div>

            {/* Bottom spacer / device simulation bezel details */}
            <div style={{ height: '40px', background: '#121225', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '40px', height: '4px', background: '#555', borderRadius: '2px' }}></div>
            </div>
          </div>
        </div>
      )}

      {/* Embedded CSS animations specific to transitions dashboard */}
      <style>{`
        @keyframes scalePulse {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.15); opacity: 1; }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
