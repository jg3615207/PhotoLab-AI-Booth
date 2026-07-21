import React, { useEffect, useState } from 'react';

interface AnalyticsData {
  total: number;
  today: number;
  hourly?: { hour: string; count: number }[];
}

export default function AnalyticsTab() {
  const [stats, setStats] = useState<AnalyticsData>({ total: 0, today: 0, hourly: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/maintenance/stats')
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch analytics stats:", err);
        setLoading(false);
      });
  }, []);

  const hourlyCounts = new Array(24).fill(0);
  if (stats.hourly) {
    stats.hourly.forEach(item => {
      const idx = parseInt(item.hour, 10);
      if (idx >= 0 && idx < 24) {
        hourlyCounts[idx] = item.count;
      }
    });
  }

  const maxCount = Math.max(...hourlyCounts, 5);

  return (
    <div>
      <h1 style={{ color: '#fff', marginBottom: '24px' }}>📊 Analytics & Cost Dashboard</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div style={{ background: 'rgba(26, 26, 46, 0.8)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ color: '#aaa', fontSize: '14px', fontWeight: 500 }}>Total All-Time Generations</div>
          <div style={{ fontSize: '36px', fontWeight: 800, color: '#fff', marginTop: '8px' }}>{stats.total}</div>
        </div>

        <div style={{ background: 'rgba(26, 26, 46, 0.8)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ color: '#aaa', fontSize: '14px', fontWeight: 500 }}>Today's Generations</div>
          <div style={{ fontSize: '36px', fontWeight: 800, color: '#4f4', marginTop: '8px' }}>{stats.today}</div>
        </div>

        <div style={{ background: 'rgba(26, 26, 46, 0.8)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ color: '#aaa', fontSize: '14px', fontWeight: 500 }}>Est. API Cost (Today)</div>
          <div style={{ fontSize: '36px', fontWeight: 800, color: '#667eea', marginTop: '8px' }}>
            ${(stats.today * 0.03).toFixed(2)}
          </div>
        </div>
      </div>

      <div style={{ background: 'rgba(26, 26, 46, 0.8)', padding: '28px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h2 style={{ color: '#fff', fontSize: '18px', marginBottom: '20px' }}>Hourly Generation Activity Today</h2>
        
        {loading ? (
          <div style={{ color: '#888', textAlign: 'center', padding: '40px' }}>Loading analytics graph...</div>
        ) : (
          <div style={{ width: '100%', height: '240px', display: 'flex', alignItems: 'flex-end', gap: '8px', paddingTop: '20px' }}>
            {hourlyCounts.map((count, hour) => {
              const heightPct = Math.max(5, (count / maxCount) * 100);
              return (
                <div key={hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifySelf: 'flex-end' }}>
                  <div style={{ fontSize: '11px', color: '#667eea', marginBottom: '4px', opacity: count > 0 ? 1 : 0.4 }}>{count}</div>
                  <div style={{ width: '100%', height: `${heightPct}%`, background: count > 0 ? 'linear-gradient(180deg, #667eea, #764ba2)' : 'rgba(255,255,255,0.05)', borderRadius: '4px 4px 0 0', transition: 'height 0.3s' }} />
                  <div style={{ fontSize: '10px', color: '#888', marginTop: '8px' }}>{hour.toString().padStart(2, '0')}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
