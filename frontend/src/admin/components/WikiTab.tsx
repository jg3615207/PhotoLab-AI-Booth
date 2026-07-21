import React from 'react';

export default function WikiTab() {
  return (
    <div style={{ background: 'rgba(26, 26, 46, 0.8)', padding: '32px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', lineHeight: 1.6 }}>
      <h1 style={{ fontSize: '28px', color: '#fff', marginBottom: '12px', borderBottom: '2px solid #667eea', paddingBottom: '12px' }}>
        📖 PhotoLab AI Booth — System Manual & Wiki
      </h1>
      <p style={{ color: '#aaa', fontSize: '15px', marginBottom: '28px' }}>
        Welcome to the comprehensive documentation for the PhotoLab AI Photo Booth system. This wiki covers everything you need to know to operate, customize, and troubleshoot both the Client Kiosk and the Admin Management System.
      </p>

      {/* Section 1: Overview */}
      <div style={{ background: 'rgba(13, 13, 26, 0.8)', padding: '24px', borderRadius: '12px', marginBottom: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 style={{ color: '#667eea', fontSize: '20px', marginBottom: '12px' }}>⚡ System Architecture Overview</h3>
        <p style={{ color: '#ddd', marginBottom: '16px' }}>
          PhotoLab is an event-grade, low-latency AI photo booth platform combining a high-performance Client Kiosk interface with a FastAPI Python backend and Cloudflare network distribution.
        </p>
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <img src="/img/admin_guide.png" style={{ maxWidth: '100%', borderRadius: '8px', border: '1px solid #333' }} alt="System Architecture Diagram" onError={(e) => (e.currentTarget.style.display = 'none')} />
        </div>
        <ul style={{ color: '#aaa', paddingLeft: '20px', fontSize: '14px' }}>
          <li style={{ marginBottom: '6px' }}><strong>Client Kiosk (Frontend):</strong> React + Vite + TypeScript application with Web Audio API sound synthesis, MediaPipe Hand Gesture tracking, and face-api.js computer vision.</li>
          <li style={{ marginBottom: '6px' }}><strong>Backend Engine (FastAPI):</strong> Async Python server handling job pipelines, SQLite state management, print spooler queues, and WebSocket broadcasts.</li>
          <li style={{ marginBottom: '6px' }}><strong>AI Inference:</strong> Powered by RunningHub Nano Banana 2 & OpenAI Multimodal Vision API (`mimo-v2.5-free`) for dynamic prompt generation.</li>
        </ul>
      </div>

      {/* Section 2: Client Kiosk Guide */}
      <div style={{ background: 'rgba(13, 13, 26, 0.8)', padding: '24px', borderRadius: '12px', marginBottom: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 style={{ color: '#4f4', fontSize: '20px', marginBottom: '12px' }}>📸 Client Kiosk User Guide</h3>
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <img src="/img/kiosk_guide.png" style={{ maxWidth: '100%', borderRadius: '8px', border: '1px solid #333' }} alt="Client Kiosk Workflow Diagram" onError={(e) => (e.currentTarget.style.display = 'none')} />
        </div>
        
        <h4 style={{ color: '#fff', fontSize: '16px', marginTop: '16px', marginBottom: '8px' }}>1. Start & Style Selection</h4>
        <p style={{ color: '#bbb', fontSize: '14px' }}>
          Guests touch the screen or scan an event QR code to open the active session. They can browse available AI Art Styles featuring live <strong>Animated Video Thumbnails</strong>.
        </p>

        <h4 style={{ color: '#fff', fontSize: '16px', marginTop: '16px', marginBottom: '8px' }}>2. Camera Capture & Interactive Controls</h4>
        <ul style={{ color: '#bbb', paddingLeft: '20px', fontSize: '14px' }}>
          <li style={{ marginBottom: '6px' }}><strong>🖐️/✌️ Touch-Free Hand Gestures:</strong> Guests can raise a <strong>Thumbs Up</strong> or a <strong>Peace Sign</strong> in front of the camera. The AI will automatically detect the gesture and trigger a 3-second audio-guided countdown without touching the screen!</li>
          <li style={{ marginBottom: '6px' }}><strong>🎨 Real-Time Camera Filters:</strong> Guests can choose from <em>Normal, B&W, Sepia,</em> or <em>Cool</em> filters. The selected filter is rendered directly onto the captured canvas before server upload.</li>
          <li style={{ marginBottom: '6px' }}><strong>👥 Multi-Person Warning:</strong> Computer vision automatically counts faces in the frame. If the count exceeds the style's limit (`max_people`), a red warning banner alerts the user to step back.</li>
        </ul>

        <h4 style={{ color: '#fff', fontSize: '16px', marginTop: '16px', marginBottom: '8px' }}>3. Retakes & Dynamic Reveal</h4>
        <ul style={{ color: '#bbb', paddingLeft: '20px', fontSize: '14px' }}>
          <li style={{ marginBottom: '6px' }}><strong>Retake Limit Enforcement:</strong> Admins can configure maximum retakes (e.g., 3 retakes per guest). Once reached, the Retake button disables itself.</li>
          <li style={{ marginBottom: '6px' }}><strong>Dynamic Vision Prompt:</strong> If enabled for a style, the guest's photo is analyzed by Multimodal AI in ~3s to describe their clothing and pose for custom prompt injection.</li>
          <li style={{ marginBottom: '6px' }}><strong>Reveal Transitions:</strong> The processed photo is delivered back via WebSockets with a dynamic <em>Glitch</em> or <em>Fade</em> animation.</li>
        </ul>

        <h4 style={{ color: '#fff', fontSize: '16px', marginTop: '16px', marginBottom: '8px' }}>4. QR Download & Printing</h4>
        <p style={{ color: '#bbb', fontSize: '14px' }}>
          Guests can scan the custom-colored QR code to save their high-res photo, or automatically send it to the connected event printer spooler.
        </p>
      </div>

      {/* Section 3: Admin Management Guide */}
      <div style={{ background: 'rgba(13, 13, 26, 0.8)', padding: '24px', borderRadius: '12px', marginBottom: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 style={{ color: '#e6a23c', fontSize: '20px', marginBottom: '12px' }}>⚙️ Admin Panel Operational Guide</h3>
        
        <h4 style={{ color: '#fff', fontSize: '16px', marginTop: '12px', marginBottom: '8px' }}>🎨 Style Library Management</h4>
        <ul style={{ color: '#bbb', paddingLeft: '20px', fontSize: '14px' }}>
          <li style={{ marginBottom: '6px' }}><strong>✨ Prompt Optimizer:</strong> Type a basic prompt and click <em>"Gen / Optimize"</em> to let AI craft high-yield prompt templates.</li>
          <li style={{ marginBottom: '6px' }}><strong>📷 Gen with Ref:</strong> Upload a style reference image and click <em>"Gen with Ref"</em> to extract style/lighting metadata using Vision AI.</li>
          <li style={{ marginBottom: '6px' }}><strong>Dynamic Prompt LLM Toggle:</strong> Enable `Dynamic Prompt LLM` to turn on real-time guest posture/clothing injection during capture.</li>
        </ul>

        <h4 style={{ color: '#fff', fontSize: '16px', marginTop: '16px', marginBottom: '8px' }}>📅 Session & Event Manager</h4>
        <ul style={{ color: '#bbb', paddingLeft: '20px', fontSize: '14px' }}>
          <li style={{ marginBottom: '6px' }}><strong>Branding & Frames:</strong> Upload custom event PNG logos and frame overlays to automatically composite onto output photos.</li>
          <li style={{ marginBottom: '6px' }}><strong>Custom QR Colors:</strong> Pick custom background (`qr_bg_color`) and foreground (`qr_fg_color`) hex values for QR code generation.</li>
          <li style={{ marginBottom: '6px' }}><strong>Retake & Filter Controls:</strong> Set maximum retakes per guest and enable/disable camera filters per session.</li>
        </ul>

        <h4 style={{ color: '#fff', fontSize: '16px', marginTop: '16px', marginBottom: '8px' }}>⚙️ Live Jobs Monitor & Analytics</h4>
        <ul style={{ color: '#bbb', paddingLeft: '20px', fontSize: '14px' }}>
          <li style={{ marginBottom: '6px' }}><strong>Live Jobs WebSocket:</strong> Connects to `/api/ws/admin` to stream active jobs in real-time, displaying 60x60px guest photo thumbnails.</li>
          <li style={{ marginBottom: '6px' }}><strong>Analytics Dashboard:</strong> Displays daily total generations, cost estimates ($0.03/gen average), and hourly volume bar charts.</li>
        </ul>
      </div>

      {/* Section 4: Maintenance & Troubleshooting */}
      <div style={{ background: 'rgba(13, 13, 26, 0.8)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 style={{ color: '#f56c6c', fontSize: '20px', marginBottom: '12px' }}>🛠️ Maintenance & Troubleshooting</h3>
        <ul style={{ color: '#bbb', paddingLeft: '20px', fontSize: '14px' }}>
          <li style={{ marginBottom: '6px' }}><strong>Graceful Pipeline Recovery:</strong> On server restart, the app automatically finds stuck `processing` jobs and sets them to `failed` to keep the queue clean.</li>
          <li style={{ marginBottom: '6px' }}><strong>Backup Database:</strong> Click <em>"Backup Database"</em> in Global Settings to download a snapshot of `booth.db`.</li>
          <li style={{ marginBottom: '6px' }}><strong>Clear Cache:</strong> Click <em>"Clear Cache"</em> to delete old uploaded guest photos and temporary outputs when disk space is low.</li>
        </ul>
      </div>
    </div>
  );
}
