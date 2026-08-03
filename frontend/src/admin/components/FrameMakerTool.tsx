import React, { useState, useEffect, useRef } from 'react';
import { useAdminLang } from '../context/AdminLangContext';

interface FrameElement {
  id: string;
  type: 'cutout' | 'text' | 'shape' | 'border' | 'sticker' | 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  locked?: boolean;
  
  // Cutout props
  cutoutShape?: 'rect' | 'rounded' | 'circle';
  cutoutRadius?: number;

  // Text props
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  italic?: boolean;

  // Shape props
  shapeType?: 'rect' | 'circle' | 'line' | 'badge' | 'border-rect';
  borderStyle?: 'solid' | 'dashed' | 'double' | 'ornate';
  borderWidth?: number;
  cornerRadius?: number;

  // Sticker / Image props
  stickerIcon?: string;
  imageUrl?: string;
}

interface FrameTemplate {
  id: string;
  name: string;
  description?: string;
  canvas_json: string;
  target_width: number;
  target_height: number;
  thumbnail_url?: string;
  frame_png_url?: string;
  category?: string;
}

const FONTS = [
  'Inter', 'Roboto', 'Playfair Display', 'Montserrat', 'Outfit',
  'Georgia', 'Impact', 'Courier New', 'Comic Sans MS', 'Brush Script MT'
];

const PRESET_COLORS = [
  '#FFFFFF', '#000000', '#FFD700', '#C0C0C0', '#FF4081',
  '#7C4DFF', '#00E676', '#00E5FF', '#FF6D00', '#E91E63'
];

const BUILTIN_STICKERS = [
  { icon: '⭐', label: 'Star' },
  { icon: '❤️', label: 'Heart' },
  { icon: '🎉', label: 'Party' },
  { icon: '👑', label: 'Crown' },
  { icon: '💍', label: 'Rings' },
  { icon: '🍾', label: 'Champagne' },
  { icon: '🎈', label: 'Balloon' },
  { icon: '🌸', label: 'Flower' },
  { icon: '✨', label: 'Sparkle' },
  { icon: '📸', label: 'Camera' },
  { icon: '🎀', label: 'Ribbon' },
  { icon: '🔥', label: 'Fire' }
];

