import React from 'react';
import { useKiosk } from '../context/KioskContext';

export default function PreviewScreen() {
  const { setScreen, capturedImage, selectedStyleId, session, setJobData, lang } = useKiosk();
  const isZh = lang === 'zh-Hant';

  const handleConfirm = async () => {
    if (!capturedImage || !selectedStyleId) {
      alert(isZh ? "缺少照片或未選擇風格" : "Missing image or style selection.");
      return;
    }

    setScreen('processing');

    try {
      const res = await fetch(capturedImage);
      const blob = await res.blob();
      
      const form = new FormData();
      form.append('image', blob, 'photo.jpg');
      form.append('style_id', selectedStyleId);
      if (session?.id) {
        form.append('event_id', session.id);
      }

      const r = await fetch('/api/capture', { method: 'POST', body: form });
      const data = await r.json();
      
      if (data.error) {
        alert((isZh ? "失敗: " : "Error: ") + data.error + "\n\n" + (isZh ? "請重試。" : "Please try again."));
        setScreen('preview');
        return;
      }
      
      setJobData({ jobId: data.job_id });
      
    } catch (err) {
      console.error(err);
      alert(isZh ? "上傳失敗，請重試。" : "Upload failed. Please try again.");
      setScreen('preview');
    }
  };

  return (
    <div className="screen active" style={{ display: 'flex' }}>
      <h2>{isZh ? '確認你的照片' : 'Review Your Photo'}</h2>
      {capturedImage ? (
        <img src={capturedImage} className="preview-img" alt="Preview" />
      ) : (
        <p>{isZh ? '無擷取照片' : 'No image captured'}</p>
      )}
      <div className="preview-controls">
        <button className="btn-primary" onClick={handleConfirm}>
          {isZh ? '使用這張' : 'Use This'}
        </button>
        <button className="btn-secondary" onClick={() => setScreen('capture')}>
          {isZh ? '重拍' : 'Retake'}
        </button>
      </div>
    </div>
  );
}
