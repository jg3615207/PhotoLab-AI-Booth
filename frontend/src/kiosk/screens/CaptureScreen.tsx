import React, { useEffect, useState, useRef } from 'react';
import { useKiosk } from '../context/KioskContext';
import { useCamera } from '../hooks/useCamera';
import { useHandsTracker } from '../hooks/useHandsTracker';
import { useFaceDetection } from '../hooks/useFaceDetection';

export default function CaptureScreen() {
  const { setScreen, setCapturedImage, lang } = useKiosk();
  const isZh = lang === 'zh-Hant';

  const { videoRef, error, isMirrored, startCamera, stopCamera, toggleMirror } = useCamera();
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const { showWarning } = useFaceDetection(videoRef.current, 2);

  useHandsTracker(videoRef.current, isMirrored, (gesture) => {
    if (countdown === null && !error) {
      startCountdown();
    }
  });

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

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

  const startCountdown = () => {
    let count = 3;
    setCountdown(count);
    const iv = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(iv);
        setCountdown(null);
        setFlash(true);
        setTimeout(() => setFlash(false), 500);
        capturePhoto();
      } else {
        setCountdown(count);
      }
    }, 1000);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) {
      canvas.width = video.videoWidth || 1080;
      canvas.height = video.videoHeight || 1920;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (isMirrored) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        setCapturedImage(canvas.toDataURL('image/jpeg', 0.95));
        setScreen('preview');
      }
    }
  };

  return (
    <div className="screen active" style={{ display: 'flex' }}>
      {flash && <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'white', zIndex: 9999 }} />}
      
      <div className="capture-container">
        {showWarning && (
          <div style={{ position: 'absolute', top: '80px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,0,0,0.85)', color: 'white', padding: '10px 20px', borderRadius: '8px', zIndex: 20, fontWeight: 'bold' }}>
            {isZh ? '人數過多！請退後' : 'Too many people! Please step back.'}
          </div>
        )}
        
        {error ? (
          <div className="no-camera-msg">
            <div className="upload-icon">📷</div>
            <p>{isZh ? '未檢測到相機' : 'No camera detected'}</p>
            <p className="sub">{isZh ? '請使用下方「上傳照片」' : 'Use "Upload Photo" below'}</p>
          </div>
        ) : (
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: isMirrored ? 'scaleX(-1)' : 'scaleX(1)' }} 
          />
        )}
        
        <button 
          onClick={toggleMirror} 
          style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10, background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' }}
        >
          {isZh ? '鏡像 ⇄' : 'Mirror ⇄'}
        </button>
        
        {countdown !== null && (
          <div className="countdown-overlay active">
            <span id="countdown-number">{countdown}</span>
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
