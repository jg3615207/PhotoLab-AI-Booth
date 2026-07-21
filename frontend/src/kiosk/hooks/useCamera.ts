import { useState, useEffect, useRef } from 'react';

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMirrored, setIsMirrored] = useState(false);

  const startCamera = async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1920 } }
      });
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      setError(null);
    } catch (err) {
      console.error(err);
      setError('No camera detected');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
  };

  const toggleMirror = () => {
    setIsMirrored(prev => !prev);
  };

  useEffect(() => {
    return () => stopCamera();
  }, [stream]);

  return {
    videoRef,
    stream,
    error,
    isMirrored,
    startCamera,
    stopCamera,
    toggleMirror
  };
}
