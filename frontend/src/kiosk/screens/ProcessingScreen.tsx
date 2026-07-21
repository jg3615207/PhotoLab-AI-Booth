import React, { useEffect, useState, useRef } from 'react';
import { useKiosk } from '../context/KioskContext';
import confetti from 'canvas-confetti';

export default function ProcessingScreen() {
  const { jobData, setJobData, setScreen } = useKiosk();
  const [tip, setTip] = useState('Applying artistic style');
  const wsRef = useRef<WebSocket | null>(null);
  
  useEffect(() => {
    const tips = ['Applying artistic style', 'Adding some AI magic', 'Almost there...'];
    let tipIdx = 0;
    const interval = setInterval(() => {
      tipIdx++;
      setTip(tips[tipIdx % tips.length]);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!jobData?.jobId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/jobs/${jobData.jobId}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const job = JSON.parse(event.data);
      if (job.status === 'done') {
        ws.close();
        setJobData({ ...jobData, result: job });
        // Handle Reveal Effect
        startReveal(job);
      } else if (job.status === 'failed') {
        ws.close();
        const errMsg = job.error_message || "Processing failed.";
        if (window.confirm(`${errMsg}\n\nWould you like to try again?`)) {
          setScreen('capture');
        } else {
          setScreen('attract');
        }
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [jobData?.jobId, setJobData, setScreen]);

  const startReveal = (job: any) => {
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.6 },
      zIndex: 200
    });
    setScreen('result');
  };

  return (
    <div className="screen active" style={{ display: 'flex' }}>
      <div className="processing-content">
        <div className="spinner"></div>
        <h2>Creating Your Masterpiece...</h2>
        <p id="processing-tip">{tip}</p>
      </div>
    </div>
  );
}
