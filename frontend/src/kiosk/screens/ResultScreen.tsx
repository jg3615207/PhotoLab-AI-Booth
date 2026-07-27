import React from 'react';
import { useKiosk } from '../context/KioskContext';

export default function ResultScreen() {
  const { setScreen, jobData, lang, session } = useKiosk();
  const isZh = lang === 'zh-Hant';
  const [showPrintModal, setShowPrintModal] = React.useState(false);
  const [copies, setCopies] = React.useState(1);
  const [printingStatus, setPrintingStatus] = React.useState<string | null>(null);

  if (!jobData || !jobData.result) {
    return (
      <div className="screen active" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#aaa', fontSize: '18px' }}>{isZh ? '尚無完成結果' : 'No result available.'}</p>
        <button className="btn-secondary" style={{ marginTop: '16px' }} onClick={() => setScreen('attract')}>
          {isZh ? '返回首頁' : 'Return Home'}
        </button>
      </div>
    );
  }

  const { result } = jobData;
  const jobId = result.job_id || jobData.jobId;

  // Safe image path resolution
  const imgSrc = `/api/images/${jobId}/download`;
  const qrSrc = result.qr_code ? `/api/images/${jobId}/qr.png` : `/api/images/${jobId}/download`;

  const maxPrints = session?.max_prints_per_capture || 2;

  const handleSendPrint = async () => {
    setPrintingStatus(isZh ? '傳送列印中...' : 'Sending to printer...');
    try {
      const res = await fetch(`/api/reprint/${jobId}?copies=${copies}`, { method: 'POST' });
      if (res.ok) {
        setPrintingStatus(isZh ? '✅ 已送至印表機列印！' : '✅ Sent to printer!');
        setTimeout(() => {
          setShowPrintModal(false);
          setPrintingStatus(null);
        }, 2000);
      } else {
        const err = await res.json();
        setPrintingStatus(isZh ? `❌ 列印失敗: ${err.detail || err.error}` : `❌ Print failed: ${err.detail || err.error}`);
      }
    } catch (e: any) {
      setPrintingStatus(isZh ? `❌ 連線失敗: ${e.message}` : `❌ Failed: ${e.message}`);
    }
  };

  return (
    <div className="screen active" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <h2 style={{ fontSize: '26px', color: '#fff', marginBottom: '16px' }}>{isZh ? '🎉 您的 AI 照片已完成！' : '🎉 Your Photo Is Ready!'}</h2>
      
      <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '24px' }}>
        <img src={imgSrc} className="result-img" alt="Result" style={{ maxHeight: '420px', borderRadius: '16px', boxShadow: '0 8px 30px rgba(0,0,0,0.6)', border: '2px solid rgba(255,255,255,0.1)' }} />
        
        {result.qr_code && (
          <div className="qr-section" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', padding: '20px', borderRadius: '16px', textAlign: 'center' }}>
            <img src={qrSrc} className="qr-img" alt="QR Code" style={{ width: '160px', height: '160px', borderRadius: '10px' }} />
            <p className="qr-label" style={{ marginTop: '12px', fontSize: '13px', color: '#a3b8ff', fontWeight: 600 }}>
              {isZh ? '📱 掃碼手機下載與分享' : '📱 Scan to download & share'}
            </p>
          </div>
        )}
      </div>

      <div className="result-controls" style={{ display: 'flex', gap: '16px' }}>
        <button className="btn-primary" onClick={() => setShowPrintModal(true)}>
          🖨️ {isZh ? '實體列印' : 'Print Photo'}
        </button>
        <a className="btn-secondary" href={imgSrc} download={`PhotoLab_${jobId}.jpg`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          📥 {isZh ? '下載' : 'Download'}
        </a>
        <button className="btn-secondary" onClick={() => setScreen('attract')}>
          🔄 {isZh ? '拍攝新照片' : 'New Photo'}
        </button>
      </div>

      {showPrintModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#1a1a2e', border: '1px solid rgba(102,126,234,0.3)', borderRadius: '20px', padding: '28px', maxWidth: '440px', width: '100%', textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.8)' }}>
            <h3 style={{ fontSize: '20px', color: '#fff', marginBottom: '16px' }}>🖨️ {isZh ? '列印預覽' : 'Print Preview'}</h3>
            
            <div style={{ background: '#0d0d1a', padding: '12px', borderRadius: '12px', marginBottom: '20px' }}>
              <img src={imgSrc} alt="Print Preview" style={{ maxHeight: '220px', maxWidth: '100%', borderRadius: '8px', objectFit: 'contain' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '20px' }}>
              <span style={{ color: '#aaa', fontSize: '14px' }}>{isZh ? '列印張數:' : 'Copies:'}</span>
              <button 
                onClick={() => setCopies(Math.max(1, copies - 1))}
                style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: '1px solid #444', color: '#fff', fontSize: '18px', cursor: 'pointer' }}
              >
                -
              </button>
              <span style={{ color: '#fff', fontSize: '18px', fontWeight: 700, minWidth: '24px' }}>{copies}</span>
              <button 
                onClick={() => setCopies(Math.min(maxPrints, copies + 1))}
                style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: '1px solid #444', color: '#fff', fontSize: '18px', cursor: 'pointer' }}
              >
                +
              </button>
              <span style={{ color: '#666', fontSize: '12px' }}>(Max {maxPrints})</span>
            </div>

            {printingStatus && (
              <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', color: '#a3b8ff', marginBottom: '16px', fontSize: '13px' }}>
                {printingStatus}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="btn-secondary" onClick={() => setShowPrintModal(false)}>
                {isZh ? '取消' : 'Cancel'}
              </button>
              <button className="btn-primary" onClick={handleSendPrint}>
                🚀 {isZh ? '確認列印' : 'Confirm Print'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
