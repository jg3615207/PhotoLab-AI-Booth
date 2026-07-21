import React, { useEffect, useState, useRef } from 'react';

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

  // Undo prompt memory
  const [previousPrompt, setPreviousPrompt] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);

  // Ref files
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refPreviewUrl, setRefPreviewUrl] = useState<string | null>(null);

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
      alert("Style ID and Display Name are required.");
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
      const err = await r.json();
      alert("Create style failed: " + (err.detail || 'Error'));
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
      const err = await r.json();
      alert("Save style failed: " + (err.detail || 'Error'));
    }
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    const f = new FormData();
    f.append('active', active ? '1' : '0');
    await fetch(`/api/styles/${id}`, { method: 'PUT', body: f });
    loadStyles();
  };

  const handleOptimizePrompt = async () => {
    if (!fPrompt.trim()) return alert("Enter a prompt first.");
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
        alert("Optimization failed: " + data.detail);
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
      alert("Select a reference image first.");
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
        alert("Vision analysis failed: " + data.detail);
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
        alert("Overlay Frame uploaded successfully!");
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
      alert("Camera error: " + e.message);
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
    if (!testImageBlob || !testStyle) return alert("Select or capture a test photo first.");

    testModels.forEach(async (modelId, index) => {
      if (!modelId) return;

      setTestResults(prev => ({ ...prev, [index]: { loading: true } }));

      const form = new FormData();
      form.append('image', testImageBlob, 'test.jpg');
      form.append('style_id', testStyle.id);
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
          setTestResults(prev => ({ ...prev, [index]: { url: `/api/images/${fn}`, loading: false } }));
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
        <h1 style={{ color: '#fff', margin: 0 }}>🎨 Style Library</h1>
        <button className="btn-primary" onClick={() => { resetForm(); setShowAddForm(true); }} style={{ padding: '10px 20px', borderRadius: '8px' }}>
          + New Style
        </button>
      </div>

      {/* Add / Edit Form Modal */}
      {(showAddForm || editingStyle) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#151525', padding: '28px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', width: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ color: '#fff', marginTop: 0, marginBottom: '20px' }}>{editingStyle ? 'Edit Style' : 'Create New Style'}</h2>

            <div style={{ display: 'grid', gap: '14px' }}>
              {!editingStyle && (
                <div>
                  <label style={{ display: 'block', color: '#aaa', fontSize: '13px', marginBottom: '4px' }}>Style ID</label>
                  <input type="text" value={fId} onChange={e => setFId(e.target.value)} placeholder="ghibli-dream" style={{ width: '100%', padding: '10px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '6px', color: '#fff' }} />
                </div>
              )}

              <div>
                <label style={{ display: 'block', color: '#aaa', fontSize: '13px', marginBottom: '4px' }}>Display Name</label>
                <input type="text" value={fName} onChange={e => setFName(e.target.value)} placeholder="Ghibli Dream" style={{ width: '100%', padding: '10px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '6px', color: '#fff' }} />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ color: '#aaa', fontSize: '13px' }}>Prompt Template</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {previousPrompt !== null && (
                      <button className="btn-secondary" onClick={handleUndoPrompt} style={{ padding: '4px 8px', fontSize: '11px' }}>↩ Undo</button>
                    )}
                    <button className="btn-secondary" onClick={handleVisionOptimize} disabled={optimizing} style={{ padding: '4px 8px', fontSize: '11px' }}>📷 Vision Ref AI</button>
                    <button className="btn-primary" onClick={handleOptimizePrompt} disabled={optimizing} style={{ padding: '4px 8px', fontSize: '11px' }}>✨ Optimize Prompt</button>
                  </div>
                </div>
                <textarea value={fPrompt} onChange={e => setFPrompt(e.target.value)} rows={4} placeholder="Studio Ghibli style, keep face identical..." style={{ width: '100%', padding: '10px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontFamily: 'inherit' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#0d0d1a', padding: '12px', borderRadius: '8px' }}>
                {refPreviewUrl && <img src={refPreviewUrl} style={{ width: '40px', height: '60px', objectFit: 'cover', borderRadius: '4px' }} alt="Ref" />}
                <div style={{ flexGrow: 1 }}>
                  <div style={{ fontSize: '13px', color: '#fff' }}>Reference Image</div>
                  <div style={{ fontSize: '12px', color: '#888' }}>{refFile ? refFile.name : (refPreviewUrl ? 'Active reference set' : 'No reference image')}</div>
                </div>
                <label className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>
                  Upload Ref
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleRefUpload} />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', color: '#aaa', fontSize: '13px', marginBottom: '4px' }}>Max People</label>
                  <input type="number" value={fMaxPeople} min={1} max={20} onChange={e => setFMaxPeople(parseInt(e.target.value) || 1)} style={{ width: '100%', padding: '10px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '6px', color: '#fff' }} />
                </div>

                <div>
                  <label style={{ display: 'block', color: '#aaa', fontSize: '13px', marginBottom: '4px' }}>Aspect Ratio</label>
                  <select value={fAspect} onChange={e => setFAspect(e.target.value)} style={{ width: '100%', padding: '10px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '6px', color: '#fff' }}>
                    <option value="1:1">1:1</option>
                    <option value="2:3">2:3</option>
                    <option value="3:2">3:2</option>
                    <option value="16:9">16:9</option>
                    <option value="9:16">9:16</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', color: '#aaa', fontSize: '13px', marginBottom: '4px' }}>Resolution</label>
                  <select value={fResolution} onChange={e => setFResolution(e.target.value)} style={{ width: '100%', padding: '10px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '6px', color: '#fff' }}>
                    <option value="2k">2k</option>
                    <option value="1k">1k</option>
                    <option value="4k">4k</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', color: '#aaa', fontSize: '13px', marginBottom: '4px' }}>V2 AI Model</label>
                  <select value={fV2Model} onChange={e => setFV2Model(e.target.value)} style={{ width: '100%', padding: '10px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '6px', color: '#fff' }}>
                    <option value="nb2-cheap">Nano Banana 2 — ~$0.027/2k</option>
                    <option value="nb-pro">Nano Banana Pro — ~$0.035/2k</option>
                    <option value="gpt2-official">GPT Image 2 Official — ~$0.045/2k</option>
                    <option value="gpt2-cheap">GPT Image 2 Cheap — ~$0.028/2k</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', color: '#aaa', fontSize: '13px', marginBottom: '4px' }}>Reveal Transition</label>
                  <select value={fTransition} onChange={e => setFTransition(e.target.value)} style={{ width: '100%', padding: '10px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '6px', color: '#fff' }}>
                    <option value="glitch">Glitch</option>
                    <option value="flash">Flash & Burn</option>
                    <option value="swipe">Laser Swipe</option>
                    <option value="random">Random</option>
                    <option value="none">None</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => { setShowAddForm(false); setEditingStyle(null); }} style={{ padding: '8px 18px', borderRadius: '8px' }}>Cancel</button>
              <button className="btn-primary" onClick={editingStyle ? handleSaveEdit : handleCreateStyle} style={{ padding: '8px 18px', borderRadius: '8px' }}>
                {editingStyle ? 'Save Changes' : 'Create Style'}
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
              <h2 style={{ color: '#fff', margin: 0, fontSize: '20px' }}>🧪 Test Style: {testStyle.name}</h2>
              <button onClick={() => { stopCamera(); setTestStyle(null); }} style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button className={`btn-secondary ${testTab === 'upload' ? 'btn-primary' : ''}`} onClick={() => { stopCamera(); setTestTab('upload'); }} style={{ padding: '6px 16px', fontSize: '13px' }}>Upload Test Photo</button>
              <button className={`btn-secondary ${testTab === 'camera' ? 'btn-primary' : ''}`} onClick={() => { setTestTab('camera'); startCamera(); }} style={{ padding: '6px 16px', fontSize: '13px' }}>Webcam Capture</button>
            </div>

            <div style={{ width: '100%', height: '200px', background: '#0d0d1a', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', overflow: 'hidden', position: 'relative' }}>
              {testTab === 'camera' ? (
                <>
                  <video ref={testVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button className="btn-primary" onClick={capturePhoto} style={{ position: 'absolute', bottom: '12px', padding: '8px 20px', borderRadius: '20px' }}>Take Photo</button>
                </>
              ) : testPreviewUrl ? (
                <img src={testPreviewUrl} style={{ maxHeight: '100%', objectFit: 'contain' }} alt="Test input" />
              ) : (
                <label className="btn-secondary" style={{ cursor: 'pointer' }}>
                  Choose Image
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
                    <option value="">(None)</option>
                    <option value="nb2-cheap">Nano Banana 2</option>
                    <option value="nb-pro">Nano Banana Pro</option>
                    <option value="gpt2-official">GPT Image 2 Official</option>
                    <option value="gpt2-cheap">GPT Image 2 Cheap</option>
                  </select>

                  <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {testResults[slotIdx]?.loading ? (
                      <span style={{ color: '#667eea', fontSize: '12px' }}>Running...</span>
                    ) : testResults[slotIdx]?.error ? (
                      <span style={{ color: '#f44', fontSize: '11px' }}>{testResults[slotIdx].error}</span>
                    ) : testResults[slotIdx]?.url ? (
                      <img 
                        src={testResults[slotIdx].url} 
                        style={{ maxWidth: '100%', maxHeight: '140px', objectFit: 'contain', borderRadius: '4px', cursor: 'pointer' }} 
                        onClick={() => setLightboxUrl(testResults[slotIdx].url!)} 
                        alt="Test output" 
                      />
                    ) : (
                      <span style={{ color: '#555', fontSize: '11px' }}>Empty Slot</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button className="btn-primary" onClick={handleRunTest} style={{ width: '100%', padding: '10px' }}>
              🚀 Run Multi-Model Comparison Test
            </button>
          </div>
        </div>
      )}

      {/* Styles List */}
      {loading ? (
        <div style={{ color: '#888', padding: '32px', textAlign: 'center' }}>Loading styles...</div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {styles.map(s => (
            <div key={s.id} style={{ background: 'rgba(26, 26, 46, 0.8)', padding: '16px', borderRadius: '12px', display: 'grid', gridTemplateColumns: '80px 1.5fr 2fr 1fr 1fr auto', alignItems: 'center', gap: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <img 
                src={`/api${s.thumbnail}`} 
                onClick={() => setLightboxUrl(`/api${s.thumbnail}`)} 
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
                  {s.prompt_template || <i>No prompt template</i>}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span className={`status ${s.rh_ref_file ? 'status-active' : 'status-inactive'}`} style={{ fontSize: '11px' }}>
                    ref {s.rh_ref_file ? 'OK' : 'None'}
                  </span>
                </div>
              </div>

              <div style={{ fontSize: '12px', color: '#aaa' }}>
                <div>Max: {s.max_people}</div>
                <div>{s.aspect_ratio} ({s.resolution})</div>
              </div>

              <div>
                <span className={`status ${s.active ? 'status-active' : 'status-inactive'}`}>
                  {s.active ? 'Active' : 'Hidden'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button className="btn-secondary" onClick={() => handleUploadFrame(s.id)} style={{ padding: '6px 10px', fontSize: '12px' }}>Frame PNG</button>
                <button className="btn-primary" onClick={() => openEditModal(s)} style={{ padding: '6px 12px', fontSize: '12px' }}>Edit</button>
                <button className="btn-secondary" onClick={() => openTestModal(s)} style={{ padding: '6px 12px', fontSize: '12px' }}>Test</button>
                {s.active ? (
                  <button onClick={() => handleToggleActive(s.id, false)} style={{ padding: '6px 10px', fontSize: '12px', background: '#8b2020', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Hide</button>
                ) : (
                  <button className="btn-primary" onClick={() => handleToggleActive(s.id, true)} style={{ padding: '6px 10px', fontSize: '12px' }}>Show</button>
                )}
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
