// gestures.js - MediaPipe Hand Tracking for PhotoLab Kiosk

let handsTracker = null;
let cameraTracker = null;
let gestureCursor = null;
let isPinching = false;
let pinchCooldown = false;
let gesturesEnabled = true;

function initGestures() {
  if (typeof Hands === 'undefined') {
    console.warn("MediaPipe Hands not loaded.");
    return;
  }

  // Create virtual cursor
  gestureCursor = document.createElement('div');
  gestureCursor.id = 'gesture-cursor';
  gestureCursor.style.position = 'fixed';
  gestureCursor.style.width = '24px';
  gestureCursor.style.height = '24px';
  gestureCursor.style.backgroundColor = 'rgba(102, 126, 234, 0.8)';
  gestureCursor.style.border = '2px solid white';
  gestureCursor.style.borderRadius = '50%';
  gestureCursor.style.pointerEvents = 'none';
  gestureCursor.style.zIndex = '99999';
  gestureCursor.style.transition = 'transform 0.1s, background-color 0.2s';
  gestureCursor.style.display = 'none';
  gestureCursor.style.boxShadow = '0 0 10px rgba(102,126,234,0.5)';
  document.body.appendChild(gestureCursor);

  handsTracker = new Hands({locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
  }});

  handsTracker.setOptions({
    maxNumHands: 1,
    modelComplexity: 0,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  handsTracker.onResults(onHandResults);

  const videoElement = document.getElementById('video');
  if (videoElement) {
    cameraTracker = new Camera(videoElement, {
      onFrame: async () => {
        if (gesturesEnabled && videoElement.videoWidth > 0) {
          await handsTracker.send({image: videoElement});
        }
      },
      width: 640,
      height: 480
    });
    cameraTracker.start();
  }
}

function onHandResults(results) {
  if (!gesturesEnabled) {
    gestureCursor.style.display = 'none';
    return;
  }

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0];
    
    // Index finger tip (8), Thumb tip (4)
    const indexTip = landmarks[8];
    const thumbTip = landmarks[4];
    
    const isVideoMirrored = typeof isMirrored !== 'undefined' ? isMirrored : false;
    let mappedX = indexTip.x;
    
    // Flip X generally because webcam naturally acts like a mirror to the user, 
    // unless they have mirrored it via the button.
    if (!isVideoMirrored) {
       mappedX = 1 - mappedX;
    }

    const screenX = mappedX * window.innerWidth;
    const screenY = indexTip.y * window.innerHeight;

    gestureCursor.style.display = 'block';
    gestureCursor.style.left = `${screenX - 12}px`;
    gestureCursor.style.top = `${screenY - 12}px`;

    // Calculate pinch distance
    const dx = indexTip.x - thumbTip.x;
    const dy = indexTip.y - thumbTip.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 0.05) {
      if (!isPinching && !pinchCooldown) {
        isPinching = true;
        gestureCursor.style.transform = 'scale(0.5)';
        gestureCursor.style.backgroundColor = '#ff4757';
        triggerClickAt(screenX, screenY);
        
        pinchCooldown = true;
        setTimeout(() => { pinchCooldown = false; }, 800);
      }
    } else {
      isPinching = false;
      gestureCursor.style.transform = 'scale(1)';
      gestureCursor.style.backgroundColor = 'rgba(102, 126, 234, 0.8)';
    }

    // Pose / Gesture: Raise hand to start (High Y coordinate)
    if (indexTip.y < 0.15 && !pinchCooldown) {
      const attractScreen = document.getElementById('screen-attract');
      if (attractScreen && attractScreen.classList.contains('active')) {
        showStyles();
        pinchCooldown = true;
        setTimeout(() => { pinchCooldown = false; }, 1500);
      }
    }

  } else {
    gestureCursor.style.display = 'none';
  }
}

function triggerClickAt(x, y) {
  const element = document.elementFromPoint(x, y);
  if (element) {
    const clickEvent = new MouseEvent('click', {
      view: window,
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y
    });
    element.dispatchEvent(clickEvent);
  }
}

window.addEventListener('load', () => {
  setTimeout(initGestures, 2000);
});
