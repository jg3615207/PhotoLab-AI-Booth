const API_BASE = window.PHOTOLAB_API || '';

let selectedStyleId = null;
let currentJobId = null;
let mediaStream = null;
let pollInterval = null;

let currentSession = null;

window.onload = async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session');
  
  if (sessionId) {
    try {
      const r = await fetch(`${API_BASE}/api/events/${sessionId}`);
      if (r.ok) {
        currentSession = await r.json();
        if (!currentSession.active) {
          throw new Error("This session is currently inactive.");
        }
        
        const header = document.getElementById('session-brand-header');
        if (header) {
          if (currentSession.logo_path) {
            const logoSrc = `${API_BASE}/api/events/${currentSession.id}/logo?t=${Date.now()}`;
            header.innerHTML = `<img src="${logoSrc}" style="height:40px; border-radius:6px; object-fit:contain; box-shadow:0 2px 4px rgba(0,0,0,0.5);"> <h2 style="color:white; margin:0; text-shadow:1px 1px 4px black; font-family:sans-serif;">${currentSession.name}</h2>`;
          } else {
            header.innerHTML = `<h2 style="color:white; margin:0; text-shadow:1px 1px 4px black; font-family:sans-serif;">${currentSession.name}</h2>`;
          }
        }
        
        await loadStyles();
        switchScreen('screen-attract');
      } else {
        throw new Error("Invalid or expired session ID.");
      }
    } catch(e) {
      document.getElementById('join-error').textContent = e.message;
      document.getElementById('join-error').style.display = 'block';
      switchScreen('screen-join');
    }
  } else {
    switchScreen('screen-join');
  }
};

async function joinSession() {
  const id = document.getElementById('join-session-id').value.trim();
  if (!id) return;
  window.location.href = `?session=${id}`;
}

let stylesData = [];
async function loadStyles() {
  try {
    const r = await fetch(`${API_BASE}/api/styles`);
    stylesData = await r.json();
    let styles = stylesData;
    
    if (currentSession && currentSession.allowed_styles && currentSession.allowed_styles.length > 0) {
      styles = styles.filter(s => currentSession.allowed_styles.includes(s.id));
    }
    
    const grid = document.getElementById('style-grid');
    grid.innerHTML = styles.map(s => `
      <div class="style-card" onclick="selectStyle('${s.id}')">
        <img class="style-thumb" src="${API_BASE}${s.thumbnail}" alt="${s.name}"
             onerror="this.outerHTML='<div class=\\'style-thumb\\' style=\\'background:#2a2a4e;display:flex;align-items:center;justify-content:center;color:#666\\'>${s.name[0]}</div>'">
        <div class="style-name">${s.name}</div>
        <div class="style-badge">${s.max_people > 1 ? __('kiosk.js.styleBadgeUpTo', s.max_people) : __('kiosk.js.styleBadgeSolo')}</div>
      </div>
    `).join('');
  } catch (e) {
    document.getElementById('style-grid').innerHTML = '<p>' + __('kiosk.js.couldNotLoadStyles') + '</p>';
  }
}

function showStyles() {
  retakeCount = 0;
  setFilter("none");
  document.getElementById("btn-retake").disabled = false;
  document.getElementById("btn-retake").textContent = __("kiosk.js.retake") || "Retake";
  switchScreen('screen-styles');
}

function showAttract() {
  if (pollInterval) clearInterval(pollInterval);
  stopCamera();
  switchScreen('screen-attract');
}

function selectStyle(id) {
  selectedStyleId = id;
  showCapture();
}

function switchScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showCapture() {

  if (document.getElementById('screen-preview').classList.contains('active')) {
      retakeCount++;
      if (retakeCount >= maxRetakes) {
          document.getElementById('btn-retake').disabled = true;
          document.getElementById('btn-retake').textContent = 'Out of Retakes';
      }
  }

  switchScreen('screen-capture');
  const video = document.getElementById('video');
  const msg = document.getElementById('no-camera-msg');
  const btn = document.getElementById('btn-capture');
  video.style.display = '';
  msg.style.display = 'none';
  btn.disabled = false;
  btn.textContent = __('kiosk.js.takePhoto');
  try {
    if (mediaStream) stopCamera();
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1920 } }
    }).then(stream => {
      mediaStream = stream;
      video.srcObject = stream;
    }).catch(() => {
      video.style.display = 'none';
      msg.style.display = 'flex';
      btn.disabled = true;
      btn.textContent = __('kiosk.js.noCamera');
    });
  } catch (e) {
    video.style.display = 'none';
    msg.style.display = 'flex';
    btn.disabled = true;
    btn.textContent = __('kiosk.js.noCamera');
  }
}

