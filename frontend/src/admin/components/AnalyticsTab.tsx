import React, { useEffect, useState } from 'react';
import { useAdminLang } from '../context/AdminLangContext';

interface AnalyticsData {
  total: number;
  today: number;
  range_total?: number;
  total_cost?: number;
  avg_time?: number;
  hourly?: { hour: string; count: number }[];
  by_style?: { style_id: string; count: number }[];
  daily_trend?: { date: string; count: number }[];
}

interface StorageData {
  upload_mb: number;
  output_mb: number;
  db_mb: number;
  total_mb: number;
}

export default function AnalyticsTab() {
  const { lang } = useAdminLang();
  const isZh = lang === 'zh-Hant';

  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<AnalyticsData>({ total: 0, today: 0, hourly: [] });
  const [storage, setStorage] = useState<StorageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/admin/maintenance/stats?days=${days}`).then(r => r.json()),
      fetch('/api/admin/maintenance/storage-info').then(r => r.json())
    ]).then(([statsData, storageData]) => {
      setStats(statsData);
      setStorage(storageData);
      setLoading(false);
    }).catch(err => {
      console.error("Failed to fetch analytics stats:", err);
      setLoading(false);
    });
  }, [days]);

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

  const handleExportCSV = () => {
    let csv = "Category,Metric,Value\n";
    csv += `Generations,Total All-Time,${stats.total}\n`;
    csv += `Generations,Today,${stats.today}\n`;
    csv += `Generations,Last ${days} Days,${stats.range_total || 0}\n`;
    csv += `Performance,Avg Time (s),${stats.avg_time || 0}\n`;
    csv += `Cost,Total Estimated Cost ($),${stats.total_cost || 0}\n`;
    if (storage) {
      csv += `Storage,Uploads (MB),${storage.upload_mb}\n`;
      csv += `Storage,Outputs (MB),${storage.output_mb}\n`;
      csv += `Storage,Database (MB),${storage.db_mb}\n`;
      csv += `Storage,Total (MB),${storage.total_mb}\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `PhotoLab_Analytics_Report_${new Date().toISOString().slice(0,10)}.csv`);
    link.click();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ color: '#fff', margin: 0 }}>📊 {isZh ? '數據分析與成本儀表板' : 'Analytics & Cost Dashboard'}</h1>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select 
            value={days} 
            onChange={e => setDays(Number(e.target.value))}
            style={{ padding: '8px 14px', borderRadius: '8px', background: '#1a1a2e', color: '#fff', border: '1px solid #333', cursor: 'pointer' }}
          >
            <option value={7}>{isZh ? '最近 7 天' : 'Last 7 Days'}</option>
            <option value={30}>{isZh ? '最近 30 天' : 'Last 30 Days'}</option>
            <option value={90}>{isZh ? '最近 90 天' : 'Last 90 Days'}</option>
          </select>
          <button 
            onClick={handleExportCSV}
            style={{ padding: '8px 16px', borderRadius: '8px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
          >
            📥 {isZh ? '匯出 CSV 報表' : 'Export CSV'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div style={{ background: 'rgba(26, 26, 46, 0.8)', padding: '20px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ color: '#aaa', fontSize: '13px', fontWeight: 500 }}>{isZh ? '歷史總生成張數' : 'Total All-Time'}</div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#fff', marginTop: '6px' }}>{stats.total}</div>
        </div>

        <div style={{ background: 'rgba(26, 26, 46, 0.8)', padding: '20px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ color: '#aaa', fontSize: '13px', fontWeight: 500 }}>{isZh ? '今日生成張數' : "Today's Generations"}</div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#4f4', marginTop: '6px' }}>{stats.today}</div>
        </div>

        <div style={{ background: 'rgba(26, 26, 46, 0.8)', padding: '20px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ color: '#aaa', fontSize: '13px', fontWeight: 500 }}>{isZh ? '平均生成耗時' : 'Avg Generation Time'}</div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#a3b8ff', marginTop: '6px' }}>{stats.avg_time || 0}s</div>
        </div>

        <div style={{ background: 'rgba(26, 26, 46, 0.8)', padding: '20px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ color: '#aaa', fontSize: '13px', fontWeight: 500 }}>{isZh ? '總預估 API 費用' : 'Total API Cost'}</div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#667eea', marginTop: '6px' }}>
            ${stats.total_cost || (stats.total * 0.03).toFixed(2)}
          </div>
        </div>

        {storage && (
          <div style={{ background: 'rgba(26, 26, 46, 0.8)', padding: '20px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ color: '#aaa', fontSize: '13px', fontWeight: 500 }}>{isZh ? '儲存空間佔用' : 'Disk Storage Used'}</div>
            <div style={{ fontSize: '32px', fontWeight: 800, color: '#ffaa00', marginTop: '6px' }}>{storage.total_mb} MB</div>
          </div>
        )}
      </div>

      <div style={{ background: 'rgba(26, 26, 46, 0.8)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: '20px' }}>
          📈 {isZh ? '今日每小時生成分佈' : 'Hourly Distribution Today'}
        </h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', height: '180px', gap: '8px', paddingBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          {hourlyCounts.map((count, hr) => (
            <div key={hr} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ color: count > 0 ? '#4f4' : '#555', fontSize: '11px', marginBottom: '4px' }}>{count > 0 ? count : ''}</div>
              <div 
                style={{ 
                  width: '100%', 
                  height: `${(count / maxCount) * 100}%`, 
                  minHeight: count > 0 ? '4px' : '0px',
                  background: 'linear-gradient(to top, #667eea, #764ba2)', 
                  borderRadius: '4px 4px 0 0' 
                }} 
              />
              <div style={{ color: '#888', fontSize: '10px', marginTop: '6px' }}>{hr}h</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
