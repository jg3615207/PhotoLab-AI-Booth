import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  visible?: boolean;
  
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

  // Shape / Border props
  shapeType?: 'rect' | 'circle' | 'line' | 'badge' | 'border-rect';
  borderStyle?: 'solid' | 'dashed' | 'double';
  borderWidth?: number;

  // Sticker / Image props
  stickerIcon?: string;
  imageUrl?: string;
  imageObj?: HTMLImageElement;
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
  '#7C4DFF', '#00E676', '#00E5FF', '#FF6D00', '#1A1A2E', '#E94560'
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
  const [frameName, setFrameName] = useState('New Custom Event Frame');
  const [backgroundColor, setBackgroundColor] = useState('#121324');
  const [useBackgroundFill, setUseBackgroundFill] = useState(true);

  // Initial Elements
  const [elements, setElements] = useState<FrameElement[]>([
    {
      id: 'border_outer',
      type: 'border',
      x: 30,
      y: 30,
      width: 1140,
      height: 1740,
      rotation: 0,
      opacity: 1,
      visible: true,
      shapeType: 'border-rect',
      borderStyle: 'double',
      borderWidth: 12,
      fillColor: '#FFD700'
    },
    {
      id: 'cutout_main',
      type: 'cutout',
      x: 80,
      y: 80,
      width: 1040,
      height: 1440,
      rotation: 0,
      opacity: 1,
      visible: true,
      cutoutShape: 'rounded',
      cutoutRadius: 32
    },
    {
      id: 'text_header',
      type: 'text',
      x: 100,
      y: 1560,
      width: 1000,
      height: 100,
      rotation: 0,
      opacity: 1,
      visible: true,
      text: 'CELEBRATION 2026',
      fontFamily: 'Montserrat',
      fontSize: 56,
      fillColor: '#FFD700',
      strokeColor: '#000000',
      strokeWidth: 4,
      align: 'center',
      bold: true
    }
  ]);

  const [selectedId, setSelectedId] = useState<string | null>('cutout_main');
  const [previewMode, setPreviewMode] = useState(true); // show sample photo behind cutouts

  // History Stack for Undo / Redo
  const [history, setHistory] = useState<FrameElement[][]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  // Mouse Drag / Resize State
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'move' | 'nw' | 'ne' | 'sw' | 'se' | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [elementStart, setElementStart] = useState({ x: 0, y: 0, w: 0, h: 0 });

  // Apply Target Selection
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

  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sampleImgRef = useRef<HTMLImageElement | null>(null);

  // Load sample image once
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80';
    img.onload = () => {
      sampleImgRef.current = img;
      renderCanvas();
    };
  }, []);

  // Fetch styles, events, and templates
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

  // Push state to history
  const pushHistory = (newElements: FrameElement[]) => {
    const updated = history.slice(0, historyIdx + 1);
    updated.push(newElements);
    setHistory(updated);
    setHistoryIdx(updated.length - 1);
  };

  const updateElementsState = (newElements: FrameElement[], recordHistory = true) => {
    setElements(newElements);
    if (recordHistory) {
      pushHistory(newElements);
    }
  };

  const undo = () => {
    if (historyIdx > 0) {
      setHistoryIdx(historyIdx - 1);
      setElements(history[historyIdx - 1]);
    }
  };

  const redo = () => {
    if (historyIdx < history.length - 1) {
      setHistoryIdx(historyIdx + 1);
      setElements(history[historyIdx + 1]);
    }
  };

  const selectedEl = elements.find(e => e.id === selectedId);

  // Render Canvas Callback
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    ctx.clearRect(0, 0, targetWidth, targetHeight);

    // 1. If Preview Mode, draw sample photo background
    if (previewMode && sampleImgRef.current) {
      ctx.drawImage(sampleImgRef.current, 0, 0, targetWidth, targetHeight);
    } else if (useBackgroundFill) {
      // Solid background fill for frame
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    }

    // 2. Render all visible elements
    elements.forEach(el => {
      if (el.visible === false) return;

      ctx.save();
      ctx.globalAlpha = el.opacity;

      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      ctx.translate(cx, cy);
      ctx.rotate((el.rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);

      if (el.type === 'cutout') {
        if (!previewMode) {
          // Erase cutout area to 100% transparent PNG
          ctx.globalCompositeOperation = 'destination-out';
          ctx.beginPath();
          if (el.cutoutShape === 'circle') {
            const rx = el.width / 2;
            const ry = el.height / 2;
            ctx.ellipse(el.x + rx, el.y + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
          } else if (el.cutoutShape === 'rounded') {
            const r = el.cutoutRadius || 20;
            ctx.roundRect(el.x, el.y, el.width, el.height, r);
          } else {
            ctx.rect(el.x, el.y, el.width, el.height);
          }
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
        } else {
          // In preview mode: draw dashed border and placeholder text
          ctx.strokeStyle = '#4ecdc4';
          ctx.lineWidth = 4;
          ctx.setLineDash([12, 8]);
          ctx.strokeRect(el.x, el.y, el.width, el.height);
          ctx.setLineDash([]);

          ctx.fillStyle = 'rgba(78, 205, 196, 0.9)';
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
        ctx.font = `${Math.min(Math.abs(el.width), Math.abs(el.height)) * 0.8}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(el.stickerIcon || '⭐', el.x + el.width / 2, el.y + el.height / 2);
      } else if (el.type === 'image' && el.imageObj) {
        ctx.drawImage(el.imageObj, el.x, el.y, el.width, el.height);
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

      // Draw Selection Handles
      if (el.id === selectedId) {
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(el.x - 4, el.y - 4, el.width + 8, el.height + 8);
        ctx.setLineDash([]);

        // Handle Boxes (NW, NE, SW, SE)
        ctx.fillStyle = '#6366f1';
        const handles = [
          { x: el.x - 6, y: el.y - 6 },
          { x: el.x + el.width - 6, y: el.y - 6 },
          { x: el.x - 6, y: el.y + el.height - 6 },
          { x: el.x + el.width - 6, y: el.y + el.height - 6 }
        ];
        handles.forEach(h => ctx.fillRect(h.x, h.y, 12, 12));
      }

      ctx.restore();
    });
  }, [elements, targetWidth, targetHeight, selectedId, previewMode, useBackgroundFill, backgroundColor]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Convert Pointer Event to Canvas Coordinates
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = targetWidth / rect.width;
    const scaleY = targetHeight / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  // Mouse Interaction: Click to Select, Drag to Move, Handle to Resize
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    
    // 1. Check if clicking handles of currently selected element
    if (selectedEl) {
      const hSize = 20; // hit box area around handle
      const nw = { x: selectedEl.x, y: selectedEl.y };
      const ne = { x: selectedEl.x + selectedEl.width, y: selectedEl.y };
      const sw = { x: selectedEl.x, y: selectedEl.y + selectedEl.height };
      const se = { x: selectedEl.x + selectedEl.width, y: selectedEl.y + selectedEl.height };

      if (Math.abs(coords.x - nw.x) < hSize && Math.abs(coords.y - nw.y) < hSize) {
        setIsDragging(true);
        setDragMode('nw');
        setDragStart(coords);
        setElementStart({ x: selectedEl.x, y: selectedEl.y, w: selectedEl.width, h: selectedEl.height });
        return;
      }
      if (Math.abs(coords.x - ne.x) < hSize && Math.abs(coords.y - ne.y) < hSize) {
        setIsDragging(true);
        setDragMode('ne');
        setDragStart(coords);
        setElementStart({ x: selectedEl.x, y: selectedEl.y, w: selectedEl.width, h: selectedEl.height });
        return;
      }
      if (Math.abs(coords.x - sw.x) < hSize && Math.abs(coords.y - sw.y) < hSize) {
        setIsDragging(true);
        setDragMode('sw');
        setDragStart(coords);
        setElementStart({ x: selectedEl.x, y: selectedEl.y, w: selectedEl.width, h: selectedEl.height });
        return;
      }
      if (Math.abs(coords.x - se.x) < hSize && Math.abs(coords.y - se.y) < hSize) {
        setIsDragging(true);
        setDragMode('se');
        setDragStart(coords);
        setElementStart({ x: selectedEl.x, y: selectedEl.y, w: selectedEl.width, h: selectedEl.height });
        return;
      }
    }

    // 2. Hit Test elements in reverse z-order (top-most first)
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];
      if (el.visible === false || el.locked) continue;

      if (
        coords.x >= el.x &&
        coords.x <= el.x + el.width &&
        coords.y >= el.y &&
        coords.y <= el.y + el.height
      ) {
        setSelectedId(el.id);
        setIsDragging(true);
        setDragMode('move');
        setDragStart(coords);
        setElementStart({ x: el.x, y: el.y, w: el.width, h: el.height });
        return;
      }
    }

    // Clicked empty area -> deselect
    setSelectedId(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !selectedId || !dragMode) return;

    const coords = getCanvasCoords(e);
    const dx = coords.x - dragStart.x;
    const dy = coords.y - dragStart.y;

    const updated = elements.map(el => {
      if (el.id !== selectedId) return el;

      if (dragMode === 'move') {
        return {
          ...el,
          x: Math.round(elementStart.x + dx),
          y: Math.round(elementStart.y + dy)
        };
      } else if (dragMode === 'se') {
        return {
          ...el,
          width: Math.max(40, Math.round(elementStart.w + dx)),
          height: Math.max(40, Math.round(elementStart.h + dy))
        };
      } else if (dragMode === 'nw') {
        return {
          ...el,
          x: Math.round(elementStart.x + dx),
          y: Math.round(elementStart.y + dy),
          width: Math.max(40, Math.round(elementStart.w - dx)),
          height: Math.max(40, Math.round(elementStart.h - dy))
        };
      } else if (dragMode === 'ne') {
        return {
          ...el,
          y: Math.round(elementStart.y + dy),
          width: Math.max(40, Math.round(elementStart.w + dx)),
          height: Math.max(40, Math.round(elementStart.h - dy))
        };
      } else if (dragMode === 'sw') {
        return {
          ...el,
          x: Math.round(elementStart.x + dx),
          width: Math.max(40, Math.round(elementStart.w - dx)),
          height: Math.max(40, Math.round(elementStart.h + dy))
        };
      }
      return el;
    });

    setElements(updated);
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      setDragMode(null);
      pushHistory(elements);
    }
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
      visible: true,
      cutoutShape: 'rounded',
      cutoutRadius: 24
    };
    updateElementsState([...elements, newEl]);
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
      visible: true,
      text: 'HAPPY CELEBRATION',
      fontFamily: 'Inter',
      fontSize: 48,
      fillColor: '#FFFFFF',
      align: 'center',
      bold: true
    };
    updateElementsState([...elements, newEl]);
    setSelectedId(newEl.id);
  };

  const addStickerElement = (icon: string) => {
    const newEl: FrameElement = {
      id: `sticker_${Date.now()}`,
      type: 'sticker',
      x: Math.round(targetWidth / 2 - 60),
      y: Math.round(targetHeight / 2 - 60),
      width: 120,
      height: 120,
      rotation: 0,
      opacity: 1,
      visible: true,
      stickerIcon: icon
    };
    updateElementsState([...elements, newEl]);
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
      visible: true,
      shapeType: 'border-rect',
      borderStyle: 'solid',
      borderWidth: 10,
      fillColor: '#FFD700'
    };
    updateElementsState([...elements, newEl]);
    setSelectedId(newEl.id);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    img.onload = () => {
      const newEl: FrameElement = {
        id: `img_${Date.now()}`,
        type: 'image',
        x: Math.round(targetWidth / 2 - 150),
        y: Math.round(targetHeight / 2 - 150),
        width: 300,
        height: Math.round(300 * (img.height / img.width)),
        rotation: 0,
        opacity: 1,
        visible: true,
        imageUrl: url,
        imageObj: img
      };
      updateElementsState([...elements, newEl]);
      setSelectedId(newEl.id);
    };
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    updateElementsState(elements.filter(e => e.id !== selectedId));
    setSelectedId(null);
  };

  const moveLayer = (id: string, direction: 'up' | 'down') => {
    const idx = elements.findIndex(e => e.id === id);
    if (idx < 0) return;
    if (direction === 'up' && idx < elements.length - 1) {
      const updated = [...elements];
      const temp = updated[idx];
      updated[idx] = updated[idx + 1];
      updated[idx + 1] = temp;
      updateElementsState(updated);
    } else if (direction === 'down' && idx > 0) {
      const updated = [...elements];
      const temp = updated[idx];
      updated[idx] = updated[idx - 1];
      updated[idx - 1] = temp;
      updateElementsState(updated);
    }
  };

  const updateSelectedProp = (key: keyof FrameElement, value: any) => {
    if (!selectedId) return;
    updateElementsState(
      elements.map(e => (e.id === selectedId ? { ...e, [key]: value } : e))
    );
  };

  // Export PNG Data URL with 100% transparent cutouts and solid frame fill
  const generateExportPng = (): string => {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = targetWidth;
    exportCanvas.height = targetHeight;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return '';

    // 1. Fill solid background
    if (useBackgroundFill) {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    }

    // 2. Render all visible elements (excluding cutouts)
    elements.forEach(el => {
      if (el.visible === false || el.type === 'cutout') return;

      ctx.save();
      ctx.globalAlpha = el.opacity;
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      ctx.translate(cx, cy);
      ctx.rotate((el.rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);

      if (el.type === 'border') {
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
        ctx.font = `${Math.min(Math.abs(el.width), Math.abs(el.height)) * 0.8}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(el.stickerIcon || '⭐', el.x + el.width / 2, el.y + el.height / 2);
      } else if (el.type === 'image' && el.imageObj) {
        ctx.drawImage(el.imageObj, el.x, el.y, el.width, el.height);
      }
      ctx.restore();
    });

    // 3. Cutout Erase (destination-out) to make cutouts 100% transparent
    elements.forEach(el => {
      if (el.type !== 'cutout' || el.visible === false) return;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      if (el.cutoutShape === 'circle') {
        const rx = el.width / 2;
        const ry = el.height / 2;
        ctx.ellipse(el.x + rx, el.y + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
      } else if (el.cutoutShape === 'rounded') {
        const r = el.cutoutRadius || 20;
        ctx.roundRect(el.x, el.y, el.width, el.height, r);
      } else {
        ctx.rect(el.x, el.y, el.width, el.height);
      }
      ctx.fill();
      ctx.restore();
    });

    return exportCanvas.toDataURL('image/png');
  };

  // Download PNG file directly
  const handleDownloadPng = () => {
    const pngData = generateExportPng();
    const link = document.createElement('a');
    link.download = `${frameName.toLowerCase().replace(/\s+/g, '_')}_frame.png`;
    link.href = pngData;
    link.click();
  };

  // Save to Database Template
  const handleSaveTemplate = async () => {
    const pngData = generateExportPng();
    try {
      const res = await fetch('/api/frame-maker/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: frameName,
          canvas_json: JSON.stringify({ targetWidth, targetHeight, backgroundColor, useBackgroundFill, elements }),
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
      if (data.backgroundColor) setBackgroundColor(data.backgroundColor);
      if (data.useBackgroundFill !== undefined) setUseBackgroundFill(data.useBackgroundFill);
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
      if (data.colors && data.colors[0]) setBackgroundColor(data.colors[0]);
      if (data.texts && data.texts[0]) {
        updateElementsState(
          elements.map(e => e.type === 'text' ? { ...e, text: data.texts[0], fillColor: data.colors ? data.colors[1] || '#FFFFFF' : '#FFFFFF' } : e)
        );
      }
      alert(isZh ? `AI 建議完成！已自動調整主題配色與標題：${data.title}` : `AI suggestion applied: ${data.title}`);
    } catch (e) {
      setAiLoading(false);
      alert(isZh ? 'AI 建議生成失敗' : 'AI Suggestion failed');
    }
  };

  return (
    <div style={{ background: '#0b0c16', color: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: '#a855f7' }}>
            🖼️ {isZh ? '相框設計師 (Photo Frame Studio)' : 'Photo Frame Studio'}
          </h2>
          <input
            type="text"
            value={frameName}
            onChange={e => setFrameName(e.target.value)}
            style={{
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              minWidth: '220px'
            }}
          />
        </div>

        {/* Action Buttons Toolbar */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={undo}
            disabled={historyIdx <= 0}
            style={{ padding: '6px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: historyIdx > 0 ? '#fff' : '#666', cursor: historyIdx > 0 ? 'pointer' : 'default', fontSize: '13px' }}
          >
            ↩️ {isZh ? '復原' : 'Undo'}
          </button>
          <button
            onClick={redo}
            disabled={historyIdx >= history.length - 1}
            style={{ padding: '6px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: historyIdx < history.length - 1 ? '#fff' : '#666', cursor: historyIdx < history.length - 1 ? 'pointer' : 'default', fontSize: '13px' }}
          >
            ↪️ {isZh ? '重做' : 'Redo'}
          </button>

          <button
            onClick={() => setShowAiModal(true)}
            style={{ padding: '6px 14px', borderRadius: '6px', background: 'linear-gradient(135deg, #a855f7, #6366f1)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}
          >
            🤖 {isZh ? 'AI 助手' : 'AI Assistant'}
          </button>

          <button
            onClick={handleDownloadPng}
            style={{ padding: '6px 14px', borderRadius: '6px', background: 'rgba(56,239,125,0.2)', border: '1px solid rgba(56,239,125,0.4)', color: '#38ef7d', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
          >
            ⬇️ {isZh ? '下載 PNG' : 'Download PNG'}
          </button>

          <button
            onClick={handleSaveTemplate}
            style={{ padding: '6px 14px', borderRadius: '6px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', fontSize: '13px' }}
          >
            💾 {isZh ? '存為模板' : 'Save Template'}
          </button>
        </div>
      </div>

      {/* Main Studio Grid: Left Tools + Center Canvas + Right Inspector & Layers */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 320px', gap: '16px' }}>
        {/* Left Toolbar */}
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#a3b8ff' }}>🛠️ {isZh ? '新增元素' : 'Add Elements'}</h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            <button
              onClick={addCutoutSlot}
              style={{ padding: '9px 12px', borderRadius: '8px', background: 'rgba(78,205,196,0.15)', border: '1px solid rgba(78,205,196,0.4)', color: '#4ecdc4', fontWeight: 600, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}
            >
              ✂️ {isZh ? '+ 相位鏤空區 (Cutout)' : '+ Photo Cutout Slot'}
            </button>

            <button
              onClick={addTextElement}
              style={{ padding: '9px 12px', borderRadius: '8px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)', color: '#a3b8ff', fontWeight: 600, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}
            >
              🔤 {isZh ? '+ 活動文字 (Text)' : '+ Text Element'}
            </button>

            <button
              onClick={addBorderElement}
              style={{ padding: '9px 12px', borderRadius: '8px', background: 'rgba(255,215,0,0.15)', border: '1px solid rgba(255,215,0,0.4)', color: '#FFD700', fontWeight: 600, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}
            >
              🖼️ {isZh ? '+ 外層邊框 (Border)' : '+ Outer Border Frame'}
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ padding: '9px 12px', borderRadius: '8px', background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.4)', color: '#f43f5e', fontWeight: 600, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}
            >
              📷 {isZh ? '+ 上傳圖案 (Upload Image)' : '+ Upload Image Asset'}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
          </div>

          {/* Background Settings */}
          <h4 style={{ margin: '14px 0 8px', fontSize: '13px', color: '#a3b8ff' }}>🎨 {isZh ? '相框底色' : 'Frame Background'}</h4>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
            <input
              type="color"
              value={backgroundColor}
              onChange={e => setBackgroundColor(e.target.value)}
              style={{ width: '36px', height: '32px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            />
            <label style={{ fontSize: '12px', color: '#ccc', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="checkbox"
                checked={useBackgroundFill}
                onChange={e => setUseBackgroundFill(e.target.checked)}
              />
              {isZh ? '實色相框邊界' : 'Solid Background Fill'}
            </label>
          </div>

          <h4 style={{ margin: '14px 0 8px', fontSize: '13px', color: '#a3b8ff' }}>✨ {isZh ? '貼圖庫' : 'Sticker Collection'}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '16px' }}>
            {BUILTIN_STICKERS.map(s => (
              <button
                key={s.label}
                onClick={() => addStickerElement(s.icon)}
                style={{ padding: '8px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '18px', cursor: 'pointer' }}
                title={s.label}
              >
                {s.icon}
              </button>
            ))}
          </div>

          <h4 style={{ margin: '14px 0 8px', fontSize: '13px', color: '#a3b8ff' }}>📁 {isZh ? '已存模板' : 'Saved Templates'}</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto' }}>
            {templates.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#666' }}>{isZh ? '無歷史模板' : 'No templates saved'}</div>
            ) : (
              templates.map(t => (
                <div
                  key={t.id}
                  onClick={() => loadTemplate(t)}
                  style={{ padding: '7px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: '12px' }}
                >
                  📌 {t.name}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Center Canvas Preview Stage */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(0,0,0,0.4)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#aaa' }}>{isZh ? '比例尺寸:' : 'Target Ratio:'}</span>
              <select
                value={`${targetWidth}x${targetHeight}`}
                onChange={e => {
                  const [w, h] = e.target.value.split('x').map(Number);
                  setTargetWidth(w);
                  setTargetHeight(h);
                }}
                style={{ padding: '4px 8px', borderRadius: '6px', background: '#111', color: '#fff', border: '1px solid #333', fontSize: '12px' }}
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
                padding: '5px 10px',
                borderRadius: '6px',
                background: previewMode ? 'rgba(56,239,125,0.2)' : 'rgba(255,255,255,0.06)',
                border: previewMode ? '1px solid rgba(56,239,125,0.4)' : '1px solid rgba(255,255,255,0.15)',
                color: previewMode ? '#38ef7d' : '#ccc',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              📷 {previewMode ? (isZh ? '實照模擬: ON' : 'Photo Preview: ON') : (isZh ? '透明 PNG 鏤空模式' : 'Cutout PNG Mode')}
            </button>
          </div>

          {/* Interactive HTML5 Canvas */}
          <div style={{ width: '100%', display: 'flex', justifyContent: 'center', overflow: 'hidden', padding: '6px' }}>
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{
                width: targetWidth > targetHeight ? '520px' : '340px',
                height: targetWidth > targetHeight ? '340px' : '510px',
                borderRadius: '8px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
                cursor: isDragging ? 'grabbing' : 'pointer',
                background: previewMode ? '#000' : 'repeating-conic-gradient(#222 0% 25%, #333 0% 50%) 50% / 20px 20px'
              }}
            />
          </div>
          <div style={{ fontSize: '11px', color: '#888', marginTop: '8px' }}>
            💡 {isZh ? '提示：可直接在畫布點擊選擇、拖曳移動或點選四角手把進行縮放' : 'Tip: Click elements to select, drag to position, drag corner handles to resize'}
          </div>
        </div>

        {/* Right Inspector & Layers Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Universal Inspector Panel */}
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#a3b8ff' }}>⚙️ {isZh ? '元素屬性調整' : 'Element Inspector'}</h4>

            {selectedEl ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#aaa', fontWeight: 600 }}>Type: {selectedEl.type}</span>
                  <button onClick={deleteSelected} style={{ padding: '3px 8px', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                    🗑️ {isZh ? '刪除' : 'Delete'}
                  </button>
                </div>

                {/* Common Transform Controls: X, Y, Width, Height, Rotation, Opacity */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <div>
                    <label style={{ color: '#888', fontSize: '10px' }}>X Pos (px)</label>
                    <input type="number" value={selectedEl.x} onChange={e => updateSelectedProp('x', Number(e.target.value))} style={{ width: '100%', padding: '4px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '4px' }} />
                  </div>
                  <div>
                    <label style={{ color: '#888', fontSize: '10px' }}>Y Pos (px)</label>
                    <input type="number" value={selectedEl.y} onChange={e => updateSelectedProp('y', Number(e.target.value))} style={{ width: '100%', padding: '4px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '4px' }} />
                  </div>
                  <div>
                    <label style={{ color: '#888', fontSize: '10px' }}>Width (px)</label>
                    <input type="number" value={selectedEl.width} onChange={e => updateSelectedProp('width', Number(e.target.value))} style={{ width: '100%', padding: '4px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '4px' }} />
                  </div>
                  <div>
                    <label style={{ color: '#888', fontSize: '10px' }}>Height (px)</label>
                    <input type="number" value={selectedEl.height} onChange={e => updateSelectedProp('height', Number(e.target.value))} style={{ width: '100%', padding: '4px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '4px' }} />
                  </div>
                </div>

                <div>
                  <label style={{ color: '#888', fontSize: '10px' }}>Rotation: {selectedEl.rotation}°</label>
                  <input type="range" min={0} max={360} value={selectedEl.rotation} onChange={e => updateSelectedProp('rotation', Number(e.target.value))} style={{ width: '100%' }} />
                </div>

                <div>
                  <label style={{ color: '#888', fontSize: '10px' }}>Opacity: {Math.round(selectedEl.opacity * 100)}%</label>
                  <input type="range" min={0.1} max={1} step={0.05} value={selectedEl.opacity} onChange={e => updateSelectedProp('opacity', Number(e.target.value))} style={{ width: '100%' }} />
                </div>

                {/* Specific Props */}
                {selectedEl.type === 'text' && (
                  <>
                    <div>
                      <label style={{ color: '#888', fontSize: '10px' }}>Text String</label>
                      <input type="text" value={selectedEl.text || ''} onChange={e => updateSelectedProp('text', e.target.value)} style={{ width: '100%', padding: '4px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '4px' }} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      <div>
                        <label style={{ color: '#888', fontSize: '10px' }}>Font</label>
                        <select value={selectedEl.fontFamily || 'Inter'} onChange={e => updateSelectedProp('fontFamily', e.target.value)} style={{ width: '100%', padding: '4px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '4px' }}>
                          {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ color: '#888', fontSize: '10px' }}>Size (px)</label>
                        <input type="number" value={selectedEl.fontSize || 40} onChange={e => updateSelectedProp('fontSize', Number(e.target.value))} style={{ width: '100%', padding: '4px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '4px' }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <div>
                        <label style={{ color: '#888', fontSize: '10px' }}>Text Fill</label>
                        <input type="color" value={selectedEl.fillColor || '#FFFFFF'} onChange={e => updateSelectedProp('fillColor', e.target.value)} style={{ width: '40px', height: '26px', border: 'none', cursor: 'pointer' }} />
                      </div>
                      <div>
                        <label style={{ color: '#888', fontSize: '10px' }}>Stroke Color</label>
                        <input type="color" value={selectedEl.strokeColor || '#000000'} onChange={e => updateSelectedProp('strokeColor', e.target.value)} style={{ width: '40px', height: '26px', border: 'none', cursor: 'pointer' }} />
                      </div>
                    </div>
                  </>
                )}

                {selectedEl.type === 'cutout' && (
                  <div>
                    <label style={{ color: '#888', fontSize: '10px' }}>Cutout Geometry</label>
                    <select value={selectedEl.cutoutShape || 'rounded'} onChange={e => updateSelectedProp('cutoutShape', e.target.value)} style={{ width: '100%', padding: '4px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '4px' }}>
                      <option value="rect">Rectangle</option>
                      <option value="rounded">Rounded Rectangle</option>
                      <option value="circle">Circle / Oval</option>
                    </select>
                  </div>
                )}

                {selectedEl.type === 'border' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      <div>
                        <label style={{ color: '#888', fontSize: '10px' }}>Border Style</label>
                        <select value={selectedEl.borderStyle || 'solid'} onChange={e => updateSelectedProp('borderStyle', e.target.value)} style={{ width: '100%', padding: '4px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '4px' }}>
                          <option value="solid">Solid Line</option>
                          <option value="dashed">Dashed Line</option>
                          <option value="double">Double Line</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ color: '#888', fontSize: '10px' }}>Width (px)</label>
                        <input type="number" value={selectedEl.borderWidth || 8} onChange={e => updateSelectedProp('borderWidth', Number(e.target.value))} style={{ width: '100%', padding: '4px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '4px' }} />
                      </div>
                    </div>
                    <div>
                      <label style={{ color: '#888', fontSize: '10px' }}>Border Color</label>
                      <input type="color" value={selectedEl.fillColor || '#FFD700'} onChange={e => updateSelectedProp('fillColor', e.target.value)} style={{ width: '100%', height: '26px', border: 'none', cursor: 'pointer' }} />
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div style={{ color: '#666', fontSize: '12px' }}>{isZh ? '點擊畫布元素以調整屬性' : 'Click canvas element to inspect props'}</div>
            )}
          </div>

          {/* Layers Manager */}
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '180px', overflowY: 'auto' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#a3b8ff' }}>🥞 {isZh ? '圖層順序' : 'Layer Stack'}</h4>
            <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: '4px' }}>
              {elements.map(el => (
                <div
                  key={el.id}
                  onClick={() => setSelectedId(el.id)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: '6px',
                    background: el.id === selectedId ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)',
                    border: el.id === selectedId ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    fontSize: '11px'
                  }}
                >
                  <span style={{ color: el.id === selectedId ? '#a3b8ff' : '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                    {el.type === 'text' ? `🔤 ${el.text}` : el.type === 'cutout' ? '✂️ Photo Cutout' : el.type === 'border' ? '🖼️ Frame Border' : `✨ ${el.stickerIcon || el.type}`}
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={(e) => { e.stopPropagation(); moveLayer(el.id, 'up'); }} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', padding: '0 2px' }}>▲</button>
                    <button onClick={(e) => { e.stopPropagation(); moveLayer(el.id, 'down'); }} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', padding: '0 2px' }}>▼</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Direct Apply */}
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(56,239,125,0.2)' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#38ef7d' }}>🚀 {isZh ? '一鍵發佈套用' : 'Direct Apply Frame'}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <select value={applyTargetType} onChange={e => setApplyTargetType(e.target.value as any)} style={{ padding: '6px', borderRadius: '6px', background: '#111', color: '#fff', border: '1px solid #333' }}>
                <option value="style">{isZh ? '風格庫 (Style)' : 'Style Library'}</option>
                <option value="event">{isZh ? '活動場次 (Event)' : 'Event Session'}</option>
              </select>

              <select value={selectedTargetId} onChange={e => setSelectedTargetId(e.target.value)} style={{ padding: '6px', borderRadius: '6px', background: '#111', color: '#fff', border: '1px solid #333' }}>
                {applyTargetType === 'style' ? (
                  stylesList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.id})</option>)
                ) : (
                  eventsList.map(ev => <option key={ev.id} value={ev.id}>{ev.name} ({ev.id})</option>)
                )}
              </select>

              <button
                onClick={handleApplyFrame}
                style={{ padding: '8px', borderRadius: '6px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer' }}
              >
                ⚡ {isZh ? '立即發佈套用相框' : 'Apply Frame Now'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* AI Assistant Modal */}
      {showAiModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#121324', border: '1px solid rgba(168,85,247,0.4)', borderRadius: '16px', padding: '24px', width: '420px', color: '#fff' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '18px', color: '#a855f7' }}>🤖 {isZh ? 'AI 相框設計助手' : 'AI Frame Design Assistant'}</h3>
            <p style={{ fontSize: '12px', color: '#aaa', margin: '0 0 16px' }}>
              {isZh ? '輸入活動類型與主題，AI 將自動生成對應配色、文字標題與背景主題' : 'Provide your event concept and AI will curate color palettes, titles, and layout themes'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div>
                <label style={{ display: 'block', color: '#ccc', marginBottom: '4px' }}>{isZh ? '活動類型' : 'Event Type'}</label>
                <input type="text" value={aiEventType} onChange={e => setAiEventType(e.target.value)} placeholder="e.g. Wedding, Birthday, Annual Gala" style={{ width: '100%', padding: '8px', borderRadius: '6px', background: '#000', color: '#fff', border: '1px solid #333' }} />
              </div>

              <div>
                <label style={{ display: 'block', color: '#ccc', marginBottom: '4px' }}>{isZh ? '風格氛圍' : 'Theme / Mood'}</label>
                <input type="text" value={aiTheme} onChange={e => setAiTheme(e.target.value)} placeholder="e.g. Elegant Gold, Cyberpunk Neon, Vintage" style={{ width: '100%', padding: '8px', borderRadius: '6px', background: '#000', color: '#fff', border: '1px solid #333' }} />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button onClick={() => setShowAiModal(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer' }}>
                  {isZh ? '取消' : 'Cancel'}
                </button>
                <button onClick={handleAiSuggest} disabled={aiLoading} style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'linear-gradient(135deg, #a855f7, #6366f1)', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                  {aiLoading ? (isZh ? '生成中...' : 'Generating...') : (isZh ? '套用建議' : 'Apply AI Design')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
