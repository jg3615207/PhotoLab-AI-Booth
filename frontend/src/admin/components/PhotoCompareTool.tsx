import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAdminLang } from '../context/AdminLangContext';

type CompareMode = 'sweep-h' | 'sweep-v' | 'sbs' | 'tab' | 'diff' | 'onion';

interface FileInfo {
  name: string;
  width: number;
  height: number;
  size: number;
}

export default function PhotoCompareTool() {
  const { lang } = useAdminLang();
  const isZh = lang === 'zh-Hant';

  const [imageA, setImageA] = useState<HTMLImageElement | null>(null);
  const [imageB, setImageB] = useState<HTMLImageElement | null>(null);
  const [infoA, setInfoA] = useState<FileInfo | null>(null);
  const [infoB, setInfoB] = useState<FileInfo | null>(null);

  const [compareMode, setCompareMode] = useState<CompareMode>('sweep-h');
  const [sweepPos, setSweepPos] = useState(0.5); // 0 to 1
  const [onionOpacity, setOnionOpacity] = useState(0.5);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  
  const [isQuickToggleOn, setIsQuickToggleOn] = useState(false);
  const [showPixelInspector, setShowPixelInspector] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showHistogram, setShowHistogram] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setCanvasSize({ width: clientWidth, height: clientHeight });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load Image Helper
  const loadImage = (file: File, isA: boolean) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const info = {
        name: file.name,
        width: img.width,
        height: img.height,
        size: file.size
      };
      if (isA) {
        setImageA(img);
        setInfoA(info);
      } else {
        setImageB(img);
        setInfoB(info);
      }
      fitZoom(img.width, img.height);
    };
    img.src = url;
  };

  // Drag and Drop Handlers
  const onDrop = (e: React.DragEvent, isA: boolean) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      loadImage(e.dataTransfer.files[0], isA);
    }
  };
  const onDragOver = (e: React.DragEvent) => e.preventDefault();

  // Paste Support
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        // Paste into whichever is empty, or A if both full
        if (!imageA) loadImage(e.clipboardData.files[0], true);
        else if (!imageB) loadImage(e.clipboardData.files[0], false);
        else loadImage(e.clipboardData.files[0], true);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [imageA, imageB]);

  const fitZoom = (imgW?: number, imgH?: number) => {
    const w = imgW || (imageA ? imageA.width : canvasSize.width);
    const h = imgH || (imageA ? imageA.height : canvasSize.height);
    const scale = Math.min(canvasSize.width / w, canvasSize.height / h) * 0.95;
    setZoom(scale);
    setPan({ x: canvasSize.width / 2, y: canvasSize.height / 2 });
  };

  const zoomOneToOne = () => {
    setZoom(1);
    setPan({ x: canvasSize.width / 2, y: canvasSize.height / 2 });
  };

  const zoomFace = () => {
    // zoom to center 40%
    if (!imageA) return;
    const scale = Math.min(canvasSize.width / (imageA.width * 0.4), canvasSize.height / (imageA.height * 0.4));
    setZoom(scale);
    setPan({ x: canvasSize.width / 2, y: canvasSize.height / 2 });
  };

  // Interaction
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = zoom * zoomFactor;
    
    // Zoom towards mouse
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const dx = mx - pan.x;
    const dy = my - pan.y;

    setPan({
      x: mx - dx * zoomFactor,
      y: my - dy * zoomFactor
    });
    setZoom(newZoom);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    
    // Check if clicking divider
    if (compareMode === 'sweep-h' && Math.abs(mx - sweepPos * canvasSize.width) < 10) {
      setIsDraggingDivider(true);
    } else if (compareMode === 'sweep-v' && Math.abs(my - sweepPos * canvasSize.height) < 10) {
      setIsDraggingDivider(true);
    } else {
      setIsPanning(true);
    }
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }

    if (isDraggingDivider) {
      if (rect) {
        if (compareMode === 'sweep-h') {
          setSweepPos(Math.max(0, Math.min(1, (e.clientX - rect.left) / canvasSize.width)));
        } else {
          setSweepPos(Math.max(0, Math.min(1, (e.clientY - rect.top) / canvasSize.height)));
        }
      }
    } else if (isPanning) {
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      setPan(p => ({ x: p.x + dx, y: p.y + dy }));
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handlePointerUp = () => {
    setIsDraggingDivider(false);
    setIsPanning(false);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsQuickToggleOn(true);
      } else if (e.key === 'ArrowLeft' && compareMode === 'sweep-h') {
        setSweepPos(p => Math.max(0, p - 0.05));
      } else if (e.key === 'ArrowRight' && compareMode === 'sweep-h') {
        setSweepPos(p => Math.min(1, p + 0.05));
      } else if (e.key === 'ArrowUp' && compareMode === 'sweep-v') {
        setSweepPos(p => Math.max(0, p - 0.05));
      } else if (e.key === 'ArrowDown' && compareMode === 'sweep-v') {
        setSweepPos(p => Math.min(1, p + 0.05));
      } else if (e.key === 'f' || e.key === 'F') {
        fitZoom();
      } else if (e.key === '1') {
        zoomOneToOne();
      } else if (e.key === '+' || e.key === '=') {
        setZoom(z => z * 1.1);
      } else if (e.key === '-' || e.key === '_') {
        setZoom(z => z * 0.9);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsQuickToggleOn(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [compareMode, imageA, canvasSize]);

  // Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    if (!imageA && !imageB) {
      ctx.fillStyle = '#151525';
      ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(isZh ? '请加载图片' : 'Please load images', canvasSize.width / 2, canvasSize.height / 2);
      return;
    }

    const drawTransformedImage = (img: HTMLImageElement | null, x: number, y: number, w: number, h: number, pX: number, pY: number, z: number) => {
      if (!img) return;
      ctx.save();
      // Clipping region for this view
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      
      // Transform
      ctx.translate(pX, pY);
      ctx.scale(z, z);
      ctx.translate(-img.width / 2, -img.height / 2);
      
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    };

    const drawGrid = (x: number, y: number, w: number, h: number) => {
      if (!showGrid) return;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(x + w / 3, y); ctx.lineTo(x + w / 3, y + h);
      ctx.moveTo(x + 2 * w / 3, y); ctx.lineTo(x + 2 * w / 3, y + h);
      ctx.moveTo(x, y + h / 3); ctx.lineTo(x + w, y + h / 3);
      ctx.moveTo(x, y + 2 * h / 3); ctx.lineTo(x + w, y + 2 * h / 3);
      ctx.stroke();
      ctx.restore();
    };

    if (isQuickToggleOn) {
      const img = imageB || imageA;
      drawTransformedImage(img, 0, 0, canvasSize.width, canvasSize.height, pan.x, pan.y, zoom);
    } else {
      switch (compareMode) {
        case 'sweep-h':
          drawTransformedImage(imageA, 0, 0, canvasSize.width, canvasSize.height, pan.x, pan.y, zoom);
          if (imageB) {
            drawTransformedImage(imageB, canvasSize.width * sweepPos, 0, canvasSize.width * (1 - sweepPos), canvasSize.height, pan.x, pan.y, zoom);
          }
          // Divider
          ctx.fillStyle = '#4ecdc4';
          ctx.fillRect(canvasSize.width * sweepPos - 1, 0, 2, canvasSize.height);
          break;
        case 'sweep-v':
          drawTransformedImage(imageA, 0, 0, canvasSize.width, canvasSize.height, pan.x, pan.y, zoom);
          if (imageB) {
            drawTransformedImage(imageB, 0, canvasSize.height * sweepPos, canvasSize.width, canvasSize.height * (1 - sweepPos), pan.x, pan.y, zoom);
          }
          ctx.fillStyle = '#4ecdc4';
          ctx.fillRect(0, canvasSize.height * sweepPos - 1, canvasSize.width, 2);
          break;
        case 'sbs':
          const halfW = canvasSize.width / 2;
          drawTransformedImage(imageA, 0, 0, halfW, canvasSize.height, pan.x - halfW/2, pan.y, zoom);
          drawTransformedImage(imageB, halfW, 0, halfW, canvasSize.height, pan.x + halfW/2, pan.y, zoom);
          ctx.fillStyle = '#4ecdc4';
          ctx.fillRect(halfW - 1, 0, 2, canvasSize.height);
          break;
        case 'tab':
          const halfH = canvasSize.height / 2;
          drawTransformedImage(imageA, 0, 0, canvasSize.width, halfH, pan.x, pan.y - halfH/2, zoom);
          drawTransformedImage(imageB, 0, halfH, canvasSize.width, halfH, pan.x, pan.y + halfH/2, zoom);
          ctx.fillStyle = '#4ecdc4';
          ctx.fillRect(0, halfH - 1, canvasSize.width, 2);
          break;
        case 'onion':
          drawTransformedImage(imageA, 0, 0, canvasSize.width, canvasSize.height, pan.x, pan.y, zoom);
          if (imageB) {
            ctx.save();
            ctx.globalAlpha = onionOpacity;
            drawTransformedImage(imageB, 0, 0, canvasSize.width, canvasSize.height, pan.x, pan.y, zoom);
            ctx.restore();
          }
          break;
        case 'diff':
          if (imageA && imageB) {
            // Draw A
            drawTransformedImage(imageA, 0, 0, canvasSize.width, canvasSize.height, pan.x, pan.y, zoom);
            const dataA = ctx.getImageData(0, 0, canvasSize.width, canvasSize.height);
            // Draw B
            ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
            drawTransformedImage(imageB, 0, 0, canvasSize.width, canvasSize.height, pan.x, pan.y, zoom);
            const dataB = ctx.getImageData(0, 0, canvasSize.width, canvasSize.height);
            
            const diffData = ctx.createImageData(canvasSize.width, canvasSize.height);
            for (let i = 0; i < dataA.data.length; i += 4) {
              diffData.data[i] = Math.abs(dataA.data[i] - dataB.data[i]) * 2; // R
              diffData.data[i+1] = Math.abs(dataA.data[i+1] - dataB.data[i+1]) * 2; // G
              diffData.data[i+2] = Math.abs(dataA.data[i+2] - dataB.data[i+2]) * 2; // B
              diffData.data[i+3] = 255; // A
            }
            ctx.putImageData(diffData, 0, 0);
          } else {
            drawTransformedImage(imageA || imageB, 0, 0, canvasSize.width, canvasSize.height, pan.x, pan.y, zoom);
          }
          break;
      }
    }

    drawGrid(0, 0, canvasSize.width, canvasSize.height);

    // Pixel Inspector
    if (showPixelInspector && mousePos.x >= 0 && mousePos.y >= 0 && mousePos.x <= canvasSize.width && mousePos.y <= canvasSize.height) {
      const size = 100;
      const zoomLevel = 10;
      
      ctx.save();
      ctx.beginPath();
      ctx.arc(mousePos.x, mousePos.y, size/2, 0, Math.PI * 2);
      ctx.clip();
      
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(canvas, 
        mousePos.x - size/(2*zoomLevel), mousePos.y - size/(2*zoomLevel), size/zoomLevel, size/zoomLevel,
        mousePos.x - size/2, mousePos.y - size/2, size, size);
      
      ctx.strokeStyle = '#4ecdc4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mousePos.x, mousePos.y, size/2, 0, Math.PI * 2);
      ctx.stroke();

      // Crosshair
      ctx.strokeStyle = 'rgba(255,0,0,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mousePos.x - 5, mousePos.y); ctx.lineTo(mousePos.x + 5, mousePos.y);
      ctx.moveTo(mousePos.x, mousePos.y - 5); ctx.lineTo(mousePos.x, mousePos.y + 5);
      ctx.stroke();
      
      ctx.restore();

      // Get RGB
      const pixel = ctx.getImageData(mousePos.x, mousePos.y, 1, 1).data;
      
      ctx.fillStyle = 'rgba(13,13,26,0.8)';
      ctx.fillRect(mousePos.x + size/2 + 10, mousePos.y - 20, 120, 40);
      ctx.fillStyle = '#fff';
      ctx.font = '12px monospace';
      ctx.fillText(`RGB: ${pixel[0]},${pixel[1]},${pixel[2]}`, mousePos.x + size/2 + 15, mousePos.y);
      ctx.fillText(`X:${Math.round(mousePos.x)} Y:${Math.round(mousePos.y)}`, mousePos.x + size/2 + 15, mousePos.y + 15);
    }

    // Histogram (Real pixel data)
    if (showHistogram) {
      ctx.save();
      const histW = 260;
      const histH = 120;
      const histX = canvasSize.width - histW - 20;
      const histY = canvasSize.height - histH - 20;

      // Sample pixel data
      const sampleData = ctx.getImageData(0, 0, canvasSize.width, canvasSize.height).data;
      const rHist = new Uint32Array(256);
      const gHist = new Uint32Array(256);
      const bHist = new Uint32Array(256);
      const step = Math.max(1, Math.floor(sampleData.length / 4 / 50000)); // sample ~50k pixels for speed
      for (let i = 0; i < sampleData.length; i += 4 * step) {
        rHist[sampleData[i]]++;
        gHist[sampleData[i + 1]]++;
        bHist[sampleData[i + 2]]++;
      }
      const maxVal = Math.max(1, ...rHist, ...gHist, ...bHist);

      ctx.fillStyle = 'rgba(13,13,26,0.85)';
      ctx.fillRect(histX, histY, histW, histH);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.strokeRect(histX, histY, histW, histH);

      ctx.fillStyle = '#fff';
      ctx.font = '10px sans-serif';
      ctx.fillText(isZh ? 'RGB 直方圖' : 'RGB Histogram', histX + 5, histY + 13);

      const barW = (histW - 8) / 256;
      const drawH = histH - 22;
      const baseY = histY + histH - 4;

      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 256; i++) {
        const x = histX + 4 + i * barW;
        ctx.fillStyle = 'rgba(255,80,80,0.7)';
        ctx.fillRect(x, baseY - (rHist[i] / maxVal) * drawH, barW, (rHist[i] / maxVal) * drawH);
        ctx.fillStyle = 'rgba(80,255,80,0.5)';
        ctx.fillRect(x, baseY - (gHist[i] / maxVal) * drawH, barW, (gHist[i] / maxVal) * drawH);
        ctx.fillStyle = 'rgba(80,80,255,0.5)';
        ctx.fillRect(x, baseY - (bHist[i] / maxVal) * drawH, barW, (bHist[i] / maxVal) * drawH);
      }
      ctx.globalAlpha = 1.0;
      ctx.restore();
    }

  }, [
    imageA, imageB, canvasSize, compareMode, sweepPos, onionOpacity,
    zoom, pan, isQuickToggleOn, showPixelInspector, showGrid, showHistogram,
    mousePos, isZh
  ]);

  const downloadScreenshot = () => {
    if (canvasRef.current) {
      const link = document.createElement('a');
      link.download = 'compare-screenshot.png';
      link.href = canvasRef.current.toDataURL();
      link.click();
    }
  };

  const swapImages = () => {
    setImageA(imageB);
    setImageB(imageA);
    setInfoA(infoB);
    setInfoB(infoA);
  };

  const clearAll = () => {
    setImageA(null);
    setImageB(null);
    setInfoA(null);
    setInfoB(null);
  };

  // Styles
  const theme = {
    bgDark: '#0d0d1a',
    bgPanel: '#151525',
    text: '#ffffff',
    textDim: '#a0a0b0',
    accent1: '#667eea',
    accent2: '#4ecdc4',
    border: 'rgba(255,255,255,0.1)',
  };

  const btnStyle = {
    background: 'rgba(255,255,255,0.05)',
    border: `1px solid ${theme.border}`,
    color: theme.text,
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'all 0.2s'
  };

  const activeBtnStyle = {
    ...btnStyle,
    background: theme.accent1,
    borderColor: theme.accent1,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: theme.bgDark, color: theme.text, fontFamily: 'sans-serif' }}>
      
      {/* Top Toolbar */}
      <div style={{ display: 'flex', padding: '10px', background: theme.bgPanel, borderBottom: `1px solid ${theme.border}`, alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
        
        {/* Load Actions */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', borderRight: `1px solid ${theme.border}`, paddingRight: '15px' }}>
          <button style={btnStyle} onClick={swapImages}>⇄ {isZh ? '交换 A/B' : 'Swap A↔B'}</button>
          <button style={btnStyle} onClick={clearAll}>✕ {isZh ? '清除' : 'Clear All'}</button>
        </div>

        {/* Modes */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', borderRight: `1px solid ${theme.border}`, paddingRight: '15px' }}>
          <span style={{ fontSize: '12px', color: theme.textDim }}>{isZh ? '模式:' : 'Mode:'}</span>
          <button style={compareMode === 'sweep-h' ? activeBtnStyle : btnStyle} onClick={() => setCompareMode('sweep-h')}>◫ H-Sweep</button>
          <button style={compareMode === 'sweep-v' ? activeBtnStyle : btnStyle} onClick={() => setCompareMode('sweep-v')}>⊟ V-Sweep</button>
          <button style={compareMode === 'sbs' ? activeBtnStyle : btnStyle} onClick={() => setCompareMode('sbs')}>◫ SBS</button>
          <button style={compareMode === 'tab' ? activeBtnStyle : btnStyle} onClick={() => setCompareMode('tab')}>⊟ T&B</button>
          <button style={compareMode === 'diff' ? activeBtnStyle : btnStyle} onClick={() => setCompareMode('diff')}>Δ Diff</button>
          <button style={compareMode === 'onion' ? activeBtnStyle : btnStyle} onClick={() => setCompareMode('onion')}>◎ Onion</button>
          {compareMode === 'onion' && (
            <input type="range" min="0" max="1" step="0.01" value={onionOpacity} onChange={e => setOnionOpacity(parseFloat(e.target.value))} style={{ width: '60px' }} />
          )}
        </div>

        {/* Zoom Controls */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', borderRight: `1px solid ${theme.border}`, paddingRight: '15px' }}>
          <button style={btnStyle} onClick={() => fitZoom()}>⛶ {isZh ? '适应' : 'Fit'}</button>
          <button style={btnStyle} onClick={zoomOneToOne}>1:1</button>
          <button style={btnStyle} onClick={zoomFace}>☺ {isZh ? '面部缩放' : 'Face Zoom'}</button>
          <span style={{ fontSize: '12px', color: theme.textDim, minWidth: '45px' }}>{Math.round(zoom * 100)}%</span>
        </div>

        {/* Tools */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button style={showPixelInspector ? activeBtnStyle : btnStyle} onClick={() => setShowPixelInspector(!showPixelInspector)}>🔍 {isZh ? '像素' : 'Pixel'}</button>
          <button style={showGrid ? activeBtnStyle : btnStyle} onClick={() => setShowGrid(!showGrid)}>▦ {isZh ? '网格' : 'Grid'}</button>
          <button style={showHistogram ? activeBtnStyle : btnStyle} onClick={() => setShowHistogram(!showHistogram)}>📊 {isZh ? '直方图' : 'Histogram'}</button>
          <button style={btnStyle} onClick={downloadScreenshot}>📷 {isZh ? '截图' : 'Screenshot'}</button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Dropzones Sidebar (if empty) or Overlay */}
        <div style={{ width: '250px', background: theme.bgPanel, borderRight: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', padding: '15px', gap: '15px' }}>
          
          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{isZh ? '照片信息' : 'Photo Info'}</div>
          
          {/* Dropzone A */}
          <div 
            onDrop={e => onDrop(e, true)} onDragOver={onDragOver}
            style={{ 
              border: `2px dashed ${imageA ? theme.border : theme.accent1}`, borderRadius: '8px', padding: '15px', textAlign: 'center', 
              background: 'rgba(255,255,255,0.02)', cursor: 'pointer' 
            }}
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file'; input.accept = 'image/*';
              input.onchange = (e: any) => { if (e.target.files[0]) loadImage(e.target.files[0], true); };
              input.click();
            }}
          >
            <div style={{ color: theme.accent1, fontWeight: 'bold', marginBottom: '5px' }}>A {isZh ? '加载' : 'Load'}</div>
            {infoA ? (
              <div style={{ fontSize: '11px', color: theme.textDim, textAlign: 'left', wordBreak: 'break-all' }}>
                {infoA.name}<br/>
                {infoA.width}x{infoA.height} • {(infoA.size/1024/1024).toFixed(2)}MB
              </div>
            ) : (
              <div style={{ fontSize: '11px', color: theme.textDim }}>{isZh ? '拖拽 / 点击 / 粘贴' : 'Drop / Click / Paste'}</div>
            )}
          </div>

          {/* Dropzone B */}
          <div 
            onDrop={e => onDrop(e, false)} onDragOver={onDragOver}
            style={{ 
              border: `2px dashed ${imageB ? theme.border : theme.accent2}`, borderRadius: '8px', padding: '15px', textAlign: 'center', 
              background: 'rgba(255,255,255,0.02)', cursor: 'pointer' 
            }}
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file'; input.accept = 'image/*';
              input.onchange = (e: any) => { if (e.target.files[0]) loadImage(e.target.files[0], false); };
              input.click();
            }}
          >
            <div style={{ color: theme.accent2, fontWeight: 'bold', marginBottom: '5px' }}>B {isZh ? '加载' : 'Load'}</div>
            {infoB ? (
              <div style={{ fontSize: '11px', color: theme.textDim, textAlign: 'left', wordBreak: 'break-all' }}>
                {infoB.name}<br/>
                {infoB.width}x{infoB.height} • {(infoB.size/1024/1024).toFixed(2)}MB
              </div>
            ) : (
              <div style={{ fontSize: '11px', color: theme.textDim }}>{isZh ? '拖拽 / 点击 / 粘贴' : 'Drop / Click / Paste'}</div>
            )}
          </div>

          <div style={{ marginTop: 'auto', fontSize: '11px', color: theme.textDim }}>
            <b>{isZh ? '快捷键:' : 'Shortcuts:'}</b><br/>
            Space: {isZh ? '快速切换 A/B' : 'Quick Toggle A/B'}<br/>
            Arrows: {isZh ? '移动分割线' : 'Nudge Divider'}<br/>
            +/-: {isZh ? '缩放' : 'Zoom'}<br/>
            F: {isZh ? '适应屏幕' : 'Fit'}<br/>
            1: 1:1 {isZh ? '缩放' : 'Zoom'}
          </div>

        </div>

        {/* Canvas Area */}
        <div 
          ref={containerRef}
          style={{ flex: 1, position: 'relative', cursor: isDraggingDivider ? (compareMode === 'sweep-h' ? 'ew-resize' : 'ns-resize') : (isPanning ? 'grabbing' : 'grab') }}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <canvas 
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            style={{ display: 'block', touchAction: 'none' }}
          />
          {isQuickToggleOn && (
            <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(255,0,0,0.8)', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
              {isZh ? '快速预览 B' : 'Previewing B'}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
