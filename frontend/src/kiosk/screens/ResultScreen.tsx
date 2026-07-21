import React from 'react';
import { useKiosk } from '../context/KioskContext';

export default function ResultScreen() {
  const { setScreen, jobData } = useKiosk();

  if (!jobData || !jobData.result) {
    return <div>No result available.</div>;
  }

  const { result } = jobData;
  const printPath = result.print_image;
  const filename = printPath.split(/[/\\]/).slice(-2).join('/');
  const imgSrc = `/api/images/${filename}`;

  let qrSrc = '';
  if (result.qr_code) {
    const qrFile = result.qr_code.split(/[/\\]/).slice(-2).join('/');
    qrSrc = `/api/images/${qrFile}`;
  }

  return (
    <div className="screen active" style={{ display: 'flex' }}>
      <h2>Your Photo Is Ready!</h2>
      <img src={imgSrc} className="result-img" alt="Result" />
      
      {qrSrc && (
        <div className="qr-section">
          <img src={qrSrc} className="qr-img" alt="QR Code" />
          <p className="qr-label"><span>Scan to download</span></p>
        </div>
      )}
      
      <div className="result-controls">
        <a className="btn-primary" href={imgSrc} download="photolab.jpg" style={{ textDecoration: 'none' }}>
          Download
        </a>
        <button className="btn-secondary" onClick={() => setScreen('attract')}>
          New Photo
        </button>
      </div>
    </div>
  );
}
