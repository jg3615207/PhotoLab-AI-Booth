import React, { useEffect, useState } from 'react';
import { useAdminLang } from '../context/AdminLangContext';

interface StyleItem {
  id: string;
  name: string;
  thumbnail: string;
}

interface SessionItem {
  id: string;
  name: string;
  allowed_styles: string[];
  allow_auto_print: number;
  frame_cap: number;
  expire_date?: string;
  enable_filters?: number;
  retake_limit?: number;
  qr_bg_color?: string;
  qr_fg_color?: string;
  active: boolean;
  archived?: boolean;
  jobs_count: number;
  logo_path?: string;
  frame_path?: string;
}

export default function SessionsTab() {
  const { lang } = useAdminLang();
  const isZh = lang === 'zh-Hant';

  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [styles, setStyles] = useState<StyleItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [qrModalSession, setQrModalSession] = useState<SessionItem | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Form State
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formAllowedStyles, setFormAllowedStyles] = useState<string[]>([]);
  const [formPrint, setFormPrint] = useState(1);
  const [formCap, setFormCap] = useState(0);
  const [formExpire, setFormExpire] = useState('');
  const [formFilters, setFormFilters] = useState(0);
  const [formRetakes, setFormRetakes] = useState(3);
  const [formQrBg, setFormQrBg] = useState('#ffffff');
  const [formQrFg, setFormQrFg] = useState('#000000');

  // Preview status
  const [logoStatus, setLogoStatus] = useState('');
  const [frameStatus, setFrameStatus] = useState('');
  const [logoPreview, setLogoPreview] = useState('');
  const [framePreview, setFramePreview] = useState('');

  const loadData = async () => {
    try {
      const resSess = await fetch('/api/events');
      const dataSess = await resSess.json();
      setSessions(dataSess || []);

      const resStyles = await fetch('/api/styles?admin=true');
      const dataStyles = await resStyles.json();
      setStyles(dataStyles || []);
    } catch (e) {
      console.error("Failed to load sessions data", e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openNewForm = () => {
    setEditMode(false);
    setFormId('');
    setFormName('');
    setFormAllowedStyles([]);
    setFormPrint(1);
    setFormCap(0);
    setFormExpire('');
    setFormFilters(0);
    setFormRetakes(3);
    setFormQrBg('#ffffff');
    setFormQrFg('#000000');
    setLogoPreview('');
    setFramePreview('');
    setLogoStatus('');
    setFrameStatus('');
    setShowForm(true);
  };

  const openEditForm = (s: SessionItem) => {
    setEditMode(true);
    setFormId(s.id);
    setFormName(s.name);
    setFormAllowedStyles(s.allowed_styles || []);
    setFormPrint(s.allow_auto_print);
    setFormCap(s.frame_cap || 0);
    setFormExpire(s.expire_date || '');
    setFormFilters(s.enable_filters || 0);
    setFormRetakes(s.retake_limit ?? 3);
    setFormQrBg(s.qr_bg_color || '#ffffff');
    setFormQrFg(s.qr_fg_color || '#000000');

    if (s.logo_path) {
      setLogoPreview(`/api/events/${s.id}/logo?t=${Date.now()}`);
      setLogoStatus(isZh ? '已啟用 Logo' : 'Logo active');
    } else {
      setLogoPreview('');
      setLogoStatus(isZh ? '未上傳 Logo' : 'No logo uploaded');
    }

    if (s.frame_path) {
      setFramePreview(`/api/events/${s.id}/frame?t=${Date.now()}`);
      setFrameStatus(isZh ? '已啟用相框' : 'Frame active');
    } else {
      setFramePreview('');
      setFrameStatus(isZh ? '未上傳相框' : 'No frame uploaded');
    }

    setShowForm(true);
  };

  const cloneSession = (s: SessionItem) => {
    openNewForm();
    setFormName(`${s.name} ${isZh ? '的副本' : '(Copy)'}`);
    setFormAllowedStyles(s.allowed_styles || []);
    setFormPrint(s.allow_auto_print);
    setFormCap(s.frame_cap || 0);
    setFormExpire(s.expire_date || '');
    setFormFilters(s.enable_filters || 0);
    setFormRetakes(s.retake_limit ?? 3);
  };

  const handleSave = async () => {
    if (!formId.trim() || !formName.trim()) {
      alert(isZh ? "場次 ID 與名稱為必填項目" : "Session ID and Name are required.");
      return;
    }

    const payload = {
      id: formId.trim(),
      name: formName.trim(),
      allowed_styles: formAllowedStyles,
      allow_auto_print: formPrint,
      frame_cap: formCap,
      expire_date: formExpire,
      enable_filters: formFilters,
      retake_limit: formRetakes,
      qr_bg_color: formQrBg,
      qr_fg_color: formQrFg
    };

    const method = editMode ? 'PUT' : 'POST';
    const url = editMode ? `/api/events/${formId.trim()}` : '/api/events';

    try {
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (r.ok) {
        setShowForm(false);
        loadData();
      } else {
        const err = await r.json();
        alert((isZh ? "儲存失敗: " : "Save failed: ") + (err.detail || 'Unknown error'));
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    try {
      const r = await fetch(`/api/events/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: active ? 1 : 0 })
      });
      if (r.ok) loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleFileUpload = async (type: 'logo' | 'frame', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!formId) return alert(isZh ? "請先儲存場次" : "Save the session first.");

    const form = new FormData();
    form.append('image', file);

    const r = await fetch(`/api/events/${formId}/${type}`, { method: 'POST', body: form });
    if (r.ok) {
      const previewUrl = `/api/events/${formId}/${type}?t=${Date.now()}`;
      if (type === 'logo') {
        setLogoPreview(previewUrl);
        setLogoStatus(file.name + (isZh ? ' 已上傳' : ' uploaded'));
      } else {
        setFramePreview(previewUrl);
        setFrameStatus(file.name + (isZh ? ' 已上傳' : ' uploaded'));
      }
      alert(type.toUpperCase() + (isZh ? " 上傳成功！" : " uploaded successfully!"));
    } else {
      alert((isZh ? "上傳失敗: " : "Failed to upload ") + type);
    }
  };

  const handleBulkArchive = async () => {
    if (!selectedIds.length) return alert(isZh ? "請先選擇要歸檔的場次" : "Select sessions to archive.");
    if (!confirm(isZh ? `確定要歸檔這 ${selectedIds.length} 個場次嗎？` : `Archive ${selectedIds.length} sessions?`)) return;

    const r = await fetch('/api/admin/maintenance/events/bulk-archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedIds })
    });
    if (r.ok) {
      setSelectedIds([]);
      loadData();
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return alert(isZh ? "請先選擇要刪除的場次" : "Select sessions to delete.");
    if (!confirm(isZh ? `確定要永久刪除這 ${selectedIds.length} 個場次嗎？` : `Permanently delete ${selectedIds.length} sessions?`)) return;

    const r = await fetch('/api/admin/maintenance/events/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedIds })
    });
    if (r.ok) {
      setSelectedIds([]);
      loadData();
    }
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDownloadQr = async (qrUrl: string, sessionId: string) => {
    try {
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `qr-code-${sessionId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      window.open(qrUrl, '_blank');
    }
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(sessions.filter(s => !s.archived).map(s => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ color: '#fff', margin: 0 }}>📅 {isZh ? '場次管理' : 'Session Manager'}</h1>
        <button className="btn-primary" onClick={openNewForm} style={{ padding: '10px 20px', borderRadius: '8px' }}>
          + {isZh ? '新增場次' : 'New Session'}
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#151525', padding: '28px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', width: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ color: '#fff', marginTop: 0, marginBottom: '20px' }}>{editMode ? (isZh ? '編輯場次' : 'Edit Session') : (isZh ? '新增場次' : 'Create New Session')}</h2>

            <div style={{ display: 'grid', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', color: '#aaa', fontSize: '13px', marginBottom: '4px' }}>{isZh ? '場次 ID' : 'Session ID'}</label>
                <input 
                  type="text" 
                  value={formId} 
                  disabled={editMode} 
                  onChange={e => setFormId(e.target.value)} 
                  placeholder="summer-party-2026" 
                  style={{ width: '100%', padding: '10px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '6px', color: '#fff' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#aaa', fontSize: '13px', marginBottom: '4px' }}>{isZh ? '活動名稱' : 'Event Name'}</label>
                <input 
                  type="text" 
                  value={formName} 
                  onChange={e => setFormName(e.target.value)} 
                  placeholder="夏日派對 2026" 
                  style={{ width: '100%', padding: '10px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '6px', color: '#fff' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#aaa', fontSize: '13px', marginBottom: '6px' }}>{isZh ? '允許的風格' : 'Allowed Styles'}</label>
                <div style={{ maxHeight: '160px', overflowY: 'auto', background: '#0d0d1a', padding: '12px', borderRadius: '8px', border: '1px solid #333', display: 'grid', gap: '8px' }}>
                  {styles.map(style => (
                    <label key={style.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#ddd', fontSize: '14px' }}>
                      <input 
                        type="checkbox" 
                        value={style.id} 
                        checked={formAllowedStyles.includes(style.id)} 
                        onChange={e => {
                          if (e.target.checked) {
                            setFormAllowedStyles([...formAllowedStyles, style.id]);
                          } else {
                            setFormAllowedStyles(formAllowedStyles.filter(id => id !== style.id));
                          }
                        }} 
                      />
                      <img src={style.thumbnail} style={{ width: '28px', height: '28px', objectFit: 'cover', borderRadius: '4px' }} alt="" />
                      <span>{style.name} ({style.id})</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', color: '#aaa', fontSize: '13px', marginBottom: '4px' }}>{isZh ? '自動列印' : 'Auto Print'}</label>
                  <select value={formPrint} onChange={e => setFormPrint(parseInt(e.target.value))} style={{ width: '100%', padding: '10px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '6px', color: '#fff' }}>
                    <option value={1}>{isZh ? '啟用' : 'Enabled'}</option>
                    <option value={0}>{isZh ? '停用' : 'Disabled'}</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', color: '#aaa', fontSize: '13px', marginBottom: '4px' }}>{isZh ? '張數上限 (0 = 無限制)' : 'Frame Cap (0 = Unlimited)'}</label>
                  <input type="number" value={formCap} onChange={e => setFormCap(parseInt(e.target.value) || 0)} style={{ width: '100%', padding: '10px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '6px', color: '#fff' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', color: '#aaa', fontSize: '13px', marginBottom: '4px' }}>{isZh ? '到期日期' : 'Expiration Date'}</label>
                  <input type="date" value={formExpire} onChange={e => setFormExpire(e.target.value)} style={{ width: '100%', padding: '10px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '6px', color: '#fff' }} />
                </div>

                <div>
                  <label style={{ display: 'block', color: '#aaa', fontSize: '13px', marginBottom: '4px' }}>{isZh ? '重拍次數上限' : 'Retake Limit'}</label>
                  <input type="number" value={formRetakes} onChange={e => setFormRetakes(parseInt(e.target.value) || 0)} style={{ width: '100%', padding: '10px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '6px', color: '#fff' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', color: '#aaa', fontSize: '13px', marginBottom: '4px' }}>{isZh ? 'QR Code 背景顏色' : 'QR Code Background'}</label>
                  <input type="color" value={formQrBg} onChange={e => setFormQrBg(e.target.value)} style={{ width: '100%', height: '40px', padding: '2px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '6px', cursor: 'pointer' }} />
                </div>

                <div>
                  <label style={{ display: 'block', color: '#aaa', fontSize: '13px', marginBottom: '4px' }}>{isZh ? 'QR Code 前景顏色' : 'QR Code Foreground'}</label>
                  <input type="color" value={formQrFg} onChange={e => setFormQrFg(e.target.value)} style={{ width: '100%', height: '40px', padding: '2px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '6px', cursor: 'pointer' }} />
                </div>
              </div>

              {editMode && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#0d0d1a', padding: '12px', borderRadius: '8px' }}>
                    {logoPreview && <img src={logoPreview} style={{ width: '40px', height: '40px', objectFit: 'contain' }} alt="Logo" />}
                    <div style={{ flexGrow: 1 }}>
                      <div style={{ fontSize: '13px', color: '#fff' }}>{isZh ? '活動 Logo' : 'Event Logo'}</div>
                      <div style={{ fontSize: '12px', color: '#888' }}>{logoStatus}</div>
                    </div>
                    <label className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>
                      {isZh ? '上傳 Logo' : 'Upload Logo'}
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFileUpload('logo', e)} />
                    </label>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#0d0d1a', padding: '12px', borderRadius: '8px' }}>
                    {framePreview && <img src={framePreview} style={{ width: '40px', height: '60px', objectFit: 'contain' }} alt="Frame" />}
                    <div style={{ flexGrow: 1 }}>
                      <div style={{ fontSize: '13px', color: '#fff' }}>{isZh ? '自訂邊框 overlay (PNG)' : 'Custom Overlay Frame (PNG)'}</div>
                      <div style={{ fontSize: '12px', color: '#888' }}>{frameStatus}</div>
                    </div>
                    <label className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>
                      {isZh ? '上傳邊框' : 'Upload Frame'}
                      <input type="file" accept="image/png" style={{ display: 'none' }} onChange={e => handleFileUpload('frame', e)} />
                    </label>
                  </div>
                </>
              )}
            </div>

            <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowForm(false)} style={{ padding: '8px 18px', borderRadius: '8px' }}>{isZh ? '取消' : 'Cancel'}</button>
              <button className="btn-primary" onClick={handleSave} style={{ padding: '8px 18px', borderRadius: '8px' }}>{isZh ? '儲存場次' : 'Save Session'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk action buttons */}
      <div style={{ marginBottom: '16px', display: 'flex', gap: '12px' }}>
        <button onClick={handleBulkArchive} className="btn-secondary" style={{ padding: '6px 14px', fontSize: '13px', borderRadius: '6px' }}>{isZh ? '歸檔所選' : 'Archive Selected'}</button>
        <button onClick={handleBulkDelete} style={{ padding: '6px 14px', fontSize: '13px', borderRadius: '6px', background: '#8b2020', color: '#fff', border: 'none', cursor: 'pointer' }}>{isZh ? '刪除所選' : 'Delete Selected'}</button>
      </div>

      {/* Sessions List */}
      <div style={{ background: 'rgba(26, 26, 46, 0.8)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '40px 1.5fr 2fr 1.2fr 2fr', padding: '16px', background: 'rgba(255,255,255,0.03)', fontWeight: 600, color: '#aaa', fontSize: '13px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <input 
            type="checkbox" 
            onChange={e => toggleSelectAll(e.target.checked)} 
            checked={sessions.length > 0 && selectedIds.length === sessions.filter(s => !s.archived).length} 
          />
          <span>{isZh ? '場次 ID' : 'ID'}</span>
          <span>{isZh ? '名稱' : 'Name'}</span>
          <span>{isZh ? '生成張數 (上限)' : 'Generations (Cap)'}</span>
          <span style={{ textAlign: 'right' }}>{isZh ? '操作' : 'Actions'}</span>
        </div>

        {sessions.filter(s => !s.archived).map(s => (
          <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '40px 1.5fr 2fr 1.2fr 2fr', padding: '16px', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '14px' }}>
            <input 
              type="checkbox" 
              checked={selectedIds.includes(s.id)} 
              onChange={e => {
                if (e.target.checked) setSelectedIds([...selectedIds, s.id]);
                else setSelectedIds(selectedIds.filter(id => id !== s.id));
              }} 
            />
            <strong style={{ color: '#fff' }}>{s.id}</strong>
            <span style={{ color: '#ddd' }}>{s.name}</span>
            <span style={{ color: '#aaa' }}>{s.jobs_count} / {s.frame_cap > 0 ? s.frame_cap : '∞'}</span>
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => openEditForm(s)} style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '4px' }}>{isZh ? '編輯' : 'Edit'}</button>
              <button className="btn-secondary" onClick={() => cloneSession(s)} style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '4px' }}>{isZh ? '複製' : 'Clone'}</button>
              <button className="btn-secondary" onClick={() => setQrModalSession(s)} style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '4px' }}>
                {isZh ? 'QR / 連結' : 'QR / Links'}
              </button>
              {s.active ? (
                <button onClick={() => handleToggleActive(s.id, false)} style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '4px', background: '#8b2020', color: '#fff', border: 'none', cursor: 'pointer' }}>{isZh ? '停用' : 'Disable'}</button>
              ) : (
                <button className="btn-primary" onClick={() => handleToggleActive(s.id, true)} style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '4px' }}>{isZh ? '啟用' : 'Enable'}</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Enhanced QR / Links Lightbox Modal */}
      {qrModalSession && (() => {
        const sessionUrl = `${window.location.origin}/?session=${qrModalSession.id}`;
        const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(sessionUrl)}`;

        return (
          <div onClick={() => setQrModalSession(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#151525', padding: '28px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center', width: '460px', maxWidth: '90vw' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ color: '#fff', margin: 0, fontSize: '18px' }}>🔗 {isZh ? '場次連結與 QR Code' : 'Session URL & QR Code'}</h3>
                <button onClick={() => setQrModalSession(null)} style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '24px', cursor: 'pointer' }}>×</button>
              </div>

              {/* URL with Copy Button */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: '#aaa', fontSize: '13px', marginBottom: '6px', textAlign: 'left' }}>{isZh ? '活動連結 (Session URL)' : 'Session Direct Link'}</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    readOnly 
                    value={sessionUrl} 
                    style={{ flexGrow: 1, padding: '10px 12px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '8px', color: '#667eea', fontSize: '13px', fontFamily: 'monospace' }} 
                  />
                  <button 
                    className="btn-primary" 
                    onClick={() => handleCopyLink(sessionUrl)} 
                    style={{ padding: '10px 16px', borderRadius: '8px', whiteSpace: 'nowrap', fontSize: '13px' }}
                  >
                    {copiedLink ? (isZh ? '已複製！' : 'Copied!') : (isZh ? '複製連結' : 'Copy Link')}
                  </button>
                </div>
              </div>

              {/* QR Code Image Container */}
              <div style={{ background: '#fff', padding: '16px', borderRadius: '16px', display: 'inline-block', marginBottom: '16px' }}>
                <img src={qrImgUrl} style={{ width: '240px', height: '240px', display: 'block' }} alt="Session QR" />
              </div>

              {/* Download QR Button */}
              <div>
                <button 
                  className="btn-secondary" 
                  onClick={() => handleDownloadQr(qrImgUrl, qrModalSession.id)} 
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  📥 {isZh ? '下載 QR Code 圖片' : 'Download QR Code Image'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