function stopCamera() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
}

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = document.getElementById('preview-img');
    img.src = e.target.result;
    img.onload = function() {
      const canvas = document.getElementById('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      switchScreen('screen-preview');
    };
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

function startCountdown() {
  const btn = document.getElementById('btn-capture');
  btn.disabled = true;
  const overlay = document.getElementById('countdown-overlay');
  const num = document.getElementById('countdown-number');
  overlay.classList.add('active');
  let count = 3;
  num.textContent = count;

  const iv = setInterval(() => {
    count--;
    if (count <= 0) {
      clearInterval(iv);
      overlay.classList.remove('active');
      const flash = document.getElementById('flash-effect');
      if (flash) {
        flash.style.display = 'block';
        flash.style.opacity = '1';
        setTimeout(() => { flash.style.opacity = '0'; }, 50);
        setTimeout(() => { flash.style.display = 'none'; }, 550);
      }
      capturePhoto();
      btn.disabled = false;
    } else {
      num.textContent = count;
    }
  }, 1000);
}

let isMirrored = false;
function toggleMirror() {
  isMirrored = !isMirrored;
  document.getElementById('video').style.transform = isMirrored ? 'scaleX(-1)' : 'scaleX(1)';
}

function capturePhoto() {
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);

  const img = document.getElementById('preview-img');
  img.src = canvas.toDataURL('image/jpeg', 0.95);
  document.getElementById('btn-capture').textContent = __('kiosk.js.retake');
  switchScreen('screen-preview');
}

async function confirmCapture() {
  const canvas = document.getElementById('canvas');
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
  const form = new FormData();
  form.append('image', blob, 'photo.jpg');
  form.append('style_id', selectedStyleId);
  if (currentSession && currentSession.id) {
    form.append('event_id', currentSession.id);
  }

  switchScreen('screen-processing');
  const tips = [__('kiosk.js.tipApplying'), __('kiosk.js.tipAddingMagic'), __('kiosk.js.tipAlmostThere')];
  let tipIdx = 0;
  setInterval(() => {
    document.getElementById('processing-tip').textContent = tips[tipIdx % tips.length];
    tipIdx++;
  }, 4000);

  try {
    const r = await fetch(`${API_BASE}/api/capture`, { method: 'POST', body: form });
    const data = await r.json();
    if (data.error) {
      alert(data.error + "\n\nPlease try again.");
      switchScreen('screen-preview'); // Go back to preview for graceful retry
      return;
    }
    currentJobId = data.job_id;
    pollJobStatus(currentJobId);
  } catch (e) {
    alert(__('kiosk.js.uploadFailed'));
    switchScreen('screen-preview'); // Go back to preview for graceful retry
  }
}

function pollJobStatus(jobId) {
  if (pollInterval) clearInterval(pollInterval);
  const startTime = Date.now();
  const submittedAt = new Date(startTime).toISOString();
  console.log(`[PhotoLab] Job ${jobId} submitted at ${submittedAt}`);
  
  // Timer for text update
  pollInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    document.getElementById('processing-tip').textContent =
      elapsed < 60 ? __('kiosk.js.processingTime', elapsed) : __('kiosk.js.stillWorking', elapsed);
  }, 1000);

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  let host = API_BASE ? API_BASE.replace(/^https?:\/\//, '') : window.location.host;
  const wsUrl = `${protocol}//${host}/ws/jobs/${jobId}`;
  
  const ws = new WebSocket(wsUrl);

  ws.onmessage = (event) => {
    const job = JSON.parse(event.data);
    if (job.status === 'done') {
      clearInterval(pollInterval);
      ws.close();
      const endTime = Date.now();
      const totalSec = (endTime - startTime) / 1000;
      console.log(`[PhotoLab] Job ${jobId} DONE in ${totalSec.toFixed(1)}s`);
      const style = stylesData.find(s => s.id === selectedStyleId) || {};
      startBigReveal(job, style.transition_type || 'glitch');
    } else if (job.status === 'failed') {
      clearInterval(pollInterval);
      ws.close();
      const errMsg = job.error_message || __('kiosk.js.processingFailed');
      if (confirm(`${errMsg}\n\n${__('kiosk.js.tryAgainConfirm')}`)) {
        showCapture();
      } else {
        showAttract();
      }
    }
  };

  ws.onerror = (e) => {
    console.error("WebSocket error", e);
  };
}

