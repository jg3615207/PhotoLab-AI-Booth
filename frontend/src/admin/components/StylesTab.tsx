import React, { useEffect, useState, useRef } from 'react';
import { useAdminLang } from '../context/AdminLangContext';

interface StyleItem {
  id: string;
  name: string;
  thumbnail: string;
  prompt_template?: string;
  max_people: number;
  aspect_ratio: string;
  resolution: string;
  seed?: string;
  provider: string;
  v2_model?: string;
  v2_quality?: string;
  transition_type?: string;
  animated_thumbnail?: string;
  dynamic_prompt_enabled?: number;
  active: boolean;
  rh_ref_file?: string;
  rh_ref_url?: string;
  cost_money?: number;
}

interface V2Model {
  id: string;
  name: string;
  has_quality?: boolean;
}

export default function StylesTab() {
  const { lang } = useAdminLang();
  const isZh = lang === 'zh-Hant';

  const [styles, setStyles] = useState<StyleItem[]>([]);
  const [v2Models, setV2Models] = useState<V2Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingStyle, setEditingStyle] = useState<StyleItem | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [testStyle, setTestStyle] = useState<StyleItem | null>(null);

  // Form inputs
  const [fId, setFId] = useState('');
  const [fName, setFName] = useState('');
  const [fPrompt, setFPrompt] = useState('');
  const [fMaxPeople, setFMaxPeople] = useState(1);
  const [fAspect, setFAspect] = useState('16:9');
  const [fResolution, setFResolution] = useState('2k');
  const [fSeed, setFSeed] = useState('');
  const [fProvider, setFProvider] = useState('v2');
  const [fV2Model, setFV2Model] = useState('nb2-cheap');
  const [fV2Quality, setFV2Quality] = useState('medium');
  const [fTransition, setFTransition] = useState('glitch');
  const [fAnimatedThumb, setFAnimatedThumb] = useState('');
  const [fDynamicPrompt, setFDynamicPrompt] = useState(0);
  const [transitionsList, setTransitionsList] = useState<any[]>([]);

  // Undo prompt memory
  const [previousPrompt, setPreviousPrompt] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);

  // Ref files
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refPreviewUrl, setRefPreviewUrl] = useState<string | null>(null);

  // AI Gen Ref Image states
  const [generatingRef, setGeneratingRef] = useState(false);
  const [aiRefPreview, setAiRefPreview] = useState<string | null>(null);
  const [aiRefCost, setAiRefCost] = useState<{ time?: number; money?: number } | null>(null);

  const handleGenerateAiRef = async () => {
    if (!fPrompt.trim()) {
      alert(isZh ? "請先輸入提示詞模板 (Prompt Template)！" : "Please enter a prompt template first!");
      return;
    }
    const targetId = editingStyle ? editingStyle.id : (fId.trim() || 'temp_style');
    setGeneratingRef(true);
    setAiRefPreview(null);
    try {
      const res = await fetch(`/api/styles/${targetId}/generate-ref`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: fPrompt,
          aspect_ratio: fAspect,
          resolution: fResolution,
          v2_model: fV2Model,
          v2_quality: fV2Quality
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "AI generation failed");
      }
      setAiRefPreview(data.preview_url + `?t=${Date.now()}`);
      setAiRefCost({ time: data.cost_time, money: data.cost_money });
    } catch (err: any) {
      alert(isZh ? `AI 生成參考圖失敗: ${err.message}` : `AI Gen Ref failed: ${err.message}`);
    } finally {
      setGeneratingRef(false);
    }
  };

  const handleAcceptAiRef = async () => {
    const targetId = editingStyle ? editingStyle.id : (fId.trim() || 'temp_style');
    try {
      const res = await fetch(`/api/styles/${targetId}/accept-ref`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Accept failed");
      }
      setRefPreviewUrl(data.ref_image + `?t=${Date.now()}`);
      setAiRefPreview(null);
      setRefFile(null);
      loadStyles();
      alert(isZh ? "已成功將 AI 生成圖設為風格參考圖！" : "Accepted AI image as style reference!");
    } catch (err: any) {
      alert(isZh ? `設定參考圖失敗: ${err.message}` : `Accept ref failed: ${err.message}`);
    }
  };

  const handleDiscardAiRef = async () => {
    const targetId = editingStyle ? editingStyle.id : (fId.trim() || 'temp_style');
    try {
      await fetch(`/api/styles/${targetId}/generate-ref`, { method: 'DELETE' });
    } catch (e) {}
    setAiRefPreview(null);
  };

  // Test modal state
  const [testImageBlob, setTestImageBlob] = useState<Blob | null>(null);
  const [testPreviewUrl, setTestPreviewUrl] = useState<string | null>(null);
  const [testTab, setTestTab] = useState<'upload' | 'camera'>('upload');
  const [testModels, setTestModels] = useState<string[]>(['nb2-cheap', '', '', '']);
  const [testResults, setTestResults] = useState<{ [key: number]: { url?: string; error?: string; loading?: boolean } }>({});
  const testVideoRef = useRef<HTMLVideoElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const loadStyles = async () => {
    try {
      const res = await fetch('/api/styles?admin=true');
      const data = await res.json();
      setStyles(data || []);

      const resModels = await fetch('/api/styles/v2-models');
      const dataModels = await resModels.json();
      setV2Models(dataModels || []);

      const resTrans = await fetch('/api/transitions/list');
      const dataTrans = await resTrans.json();
      setTransitionsList(dataTrans || []);
    } catch (e) {
      console.error("Failed to load styles", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStyles();
  }, []);

  const handleCreateStyle = async () => {
    if (!fId.trim() || !fName.trim()) {
      alert(isZh ? "請輸入風格 ID 和顯示名稱" : "Style ID and Display Name are required.");
      return;
    }

    const form = new FormData();
    form.append('id', fId.trim());
    form.append('name', fName.trim());
    form.append('max_people', fMaxPeople.toString());
    form.append('aspect_ratio', fAspect);
    form.append('prompt_template', fPrompt);
    form.append('resolution', fResolution);
    form.append('seed', fSeed);
    form.append('provider', fProvider);
    form.append('v2_model', fV2Model);
    form.append('v2_quality', fV2Quality);
    form.append('transition_type', fTransition);
    form.append('animated_thumbnail', fAnimatedThumb);
    form.append('dynamic_prompt_enabled', fDynamicPrompt.toString());

    const r = await fetch('/api/styles', { method: 'POST', body: form });
    if (r.ok) {
      if (refFile) {
        const refForm = new FormData();
        refForm.append('image', refFile);
        await fetch(`/api/styles/${fId.trim()}/ref-image`, { method: 'POST', body: refForm });
      }
      setShowAddForm(false);
      resetForm();
      loadStyles();
    } else {
      let errMsg = 'Error';
      try {
        const text = await r.text();
        try {
          const err = JSON.parse(text);
          errMsg = err.detail || JSON.stringify(err);
        } catch (e) {
          errMsg = text;
        }
      } catch (e) {
        errMsg = r.statusText || 'Error';
      }
      alert((isZh ? "建立風格失敗: " : "Create style failed: ") + errMsg);
    }
  };

  const resetForm = () => {
    setFId('');
    setFName('');
    setFPrompt('');
    setFMaxPeople(1);
    setFAspect('16:9');
    setFResolution('2k');
    setFSeed('');
    setFProvider('v2');
    setFV2Model('nb2-cheap');
    setFV2Quality('medium');
    setFTransition('glitch');
    setFAnimatedThumb('');
    setFDynamicPrompt(0);
    setRefFile(null);
    setRefPreviewUrl(null);
  };

  const openEditModal = (s: StyleItem) => {
    setEditingStyle(s);
    setFId(s.id);
    setFName(s.name);
    setFPrompt(s.prompt_template || '');
    setFMaxPeople(s.max_people || 1);
    setFAspect(s.aspect_ratio || '16:9');
    setFResolution(s.resolution || '2k');
    setFSeed(s.seed || '');
    setFProvider(s.provider || 'v2');
    setFV2Model(s.v2_model || 'nb2-cheap');
    setFV2Quality(s.v2_quality || 'medium');
    setFTransition(s.transition_type || 'glitch');
    setFAnimatedThumb(s.animated_thumbnail || '');
    setFDynamicPrompt(s.dynamic_prompt_enabled || 0);

    if (s.rh_ref_file || s.rh_ref_url) {
      setRefPreviewUrl(`/api/styles/${s.id}/ref.jpg?t=${Date.now()}`);
    } else {
      setRefPreviewUrl(null);
    }
    setRefFile(null);
  };

  const handleSaveEdit = async () => {
    if (!editingStyle) return;

    const form = new FormData();
    form.append('name', fName);
    form.append('prompt_template', fPrompt);
    form.append('max_people', fMaxPeople.toString());
    form.append('aspect_ratio', fAspect);
    form.append('resolution', fResolution);
    form.append('seed', fSeed);
    form.append('provider', fProvider);
    if (fProvider === 'v2') {
      form.append('v2_model', fV2Model);
      form.append('v2_quality', fV2Quality);
    }
    form.append('transition_type', fTransition);
    form.append('animated_thumbnail', fAnimatedThumb);
    form.append('dynamic_prompt_enabled', fDynamicPrompt.toString());

    const r = await fetch(`/api/styles/${editingStyle.id}`, { method: 'PUT', body: form });
    if (r.ok) {
      if (refFile) {
        const refForm = new FormData();
        refForm.append('image', refFile);
        await fetch(`/api/styles/${editingStyle.id}/ref-image`, { method: 'POST', body: refForm });
      }
      setEditingStyle(null);
      resetForm();
      loadStyles();
    } else {
      let errMsg = 'Error';
      try {
        const text = await r.text();
        try {
          const err = JSON.parse(text);
          errMsg = err.detail || JSON.stringify(err);
        } catch (e) {
          errMsg = text;
        }
      } catch (e) {
        errMsg = r.statusText || 'Error';
      }
      alert((isZh ? "儲存失敗: " : "Save style failed: ") + errMsg);
    }
  };

  const handleToggleActive = async (id: string, active: boolean, dynamicPromptEnabled?: number) => {
    const f = new FormData();
    f.append('active', active ? '1' : '0');
    if (dynamicPromptEnabled !== undefined) {
      f.append('dynamic_prompt_enabled', dynamicPromptEnabled.toString());
    }
    await fetch(`/api/styles/${id}`, { method: 'PUT', body: f });
    loadStyles();
  };

  const handleDeleteStyle = async (id: string) => {
    if (!window.confirm(isZh ? "您確定要永久刪除此風格嗎？此動作無法復原！" : "Are you sure you want to permanently delete this style? This action cannot be undone!")) {
      return;
    }
    const r = await fetch(`/api/styles/${id}`, { method: 'DELETE' });
    if (r.ok) {
      loadStyles();
    } else {
      let errMsg = 'Error';
      try {
        const text = await r.text();
        try {
          const err = JSON.parse(text);
          errMsg = err.detail || JSON.stringify(err);
        } catch (e) {
          errMsg = text;
        }
      } catch (e) {
        errMsg = r.statusText || 'Error';
      }
      alert((isZh ? "刪除風格失敗: " : "Delete style failed: ") + errMsg);
    }
  };

  const handleOptimizePrompt = async () => {
    if (!fPrompt.trim()) return alert(isZh ? "請先輸入提示詞" : "Enter a prompt first.");
    setOptimizing(true);
    try {
      const form = new FormData();
      form.append('raw_prompt', fPrompt);
      const r = await fetch('/api/styles/optimize-prompt', { method: 'POST', body: form });
      const data = await r.json();
      if (r.ok) {
        setPreviousPrompt(fPrompt);
        setFPrompt(data.optimized_prompt);
      } else {
        alert(isZh ? "優化失敗: " + data.detail : "Optimization failed: " + data.detail);
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setOptimizing(false);
    }
  };

  const handleVisionOptimize = async () => {
    let fileToUse = refFile;
    if (!fileToUse && editingStyle && refPreviewUrl) {
      try {
        const res = await fetch(refPreviewUrl);
        const blob = await res.blob();
        fileToUse = new File([blob], 'ref.jpg', { type: 'image/jpeg' });
      } catch (e) {}
    }

    if (!fileToUse) {
      alert(isZh ? "請先選取參考圖片" : "Select a reference image first.");
      return;
    }

    setOptimizing(true);
    try {
      const form = new FormData();
      form.append('image', fileToUse);
      const r = await fetch('/api/styles/analyze-vision', { method: 'POST', body: form });
      const data = await r.json();
      if (r.ok) {
        setPreviousPrompt(fPrompt);
        setFPrompt(data.optimized_prompt);
      } else {
        alert(isZh ? "視覺分析失敗: " + data.detail : "Vision analysis failed: " + data.detail);
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setOptimizing(false);
    }
  };

  const handleUndoPrompt = () => {
    if (previousPrompt !== null) {
      setFPrompt(previousPrompt);
      setPreviousPrompt(null);
    }
  };

  const handleRefUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRefFile(file);
      setRefPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleUploadFrame = async (styleId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png';
    input.onchange = async () => {
      if (!input.files?.[0]) return;
      const form = new FormData();
      form.append('image', input.files[0]);
      const r = await fetch(`/api/styles/${styleId}/frame`, { method: 'POST', body: form });
      if (r.ok) {
        alert(isZh ? "相框 PNG 已上傳成功！" : "Overlay Frame uploaded successfully!");
        loadStyles();
      }
    };
    input.click();
  };

  // Test Modal
  const openTestModal = (s: StyleItem) => {
    setTestStyle(s);
    setFPrompt(s.prompt_template || '');
    setFResolution(s.resolution || '2k');
    setFV2Quality(s.v2_quality || 'medium');
    setFAspect(s.aspect_ratio || '16:9');
    setFSeed(s.seed || '');
    setTestModels([s.v2_model || 'nb2-cheap', '', '', '']);
    setTestResults({});
    setTestImageBlob(null);
    setTestPreviewUrl(null);
    setTestTab('upload');
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1080 }, height: { ideal: 1920 } } });
      setCameraStream(stream);
      if (testVideoRef.current) {
        testVideoRef.current.srcObject = stream;
      }
    } catch (e: any) {
      alert(isZh ? "相機錯誤: " + e.message : "Camera error: " + e.message);
      setTestTab('upload');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      setCameraStream(null);
    }
  };

  const capturePhoto = () => {
    if (testVideoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = testVideoRef.current.videoWidth;
      canvas.height = testVideoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(testVideoRef.current, 0, 0);
        canvas.toBlob(blob => {
          if (blob) {
            setTestImageBlob(blob);
            setTestPreviewUrl(URL.createObjectURL(blob));
            stopCamera();
            setTestTab('upload');
          }
        }, 'image/jpeg', 0.95);
      }
    }
  };

  const handleRunTest = async () => {
    if (!testImageBlob || !testStyle) return alert(isZh ? "請先拍攝或選擇測試照片" : "Select or capture a test photo first.");

    testModels.forEach(async (modelId, index) => {
      if (!modelId) return;

      setTestResults(prev => ({ ...prev, [index]: { loading: true } }));

      const form = new FormData();
      form.append('image', testImageBlob, 'test.jpg');
      form.append('style_id', testStyle.id);
      form.append('capture_source', 'test');
      if (fPrompt) form.append('prompt_override', fPrompt);
      if (modelId) form.append('model_override', modelId);
      if (fResolution) form.append('resolution_override', fResolution);
      if (fV2Quality) form.append('quality_override', fV2Quality);
      if (fAspect) form.append('aspect_override', fAspect);
      if (fSeed) form.append('seed_override', fSeed);

      try {
        const r = await fetch('/api/capture', { method: 'POST', body: form });
        const data = await r.json();
        if (data.error) {
          setTestResults(prev => ({ ...prev, [index]: { error: data.error, loading: false } }));
        } else if (data.job_id) {
          pollTestJob(data.job_id, index);
        }
      } catch (e: any) {
        setTestResults(prev => ({ ...prev, [index]: { error: e.message, loading: false } }));
      }
    });
  };

  const pollTestJob = (jobId: string, index: number) => {
    const iv = setInterval(async () => {
      try {
        const r = await fetch(`/api/job/${jobId}`);
        const job = await r.json();
        if (job.status === 'done') {
          clearInterval(iv);
          const fn = job.print_image ? job.print_image.split(/[/\\]/).slice(-2).join('/') : job.output_image;
          setTestResults(prev => ({ ...prev, [index]: { url: `/api/images/${fn}`, job_id: jobId, loading: false } }));
        } else if (job.status === 'failed') {
          clearInterval(iv);
          setTestResults(prev => ({ ...prev, [index]: { error: job.error_message || 'Failed', loading: false } }));
        }
      } catch (e) {}
    }, 1500);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ color: '#fff', margin: 0 }}>🎨 {isZh ? '風格庫管理' : 'Style Library'}</h1>
        <button className="btn-primary" onClick={() => { resetForm(); setShowAddForm(true); }} style={{ padding: '10px 20px', borderRadius: '8px' }}>
          + {isZh ? '新增風格' : 'New Style'}
        </button>
      </div>

      {/* Add / Edit Form Modal */}
      {(showAddForm || editingStyle) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#151525', padding: '28px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', width: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ color: '#fff', marginTop: 0, marginBottom: '20px' }}>
              {editingStyle ? (isZh ? '編輯風格' : 'Edit Style') : (isZh ? '新增風格' : 'Create New Style')}
            </h2>

            <div style={{ display: 'grid', gap: '14px' }}>
              {!editingStyle && (
                <div>
                  <label style={{ display: 'block', color: '#aaa', fontSize: '13px', marginBottom: '4px' }}>{isZh ? '風格 ID' : 'Style ID'}</label>
                  <input type="text" value={fId} onChange={e => setFId(e.target.value)} placeholder="ghibli-dream" style={{ width: '100%', padding: '10px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '6px', color: '#fff' }} />
                </div>
              )}

              <div>
                <label style={{ display: 'block', color: '#aaa', fontSize: '13px', marginBottom: '4px' }}>{isZh ? '顯示名稱' : 'Display Name'}</label>
                <input type="text" value={fName} onChange={e => setFName(e.target.value)} placeholder="吉卜力夢幻" style={{ width: '100%', padding: '10px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '6px', color: '#fff' }} />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ color: '#aaa', fontSize: '13px' }}>{isZh ? '提示詞模板' : 'Prompt Template'}</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {previousPrompt !== null && (
                      <button className="btn-secondary" onClick={handleUndoPrompt} style={{ padding: '4px 8px', fontSize: '11px' }}>↩ {isZh ? '復原' : 'Undo'}</button>
                    )}
                    <button className="btn-secondary" onClick={handleVisionOptimize} disabled={optimizing} style={{ padding: '4px 8px', fontSize: '11px' }}>📷 {isZh ? '視覺參考圖 AI' : 'Vision Ref AI'}</button>
                    <button className="btn-primary" onClick={handleOptimizePrompt} disabled={optimizing} style={{ padding: '4px 8px', fontSize: '11px' }}>✨ {isZh ? '優化提示詞' : 'Optimize Prompt'}</button>
                  </div>
                </div>
                <textarea value={fPrompt} onChange={e => setFPrompt(e.target.value)} rows={4} placeholder="吉卜力動漫風格，保留臉部特徵..." style={{ width: '100%', padding: '10px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontFamily: 'inherit' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: '#0d0d1a', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {refPreviewUrl && <img src={refPreviewUrl} style={{ width: '48px', height: '72px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)' }} alt="Ref" />}
                    <div>
                      <div style={{ fontSize: '13px', color: '#fff', fontWeight: 600 }}>{isZh ? '參考圖片 (Reference Image)' : 'Reference Image'}</div>
                      <div style={{ fontSize: '12px', color: '#888' }}>
                        {refFile ? refFile.name : (refPreviewUrl ? (isZh ? '已設定官方參考圖' : 'Active reference set') : (isZh ? '未設定參考圖片' : 'No reference image'))}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      type="button" 
                      className="btn-primary" 
                      onClick={handleGenerateAiRef} 
                      disabled={generatingRef} 
                      style={{ padding: '6px 14px', fontSize: '12px', background: 'linear-gradient(135deg, #ff007f, #764ba2)', borderRadius: '6px' }}
                    >
                      {generatingRef ? (isZh ? '⌛ AI 生成中...' : '⌛ Generating...') : (isZh ? '✨ AI 生成參考圖' : '✨ AI Gen Ref')}
                    </button>

                    <label className="btn-secondary" style={{ padding: '6px 14px', fontSize: '12px', cursor: 'pointer', borderRadius: '6px' }}>
                      📁 {isZh ? '上傳參考圖' : 'Upload Ref'}
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleRefUpload} />
                    </label>
                  </div>
                </div>

                {/* AI Generated Preview Panel */}
                {aiRefPreview && (
                  <div style={{ marginTop: '10px', background: 'rgba(255,0,127,0.08)', border: '1px solid rgba(255,0,127,0.4)', borderRadius: '8px', padding: '12px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <img src={aiRefPreview} alt="AI Preview" style={{ width: '80px', height: '120px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #ff007f' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#ff77bc', marginBottom: '4px' }}>
                        ✨ {isZh ? 'AI 參考圖片生成成功！' : 'AI Reference Image Generated!'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '10px' }}>
                        {aiRefCost?.time && `${(aiRefCost.time/1000).toFixed(1)}s`} {aiRefCost?.money && `| $${aiRefCost.money.toFixed(4)}`}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          type="button"
                          className="btn-primary" 
                          onClick={handleAcceptAiRef} 
                          style={{ padding: '6px 14px', fontSize: '12px', background: '#38ef7d', color: '#000', fontWeight: 700, borderRadius: '6px' }}
                        >
                          ✅ {isZh ? '設為風格參考圖' : 'Set as Reference'}
                        </button>
                        <button 
                          type="button"
                          className="btn-secondary" 
                          onClick={handleDiscardAiRef} 
                          style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '6px' }}
                        >
                          ❌ {isZh ? '捨棄' : 'Discard'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', color: '#aaa', fontSize: '13px', marginBottom: '4px' }}>{isZh ? '最多人數' : 'Max People'}</label>
                  <input type="number" value={fMaxPeople} min={1} max={20} onChange={e => setFMaxPeople(parseInt(e.target.value) || 1)} style={{ width: '100%', padding: '10px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '6px', color: '#fff' }} />
                </div>

                <div>
                  <label style={{ display: 'block', color: '#aaa', fontSize: '13px', marginBottom: '4px' }}>{isZh ? '畫面比例' : 'Aspect Ratio'}</label>
                  <select value={fAspect} onChange={e => setFAspect(e.target.value)} style={{ width: '100%', padding: '10px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '6px', color: '#fff' }}>
                    <option value="1:1">1:1</option>
                    <option value="2:3">2:3</option>
                    <option value="3:2">3:2</option>
                    <option value="16:9">16:9</option>
                    <option value="9:16">9:16</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', color: '#aaa', fontSize: '13px', marginBottom: '4px' }}>{isZh ? '解析度' : 'Resolution'}</label>
                  <select value={fResolution} onChange={e => setFResolution(e.target.value)} style={{ width: '100%', padding: '10px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '6px', color: '#fff' }}>
                    <option value="2k">2k</option>
                    <option value="1k">1k</option>
                    <option value="4k">4k</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', color: '#aaa', fontSize: '13px', marginBottom: '4px' }}>{isZh ? 'AI 模型' : 'V2 AI Model'}</label>
                  <select value={fV2Model} onChange={e => setFV2Model(e.target.value)} style={{ width: '100%', padding: '10px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '6px', color: '#fff' }}>
                    <option value="nb2-cheap">Nano Banana 2 — ~$0.027/2k</option>
                    <option value="nb-pro">Nano Banana Pro — ~$0.035/2k</option>
                    <option value="gpt2-official">GPT Image 2 Official — ~$0.045/2k</option>
                    <option value="gpt2-cheap">GPT Image 2 Cheap — ~$0.028/2k</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', color: '#aaa', fontSize: '13px', marginBottom: '4px' }}>{isZh ? '揭曉動畫' : 'Reveal Transition'}</label>
                  <select value={fTransition} onChange={e => setFTransition(e.target.value)} style={{ width: '100%', padding: '10px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '6px', color: '#fff' }}>
                    {transitionsList.map(t => (
                      <option key={t.id} value={t.id}>{t.is_favorite ? `⭐ ${t.name}` : t.name}</option>
                    ))}
                    <option value="random">{isZh ? 'Random (隨機)' : 'Random'}</option>
                    <option value="none">{isZh ? 'None (無)' : 'None'}</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'center' }}>
                <div>
                  <label style={{ display: 'block', color: '#aaa', fontSize: '13px', marginBottom: '4px' }}>{isZh ? '動畫預覽檔名 / URL' : 'Animated Preview File/URL'}</label>
                  <input 
                    type="text" 
                    value={fAnimatedThumb} 
                    onChange={e => setFAnimatedThumb(e.target.value)} 
                    placeholder="e.g., preview.mp4 or preview.gif" 
                    style={{ width: '100%', padding: '10px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '6px', color: '#fff' }} 
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', height: '100%', paddingTop: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', color: '#aaa', fontSize: '13px', cursor: 'pointer', gap: '8px' }}>
                    <input 
                      type="checkbox" 
                      checked={fDynamicPrompt === 1} 
                      onChange={e => setFDynamicPrompt(e.target.checked ? 1 : 0)} 
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    {isZh ? '啟用視覺動態提示詞' : 'Enable Vision Dynamic Prompt'}
                  </label>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => { setShowAddForm(false); setEditingStyle(null); }} style={{ padding: '8px 18px', borderRadius: '8px' }}>{isZh ? '取消' : 'Cancel'}</button>
              <button className="btn-primary" onClick={editingStyle ? handleSaveEdit : handleCreateStyle} style={{ padding: '8px 18px', borderRadius: '8px' }}>
                {editingStyle ? (isZh ? '儲存變更' : 'Save Changes') : (isZh ? '建立風格' : 'Create Style')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Modal with 4 Grid Models Comparison */}
      {testStyle && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120 }}>
          <div style={{ background: '#151525', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', width: '760px', maxHeight: '95vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ color: '#fff', margin: 0, fontSize: '20px' }}>🧪 {isZh ? '測試風格' : 'Test Style'}: {testStyle.name}</h2>
              <button onClick={() => { stopCamera(); setTestStyle(null); }} style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button className={`btn-secondary ${testTab === 'upload' ? 'btn-primary' : ''}`} onClick={() => { stopCamera(); setTestTab('upload'); }} style={{ padding: '6px 16px', fontSize: '13px' }}>📁 {isZh ? '上傳測試照片' : 'Upload Test Photo'}</button>
              <button className={`btn-secondary ${testTab === 'camera' ? 'btn-primary' : ''}`} onClick={() => { setTestTab('camera'); startCamera(); }} style={{ padding: '6px 16px', fontSize: '13px' }}>📷 {isZh ? '相機拍攝' : 'Webcam Capture'}</button>
            </div>

            <div style={{ width: '100%', height: '200px', background: '#0d0d1a', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', overflow: 'hidden', position: 'relative' }}>
              {testTab === 'camera' ? (
                <>
                  <video ref={testVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button className="btn-primary" onClick={capturePhoto} style={{ position: 'absolute', bottom: '12px', padding: '8px 20px', borderRadius: '20px' }}>📸 {isZh ? '拍攝' : 'Take Photo'}</button>
                </>
              ) : testPreviewUrl ? (
                <div style={{ position: 'relative', display: 'inline-block', maxHeight: '100%' }}>
                  <img src={testPreviewUrl} style={{ maxHeight: '140px', objectFit: 'contain', borderRadius: '8px' }} alt="Test input" />
                  <button 
                    onClick={() => {
                      setTestImageBlob(null);
                      setTestPreviewUrl(null);
                    }}
                    style={{
                      position: 'absolute',
                      top: '-8px',
                      right: '-8px',
                      background: '#ff4f4f',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      fontWeight: 'bold',
                      fontSize: '12px',
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title={isZh ? "清除所選照片" : "Clear selected photo"}
                  >
                    ✖
                  </button>
                </div>
              ) : (
                <label className="btn-secondary" style={{ cursor: 'pointer' }}>
                  {isZh ? '選擇圖片' : 'Choose Image'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                    if (e.target.files?.[0]) {
                      setTestImageBlob(e.target.files[0]);
                      setTestPreviewUrl(URL.createObjectURL(e.target.files[0]));
                    }
                  }} />
                </label>
              )}
            </div>

            {/* Model grid comparison slots */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
              {[0, 1, 2, 3].map((slotIdx) => (
                <div key={slotIdx} style={{ background: '#0d0d1a', padding: '10px', borderRadius: '8px', textAlign: 'center', minHeight: '180px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <select 
                    value={testModels[slotIdx]} 
                    onChange={e => {
                      const updated = [...testModels];
                      updated[slotIdx] = e.target.value;
                      setTestModels(updated);
                    }}
                    style={{ fontSize: '11px', padding: '4px', background: '#1a1a2e', border: '1px solid #333', color: '#fff', borderRadius: '4px', marginBottom: '8px' }}
                  >
                    <option value="">({isZh ? '無' : 'None'})</option>
                    <option value="nb2-cheap">Nano Banana 2</option>
                    <option value="nb-pro">Nano Banana Pro</option>
                    <option value="gpt2-official">GPT Image 2 Official</option>
                    <option value="gpt2-cheap">GPT Image 2 Cheap</option>
                  </select>

                  <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    {testResults[slotIdx]?.loading ? (
                      <span style={{ color: '#667eea', fontSize: '12px' }}>{isZh ? '運行中...' : 'Running...'}</span>
                    ) : testResults[slotIdx]?.error ? (
                      <span style={{ color: '#f44', fontSize: '11px' }}>{testResults[slotIdx].error}</span>
                    ) : testResults[slotIdx]?.url ? (
                      <>
                        <img 
                          src={testResults[slotIdx].url} 
                          style={{ maxWidth: '100%', maxHeight: '110px', objectFit: 'contain', borderRadius: '4px', cursor: 'pointer' }} 
                          onClick={() => setLightboxUrl(testResults[slotIdx].url!)} 
                          alt="Test output" 
                        />
                        <button
                          onClick={async () => {
                            const jid = testResults[slotIdx]?.job_id;
                            if (!jid) return;
                            try {
                              const r = await fetch(`/api/capture/reprint/${jid}`, { method: 'POST' });
                              if (r.ok) alert(isZh ? "已將此測試照片加入列印隊列！" : "Sent to printer queue!");
                              else alert(isZh ? "加入列印隊列失敗" : "Failed to queue print");
                            } catch (e: any) {
                              alert(e.message);
                            }
                          }}
                          style={{
                            marginTop: '6px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            borderRadius: '6px',
                            background: 'linear-gradient(135deg, #667eea, #764ba2)',
                            color: '#fff',
                            border: 'none',
                            cursor: 'pointer',
                            width: '100%',
                            fontWeight: 600
                          }}
                        >
                          🖨️ {isZh ? '列印測試圖' : 'Print Test'}
                        </button>
                      </>
                    ) : (
                      <span style={{ color: '#555', fontSize: '11px' }}>{isZh ? '空位' : 'Empty Slot'}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button className="btn-primary" onClick={handleRunTest} style={{ width: '100%', padding: '10px' }}>
              🚀 {isZh ? '開始多模型比較測試' : 'Run Multi-Model Comparison Test'}
            </button>
          </div>
        </div>
      )}

      {/* Styles List */}
      {loading ? (
        <div style={{ color: '#888', padding: '32px', textAlign: 'center' }}>{isZh ? '載入風格中...' : 'Loading styles...'}</div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {styles.map(s => (
            <div key={s.id} style={{ background: 'rgba(26, 26, 46, 0.8)', padding: '16px', borderRadius: '12px', display: 'grid', gridTemplateColumns: '80px 1.5fr 2fr 1fr 1fr auto', alignItems: 'center', gap: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
              {/* FIXED THUMBNAIL SRC - NO EXTRA /api PREPENDED */}
              <img 
                src={s.thumbnail} 
                onClick={() => setLightboxUrl(s.thumbnail)} 
                onError={(e) => { (e.target as HTMLElement).style.background = '#2a2a4e'; }} 
                style={{ width: '60px', height: '90px', objectFit: 'cover', borderRadius: '6px', cursor: 'pointer' }} 
                alt={s.name} 
              />

              <div>
                <strong style={{ fontSize: '16px', color: '#fff' }}>{s.name}</strong>
                <div style={{ fontSize: '12px', color: '#888' }}>{s.id}</div>
              </div>

              <div>
                <div style={{ fontSize: '13px', color: '#bbb', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                  {s.prompt_template || <i>{isZh ? '無提示詞' : 'No prompt template'}</i>}
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className={`status ${s.rh_ref_file ? 'status-active' : 'status-inactive'}`} style={{ fontSize: '11px' }}>
                    ref {s.rh_ref_file ? 'OK' : (isZh ? '無' : 'None')}
                  </span>

                  {/* VISION DYNAMIC PROMPT BADGE & TOGGLE */}
                  <span 
                    onClick={() => handleToggleActive(s.id, s.active === 1, s.dynamic_prompt_enabled === 1 ? 0 : 1)}
                    title={isZh ? '點擊切換視覺動態提示詞' : 'Click to toggle Vision Dynamic Prompt'}
                    style={{ 
                      fontSize: '11px', 
                      padding: '2px 8px', 
                      borderRadius: '10px', 
                      background: s.dynamic_prompt_enabled === 1 ? 'rgba(0,210,255,0.18)' : 'rgba(255,255,255,0.05)', 
                      color: s.dynamic_prompt_enabled === 1 ? '#00d2ff' : '#888', 
                      border: s.dynamic_prompt_enabled === 1 ? '1px solid rgba(0,210,255,0.4)' : '1px solid rgba(255,255,255,0.12)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    👁️ {isZh ? (s.dynamic_prompt_enabled === 1 ? 'Vision動態: 開' : 'Vision動態: 關') : (s.dynamic_prompt_enabled === 1 ? 'Vision: ON' : 'Vision: OFF')}
                  </span>
                </div>
              </div>

              <div style={{ fontSize: '12px', color: '#aaa' }}>
                <div>{isZh ? '最多' : 'Max'}: {s.max_people}</div>
                <div>{s.aspect_ratio} ({s.resolution})</div>
              </div>

              <div>
                <span className={`status ${s.active ? 'status-active' : 'status-inactive'}`}>
                  {s.active ? (isZh ? '啟用' : 'Active') : (isZh ? '隱藏' : 'Hidden')}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button className="btn-secondary" onClick={() => handleUploadFrame(s.id)} style={{ padding: '6px 10px', fontSize: '12px' }}>{isZh ? '邊框 PNG' : 'Frame PNG'}</button>
                <button className="btn-primary" onClick={() => openEditModal(s)} style={{ padding: '6px 12px', fontSize: '12px' }}>{isZh ? '編輯' : 'Edit'}</button>
                <button className="btn-secondary" onClick={() => openTestModal(s)} style={{ padding: '6px 12px', fontSize: '12px' }}>{isZh ? '測試' : 'Test'}</button>
                {s.active ? (
                  <button onClick={() => handleToggleActive(s.id, false)} style={{ padding: '6px 10px', fontSize: '12px', background: '#8b2020', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>{isZh ? '隱藏' : 'Hide'}</button>
                ) : (
                  <button className="btn-primary" onClick={() => handleToggleActive(s.id, true)} style={{ padding: '6px 10px', fontSize: '12px' }}>{isZh ? '顯示' : 'Show'}</button>
                )}
                <button onClick={() => handleDeleteStyle(s.id)} style={{ padding: '6px 10px', fontSize: '12px', background: '#d32f2f', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>{isZh ? '刪除' : 'Delete'}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxUrl && (
        <div onClick={() => setLightboxUrl(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 250, cursor: 'pointer' }}>
          <img src={lightboxUrl} style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '12px' }} alt="Full view" />
        </div>
      )}
    </div>
  );
}
