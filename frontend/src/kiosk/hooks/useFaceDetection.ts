import { useEffect, useState } from 'react';
import * as faceapi from 'face-api.js';

export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

export function useFaceDetection(
  videoElement: HTMLVideoElement | null,
  targetPeople: number = 1,
  enabled: boolean = true
) {
  const [faceCount, setFaceCount] = useState(0);
  const [faceBoxes, setFaceBoxes] = useState<FaceBox[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const loadModels = async () => {
      try {
        try {
          await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        } catch {
          await faceapi.nets.tinyFaceDetector.loadFromUri('https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights');
        }
        setIsLoaded(true);
      } catch (e) {
        console.error('FaceAPI failed to load', e);
      }
    };
    loadModels();
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !isLoaded || !videoElement) return;

    const interval = setInterval(async () => {
      if (videoElement.readyState === 4) { // HAVE_ENOUGH_DATA
        try {
          const detections = await faceapi.detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions());
          setFaceCount(detections.length);

          // Sort detected faces left-to-right by x coordinate
          const sorted = [...detections].sort((a, b) => a.box.x - b.box.x);

          const boxes: FaceBox[] = sorted.map((det, idx) => ({
            x: det.box.x,
            y: det.box.y,
            width: det.box.width,
            height: det.box.height,
            label: `user${idx + 1}`
          }));

          setFaceBoxes(boxes);
        } catch (err) {
          console.error('Face detection error', err);
        }
      }
    }, 400);

    return () => clearInterval(interval);
  }, [isLoaded, videoElement, enabled]);

  const showWarning = faceCount > targetPeople;
  const countMismatch = enabled && faceCount > 0 && faceCount !== targetPeople;

  return { faceCount, faceBoxes, showWarning, countMismatch, targetPeople };
}
