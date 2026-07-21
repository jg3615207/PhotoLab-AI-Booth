import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    Hands: any;
    Camera: any;
  }
}

export function useHandsTracker(
  videoElement: HTMLVideoElement | null,
  isMirrored: boolean,
  onGestureDetected: (gesture: string) => void
) {
  const handsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);

  useEffect(() => {
    if (!videoElement || !window.Hands || !window.Camera) return;

    const hands = new window.Hands({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 0,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7
    });

    hands.onResults((results: any) => {
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        for (const landmarks of results.multiHandLandmarks) {
          const thumbTip = landmarks[4];
          const indexTip = landmarks[8];
          const middleTip = landmarks[12];
          
          // Thumbs up gesture
          if (thumbTip.y < indexTip.y - 0.1 && thumbTip.y < middleTip.y - 0.1) {
            onGestureDetected('thumbs-up');
            break;
          }
          // Peace sign gesture
          if (indexTip.y < landmarks[5].y && middleTip.y < landmarks[9].y && landmarks[16].y > landmarks[13].y) {
            onGestureDetected('peace-sign');
            break;
          }
        }
      }
    });

    handsRef.current = hands;

    const camera = new window.Camera(videoElement, {
      onFrame: async () => {
        if (videoElement.videoWidth > 0 && handsRef.current) {
          await handsRef.current.send({ image: videoElement });
        }
      },
      width: 640,
      height: 480
    });
    
    camera.start();
    cameraRef.current = camera;

    return () => {
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
      if (handsRef.current) {
        handsRef.current.close();
      }
    };
  }, [videoElement, isMirrored, onGestureDetected]);

}
