import React from 'react';
import { useAdminLang } from '../context/AdminLangContext';

export default function WikiTab() {
  const { lang } = useAdminLang();

  const isZh = lang === 'zh-Hant';

  return (
    <div style={{ background: 'rgba(26, 26, 46, 0.8)', padding: '32px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', lineHeight: 1.6 }}>
      <h1 style={{ fontSize: '28px', color: '#fff', marginBottom: '12px', borderBottom: '2px solid #667eea', paddingBottom: '12px' }}>
        {isZh ? '📖 PhotoLab AI 照相亭 — 系統使用手冊與維基' : '📖 PhotoLab AI Booth — System Manual & Wiki'}
      </h1>
      <p style={{ color: '#aaa', fontSize: '15px', marginBottom: '28px' }}>
        {isZh 
          ? '歡迎閱讀 PhotoLab AI 照相亭系統的完整技術文件與使用指南。本維基涵蓋了操作、自訂以及維護客戶端 Kiosk 與管理員後台所需了解的一切資訊。'
          : 'Welcome to the comprehensive documentation for the PhotoLab AI Photo Booth system. This wiki covers everything you need to know to operate, customize, and troubleshoot both the Client Kiosk and the Admin Management System.'}
      </p>

      {/* Section 1: Architecture Overview */}
      <div style={{ background: 'rgba(13, 13, 26, 0.8)', padding: '24px', borderRadius: '12px', marginBottom: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 style={{ color: '#667eea', fontSize: '20px', marginBottom: '12px' }}>
          {isZh ? '⚡ 系統架構總覽 (System Architecture)' : '⚡ System Architecture Overview'}
        </h3>
        <p style={{ color: '#ddd', marginBottom: '16px' }}>
          {isZh
            ? 'PhotoLab 是一個專為活動現場打造的高效能、低延遲 AI 照相亭平台，結合 React + Vite + TypeScript 前端、FastAPI Python 異步後端以及 Cloudflare 網路分發技術。'
            : 'PhotoLab is an event-grade, low-latency AI photo booth platform combining a high-performance React + Vite + TypeScript frontend with a FastAPI Python backend and Cloudflare network distribution.'}
        </p>
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <img src="/img/admin_guide.png" style={{ maxWidth: '100%', borderRadius: '8px', border: '1px solid #333' }} alt="System Architecture Diagram" onError={(e) => (e.currentTarget.style.display = 'none')} />
        </div>
        <ul style={{ color: '#aaa', paddingLeft: '20px', fontSize: '14px' }}>
          <li style={{ marginBottom: '6px' }}>
            <strong>{isZh ? '前端客戶端 (Client Kiosk):' : 'Client Kiosk (Frontend):'}</strong> {isZh ? '採用 React + Vite + TypeScript 構建，整合 Web Audio API 音效合成、MediaPipe 手勢辨識及 face-api.js 電腦視覺。' : 'Built with React + Vite + TypeScript, featuring Web Audio API sound synthesis, MediaPipe Hand Gesture tracking, and face-api.js computer vision.'}
          </li>
          <li style={{ marginBottom: '6px' }}>
            <strong>{isZh ? '後端引擎 (FastAPI Backend):' : 'Backend Engine (FastAPI):'}</strong> {isZh ? '異步 Python 伺服器，負責圖像處理流水線、SQLite 狀態管理、列印佇列處理及 WebSocket 實時廣播。' : 'Async Python server handling image processing pipelines, SQLite state management, print spooler queues, and WebSocket broadcasts.'}
          </li>
          <li style={{ marginBottom: '6px' }}>
            <strong>{isZh ? 'AI 繪圖與視覺推理 (AI Inference):' : 'AI Inference & Vision:'}</strong> {isZh ? '由 RunningHub Nano Banana 2 多模型與 OpenAI 多模態視覺 API (mimo-v2.5-free) 驅動，實現動態提示詞注入。' : 'Powered by RunningHub Nano Banana 2 multimodal models & OpenAI Multimodal Vision API (mimo-v2.5-free) for dynamic prompt generation.'}
          </li>
        </ul>
      </div>

      {/* Section 2: Kiosk Guide */}
      <div style={{ background: 'rgba(13, 13, 26, 0.8)', padding: '24px', borderRadius: '12px', marginBottom: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 style={{ color: '#4f4', fontSize: '20px', marginBottom: '12px' }}>
          {isZh ? '📸 客戶端照相亭操作指南 (Kiosk User Guide)' : '📸 Client Kiosk User Guide'}
        </h3>
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <img src="/img/kiosk_guide.png" style={{ maxWidth: '100%', borderRadius: '8px', border: '1px solid #333' }} alt="Client Kiosk Workflow Diagram" onError={(e) => (e.currentTarget.style.display = 'none')} />
        </div>
        
        <h4 style={{ color: '#fff', fontSize: '16px', marginTop: '16px', marginBottom: '8px' }}>
          {isZh ? '1. 開始與風格選擇 (Start & Style Selection)' : '1. Start & Style Selection'}
        </h4>
        <p style={{ color: '#bbb', fontSize: '14px' }}>
          {isZh
            ? '賓客點擊螢幕或掃描活動專屬 QR Code 開啟當前場次，即可瀏覽支援動態影片縮圖的 AI 藝術風格。'
            : 'Guests touch the screen or scan an event QR code to open the active session. They can browse available AI Art Styles featuring live Animated Video Thumbnails.'}
        </p>

        <h4 style={{ color: '#fff', fontSize: '16px', marginTop: '16px', marginBottom: '8px' }}>
          {isZh ? '2. 相機拍攝與無接觸手勢控制 (Camera & Touch-Free Gestures)' : '2. Camera Capture & Interactive Controls'}
        </h4>
        <ul style={{ color: '#bbb', paddingLeft: '20px', fontSize: '14px' }}>
          <li style={{ marginBottom: '6px' }}>
            <strong>{isZh ? '🖐️/✌️ 免觸控手勢觸發:' : '🖐️/✌️ Touch-Free Hand Gestures:'}</strong> {isZh ? '賓客只需在相鏡頭前比出「豎大拇指 (Thumbs Up)」或「勝利手勢 (Peace Sign)」，AI 即可自動識別並觸發 3 秒倒數計時拍攝，完全無需觸碰螢幕！' : 'Guests can raise a Thumbs Up or a Peace Sign in front of the camera. The AI will automatically detect the gesture and trigger a 3-second audio-guided countdown without touching the screen!'}
          </li>
          <li style={{ marginBottom: '6px' }}>
            <strong>{isZh ? '🎨 實時相機濾鏡:' : '🎨 Real-Time Camera Filters:'}</strong> {isZh ? '提供原色、黑白 (B&W)、復古 (Sepia) 與冷色調 (Cool) 濾鏡，即時渲染於畫面上傳。' : 'Guests can choose from Normal, B&W, Sepia, or Cool filters rendered directly onto the captured canvas.'}
          </li>
          <li style={{ marginBottom: '6px' }}>
            <strong>{isZh ? '👥 多人過載警示:' : '👥 Multi-Person Warning:'}</strong> {isZh ? '電腦視覺人臉識別會自動計算鏡頭前的人數，若超過該風格設定的最大人數上限，將顯示紅色警告標語提示後退。' : 'Computer vision automatically counts faces in the frame. If the count exceeds the style limit (max_people), a red warning banner alerts users.'}
          </li>
        </ul>

        <h4 style={{ color: '#fff', fontSize: '16px', marginTop: '16px', marginBottom: '8px' }}>
          {isZh ? '3. 重拍限制與動態揭曉動畫 (Retakes & Dynamic Reveal)' : '3. Retakes & Dynamic Reveal'}
        </h4>
        <ul style={{ color: '#bbb', paddingLeft: '20px', fontSize: '14px' }}>
          <li style={{ marginBottom: '6px' }}>
            <strong>{isZh ? '重拍次數控制:' : 'Retake Limit Enforcement:'}</strong> {isZh ? '管理員可設定每位賓客的重拍上限（例如最多 3 次），達到上限後重拍按鈕自動禁用。' : 'Admins can configure maximum retakes (e.g. 3 retakes per guest). Once reached, the Retake button disables itself.'}
          </li>
          <li style={{ marginBottom: '6px' }}>
            <strong>{isZh ? '視覺 AI 動態提示詞:' : 'Dynamic Vision Prompt:'}</strong> {isZh ? '若開啟動態提示詞，系統會在 3 秒內分析照片中賓客的服裝與姿勢，自動注入 AI 提示詞中以提高保留度。' : 'If enabled, the guest photo is analyzed by Multimodal AI in ~3s to describe clothing and pose for prompt injection.'}
          </li>
          <li style={{ marginBottom: '6px' }}>
            <strong>{isZh ? '動態揭曉特效:' : 'Reveal Transitions:'}</strong> {isZh ? '生成的藝術照片會透過 WebSocket 即時回傳，並展示故障風 (Glitch)、閃光 (Flash) 或雷射 (Laser) 揭曉動畫。' : 'The processed photo is delivered back via WebSockets with dynamic Glitch, Flash, or Laser animations.'}
          </li>
        </ul>

        <h4 style={{ color: '#fff', fontSize: '16px', marginTop: '16px', marginBottom: '8px' }}>
          {isZh ? '4. QR Code 下載與相片列印 (QR Download & Printing)' : '4. QR Download & Printing'}
        </h4>
        <p style={{ color: '#bbb', fontSize: '14px' }}>
          {isZh
            ? '賓客可直接掃描自訂顏色的 QR Code 將高清照片儲存至手機，或自動發送至現場連線的列印機進行實體列印。'
            : 'Guests can scan the custom-colored QR code to save their high-res photo, or automatically send it to the connected event printer spooler.'}
        </p>
      </div>

      {/* Section 3: Admin Management Guide */}
      <div style={{ background: 'rgba(13, 13, 26, 0.8)', padding: '24px', borderRadius: '12px', marginBottom: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 style={{ color: '#e6a23c', fontSize: '20px', marginBottom: '12px' }}>
          {isZh ? '⚙️ 管理員後台操作指南 (Admin Operational Guide)' : '⚙️ Admin Panel Operational Guide'}
        </h3>
        
        <h4 style={{ color: '#fff', fontSize: '16px', marginTop: '12px', marginBottom: '8px' }}>
          {isZh ? '🎨 風格庫管理 (Style Library Management)' : '🎨 Style Library Management'}
        </h4>
        <ul style={{ color: '#bbb', paddingLeft: '20px', fontSize: '14px' }}>
          <li style={{ marginBottom: '6px' }}>
            <strong>{isZh ? '✨ 提示詞優化器:' : '✨ Prompt Optimizer:'}</strong> {isZh ? '輸入基礎文字描述，點擊「Optimize Prompt」即可由 AI 自動優化成高品質 Prompt 模板。' : 'Type a basic prompt and click "Optimize Prompt" to let AI craft high-yield prompt templates.'}
          </li>
          <li style={{ marginBottom: '6px' }}>
            <strong>{isZh ? '📷 視覺參考圖分析 (Vision Ref AI):' : '📷 Vision Ref AI:'}</strong> {isZh ? '上傳風格參考圖片並點擊「Vision Ref AI」，系統將利用多模態視覺 AI 自動解析光影與色彩特徵。' : 'Upload a style reference image and click "Vision Ref AI" to extract style/lighting metadata using Vision AI.'}
          </li>
          <li style={{ marginBottom: '6px' }}>
            <strong>{isZh ? '🧪 4 網格多模型測試比較 (4-Grid Comparison Test):' : '🧪 4-Grid Multi-Model Comparison Test:'}</strong> {isZh ? '提供即時網頁相機拍攝或圖片上傳，同時調用 4 個模型（如 Nano Banana 2、Pro、GPT Image 2）進行輸出效果與花費比較。' : 'Interactive testing modal supporting webcam capture or file uploads with live job status polling across 4 different AI models.'}
          </li>
        </ul>

        <h4 style={{ color: '#fff', fontSize: '16px', marginTop: '16px', marginBottom: '8px' }}>
          {isZh ? '📅 場次活動管理 (Session Manager)' : '📅 Session & Event Manager'}
        </h4>
        <ul style={{ color: '#bbb', paddingLeft: '20px', fontSize: '14px' }}>
          <li style={{ marginBottom: '6px' }}>
            <strong>{isZh ? '品牌圖示與相框:' : 'Branding & Overlay Frames:'}</strong> {isZh ? '支援上傳活動專屬 Logo 圖示與 PNG 透明疊加相框，自動合成於輸出相片。' : 'Upload custom event PNG logos and frame overlays to automatically composite onto output photos.'}
          </li>
          <li style={{ marginBottom: '6px' }}>
            <strong>{isZh ? '自訂 QR Code 顏色:' : 'Custom QR Colors:'}</strong> {isZh ? '可自訂 QR Code 的背景與前景 Hex 顏色。' : 'Pick custom background and foreground hex values for QR code generation.'}
          </li>
          <li style={{ marginBottom: '6px' }}>
            <strong>{isZh ? '批次操作 (Bulk Actions):' : 'Bulk Operations:'}</strong> {isZh ? '支援多選場次進行批次歸檔 (Archive) 或永久刪除 (Delete)。' : 'Support multi-selecting sessions for bulk archiving or permanent deletion.'}
          </li>
        </ul>

        <h4 style={{ color: '#fff', fontSize: '16px', marginTop: '16px', marginBottom: '8px' }}>
          {isZh ? '⚙️ 即時任務監控與數據分析 (Live Jobs & Analytics)' : '⚙️ Live Jobs Monitor & Analytics'}
        </h4>
        <ul style={{ color: '#bbb', paddingLeft: '20px', fontSize: '14px' }}>
          <li style={{ marginBottom: '6px' }}>
            <strong>{isZh ? '即時任務監控 (Live Jobs):' : 'Live Jobs WebSocket:'}</strong> {isZh ? '透過 `/api/ws/admin` WebSocket 實時串流目前正在處理的相片任務與縮圖。' : 'Connects to /api/ws/admin to stream active jobs in real-time with input photo thumbnails.'}
          </li>
          <li style={{ marginBottom: '6px' }}>
            <strong>{isZh ? '數據儀表板 (Analytics):' : 'Analytics Dashboard:'}</strong> {isZh ? '展示每日總生成量、預估 API 成本及 24 小時每小時活動柱狀圖。' : 'Displays daily total generations, cost estimates ($0.03/gen average), and hourly volume bar charts.'}
          </li>
        </ul>
      </div>

      {/* Section 4: Maintenance */}
      <div style={{ background: 'rgba(13, 13, 26, 0.8)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 style={{ color: '#f56c6c', fontSize: '20px', marginBottom: '12px' }}>
          {isZh ? '🛠️ 系統維護與疑難排解 (Maintenance & Troubleshooting)' : '🛠️ Maintenance & Troubleshooting'}
        </h3>
        <ul style={{ color: '#bbb', paddingLeft: '20px', fontSize: '14px' }}>
          <li style={{ marginBottom: '6px' }}>
            <strong>{isZh ? '優雅管線恢復 (Graceful Recovery):' : 'Graceful Pipeline Recovery:'}</strong> {isZh ? '伺服器重啟時，自動將卡在 processing 狀態的任務轉換為 failed，保持佇列乾淨。' : 'On server restart, the app automatically finds stuck processing jobs and sets them to failed.'}
          </li>
          <li style={{ marginBottom: '6px' }}>
            <strong>{isZh ? '清理快取與臨時檔 (Clear Cache):' : 'Clear Cache:'}</strong> {isZh ? '在全域設定頁面點擊「Clear Cache」可刪除過期的上傳相片與輸出暫存檔，釋放硬碟空間。' : 'Click "Clear Cache" in Global Settings to delete old uploaded guest photos and temporary outputs when disk space is low.'}
          </li>
        </ul>
      </div>
    </div>
  );
}
