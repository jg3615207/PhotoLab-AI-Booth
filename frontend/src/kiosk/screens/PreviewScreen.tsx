import React from 'react';
import { useKiosk } from '../context/KioskContext';

export default function PreviewScreen() {
  const { setScreen, capturedImage, selectedStyleId, session, setJobData } = useKiosk();

  const handleConfirm = async () => {
    if (!capturedImage || !selectedStyleId) {
      alert("Missing image or style selection.");
      return;
    }

    setScreen('processing');

    try {
      // Convert Data URL to Blob
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
        alert(data.error + "\n\nPlease try again.");
        setScreen('preview');
        return;
      }
      
      setJobData({ jobId: data.job_id });
      // The ProcessingScreen will handle the WebSocket polling
      
    } catch (err) {
      console.error(err);
      alert('Upload failed. Please try again.');
      setScreen('preview');
    }
  };

  return (
    <div className="screen active" style={{ display: 'flex' }}>
      <h2>Review Your Photo</h2>
      {capturedImage ? (
        <img src={capturedImage} className="preview-img" alt="Preview" />
      ) : (
        <p>No image captured</p>
      )}
      <div className="preview-controls">
        <button className="btn-primary" onClick={handleConfirm}>
          Use This
        </button>
        <button className="btn-secondary" onClick={() => setScreen('capture')}>
          Retake
        </button>
      </div>
    </div>
  );
}
