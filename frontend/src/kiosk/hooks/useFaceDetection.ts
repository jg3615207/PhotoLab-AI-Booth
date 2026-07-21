import { useEffect, useState } from 'react';
import * as faceapi from 'face-api.js';

export function useFaceDetection(
  videoElement: HTMLVideoElement | null,
  maxPeople: number
) {
  const [faceCount, setFaceCount] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadModels = async () => {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri('https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights');
        setIsLoaded(true);
      } catch (e) {
        console.error('FaceAPI failed', e);
      }
    };
    loadModels();
  }, []);

  useEffect(() => {
    if (!isLoaded || !videoElement) return;

    const interval = setInterval(async () => {
      if (videoElement.readyState === 4) { // HAVE_ENOUGH_DATA
        const detections = await faceapi.detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions());
        setFaceCount(detections.length);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isLoaded, videoElement]);

  const showWarning = faceCount > maxPeople;

  return { faceCount, showWarning };
}