export default function FrameMakerTool() {
  const { lang } = useAdminLang();
  const isZh = lang === 'zh-Hant';

  // Canvas Settings
  const [targetWidth, setTargetWidth] = useState(1200);
  const [targetHeight, setTargetHeight] = useState(1800);
  const [frameName, setFrameName] = useState('New Frame Design');
  
  // Elements & Selection
  const [elements, setElements] = useState<FrameElement[]>([
    {
      id: 'cutout_main',
      type: 'cutout',
      x: 60,
      y: 60,
      width: 1080,
      height: 1480,
      rotation: 0,
      opacity: 1,
      cutoutShape: 'rounded',
      cutoutRadius: 30
    },
    {
      id: 'text_header',
      type: 'text',
      x: 100,
      y: 1570,
      width: 1000,
      height: 80,
      rotation: 0,
      opacity: 1,
      text: 'SPECIAL EVENT 2026',
      fontFamily: 'Montserrat',
      fontSize: 54,
      fillColor: '#FFD700',
      strokeColor: '#000000',
      strokeWidth: 4,
      align: 'center',
      bold: true
    },
    {
      id: 'border_outer',
      type: 'border',
      x: 20,
      y: 20,
      width: 1160,
      height: 1760,
      rotation: 0,
      opacity: 1,
      shapeType: 'border-rect',
      borderStyle: 'double',
      borderWidth: 12,
      fillColor: '#FFD700'
    }
  ]);

  const [selectedId, setSelectedId] = useState<string | null>('cutout_main');
  const [previewMode, setPreviewMode] = useState(true); // show sample photo behind cutout
  const [history, setHistory] = useState<FrameElement[][]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  // Apply target selection
  const [stylesList, setStylesList] = useState<any[]>([]);
  const [eventsList, setEventsList] = useState<any[]>([]);
  const [applyTargetType, setApplyTargetType] = useState<'style' | 'event'>('style');
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [templates, setTemplates] = useState<FrameTemplate[]>([]);

  // AI Assistant Modal
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiEventType, setAiEventType] = useState('Wedding');
  const [aiTheme, setAiTheme] = useState('Elegant Gold & Rose');
  const [aiLoading, setAiLoading] = useState(false);

  // Canvas Ref
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sample guest photo for background preview
  const samplePhotoUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80';

  useEffect(() => {
    fetch('/api/styles?admin=true').then(r => r.json()).then(data => {
      if (Array.isArray(data)) {
        setStylesList(data);
        if (data.length > 0) setSelectedTargetId(data[0].id);
      }
    }).catch(() => {});

    fetch('/api/events').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setEventsList(data);
    }).catch(() => {});

    fetchTemplates();
  }, []);

  const fetchTemplates = () => {
    fetch('/api/frame-maker/templates').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setTemplates(data);
    }).catch(() => {});
  };

  // Record history
  const pushHistory = (newElements: FrameElement[]) => {
    const updatedHistory = history.slice(0, historyIdx + 1);
    updatedHistory.push(newElements);
    setHistory(updatedHistory);
    setHistoryIdx(updatedHistory.length - 1);
  };

  const updateElements = (newElements: FrameElement[]) => {
    setElements(newElements);
    pushHistory(newElements);
  };

  const selectedEl = elements.find(e => e.id === selectedId);

  // Draw Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    // Clear
    ctx.clearRect(0, 0, targetWidth, targetHeight);

    // 1. If Preview Mode, draw sample photo first
    if (previewMode) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = samplePhotoUrl;
      img.onload = () => {
        renderFrameContent(ctx, img);
      };
      if (img.complete) {
        renderFrameContent(ctx, img);
      }
    } else {
      renderFrameContent(ctx, null);
    }
  }, [elements, targetWidth, targetHeight, selectedId, previewMode]);

  const renderFrameContent = (ctx: CanvasRenderingContext2D, sampleImg: HTMLImageElement | null) => {
    ctx.clearRect(0, 0, targetWidth, targetHeight);

    // If sample photo, draw across canvas
    if (sampleImg) {
      ctx.drawImage(sampleImg, 0, 0, targetWidth, targetHeight);
    }

    // Render non-cutout elements first or background layers
    elements.forEach(el => {
      ctx.save();
      ctx.globalAlpha = el.opacity;
      
      // Translate to element center for rotation
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      ctx.translate(cx, cy);
      ctx.rotate((el.rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);

      if (el.type === 'cutout') {
        if (!sampleImg) {
          // If exporting PNG without sample photo, erase the cutout area to make it transparent
          ctx.globalCompositeOperation = 'destination-out';
          ctx.beginPath();
          if (el.cutoutShape === 'circle') {
            const rx = el.width / 2;
            const ry = el.height / 2;
            ctx.ellipse(el.x + rx, el.y + ry, rx, ry, 0, 0, Math.PI * 2);
          } else if (el.cutoutShape === 'rounded') {
            const r = el.cutoutRadius || 20;
            ctx.roundRect(el.x, el.y, el.width, el.height, r);
          } else {
            ctx.rect(el.x, el.y, el.width, el.height);
          }
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
        } else {
          // In preview mode, draw dashed guide around cutout
          ctx.strokeStyle = '#4ecdc4';
          ctx.lineWidth = 4;
          ctx.setLineDash([12, 8]);
          ctx.strokeRect(el.x, el.y, el.width, el.height);
          ctx.setLineDash([]);
          
          // Badge indicator
          ctx.fillStyle = 'rgba(78, 205, 196, 0.85)';
          ctx.font = 'bold 24px Inter, sans-serif';
          ctx.fillText('📷 Photo Cutout Area', el.x + 16, el.y + 36);
        }
      } else if (el.type === 'border') {
        ctx.strokeStyle = el.fillColor || '#FFD700';
        ctx.lineWidth = el.borderWidth || 8;
        if (el.borderStyle === 'dashed') ctx.setLineDash([20, 10]);
        ctx.strokeRect(el.x, el.y, el.width, el.height);
        ctx.setLineDash([]);
        
        if (el.borderStyle === 'double') {
          const offset = (el.borderWidth || 8) * 1.5;
          ctx.strokeRect(el.x + offset, el.y + offset, el.width - offset * 2, el.height - offset * 2);
        }
      } else if (el.type === 'text') {
        ctx.fillStyle = el.fillColor || '#FFFFFF';
        const fontStyle = `${el.italic ? 'italic ' : ''}${el.bold ? 'bold ' : ''}${el.fontSize || 40}px ${el.fontFamily || 'Inter'}`;
        ctx.font = fontStyle;
        ctx.textAlign = el.align || 'center';
        ctx.textBaseline = 'middle';

        const tx = el.align === 'left' ? el.x : el.align === 'right' ? el.x + el.width : el.x + el.width / 2;
        const ty = el.y + el.height / 2;

        if (el.strokeColor && el.strokeWidth) {
          ctx.strokeStyle = el.strokeColor;
          ctx.lineWidth = el.strokeWidth;
          ctx.strokeText(el.text || '', tx, ty);
        }
        ctx.fillText(el.text || '', tx, ty);
      } else if (el.type === 'sticker') {
        ctx.font = `${Math.min(el.width, el.height) * 0.8}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(el.stickerIcon || '⭐', el.x + el.width / 2, el.y + el.height / 2);
      } else if (el.type === 'shape') {
        ctx.fillStyle = el.fillColor || '#FFD700';
        if (el.shapeType === 'circle') {
          ctx.beginPath();
          ctx.arc(el.x + el.width / 2, el.y + el.height / 2, Math.min(el.width, el.height) / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(el.x, el.y, el.width, el.height);
        }
      }

      // Draw Selection Bounding Box if selected
      if (el.id === selectedId) {
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(el.x - 4, el.y - 4, el.width + 8, el.height + 8);
        ctx.setLineDash([]);

        // Handle points
        ctx.fillStyle = '#6366f1';
        const handles = [
          { x: el.x - 4, y: el.y - 4 },
          { x: el.x + el.width + 4, y: el.y - 4 },
          { x: el.x - 4, y: el.y + el.height + 4 },
          { x: el.x + el.width + 4, y: el.y + el.height + 4 }
        ];
        handles.forEach(h => ctx.fillRect(h.x - 6, h.y - 6, 12, 12));
      }

      ctx.restore();
    });
  };

  // Add Elements
  const addCutoutSlot = () => {
    const newEl: FrameElement = {
      id: `cutout_${Date.now()}`,
      type: 'cutout',
      x: 100,
      y: 100,
      width: 1000,
      height: 1200,
      rotation: 0,
      opacity: 1,
      cutoutShape: 'rounded',
      cutoutRadius: 20
    };
    updateElements([...elements, newEl]);
    setSelectedId(newEl.id);
  };

  const addTextElement = () => {
    const newEl: FrameElement = {
      id: `text_${Date.now()}`,
      type: 'text',
      x: 200,
      y: 1400,
      width: 800,
      height: 100,
      rotation: 0,
      opacity: 1,
      text: 'HAPPY CELEBRATION',
      fontFamily: 'Inter',
      fontSize: 48,
      fillColor: '#FFFFFF',
      align: 'center',
      bold: true
    };
    updateElements([...elements, newEl]);
    setSelectedId(newEl.id);
  };

  const addStickerElement = (icon: string) => {
    const newEl: FrameElement = {
      id: `sticker_${Date.now()}`,
      type: 'sticker',
      x: targetWidth / 2 - 60,
      y: targetHeight / 2 - 60,
      width: 120,
      height: 120,
      rotation: 0,
      opacity: 1,
      stickerIcon: icon
    };
    updateElements([...elements, newEl]);
    setSelectedId(newEl.id);
  };

  const addBorderElement = () => {
    const newEl: FrameElement = {
      id: `border_${Date.now()}`,
      type: 'border',
      x: 40,
      y: 40,
      width: targetWidth - 80,
      height: targetHeight - 80,
      rotation: 0,
      opacity: 1,
      shapeType: 'border-rect',
      borderStyle: 'solid',
      borderWidth: 10,
      fillColor: '#FFD700'
    };
    updateElements([...elements, newEl]);
    setSelectedId(newEl.id);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    updateElements(elements.filter(e => e.id !== selectedId));
    setSelectedId(null);
  };

  const updateSelectedProp = (key: keyof FrameElement, value: any) => {
    if (!selectedId) return;
    updateElements(
      elements.map(e => (e.id === selectedId ? { ...e, [key]: value } : e))
    );
  };

  // Export PNG Data URL with transparent cutout
  const generateExportPng = (): string => {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = targetWidth;
    exportCanvas.height = targetHeight;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return '';

    // Render frame without sample photo
    renderFrameContent(ctx, null);

    return exportCanvas.toDataURL('image/png');
  };

  // Save to DB Template
  const handleSaveTemplate = async () => {
    const pngData = generateExportPng();
    try {
      const res = await fetch('/api/frame-maker/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: frameName,
          canvas_json: JSON.stringify({ targetWidth, targetHeight, elements }),
          target_width: targetWidth,
          target_height: targetHeight,
          frame_image_base64: pngData
        })
      });
      if (res.ok) {
        alert(isZh ? '相框模板已成功儲存！' : 'Frame template saved successfully!');
        fetchTemplates();
      } else {
        alert(isZh ? '儲存失敗' : 'Failed to save template');
      }
    } catch (e) {
      alert(isZh ? '儲存發生錯誤' : 'Error saving template');
    }
  };

  // Apply directly to Style or Event
  const handleApplyFrame = async () => {
    if (!selectedTargetId) {
      alert(isZh ? '請選擇目標風格或活動！' : 'Please select a target style or event!');
      return;
    }

    const pngData = generateExportPng();
    try {
      const res = await fetch('/api/frame-maker/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frame_image_base64: pngData,
          target_type: applyTargetType,
          target_id: selectedTargetId
        })
      });

      if (res.ok) {
        alert(isZh ? `相框已成功套用到 ${applyTargetType === 'style' ? '風格' : '活動'} (${selectedTargetId})！` : `Frame successfully applied to ${applyTargetType} (${selectedTargetId})!`);
      } else {
        alert(isZh ? '套用失敗' : 'Failed to apply frame');
      }
    } catch (e) {
      alert(isZh ? '套用發生錯誤' : 'Error applying frame');
    }
  };

  // Load Template
  const loadTemplate = (tmpl: FrameTemplate) => {
    try {
      const data = JSON.parse(tmpl.canvas_json);
      if (data.targetWidth) setTargetWidth(data.targetWidth);
      if (data.targetHeight) setTargetHeight(data.targetHeight);
      if (data.elements && Array.isArray(data.elements)) {
        setElements(data.elements);
        setSelectedId(data.elements[0]?.id || null);
      }
      setFrameName(tmpl.name);
    } catch (e) {
      console.error('Failed to parse template json', e);
    }
  };

  // AI Suggest
  const handleAiSuggest = async () => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/frame-maker/ai-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: aiEventType, theme: aiTheme })
      });
      const data = await res.json();
      setAiLoading(false);
      setShowAiModal(false);

      if (data.title) setFrameName(data.title);
      if (data.texts && data.texts[0]) {
        updateElements(
          elements.map(e => e.type === 'text' ? { ...e, text: data.texts[0], fillColor: data.colors ? data.colors[0] : '#FFD700' } : e)
        );
      }
      alert(isZh ? `AI 建議完成！已自動調整配色與標題：${data.title}` : `AI suggestion applied: ${data.title}`);
    } catch (e) {
      setAiLoading(false);
      alert(isZh ? 'AI 建議生成失敗' : 'AI Suggestion failed');
    }
  };

  return (
    <div style={{ background: '#0b0c16', color: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', display: 'flex', alignItems: 'center', gap: '10px', color: '#4ecdc4' }}>
            🖼️ {isZh ? '相框設計師 (Photo Frame Maker)' : 'Photo Frame Maker Studio'}
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#aaa' }}>
            {isZh ? '拖曳、設計並一鍵套用客製化框線、貼圖與鏤空拍攝區域至風格庫或活動場次' : 'Visual drag-and-drop designer for photo booth event overlays, cutout slots, and AI designs'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowAiModal(true)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #a855f7, #6366f1)',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            🤖 {isZh ? 'AI 相框助手' : 'AI Frame Assistant'}
          </button>

          <button
            onClick={handleSaveTemplate}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            💾 {isZh ? '儲存為模板' : 'Save Template'}
          </button>
        </div>
      </div>

      {/* Main Studio Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 300px', gap: '20px' }}>
        {/* Left Toolbar */}
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h4 style={{ margin: '0 0 12px', fontSize: '14px', color: '#a3b8ff' }}>🛠️ {isZh ? '新增元素' : 'Add Elements'}</h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            <button
              onClick={addCutoutSlot}
              style={{
                padding: '10px',
                borderRadius: '8px',
                background: 'rgba(78,205,196,0.15)',
                border: '1px solid rgba(78,205,196,0.4)',
                color: '#4ecdc4',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              ✂️ {isZh ? '+ 相位鏤空區 (Cutout Slot)' : '+ Photo Cutout Slot'}
            </button>

            <button
              onClick={addTextElement}
              style={{
                padding: '10px',
                borderRadius: '8px',
                background: 'rgba(99,102,241,0.15)',
                border: '1px solid rgba(99,102,241,0.4)',
                color: '#a3b8ff',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              🔤 {isZh ? '+ 活動文字 (Text)' : '+ Event Text'}
            </button>

            <button
              onClick={addBorderElement}
              style={{
                padding: '10px',
                borderRadius: '8px',
                background: 'rgba(255,215,0,0.15)',
                border: '1px solid rgba(255,215,0,0.4)',
                color: '#FFD700',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              🖼️ {isZh ? '+ 外層邊框 (Border)' : '+ Outer Frame Border'}
            </button>
          </div>

          <h4 style={{ margin: '16px 0 8px', fontSize: '14px', color: '#a3b8ff' }}>✨ {isZh ? '貼圖庫 (Stickers)' : 'Sticker Collection'}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '20px' }}>
            {BUILTIN_STICKERS.map(s => (
              <button
                key={s.label}
                onClick={() => addStickerElement(s.icon)}
                style={{
                  padding: '8px',
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  fontSize: '20px',
                  cursor: 'pointer'
                }}
                title={s.label}
              >
                {s.icon}
              </button>
            ))}
          </div>

          <h4 style={{ margin: '16px 0 8px', fontSize: '14px', color: '#a3b8ff' }}>📁 {isZh ? '預設相框庫' : 'Saved Templates'}</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
            {templates.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#666' }}>{isZh ? '尚無儲存模板' : 'No templates found'}</div>
            ) : (
              templates.map(t => (
                <div
                  key={t.id}
                  onClick={() => loadTemplate(t)}
                  style={{
                    padding: '8px',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  📌 {t.name}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Center Stage / Canvas Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
          {/* Controls Bar */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#aaa' }}>{isZh ? '尺寸:' : 'Target Size:'}</span>
              <select
                value={`${targetWidth}x${targetHeight}`}
                onChange={e => {
                  const [w, h] = e.target.value.split('x').map(Number);
                  setTargetWidth(w);
                  setTargetHeight(h);
                }}
                style={{ padding: '6px', borderRadius: '6px', background: '#111', color: '#fff', border: '1px solid #333', fontSize: '12px' }}
              >
                <option value="1200x1800">4x6 Vertical (1200x1800)</option>
                <option value="1800x1200">4x6 Horizontal (1800x1200)</option>
                <option value="1500x1500">Square 1:1 (1500x1500)</option>
                <option value="600x1800">Strip 2x6 (600x1800)</option>
              </select>
            </div>

            <button
              onClick={() => setPreviewMode(!previewMode)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                background: previewMode ? 'rgba(56,239,125,0.2)' : 'rgba(255,255,255,0.06)',
                border: previewMode ? '1px solid rgba(56,239,125,0.4)' : '1px solid rgba(255,255,255,0.15)',
                color: previewMode ? '#38ef7d' : '#ccc',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              📷 {previewMode ? (isZh ? '即時實照預覽: ON' : 'Photo Preview: ON') : (isZh ? '透明 PNG 檢視' : 'Transparent Cutout Mode')}
            </button>
          </div>

          {/* Render Canvas */}
          <div ref={containerRef} style={{ width: '100%', display: 'flex', justifyContent: 'center', overflow: 'hidden', padding: '10px' }}>
            <canvas
              ref={canvasRef}
              style={{
                width: targetWidth > targetHeight ? '540px' : '360px',
                height: targetWidth > targetHeight ? '360px' : '540px',
                borderRadius: '8px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                background: previewMode ? '#000' : 'repeating-conic-gradient(#222 0% 25%, #333 0% 50%) 50% / 20px 20px'
              }}
            />
          </div>
        </div>

        {/* Right Inspector & Apply Panel */}
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h4 style={{ margin: '0 0 12px', fontSize: '14px', color: '#a3b8ff' }}>⚙️ {isZh ? '元素屬性' : 'Element Inspector'}</h4>

          {selectedEl ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}>
              <div>
                <label style={{ color: '#aaa', display: 'block', marginBottom: '4px' }}>{isZh ? '類型' : 'Type'}: {selectedEl.type}</label>
              </div>

              {selectedEl.type === 'text' && (
                <>
                  <div>
                    <label style={{ color: '#aaa', display: 'block', marginBottom: '4px' }}>{isZh ? '文字內容' : 'Text Content'}</label>
                    <input
                      type="text"
                      value={selectedEl.text || ''}
                      onChange={e => updateSelectedProp('text', e.target.value)}
                      style={{ width: '100%', padding: '6px', borderRadius: '6px', background: '#111', color: '#fff', border: '1px solid #333' }}
                    />
                  </div>

                  <div>
                    <label style={{ color: '#aaa', display: 'block', marginBottom: '4px' }}>{isZh ? '字型' : 'Font Family'}</label>
                    <select
                      value={selectedEl.fontFamily || 'Inter'}
                      onChange={e => updateSelectedProp('fontFamily', e.target.value)}
                      style={{ width: '100%', padding: '6px', borderRadius: '6px', background: '#111', color: '#fff', border: '1px solid #333' }}
                    >
                      {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ color: '#aaa', display: 'block', marginBottom: '4px' }}>{isZh ? '字體大小' : 'Font Size'}: {selectedEl.fontSize}px</label>
                    <input
                      type="range"
                      min={16}
                      max={120}
                      value={selectedEl.fontSize || 40}
                      onChange={e => updateSelectedProp('fontSize', Number(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div>
                    <label style={{ color: '#aaa', display: 'block', marginBottom: '4px' }}>{isZh ? '文字顏色' : 'Text Color'}</label>
                    <input
                      type="color"
                      value={selectedEl.fillColor || '#FFFFFF'}
                      onChange={e => updateSelectedProp('fillColor', e.target.value)}
                      style={{ width: '100%', height: '32px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    />
                  </div>
                </>
              )}

              {selectedEl.type === 'cutout' && (
                <div>
                  <label style={{ color: '#aaa', display: 'block', marginBottom: '4px' }}>{isZh ? '鏤空形狀' : 'Cutout Shape'}</label>
                  <select
                    value={selectedEl.cutoutShape || 'rounded'}
                    onChange={e => updateSelectedProp('cutoutShape', e.target.value)}
                    style={{ width: '100%', padding: '6px', borderRadius: '6px', background: '#111', color: '#fff', border: '1px solid #333' }}
                  >
                    <option value="rect">Rectangle</option>
                    <option value="rounded">Rounded Rectangle</option>
                    <option value="circle">Circle / Oval</option>
                  </select>
                </div>
              )}

              {selectedEl.type === 'border' && (
                <>
                  <div>
                    <label style={{ color: '#aaa', display: 'block', marginBottom: '4px' }}>{isZh ? '邊框粗細' : 'Border Width'}: {selectedEl.borderWidth}px</label>
                    <input
                      type="range"
                      min={2}
                      max={40}
                      value={selectedEl.borderWidth || 8}
                      onChange={e => updateSelectedProp('borderWidth', Number(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div>
                    <label style={{ color: '#aaa', display: 'block', marginBottom: '4px' }}>{isZh ? '邊框顏色' : 'Border Color'}</label>
                    <input
                      type="color"
                      value={selectedEl.fillColor || '#FFD700'}
                      onChange={e => updateSelectedProp('fillColor', e.target.value)}
                      style={{ width: '100%', height: '32px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    />
                  </div>
                </>
              )}

              <button
                onClick={deleteSelected}
                style={{
                  padding: '8px',
                  borderRadius: '6px',
                  background: 'rgba(239,68,68,0.2)',
                  border: '1px solid rgba(239,68,68,0.4)',
                  color: '#ef4444',
                  cursor: 'pointer',
                  fontWeight: 600,
                  marginTop: '12px'
                }}
              >
                🗑️ {isZh ? '刪除選取元素' : 'Delete Selected Element'}
              </button>
            </div>
          ) : (
            <div style={{ color: '#666', fontSize: '12px' }}>{isZh ? '請點擊畫布上的元素進行調整' : 'Select an element to inspect properties'}</div>
          )}

          <hr style={{ borderColor: 'rgba(255,255,255,0.08)', margin: '20px 0' }} />

          {/* Quick Apply Section */}
          <h4 style={{ margin: '0 0 12px', fontSize: '14px', color: '#38ef7d' }}>⚡ {isZh ? '一鍵套用至實體' : 'Direct Apply Frame'}</h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
            <div>
              <label style={{ color: '#aaa', display: 'block', marginBottom: '4px' }}>{isZh ? '套用目標' : 'Target Type'}</label>
              <select
                value={applyTargetType}
                onChange={e => setApplyTargetType(e.target.value as any)}
                style={{ width: '100%', padding: '6px', borderRadius: '6px', background: '#111', color: '#fff', border: '1px solid #333' }}
              >
                <option value="style">{isZh ? '風格庫 (Style)' : 'Style Library'}</option>
                <option value="event">{isZh ? '活動場次 (Event)' : 'Event Session'}</option>
              </select>
            </div>

            <div>
              <label style={{ color: '#aaa', display: 'block', marginBottom: '4px' }}>{isZh ? '選擇項目' : 'Select ID'}</label>
              <select
                value={selectedTargetId}
                onChange={e => setSelectedTargetId(e.target.value)}
                style={{ width: '100%', padding: '6px', borderRadius: '6px', background: '#111', color: '#fff', border: '1px solid #333' }}
              >
                {applyTargetType === 'style' ? (
                  stylesList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.id})</option>)
                ) : (
                  eventsList.map(ev => <option key={ev.id} value={ev.id}>{ev.name} ({ev.id})</option>)
                )}
              </select>
            </div>

            <button
              onClick={handleApplyFrame}
              style={{
                padding: '10px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#fff',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                marginTop: '8px',
                boxShadow: '0 4px 12px rgba(16,185,129,0.3)'
              }}
            >
              🚀 {isZh ? '一鍵發佈套用相框' : 'Apply Frame Now'}
            </button>
          </div>
        </div>
      </div>

      {/* AI Assistant Modal */}
      {showAiModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#121324', border: '1px solid rgba(168,85,247,0.4)', borderRadius: '16px', padding: '24px', width: '420px', color: '#fff' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '18px', color: '#a855f7' }}>🤖 {isZh ? 'AI 相框助手建議' : 'AI Frame Design Assistant'}</h3>
            <p style={{ fontSize: '12px', color: '#aaa', margin: '0 0 16px' }}>
              {isZh ? '輸入活動類型與風格主題，AI 將自動生成配色方案、貼圖建議與文字' : 'Provide your event concept and AI will curate colors, titles, and layout ideas'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div>
                <label style={{ display: 'block', color: '#ccc', marginBottom: '4px' }}>{isZh ? '活動類型' : 'Event Type'}</label>
                <input
                  type="text"
                  value={aiEventType}
                  onChange={e => setAiEventType(e.target.value)}
                  placeholder="e.g. Wedding, Birthday, Corporate Annual Party"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', background: '#000', color: '#fff', border: '1px solid #333' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#ccc', marginBottom: '4px' }}>{isZh ? '風格主題' : 'Theme / Atmosphere'}</label>
                <input
                  type="text"
                  value={aiTheme}
                  onChange={e => setAiTheme(e.target.value)}
                  placeholder="e.g. Elegant Gold, Cyberpunk Neon, Vintage Retro"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', background: '#000', color: '#fff', border: '1px solid #333' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button
                  onClick={() => setShowAiModal(false)}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer' }}
                >
                  {isZh ? '取消' : 'Cancel'}
                </button>
                <button
                  onClick={handleAiSuggest}
                  disabled={aiLoading}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'linear-gradient(135deg, #a855f7, #6366f1)', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                  {aiLoading ? (isZh ? '思考中...' : 'Generating...') : (isZh ? '生成設計' : 'Generate Ideas')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
