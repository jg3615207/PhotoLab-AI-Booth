import React, { useEffect, useState } from 'react';

interface JobItem {
  job_id: string;
  event_id?: string;
  style_id: string;
  status: string;
}

export default function LiveJobsTab() {
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    try {
      const r = await fetch('/api/admin/maintenance/live-jobs');
      if (r.ok) {
        const data = await r.json();
        setJobs(data || []);
      }
    } catch (e) {
      console.error("Failed to load live jobs", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();

    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(`${wsProto}//${wsHost}/api/ws/admin`);
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.event === 'job_update') {
            setTimeout(fetchJobs, 400);
          }
        } catch (err) {}
      };
    } catch (err) {}

    return () => {
      if (ws) ws.close();
    };
  }, []);

  return (
    <div>
      <h1 style={{ color: '#fff', marginBottom: '24px' }}>⚙️ Live Jobs Monitor</h1>
      
      {loading ? (
        <div style={{ color: '#888', padding: '24px', textAlign: 'center' }}>Loading live jobs...</div>
      ) : jobs.length === 0 ? (
        <div style={{ background: 'rgba(26, 26, 46, 0.6)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.05)', padding: '32px', borderRadius: '16px', color: '#888', textAlign: 'center' }}>
          No active jobs currently processing.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {jobs.map((j) => (
            <div key={j.job_id} style={{ background: 'rgba(26, 26, 46, 0.8)', padding: '16px', borderRadius: '12px', display: 'flex', gap: '16px', alignItems: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
              <img 
                src={`/api/uploads/${j.job_id}/input.jpg`} 
                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} 
                style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px', background: '#1a1a2e' }} 
                alt="Upload preview" 
              />
              <div style={{ flexGrow: 1 }}>
                <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#fff', marginBottom: '4px' }}>Job {j.job_id}</div>
                <div style={{ fontSize: '13px', color: '#aaa' }}>
                  Session: <strong style={{ color: '#ddd' }}>{j.event_id || 'default'}</strong> | Style: <strong style={{ color: '#667eea' }}>{j.style_id}</strong>
                </div>
              </div>
              <div>
                <span className={`status ${j.status === 'processing' ? 'status-active' : 'status-inactive'}`} style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '20px', textTransform: 'uppercase', fontWeight: 600 }}>
                  {j.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
