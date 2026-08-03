import { useState, useEffect, useRef } from 'react';

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMirrored, setIsMirrored] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [resolutionInfo, setResolutionInfo] = useState<{ width: number; height: number } | null>(null);

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

      // Resolution preference tiers specifically formatted for OBS Virtual Cam & Windows DirectShow
      const resolutionTiers: MediaTrackConstraints[] = [
        // Tier 1: 1080p Full HD Ideal (Standard for OBS Virtual Cam & webcams)
        {
          ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' }),
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        // Tier 2: 4K UHD Ideal
        {
          ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' }),
          width: { ideal: 3840 },
          height: { ideal: 2160 }
        },
        // Tier 3: Fixed 1920x1080
        {
          ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' }),
          width: 1920,
          height: 1080
        },
        // Tier 4: 720p HD Ideal
        {
          ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' }),
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        // Tier 5: Loose device match with 1080p preference
        {
          ...(deviceId ? { deviceId } : { facingMode: 'user' }),
          width: 1920,
          height: 1080
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
        newStream = await navigator.mediaDevices.getUserMedia({ 
          video: deviceId ? { deviceId, width: 1920, height: 1080 } : { width: 1920, height: 1080 } 
        });
      }

      const videoTrack = newStream.getVideoTracks()[0];
      if (videoTrack) {
        // Attempt to apply 1920x1080 constraint explicitly on track
        try {
          await videoTrack.applyConstraints({ width: { ideal: 1920 }, height: { ideal: 1080 } });
        } catch (e) {
          try {
            await videoTrack.applyConstraints({ width: 1920, height: 1080 });
          } catch (e2) {}
        }

        const settings = videoTrack.getSettings();
        const w = settings.width || 1920;
        const h = settings.height || 1080;
        console.log(`[Camera API] Stream Active: ${w}x${h} @ ${settings.frameRate || 30}fps`);
        setResolutionInfo({ width: w, height: h });
      }

      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            const vw = videoRef.current.videoWidth;
            const vh = videoRef.current.videoHeight;
            console.log(`[Camera API] Video Metadata Loaded: ${vw}x${vh}`);
            if (vw > 0 && vh > 0) {
              setResolutionInfo({ width: vw, height: vh });
            }
          }
        };
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
      setResolutionInfo(null);
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
    resolutionInfo,
    startCamera,
    stopCamera,
    toggleMirror
  };
}
