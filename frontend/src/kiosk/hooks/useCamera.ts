import { useState, useEffect, useRef } from 'react';

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMirrored, setIsMirrored] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices()
      .then(devs => {
        const videoInputs = devs.filter(d => d.kind === 'videoinput');
        setDevices(videoInputs);
        if (videoInputs.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(videoInputs[0].deviceId);
        }
      })
      .catch(() => {});
  }, []);

  const startCamera = async (deviceId = selectedDeviceId) => {
    try {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      
      const videoConstraints: MediaTrackConstraints = deviceId
        ? { deviceId: { exact: deviceId }, width: { ideal: 1080 }, height: { ideal: 1920 } }
        : { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1920 } };

      let newStream: MediaStream;
      try {
        newStream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
      } catch (firstErr) {
        // Fallback to basic video without resolution constraints
        newStream = await navigator.mediaDevices.getUserMedia({ video: deviceId ? { deviceId } : true });
      }

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
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    startCamera,
    stopCamera,
    toggleMirror
  };
}
