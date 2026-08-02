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
  multi_face_crop_enabled?: number;
  active: boolean;
  rh_ref_file?: string;
  rh_ref_url?: string;
  cost_money?: number;
  mode?: string;
  filter_preset?: string;
  layout_type?: string;
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
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingStyle, setEditingStyle] = useState<StyleItem | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [testStyle, setTestStyle] = useState<StyleItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [modeFilter, setModeFilter] = useState<string>('all');
  const [availableFilters, setAvailableFilters] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/styles/filters')
      .then(r => r.json())
      .then(data => setAvailableFilters(data || []))
      .catch(e => console.error("Failed to fetch available filters:", e));
  }, []);

  const handleCloneStyle = async (s: StyleItem) => {
    const newId = `${s.id}_copy_${Date.now().toString().slice(-4)}`;
    const newName = `${s.name} (${isZh ? '副本' : 'Copy'})`;
    try {
      const form = new FormData();
      form.append('id', newId);
      form.append('name', newName);
      form.append('prompt_template', s.prompt_template || '');
      form.append('max_people', (s.max_people || 1).toString());
      form.append('aspect_ratio', s.aspect_ratio || '16:9');
      form.append('resolution', s.resolution || '2k');
      form.append('seed', s.seed || '');
      form.append('provider', s.provider || 'v2');
      if (s.provider === 'v2') {
        form.append('v2_model', s.v2_model || 'nb2-cheap');
        form.append('v2_quality', s.v2_quality || 'medium');
      }
      form.append('transition_type', s.transition_type || 'glitch');
      form.append('animated_thumbnail', s.animated_thumbnail || '');
      form.append('dynamic_prompt_enabled', (s.dynamic_prompt_enabled || 0).toString());
      form.append('multi_face_crop_enabled', (s.multi_face_crop_enabled || 0).toString());
      form.append('mode', s.mode || 'ai');
      form.append('filter_preset', s.filter_preset || '');
      form.append('layout_type', s.layout_type || 'single');

      const res = await fetch('/api/styles', {
        method: 'POST',
        body: form
      });
      if (res.ok) {
        loadStyles();
      }
    } catch (err) {
      console.error("Clone style failed", err);
    }
  };

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
  const [fMultiFaceCrop, setFMultiFaceCrop] = useState(0);
  const [fMode, setFMode] = useState('ai');
  const [fFilterPreset, setFFilterPreset] = useState('');
  const [fLayoutType, setFLayoutType] = useState('single');
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

  // Ref URL states
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [pastedRefUrl, setPastedRefUrl] = useState('');
  const [downloadingUrl, setDownloadingUrl] = useState(false);

  const handleDownloadRefUrl = async () => {
    if (!pastedRefUrl.trim()) return alert(isZh ? "請先輸入圖片 URL" : "Enter an image URL first.");
    const targetId = editingStyle ? editingStyle.id : fId.trim();
    setDownloadingUrl(true);
    try {
      if (targetId) {
        const r = await fetch(`/api/styles/${targetId}/ref-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: pastedRefUrl.trim() })
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.detail || 'Download failed');
        setRefPreviewUrl(`${data.ref_image}?t=${Date.now()}`);
        setRefFile(null);
        setPastedRefUrl('');
        setShowUrlInput(false);
        alert(isZh ? "圖片已成功下載並設為風格參考圖！" : "Downloaded & set as style reference image!");
      } else {
        const r = await fetch('/api/styles/fetch-ref-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: pastedRefUrl.trim() })
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.detail || 'Fetch failed');
        
        const resBlob = await fetch(data.data_url);
        const blob = await resBlob.blob();
        const file = new File([blob], 'ref_from_url.jpg', { type: 'image/jpeg' });
        setRefFile(file);
        setRefPreviewUrl(data.data_url);
        setPastedRefUrl('');
        setShowUrlInput(false);
        alert(isZh ? "圖片已成功載入！" : "Image loaded successfully!");
      }
    } catch (e: any) {
      alert((isZh ? "下載圖片失敗: " : "Failed to download image: ") + e.message);
    } finally {
      setDownloadingUrl(false);
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
  const [testResults, setTestResults] = useState<{ [key: number]: { url?: string; job_id?: string; error?: string; loading?: boolean } }>({});
  const [testMode, setTestMode] = useState<'models' | 'photos'>('models');
  const [slotBlobs, setSlotBlobs] = useState<(Blob | null)[]>([null, null, null, null]);
  const [slotPreviewUrls, setSlotPreviewUrls] = useState<(string | null)[]>([null, null, null, null]);
  const [selectedSingleModel, setSelectedSingleModel] = useState<string>('nb2-cheap');
  const testVideoRef = useRef<HTMLVideoElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const loadStyles = async () => {
    try {
      const res = await fetch('/api/styles?admin=true');
      const data = await res.json();
      setStyles(data || []);

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
    form.append('multi_face_crop_enabled', fMultiFaceCrop.toString());
    form.append('mode', fMode);
    form.append('filter_preset', fFilterPreset);
    form.append('layout_type', fLayoutType);

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
    setFMultiFaceCrop(0);
    setFMode('ai');
    setFFilterPreset('');
    setFLayoutType('single');
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
    setFMultiFaceCrop(s.multi_face_crop_enabled || 0);
    setFMode(s.mode || 'ai');
    setFFilterPreset(s.filter_preset || '');
    setFLayoutType(s.layout_type || 'single');

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
    form.append('multi_face_crop_enabled', fMultiFaceCrop.toString());
    form.append('mode', fMode);
    form.append('filter_preset', fFilterPreset);
    form.append('layout_type', fLayoutType);

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

  const handleToggleActive = async (id: string, active: boolean, dynamicPromptEnabled?: number, multiFaceCropEnabled?: number) => {
    const f = new FormData();
    f.append('active', active ? '1' : '0');
    if (dynamicPromptEnabled !== undefined) {
      f.append('dynamic_prompt_enabled', dynamicPromptEnabled.toString());
    }
    if (multiFaceCropEnabled !== undefined) {
      f.append('multi_face_crop_enabled', multiFaceCropEnabled.toString());
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
    setFAspect(s.aspect_ratio || '2:3');
    setFSeed(s.seed || '');
    setTestModels([s.v2_model || 'nb2-cheap', 'nb-pro', 'gpt2-official', 'gpt2-cheap']);
    setSelectedSingleModel(s.v2_model || 'nb2-cheap');
    setTestResults({});
    setTestImageBlob(null);
    setTestPreviewUrl(null);
    setSlotBlobs([null, null, null, null]);
    setSlotPreviewUrls([null, null, null, null]);
    setTestMode('models');
    setTestTab('upload');
  };

  const handleUploadSlotImage = (slotIdx: number, file: File) => {
    const url = URL.createObjectURL(file);
    setSlotBlobs(prev => {
      const next = [...prev];
      next[slotIdx] = file;
      return next;
    });
    setSlotPreviewUrls(prev => {
      const next = [...prev];
      next[slotIdx] = url;
      return next;
    });
  };

  const handleClearSlotImage = (slotIdx: number) => {
    setSlotBlobs(prev => {
      const next = [...prev];
      next[slotIdx] = null;
      return next;
    });
    setSlotPreviewUrls(prev => {
      const next = [...prev];
      next[slotIdx] = null;
      return next;
    });
  };

  const handleBatchUploadSlotImages = (files: FileList) => {
    const fileArray = Array.from(files).slice(0, 4);
    setSlotBlobs(prev => {
      const next = [...prev];
      fileArray.forEach((file, idx) => {
        next[idx] = file;
      });
      return next;
    });
    setSlotPreviewUrls(prev => {
      const next = [...prev];
      fileArray.forEach((file, idx) => {
        next[idx] = URL.createObjectURL(file);
      });
      return next;
    });
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1080 }, height: { ideal: 1920 } } });
      setCameraStream(stream);
      if (testVideoRef.current) {
        testVideoRef.current.srcObject = stream;
      }
    } catch (e: any) {
      alert(isZh ? "無法存取相機" : "Cannot access camera");
      setTestTab('upload');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
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
    if (!testStyle) return;

    const hasAnyPhoto = testImageBlob || slotBlobs.some(b => b !== null);
    if (!hasAnyPhoto) return alert(isZh ? "請先拍攝或選擇測試照片" : "Select or capture at least one test photo first.");

    [0, 1, 2, 3].forEach(async (index) => {
      const modelId = testMode === 'models' ? testModels[index] : selectedSingleModel;
      if (!modelId) return;

      const targetBlob = slotBlobs[index] || testImageBlob;
      if (!targetBlob) return;

      setTestResults(prev => ({ ...prev, [index]: { loading: true } }));

      const targetAspect = testStyle.aspect_ratio || fAspect || '2:3';

      const form = new FormData();
      form.append('image', targetBlob, `test_${index}.jpg`);
      form.append('style_id', testStyle.id);
      form.append('capture_source', 'test');
      if (fPrompt) form.append('prompt_override', fPrompt);
      if (modelId) form.append('model_override', modelId);
      if (fResolution) form.append('resolution_override', fResolution);
      if (fV2Quality) form.append('quality_override', fV2Quality);
      form.append('aspect_override', targetAspect);
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
          const rawFile = job.output_image
            ? job.output_image.split(/[/\\]/).slice(-2).join('/')
            : (job.print_image ? job.print_image.split(/[/\\]/).slice(-2).join('/') : '');
          setTestResults(prev => ({ ...prev, [index]: { url: `/api/images/${rawFile}`, job_id: jobId, loading: false } }));
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', background: 'rgba(5, 5, 12, 0.8)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)' }}>
            <button
              onClick={() => setModeFilter('all')}
              style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: modeFilter === 'all' ? '#667eea' : 'transparent', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              {isZh ? '全部' : 'All'}
            </button>
            <button
              onClick={() => setModeFilter('ai')}
              style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: modeFilter === 'ai' ? '#667eea' : 'transparent', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              🤖 {isZh ? 'AI 寫真' : 'AI Mode'}
            </button>
            <button
              onClick={() => setModeFilter('normal')}
              style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: modeFilter === 'normal' ? '#48bb78' : 'transparent', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              📷 {isZh ? '傳統相亭' : 'Normal Booth'}
            </button>
          </div>

          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder={isZh ? '搜尋風格名稱、ID 或提示詞...' : 'Search style name, ID, or prompt...'}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(5, 5, 12, 0.8)',
              color: '#fff',
              fontSize: '13px',
              width: '240px',
              outline: 'none'
            }}
          />
          <button className="btn-primary" onClick={() => { resetForm(); setShowAddForm(true); }} style={{ padding: '10px 20px', borderRadius: '8px' }}>
            + {isZh ? '新增風格' : 'New Style'}
          </button>
        </div>
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

              {/* Mode Selection */}
              <div style={{ display: 'grid', gridTemplateColumns: fMode !== 'ai' ? '1fr 1fr' : '1fr', gap: '12px', background: 'rgba(102,126,234,0.08)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(102,126,234,0.2)' }}>
                <div>
                  <label style={{ display: 'block', color: '#a3b8ff', fontSize: '13px', marginBottom: '4px', fontWeight: 600 }}>
                    ⚙️ {isZh ? '風格適用模式 (Mode)' : 'Style Applicable Mode'}
                  </label>
                  <select 
                    value={fMode} 
                    onChange={e => setFMode(e.target.value)}
                    style={{ width: '100%', padding: '10px', background: '#0d0d1a', border: '1px solid #667eea', borderRadius: '6px', color: '#fff', fontWeight: 600 }}
                  >
                    <option value="ai">🤖 {isZh ? '僅限 AI 生成模式 (AI Only)' : 'AI Generation Mode Only'}</option>
                    <option value="normal">📷 {isZh ? '僅限傳統拍貼機模式 (Normal Only)' : 'Normal Photo Booth Only'}</option>
                    <option value="both">🌟 {isZh ? '通用 (AI 與傳統模式皆可)' : 'Both AI & Normal Modes'}</option>
                  </select>
                </div>

                {fMode !== 'ai' && (
                  <div>
                    <label style={{ display: 'block', color: '#68d391', fontSize: '13px', marginBottom: '4px', fontWeight: 600 }}>
                      🎞️ {isZh ? '預設相片濾鏡 (Filter Preset)' : 'Photo Filter Preset'}
                    </label>
                    <select
                      value={fFilterPreset}
                      onChange={e => setFFilterPreset(e.target.value)}
                      style={{ width: '100%', padding: '10px', background: '#0d0d1a', border: '1px solid #48bb78', borderRadius: '6px', color: '#fff' }}
                    >
                      <option value="">{isZh ? '無 (原圖色調)' : 'None (Original)'}</option>
                      {availableFilters.map(flt => (
                        <option key={flt.id} value={flt.id}>
                          {isZh ? flt.name_zh : flt.name} — {flt.description}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {fMode !== 'normal' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ color: '#aaa', fontSize: '13px' }}>{isZh ? '提示詞模板 (Prompt Template)' : 'Prompt Template'}</label>
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
              )}

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

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button 
                      type="button" 
                      className="btn-primary" 
                      onClick={handleGenerateAiRef} 
                      disabled={generatingRef} 
                      style={{ padding: '6px 14px', fontSize: '12px', background: 'linear-gradient(135deg, #ff007f, #764ba2)', borderRadius: '6px' }}
                    >
                      {generatingRef ? (isZh ? '⌛ AI 生成中...' : '⌛ Generating...') : (isZh ? '✨ AI 生成參考圖' : '✨ AI Gen Ref')}
                    </button>

                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setShowUrlInput(!showUrlInput)}
                      style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '6px' }}
                    >
                      🔗 {isZh ? '貼上圖片 URL' : 'Paste URL'}
                    </button>

                    <label className="btn-secondary" style={{ padding: '6px 14px', fontSize: '12px', cursor: 'pointer', borderRadius: '6px' }}>
                      📁 {isZh ? '上傳參考圖' : 'Upload Ref'}
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleRefUpload} />
                    </label>
                  </div>
                </div>

                {/* Paste URL Input Drawer */}
                {showUrlInput && (
                  <div style={{ marginTop: '6px', padding: '10px', background: '#151528', borderRadius: '6px', border: '1px solid #334', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input 
                      type="text" 
                      value={pastedRefUrl} 
                      onChange={e => setPastedRefUrl(e.target.value)} 
                      placeholder={isZh ? "請貼上圖片網址 (https://.../image.jpg)" : "Paste picture URL (https://.../image.jpg)"} 
                      style={{ flex: 1, padding: '8px 12px', background: '#0d0d1a', border: '1px solid #444', borderRadius: '6px', color: '#fff', fontSize: '12px' }} 
                    />
                    <button 
                      type="button" 
                      className="btn-primary" 
                      onClick={handleDownloadRefUrl} 
                      disabled={downloadingUrl} 
                      style={{ padding: '8px 14px', fontSize: '12px', borderRadius: '6px', whiteSpace: 'nowrap' }}
                    >
                      {downloadingUrl ? (isZh ? '⌛ 下載中...' : '⌛ Downloading...') : (isZh ? '📥 下載並設為參考圖' : '📥 Download & Set')}
                    </button>
                  </div>
                )}

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

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', color: '#aaa', fontSize: '13px', cursor: 'pointer', gap: '8px' }}>
                    <input 
                      type="checkbox" 
                      checked={fDynamicPrompt === 1} 
                      onChange={e => setFDynamicPrompt(e.target.checked ? 1 : 0)} 
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    {isZh ? '👁️ 啟用視覺動態提示詞' : '👁️ Enable Vision Dynamic Prompt'}
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', color: '#4ecdc4', fontSize: '13px', cursor: 'pointer', gap: '8px', fontWeight: 600 }}>
                    <input 
                      type="checkbox" 
                      checked={fMultiFaceCrop === 1} 
                      onChange={e => setFMultiFaceCrop(e.target.checked ? 1 : 0)} 
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    {isZh ? '✂️ 啟用多面孔裁切與追蹤 (user1, user2...)' : '✂️ Enable Multi-Face Crop & Tracking (user1, user2...)'}
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

      {/* Test Modal with Dual Modes (4 Models vs 4 Photos Prompt Stability) */}
      {testStyle && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120 }}>
          <div style={{ background: '#151525', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', width: '820px', maxHeight: '95vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ color: '#fff', margin: 0, fontSize: '20px' }}>🧪 {isZh ? '測試風格' : 'Test Style'}: {testStyle.name}</h2>
                <span style={{ fontSize: '11px', background: 'rgba(102,126,234,0.2)', color: '#a3b8ff', border: '1px solid rgba(102,126,234,0.4)', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
                  📐 {testStyle.aspect_ratio || '2:3'}
                </span>
              </div>
              <button onClick={() => { stopCamera(); setTestStyle(null); }} style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>

            {/* Mode Selector Toggle */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', padding: '4px', borderRadius: '10px', marginBottom: '16px', gap: '4px' }}>
              <button
                type="button"
                onClick={() => setTestMode('models')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: testMode === 'models' ? 'linear-gradient(135deg, #667eea, #764ba2)' : 'transparent',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                🧪 {isZh ? '1 圖 vs 4 AI 模型比較' : '1 Photo vs 4 AI Models'}
              </button>

              <button
                type="button"
                onClick={() => setTestMode('photos')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: testMode === 'photos' ? 'linear-gradient(135deg, #4ecdc4, #556270)' : 'transparent',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                🎯 {isZh ? '4 圖 vs 1 AI 模型 (Prompt 穩定度測試)' : '4 Photos vs 1 Model (Prompt Stability)'}
              </button>
            </div>

            {/* Target Model Bar for Photos Mode */}
            {testMode === 'photos' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(78,205,196,0.1)', border: '1px solid rgba(78,205,196,0.3)', padding: '10px 14px', borderRadius: '10px', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', color: '#4ecdc4', fontWeight: 600 }}>
                  ⚙️ {isZh ? '選擇要測試 prompt 穩定度的 AI 模型:' : 'Target AI Model for Prompt Stability:'}
                </div>
                <select
                  value={selectedSingleModel}
                  onChange={(e) => setSelectedSingleModel(e.target.value)}
                  style={{ padding: '6px 12px', borderRadius: '6px', background: '#0d0d1a', border: '1px solid #444', color: '#fff', fontSize: '13px', fontWeight: 600 }}
                >
                  <option value="nb2-cheap">Nano Banana 2</option>
                  <option value="nb-pro">Nano Banana Pro</option>
                  <option value="gpt2-official">GPT Image 2 Official</option>
                  <option value="gpt2-cheap">GPT Image 2 Cheap</option>
                </select>
              </div>
            )}

            {/* Main Photo Action / Batch Upload Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className={`btn-secondary ${testTab === 'upload' ? 'btn-primary' : ''}`} onClick={() => { stopCamera(); setTestTab('upload'); }} style={{ padding: '6px 16px', fontSize: '13px' }}>📁 {isZh ? '預設主測試圖' : 'Main Test Photo'}</button>
                <button className={`btn-secondary ${testTab === 'camera' ? 'btn-primary' : ''}`} onClick={() => { setTestTab('camera'); startCamera(); }} style={{ padding: '6px 16px', fontSize: '13px' }}>📷 {isZh ? '相機拍攝主圖' : 'Webcam Capture'}</button>
              </div>

              {testMode === 'photos' && (
                <label className="btn-secondary" style={{ padding: '6px 16px', fontSize: '13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(78,205,196,0.15)', borderColor: 'rgba(78,205,196,0.4)', color: '#4ecdc4', fontWeight: 600 }}>
                  📁 {isZh ? '一次選擇最多 4 張照片' : 'Batch Upload 4 Photos'}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleBatchUploadSlotImages(e.target.files);
                      }
                    }}
                  />
                </label>
              )}
            </div>

            {/* Main Photo Preview Box */}
            <div style={{ width: '100%', height: '140px', background: '#0d0d1a', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', overflow: 'hidden', position: 'relative' }}>
              {testTab === 'camera' ? (
                <>
                  <video ref={testVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button className="btn-primary" onClick={capturePhoto} style={{ position: 'absolute', bottom: '12px', padding: '8px 20px', borderRadius: '20px' }}>📸 {isZh ? '拍攝' : 'Take Photo'}</button>
                </>
              ) : testPreviewUrl ? (
                <div style={{ position: 'relative', display: 'inline-block', maxHeight: '100%' }}>
                  <img src={testPreviewUrl} style={{ maxHeight: '120px', objectFit: 'contain', borderRadius: '8px' }} alt="Test input" />
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
                    title={isZh ? "清除主照片" : "Clear main photo"}
                  >
                    ✖
                  </button>
                </div>
              ) : (
                <label className="btn-secondary" style={{ cursor: 'pointer' }}>
                  {isZh ? '選擇預設主照片' : 'Choose Main Photo'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                    if (e.target.files?.[0]) {
                      setTestImageBlob(e.target.files[0]);
                      setTestPreviewUrl(URL.createObjectURL(e.target.files[0]));
                    }
                  }} />
                </label>
              )}
            </div>

            {/* 4 Grid Slots */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
              {[0, 1, 2, 3].map((slotIdx) => {
                const currentSlotUrl = slotPreviewUrls[slotIdx] || testPreviewUrl;

                return (
                  <div key={slotIdx} style={{ background: '#0d0d1a', padding: '10px', borderRadius: '8px', textAlign: 'center', minHeight: '220px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: slotPreviewUrls[slotIdx] ? '1px solid rgba(78,205,196,0.4)' : '1px solid rgba(255,255,255,0.06)' }}>
                    
                    {/* Header: Model Selector (models mode) OR Slot Title (photos mode) */}
                    {testMode === 'models' ? (
                      <select 
                        value={testModels[slotIdx]} 
                        onChange={e => {
                          const updated = [...testModels];
                          updated[slotIdx] = e.target.value;
                          setTestModels(updated);
                        }}
                        style={{ fontSize: '11px', padding: '4px', background: '#1a1a2e', border: '1px solid #333', color: '#fff', borderRadius: '4px', marginBottom: '6px' }}
                      >
                        <option value="">({isZh ? '無' : 'None'})</option>
                        <option value="nb2-cheap">Nano Banana 2</option>
                        <option value="nb-pro">Nano Banana Pro</option>
                        <option value="gpt2-official">GPT Image 2 Official</option>
                        <option value="gpt2-cheap">GPT Image 2 Cheap</option>
                      </select>
                    ) : (
                      <div style={{ fontSize: '12px', color: '#4ecdc4', fontWeight: 700, marginBottom: '6px' }}>
                        📸 {isZh ? `照片 #${slotIdx + 1}` : `Photo #${slotIdx + 1}`}
                      </div>
                    )}

                    {/* Slot Input Photo Thumbnail & Action */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '6px', marginBottom: '8px' }}>
                      {currentSlotUrl ? (
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <img src={currentSlotUrl} style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '4px', display: 'block', margin: '0 auto' }} alt={`Slot ${slotIdx}`} />
                          {slotPreviewUrls[slotIdx] && (
                            <button
                              onClick={() => handleClearSlotImage(slotIdx)}
                              style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#ff4f4f', color: '#fff', border: 'none', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              title={isZh ? "清除此張照片" : "Clear slot photo"}
                            >
                              ✖
                            </button>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: '10px', color: '#666' }}>{isZh ? '無照片' : 'No photo'}</span>
                      )}

                      <div style={{ marginTop: '4px' }}>
                        <label style={{ fontSize: '10px', color: '#aaa', cursor: 'pointer', background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                          {slotPreviewUrls[slotIdx] ? (isZh ? '換照片' : 'Change') : (isZh ? '上傳此位置' : 'Upload')}
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                handleUploadSlotImage(slotIdx, e.target.files[0]);
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    {/* Slot Result Output */}
                    <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      {testResults[slotIdx]?.loading ? (
                        <span style={{ color: '#667eea', fontSize: '12px' }}>{isZh ? '運行中...' : 'Running...'}</span>
                      ) : testResults[slotIdx]?.error ? (
                        <span style={{ color: '#f44', fontSize: '11px' }}>{testResults[slotIdx].error}</span>
                      ) : testResults[slotIdx]?.url ? (
                        <>
                          <img 
                            src={testResults[slotIdx].url} 
                            style={{ maxWidth: '100%', maxHeight: '100px', objectFit: 'contain', borderRadius: '4px', cursor: 'pointer' }} 
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
                );
              })}
            </div>

            <button className="btn-primary" onClick={handleRunTest} style={{ width: '100%', padding: '12px', fontSize: '15px', fontWeight: 700 }}>
              🚀 {testMode === 'models' ? (isZh ? '開始多模型比較測試 (1 圖 4 模型)' : 'Run Multi-Model Test (1 Photo vs 4 Models)') : (isZh ? '開始 Prompt 穩定度測試 (4 圖 1 模型)' : 'Run Prompt Stability Test (4 Photos vs 1 Model)')}
            </button>
          </div>
        </div>
      )}

      {/* Styles List */}
      {loading ? (
        <div style={{ color: '#888', padding: '32px', textAlign: 'center' }}>{isZh ? '載入風格中...' : 'Loading styles...'}</div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {styles.filter(s => {
            if (modeFilter === 'ai' && (s.mode === 'normal')) return false;
            if (modeFilter === 'normal' && (s.mode === 'ai')) return false;
            if (!searchTerm.trim()) return true;
            const term = searchTerm.toLowerCase();
            return (
              s.name.toLowerCase().includes(term) ||
              s.id.toLowerCase().includes(term) ||
              (s.prompt_template && s.prompt_template.toLowerCase().includes(term))
            );
          }).map(s => {
            const styleMode = s.mode || 'ai';
            return (
            <div key={s.id} style={{ background: 'rgba(26, 26, 46, 0.8)', padding: '16px', borderRadius: '12px', display: 'grid', gridTemplateColumns: (s.aspect_ratio === '16:9' || s.aspect_ratio === '3:2') ? '100px 1.5fr 2fr 1fr 1fr auto' : '80px 1.5fr 2fr 1fr 1fr auto', alignItems: 'center', gap: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <img 
                src={s.thumbnail} 
                onClick={() => setLightboxUrl(s.thumbnail)} 
                onError={(e) => { (e.target as HTMLElement).style.background = '#2a2a4e'; }} 
                style={{ 
                  width: (s.aspect_ratio === '16:9' || s.aspect_ratio === '3:2') ? '96px' : '60px', 
                  height: (s.aspect_ratio === '16:9' || s.aspect_ratio === '3:2') ? '54px' : '90px', 
                  objectFit: 'cover', 
                  borderRadius: '6px', 
                  cursor: 'pointer' 
                }} 
                alt={s.name} 
              />

              <div>
                <strong style={{ fontSize: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {s.name}
                  {styleMode === 'normal' && <span style={{ fontSize: '10px', background: 'rgba(72,187,120,0.2)', color: '#68d391', border: '1px solid rgba(72,187,120,0.4)', padding: '1px 6px', borderRadius: '8px', fontWeight: 600 }}>📷 傳統</span>}
                  {styleMode === 'both' && <span style={{ fontSize: '10px', background: 'rgba(159,122,234,0.2)', color: '#b794f4', border: '1px solid rgba(159,122,234,0.4)', padding: '1px 6px', borderRadius: '8px', fontWeight: 600 }}>🌟 通用</span>}
                  {styleMode === 'ai' && <span style={{ fontSize: '10px', background: 'rgba(102,126,234,0.2)', color: '#a3b8ff', border: '1px solid rgba(102,126,234,0.4)', padding: '1px 6px', borderRadius: '8px', fontWeight: 600 }}>🤖 AI</span>}
                </strong>
                <div style={{ fontSize: '12px', color: '#888' }}>{s.id}</div>
              </div>

              <div>
                <div style={{ fontSize: '13px', color: '#bbb', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                  {styleMode === 'normal' 
                    ? (s.filter_preset ? (isZh ? `濾鏡: ${s.filter_preset}` : `Filter: ${s.filter_preset}`) : (isZh ? '相框拍貼 (無濾鏡)' : 'Frame only')) 
                    : (s.prompt_template || <i>{isZh ? '無提示詞' : 'No prompt template'}</i>)}
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className={`status ${s.rh_ref_file ? 'status-active' : 'status-inactive'}`} style={{ fontSize: '11px' }}>
                    ref {s.rh_ref_file ? 'OK' : (isZh ? '無' : 'None')}
                  </span>

                  {/* VISION DYNAMIC PROMPT BADGE & TOGGLE */}
                  <span 
                    onClick={() => handleToggleActive(s.id, Boolean(s.active), s.dynamic_prompt_enabled === 1 ? 0 : 1, s.multi_face_crop_enabled)}
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
                    👁️ {isZh ? (s.dynamic_prompt_enabled === 1 ? 'Vision:開' : 'Vision:關') : (s.dynamic_prompt_enabled === 1 ? 'Vision:ON' : 'Vision:OFF')}
                  </span>

                  {/* MULTI-FACE CROP BADGE & TOGGLE */}
                  <span 
                    onClick={() => handleToggleActive(s.id, Boolean(s.active), s.dynamic_prompt_enabled, s.multi_face_crop_enabled === 1 ? 0 : 1)}
                    title={isZh ? '點擊切換多面孔裁切 (user1, user2...)' : 'Click to toggle Multi-Face Crop'}
                    style={{ 
                      fontSize: '11px', 
                      padding: '2px 8px', 
                      borderRadius: '10px', 
                      background: s.multi_face_crop_enabled === 1 ? 'rgba(78,205,196,0.2)' : 'rgba(255,255,255,0.05)', 
                      color: s.multi_face_crop_enabled === 1 ? '#4ecdc4' : '#888', 
                      border: s.multi_face_crop_enabled === 1 ? '1px solid rgba(78,205,196,0.4)' : '1px solid rgba(255,255,255,0.12)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    ✂️ {isZh ? (s.multi_face_crop_enabled === 1 ? '裁切:開' : '裁切:關') : (s.multi_face_crop_enabled === 1 ? 'Crop:ON' : 'Crop:OFF')}
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
                <button className="btn-secondary" onClick={() => handleCloneStyle(s)} style={{ padding: '6px 10px', fontSize: '12px' }}>📋 {isZh ? '複製' : 'Clone'}</button>
                <button className="btn-secondary" onClick={() => openTestModal(s)} style={{ padding: '6px 10px', fontSize: '12px' }}>{isZh ? '測試' : 'Test'}</button>
                {s.active ? (
                  <button onClick={() => handleToggleActive(s.id, false)} style={{ padding: '6px 10px', fontSize: '12px', background: '#8b2020', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>{isZh ? '隱藏' : 'Hide'}</button>
                ) : (
                  <button className="btn-primary" onClick={() => handleToggleActive(s.id, true)} style={{ padding: '6px 10px', fontSize: '12px' }}>{isZh ? '顯示' : 'Show'}</button>
                )}
              </div>
            </div>
            );
          })}
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
