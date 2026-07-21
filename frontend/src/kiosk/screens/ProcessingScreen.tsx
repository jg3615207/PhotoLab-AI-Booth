import React, { useEffect, useState, useRef } from 'react';
import { useKiosk } from '../context/KioskContext';
import confetti from 'canvas-confetti';

export default function ProcessingScreen() {
  const { jobData, setJobData, setScreen, lang, selectedStyleId } = useKiosk();
  const isZh = lang === 'zh-Hant';

  const tipsZh = ['正在套用藝術風格...', '加入 AI 魔法效果...', '快要完成了...'];
  const tipsEn = ['Applying artistic style...', 'Adding some AI magic...', 'Almost there...'];
  const tips = isZh ? tipsZh : tipsEn;

  const [tip, setTip] = useState(tips[0]);
  const [transitionType, setTransitionType] = useState('glitch');
  const [transitions, setTransitions] = useState<any[]>([]);
  const [activeTransition, setActiveTransition] = useState<string | null>(null);
  const isFinishedRef = useRef(false);
  
  useEffect(() => {
    if (selectedStyleId) {
      Promise.all([
        fetch('/api/styles').then(r => r.json()),
        fetch('/api/transitions/list').then(r => r.json())
      ]).then(([styleList, transList]) => {
        const matchStyle = styleList.find((s: any) => s.id === selectedStyleId);
        if (matchStyle) {
          setTransitionType(matchStyle.transition_type || 'glitch');
        }
        setTransitions(transList || []);
      }).catch(e => console.error("Failed to load transitions details:", e));
    }
  }, [selectedStyleId]);

  useEffect(() => {
    let tipIdx = 0;
    const interval = setInterval(() => {
      tipIdx++;
      setTip(tips[tipIdx % tips.length]);
    }, 4000);
    return () => clearInterval(interval);
  }, [tips]);

  useEffect(() => {
    if (!jobData?.jobId) return;

    isFinishedRef.current = false;

    // Helper to handle completion
    const handleJobComplete = (job: any) => {
      if (isFinishedRef.current) return;
      isFinishedRef.current = true;
      setJobData({ ...jobData, result: job });
      
      let trans = transitionType;
      if (trans === 'random') {
        const activeTypes = transitions.map(t => t.id).filter(id => id !== 'random' && id !== 'none');
        if (activeTypes.length > 0) {
          trans = activeTypes[Math.floor(Math.random() * activeTypes.length)];
        } else {
          trans = 'glitch';
        }
      }

      if (trans === 'none') {
        startReveal();
      } else {
        const transMatch = transitions.find(t => t.id === trans);
        const duration = transMatch ? transMatch.duration : 1400;
        
        setActiveTransition(trans);
        setTimeout(() => {
          startReveal();
        }, duration);
      }
    };

    const handleJobFailed = (job: any) => {
      if (isFinishedRef.current) return;
      isFinishedRef.current = true;
      const errMsg = job.error_message || job.error || (isZh ? "處理失敗。" : "Processing failed.");
      if (window.confirm(`${errMsg}\n\n${isZh ? '要再試一次嗎？' : 'Would you like to try again?'}`)) {
        setScreen('capture');
      } else {
        setScreen('attract');
      }
    };

    // 1. Try WebSocket
    let ws: WebSocket | null = null;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws/jobs/${jobData.jobId}`;
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const job = JSON.parse(event.data);
          if (job.status === 'done') {
            handleJobComplete(job);
          } else if (job.status === 'failed') {
            handleJobFailed(job);
          }
        } catch (e) {
          console.error("WS Parse error", e);
        }
      };
    } catch (e) {
      console.warn("WebSocket init error, falling back to HTTP polling", e);
    }

    // 2. HTTP Polling Fallback (always runs to guarantee completion even if WS fails/drops)
    const pollInterval = setInterval(async () => {
      if (isFinishedRef.current) {
        clearInterval(pollInterval);
        return;
      }
      try {
        const res = await fetch(`/api/job/${jobData.jobId}`);
        if (res.ok) {
          const job = await res.json();
          if (job.status === 'done') {
            clearInterval(pollInterval);
            if (ws && ws.readyState === WebSocket.OPEN) ws.close();
            handleJobComplete(job);
          } else if (job.status === 'failed') {
            clearInterval(pollInterval);
            if (ws && ws.readyState === WebSocket.OPEN) ws.close();
            handleJobFailed(job);
          }
        }
      } catch (err) {
        console.error("Polling error", err);
      }
    }, 1500);

    return () => {
      clearInterval(pollInterval);
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close();
      }
    };
  }, [jobData?.jobId, setJobData, setScreen, isZh]);

  const startReveal = () => {
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
      {activeTransition && (
        <div className={`transition-overlay transition-${activeTransition}-custom`} />
      )}
      <div className="processing-content">
        <div className="spinner"></div>
        <h2>{isZh ? 'AI 創作中...' : 'Creating Your Masterpiece...'}</h2>
        <p id="processing-tip">{tip}</p>
      </div>
    </div>
  );
}
