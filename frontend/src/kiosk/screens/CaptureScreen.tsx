import { useEffect, useState, useRef } from 'react';
import { useKiosk } from '../context/KioskContext';
import { useCamera } from '../hooks/useCamera';
import { useHandsTracker } from '../hooks/useHandsTracker';
import { useFaceDetection } from '../hooks/useFaceDetection';

function parseAspectRatio(ratioStr?: string): { targetW: number; targetH: number; ratioVal: number; cssRatio: string } {
  if (!ratioStr || !ratioStr.includes(':')) {
    return { targetW: 2, targetH: 3, ratioVal: 2 / 3, cssRatio: '2/3' };
  }
  const parts = ratioStr.split(':').map(s => Number(s.trim()));
  const w = parts[0] > 0 ? parts[0] : 2;
  const h = parts[1] > 0 ? parts[1] : 3;
  return { targetW: w, targetH: h, ratioVal: w / h, cssRatio: `${w}/${h}` };
}

function computeVideoCrop(vw: number, vh: number, targetW: number, targetH: number) {
  const targetRatio = targetW / targetH;
  const videoRatio = vw / vh;

  let cropX = 0;
  let cropY = 0;
  let cropW = vw;
  let cropH = vh;

  if (videoRatio > targetRatio) {
    // Video is wider than target aspect ratio -> crop horizontally
    cropH = vh;
    cropW = vh * targetRatio;
    cropX = (vw - cropW) / 2.0;
  } else {
    // Video is taller than target aspect ratio -> crop vertically
    cropW = vw;
    cropH = vw / targetRatio;
    cropY = (vh - cropH) / 2.0;
  }

  return { cropX, cropY, cropW, cropH };
}