function startBigReveal(job, transitionType) {
  if (transitionType === 'random') {
    const types = ['glitch', 'flash', 'swipe'];
    transitionType = types[Math.floor(Math.random() * types.length)];
  }

  if (transitionType === 'none') {
    showResult(job);
    return;
  }

  // Populate images
  const originalImg = document.getElementById('reveal-original');
  const generatedImg = document.getElementById('reveal-generated');
  
  const printPath = job.print_image.split(/[/\\]/).slice(-2).join('/');
  generatedImg.src = `${API_BASE}/api/images/${printPath}`;
  generatedImg.className = 'reveal-img generated'; // reset class
  generatedImg.style.opacity = '0';
  
  // Use preview image or input image
  originalImg.src = document.getElementById('preview-img').src;

  const container = document.querySelector('.reveal-container');
  container.className = `reveal-container effect-${transitionType}`;
  
  switchScreen('screen-reveal');

  const text = document.getElementById('reveal-text');
  text.textContent = __('kiosk.js.revealReady') || "Get ready to be amazed...";
  text.classList.add('show');

  setTimeout(() => {
    text.textContent = "3";
  }, 2000);
  setTimeout(() => {
    text.textContent = "2";
  }, 3000);
  setTimeout(() => {
    text.textContent = "1";
  }, 4000);

  setTimeout(() => {
    text.classList.remove('show');
    container.classList.add('start-swipe'); // only affects swipe CSS
    generatedImg.classList.add('reveal-generated-show');
    
    // Confetti
    if (window.confetti) {
      window.confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        zIndex: 200
      });
    }

    setTimeout(() => {
      showResult(job);
    }, 2000);

  }, 5000);
}

function showResult(job) {
  const img = document.getElementById('result-img');
  const printPath = job.print_image;
  const filename = printPath.split(/[/\\]/).slice(-2).join('/');
  img.src = `${API_BASE}/api/images/${filename}`;
  document.getElementById('result-download').href = img.src;
  document.getElementById('result-download').download = 'photolab-print.jpg';

  // QR code
  const qrImg = document.getElementById('qr-img');
  if (job.qr_code) {
    const qrPath = job.qr_code;
    const qrFile = qrPath.split(/[/\\]/).slice(-2).join('/');
    qrImg.src = `${API_BASE}/api/images/${qrFile}`;
    qrImg.style.display = '';
  } else {
    qrImg.style.display = 'none';
  }

  switchScreen('screen-result');
}


// --- ML Features: Face & Gesture Detection ---
let faceApiLoaded = false;
let handsApiLoaded = false;
const videoEl = document.getElementById('camera-video');

async function initML() {
    try {
        await faceapi.nets.tinyFaceDetector.loadFromUri('https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights');
        faceApiLoaded = true;
    } catch(e) { console.error('FaceAPI failed', e); }
    
    try {
        const hands = new window.Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
        hands.setOptions({ maxNumHands: 2, modelComplexity: 0, minDetectionConfidence: 0.7, minTrackingConfidence: 0.7 });
        hands.onResults(onHandResults);
        
        const camera = new window.Camera(videoEl, {
            onFrame: async () => {
                if(document.getElementById('screen-capture').classList.contains('active')) {
                    await hands.send({image: videoEl});
                }
            },
            width: 640, height: 480
        });
        camera.start();
        handsApiLoaded = true;
    } catch(e) { console.error('HandsAPI failed', e); }
}

function onHandResults(results) {
    if(!document.getElementById('screen-capture').classList.contains('active')) return;
    if(document.getElementById('countdown').style.display !== 'none') return;
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        for (const landmarks of results.multiHandLandmarks) {
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];
            const middleTip = landmarks[12];
            // Thumbs up gesture: thumb is pointing up, index and middle are folded
            if (thumbTip.y < indexTip.y - 0.1 && thumbTip.y < middleTip.y - 0.1) {
                console.log("Thumbs up detected! Triggering capture...");
                startCountdown();
                break;
            }
            // Peace sign gesture: index and middle are up, thumb/ring/pinky folded
            if (indexTip.y < landmarks[5].y && middleTip.y < landmarks[9].y && landmarks[16].y > landmarks[13].y) {
                console.log("Peace sign detected! Triggering capture...");
                startCountdown();
                break;
            }
        }
    }
}

async function checkFaces() {
    if(!faceApiLoaded) return;
    if(!document.getElementById('screen-capture').classList.contains('active')) return;
    
    const detections = await faceapi.detectAllFaces(videoEl, new faceapi.TinyFaceDetectorOptions());
    const warnEl = document.getElementById('face-warning');
    if (detections.length > currentMaxPeople) {
        document.getElementById('max-faces-text').textContent = currentMaxPeople;
        warnEl.style.display = 'block';
    } else {
        warnEl.style.display = 'none';
    }
}

// Start ML checks
setInterval(() => {
    if(document.getElementById('screen-capture').classList.contains('active')) checkFaces();
}, 1000);

// initML when DOM is ready
document.addEventListener('DOMContentLoaded', initML);
