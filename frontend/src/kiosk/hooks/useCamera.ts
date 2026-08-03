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

      // Resolution preference tiers: 4K UHD -> 1080p Full HD -> 720p HD -> Loose fallback
      const resolutionTiers: MediaTrackConstraints[] = [
        // Tier 1: 4K UHD
        {
          ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' }),
          width: { ideal: 3840, min: 1920 },
          height: { ideal: 2160, min: 1080 }
        },
        // Tier 2: 1080p Full HD
        {
          ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' }),
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 }
        },
        // Tier 3: 720p HD
        {
          ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' }),
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        // Tier 4: Basic device match
        {
          ...(deviceId ? { deviceId } : { facingMode: 'user' })
        }
      ];

      let newStream: MediaStream | null = null;

      for (const constraints of resolutionTiers) {
        try {
          newStream = await navigator.mediaDevices.getUserMedia({ video: constraints });
          if (newStream && newStream.getVideoTracks().length > 0) {
            break;
          }
        } catch (err) {
          // Try next tier
        }
      }

      if (!newStream) {
        newStream = await navigator.mediaDevices.getUserMedia({ video: deviceId ? { deviceId } : true });
      }

      const videoTrack = newStream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        console.log(`[Camera API] High-Res Stream Active: ${settings.width}x${settings.height} @ ${settings.frameRate || 30}fps`);
      }

      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      setError(null);
    } catch (err) {
      console.error("[Camera API] Failed to start camera:", err);
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