export default function CaptureScreen() {
  const { setScreen, setCapturedImage, lang, session, selectedStyle } = useKiosk();
  const isZh = lang === 'zh-Hant';

  const { videoRef, error, isMirrored, resolutionInfo, startCamera, stopCamera, toggleMirror } = useCamera();
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [handDetected, setHandDetected] = useState(false);
  const [activeFilter, setActiveFilter] = useState('none');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const targetFaceCount = selectedStyle?.max_people || 1;
  const multiCropEnabled = selectedStyle?.multi_face_crop_enabled === 1;

  const { faceCount, faceBoxes, countMismatch } = useFaceDetection(videoRef.current, targetFaceCount, true);

  const filters = [
    { id: 'none', nameZh: '原始', nameEn: 'Normal', css: 'none' },
    { id: 'bw', nameZh: '黑白', nameEn: 'B&W', css: 'grayscale(100%)' },
    { id: 'sepia', nameZh: '復古', nameEn: 'Sepia', css: 'sepia(100%)' },
    { id: 'vivid', nameZh: '鮮明', nameEn: 'Vivid', css: 'saturate(1.4) contrast(1.15)' }
  ];
  
  const currentFilterCSS = filters.find(f => f.id === activeFilter)?.css || 'none';
  const showFilters = session?.enable_filters === 1 || session?.enable_filters === true;
  const gestureEnabled = session?.enable_gesture_capture !== 0;

  const { targetW, targetH, cssRatio } = parseAspectRatio(selectedStyle?.aspect_ratio);

  useHandsTracker(videoRef.current, isMirrored, () => {
    if (countdown === null && !error) {
      startCountdown();
    }
  }, setHandDetected, gestureEnabled);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  // Live face tracking bounding box canvas overlay (aligned with video crop)
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !video.videoWidth || !video.videoHeight) return;

    if (!faceBoxes || faceBoxes.length === 0) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const { cropX, cropY, cropW, cropH } = computeVideoCrop(vw, vh, targetW, targetH);

    canvas.width = video.clientWidth || 600;
    canvas.height = video.clientHeight || 900;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scaleX = canvas.width / cropW;
    const scaleY = canvas.height / cropH;

    faceBoxes.forEach((box) => {
      const croppedBoxX = box.x - cropX;
      const croppedBoxY = box.y - cropY;

      let rx = croppedBoxX * scaleX;
      if (isMirrored) {
        rx = canvas.width - (croppedBoxX + box.width) * scaleX;
      }
      const ry = croppedBoxY * scaleY;
      const rw = box.width * scaleX;
      const rh = box.height * scaleY;

      // Draw glowing cyan bounding box
      ctx.strokeStyle = '#00f2fe';
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(rx, ry, rw, rh, 8);
      } else {
        ctx.rect(rx, ry, rw, rh);
      }
      ctx.stroke();

      // Corner accent markers
      const lineLen = Math.min(18, rw / 4);
      ctx.strokeStyle = '#38ef7d';
      ctx.lineWidth = 4;
      // Top-Left corner
      ctx.beginPath();
      ctx.moveTo(rx, ry + lineLen); ctx.lineTo(rx, ry); ctx.lineTo(rx + lineLen, ry);
      ctx.stroke();
      // Top-Right corner
      ctx.beginPath();
      ctx.moveTo(rx + rw - lineLen, ry); ctx.lineTo(rx + rw, ry); ctx.lineTo(rx + rw, ry + lineLen);
      ctx.stroke();

      // Label badge tag e.g. "👤 user1"
      const labelText = `👤 ${box.label}`;
      ctx.font = 'bold 13px sans-serif';
      const tw = ctx.measureText(labelText).width;

      const tagY = ry - 24 > 0 ? ry - 24 : ry;
      ctx.fillStyle = 'rgba(0, 242, 254, 0.9)';
      ctx.fillRect(rx, tagY, tw + 14, 22);

      ctx.fillStyle = '#000';
      ctx.fillText(labelText, rx + 7, tagY + 15);
    });
  }, [faceBoxes, isMirrored, targetW, targetH]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCapturedImage(ev.target?.result as string);
      setScreen('preview');
    };
    reader.readAsDataURL(file);
  };

  const speakText = (text: string) => {
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = isZh ? 'zh-TW' : 'en-US';
        utter.rate = 1.1;
        window.speechSynthesis.speak(utter);
      }
    } catch (e) {}
  };

  const startCountdown = () => {
    let count = 3;
    setCountdown(count);
    speakText(count.toString());
    const iv = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(iv);
        setCountdown(null);
        setFlash(true);
        speakText(isZh ? "笑一個！" : "Smile!");
        setTimeout(() => setFlash(false), 500);
        capturePhoto();
      } else {
        setCountdown(count);
        speakText(count.toString());
      }
    }, 1000);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && video.videoWidth > 0 && video.videoHeight > 0) {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const { cropX, cropY, cropW, cropH } = computeVideoCrop(vw, vh, targetW, targetH);

      canvas.width = Math.round(cropW);
      canvas.height = Math.round(cropH);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (currentFilterCSS !== 'none') {
          ctx.filter = currentFilterCSS;
        }
        if (isMirrored) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(
          video,
          cropX, cropY, cropW, cropH,
          0, 0, canvas.width, canvas.height
        );
        console.log(`[Capture API] Photo captured at HD resolution ${canvas.width}x${canvas.height} (Aspect ratio ${selectedStyle?.aspect_ratio || '2:3'})`);
        setCapturedImage(canvas.toDataURL('image/jpeg', 0.96));
        setScreen('preview');
      }
    }
  };

  return (
    <div className="screen active" style={{ display: 'flex' }}>
      {flash && <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'white', zIndex: 9999 }} />}
      
      <div className="capture-container" style={{ position: 'relative', aspectRatio: cssRatio }}>
        {countMismatch && multiCropEnabled && (
          <div style={{ position: 'absolute', top: '70px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,152,0,0.95)', color: '#000', padding: '10px 18px', borderRadius: '12px', zIndex: 30, fontWeight: 700, fontSize: '13px', boxShadow: '0 4px 15px rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '90%', textAlign: 'center' }}>
            ⚠️ {isZh 
              ? `目前偵測到 ${faceCount} 人，但此風格預設需 ${targetFaceCount} 人（可能影響 AI 生成結果）` 
              : `Detected ${faceCount} faces, but style expects ${targetFaceCount} (may affect generation accuracy).`}
          </div>
        )}
        
        {error ? (
          <div className="no-camera-msg">
            <div className="upload-icon">📷</div>
            <p>{isZh ? '未檢測到相機' : 'No camera detected'}</p>
            <p className="sub">{isZh ? '請使用下方「上傳照片」' : 'Use "Upload Photo" below'}</p>
          </div>
        ) : (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: isMirrored ? 'scaleX(-1)' : 'scaleX(1)', filter: currentFilterCSS }} 
            />
            <canvas
              ref={overlayCanvasRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 15
              }}
            />
          </>
        )}
        
        {resolutionInfo && (
          <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 20, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', color: '#00f2fe', border: '1px solid rgba(0,242,254,0.4)', padding: '5px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
            📹 {resolutionInfo.width >= 3840 ? '4K UHD' : (resolutionInfo.width >= 1920 ? '1080p Full HD' : `${resolutionInfo.width}p`)} ({resolutionInfo.width}x{resolutionInfo.height})
          </div>
        )}

        <button 
          onClick={toggleMirror} 
          style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 20, background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' }}
        >
          {isZh ? '鏡像 ⇄' : 'Mirror ⇄'}
        </button>
        
        {countdown !== null && (
          <div className="countdown-overlay active">
            <span id="countdown-number">{countdown}</span>
          </div>
        )}

        {handDetected && countdown === null && (
          <div className="hand-guide-overlay">
            <span className="hand-guide-icon"></span>
            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff', lineHeight: '1.2' }}>
                {isZh ? '偵測到手勢功能' : 'Gesture Mode Active'}
              </span>
              <span style={{ fontSize: '11px', color: '#aaa', marginTop: '2px', lineHeight: '1.2' }}>
                {isZh ? '比出 👍 或 ✌️ 以啟動倒數' : 'Show 👍 or ✌️ to start capture'}
              </span>
            </div>
          </div>
        )}

        {showFilters && !error && (
          <div style={{ position: 'absolute', bottom: '15px', left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', padding: '6px 12px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)' }}>
            {filters.map(f => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                style={{
                  background: activeFilter === f.id ? 'linear-gradient(135deg,#667eea,#764ba2)' : 'transparent',
                  border: 'none',
                  color: 'white',
                  padding: '6px 14px',
                  borderRadius: '18px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all 0.2s'
                }}
              >
                {isZh ? f.nameZh : f.nameEn}
              </button>
            ))}
          </div>
        )}
        
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      <div className="capture-controls">
        <button className="btn-primary" onClick={startCountdown} disabled={countdown !== null || !!error}>
          {isZh ? '📸 拍照' : 'Take Photo'}
        </button>
        <label className="btn-secondary" style={{ cursor: 'pointer', display: 'inline-block', lineHeight: '24px' }}>
          {isZh ? '📁 上傳照片' : 'Upload Photo'}
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
        </label>
        <button className="btn-back" onClick={() => setScreen('styles')} disabled={countdown !== null}>
          {isZh ? '返回' : 'Back'}
        </button>
      </div>
    </div>
  );
}
