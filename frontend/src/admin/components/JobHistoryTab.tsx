import React, { useEffect, useState } from 'react';
import { useAdminLang } from '../context/AdminLangContext';

interface JobRecord {
  job_id: string;
  event_id: string;
  event_name: string;
  style_id: string;
  style_name: string;
  status: string;
  input_image: string;
  output_image: string;
  print_image: string;
  print_status: string;
  download_count: number;
  is_downloaded: boolean;
  file_name: string;
  file_size_formatted: str;
  cost_time: number;
  cost_money: number;
  created_at: string;
  updated_at: string;
  printed_at: string;
}

export default function JobHistoryTab() {
  const { lang } = useAdminLang();
  const isZh = lang === 'zh-Hant';

  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedEvent, setSelectedEvent] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [resJobs, resEvents] = await Promise.all([
        fetch(`/api/admin/job-history?event_id=${selectedEvent}&status=${selectedStatus}`),
        fetch('/api/events')
      ]);
      const dataJobs = await resJobs.json();
      const dataEvents = await resEvents.json();

      setJobs(dataJobs || []);
      setEvents(dataEvents || []);
    } catch (err) {
      console.error("Failed to fetch job history", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedEvent, selectedStatus]);

  const handleReprint = async (jobId: string) => {
    try {
      const r = await fetch(`/api/capture/reprint/${jobId}`, { method: 'POST' });
      if (r.ok) {
        alert(isZh ? "已加入列印隊列！" : "Sent to print queue!");
        loadData();
      } else {
        alert(isZh ? "加入列印隊列失敗" : "Failed to queue print");
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const filteredJobs = jobs.filter(j => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return j.job_id.toLowerCase().includes(term) ||
      (j.style_name && j.style_name.toLowerCase().includes(term)) ||
      (j.event_name && j.event_name.toLowerCase().includes(term)) ||
      (j.file_name && j.file_name.toLowerCase().includes(term));
  });

  // Stats
  const totalJobs = filteredJobs.length;
  const downloadedJobs = filteredJobs.filter(j => j.download_count > 0).length;
  const printedJobs = filteredJobs.filter(j => j.print_status === 'completed').length;
  const totalCost = filteredJobs.reduce((acc, j) => acc + (j.cost_money || 0), 0);

  return (
    <div style={{ color: '#fff' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', color: '#fff', fontWeight: 700 }}>
            📋 {isZh ? '任務歷史與場次日誌' : 'Job History & Session Log'}
          </h2>
          <p style={{ margin: '4px 0 0 0', color: '#aaa', fontSize: '13px' }}>
            {isZh ? '檢視所有拍照任務詳細記錄、檔案大小、下載狀態及列印歷程' : 'View detailed task records, file sizes, download activity, and print history'}
          </p>
        </div>
        <button onClick={loadData} className="btn-secondary" style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '13px' }}>
          🔄 {isZh ? '重新整理' : 'Refresh'}
        </button>
      </div>

      {/* Summary Stats Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px' }}>
          <span style={{ color: '#aaa', fontSize: '12px', display: 'block', marginBottom: '4px' }}>{isZh ? '總任務數' : 'Total Jobs'}</span>
          <span style={{ fontSize: '24px', fontWeight: 700, color: '#667eea' }}>{totalJobs}</span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px' }}>
          <span style={{ color: '#aaa', fontSize: '12px', display: 'block', marginBottom: '4px' }}>{isZh ? '照片已下載' : 'Photos Downloaded'}</span>
          <span style={{ fontSize: '24px', fontWeight: 700, color: '#38ef7d' }}>{downloadedJobs} <span style={{ fontSize: '12px', color: '#aaa', fontWeight: 400 }}>({totalJobs ? Math.round((downloadedJobs/totalJobs)*100) : 0}%)</span></span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px' }}>
          <span style={{ color: '#aaa', fontSize: '12px', display: 'block', marginBottom: '4px' }}>{isZh ? '相片已列印' : 'Photos Printed'}</span>
          <span style={{ fontSize: '24px', fontWeight: 700, color: '#ffaa00' }}>{printedJobs}</span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px' }}>
          <span style={{ color: '#aaa', fontSize: '12px', display: 'block', marginBottom: '4px' }}>{isZh ? '預算花費' : 'Total API Cost'}</span>
          <span style={{ fontSize: '24px', fontWeight: 700, color: '#e0c3fc' }}>${totalCost.toFixed(4)}</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
        <div>
          <label style={{ display: 'block', color: '#aaa', fontSize: '12px', marginBottom: '4px' }}>{isZh ? '篩選場次 (Session)' : 'Filter Session'}</label>
          <select 
            value={selectedEvent} 
            onChange={e => setSelectedEvent(e.target.value)}
            style={{ padding: '8px 12px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
          >
            <option value="all">{isZh ? '全部場次 (All Sessions)' : 'All Sessions'}</option>
            {events.map(ev => (
              <option key={ev.id} value={ev.id}>{ev.name} ({ev.id})</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', color: '#aaa', fontSize: '12px', marginBottom: '4px' }}>{isZh ? '任務狀態' : 'Job Status'}</label>
          <select 
            value={selectedStatus} 
            onChange={e => setSelectedStatus(e.target.value)}
            style={{ padding: '8px 12px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
          >
            <option value="all">{isZh ? '全部狀態 (All)' : 'All Statuses'}</option>
            <option value="done">{isZh ? '完成 (Done)' : 'Done'}</option>
            <option value="processing">{isZh ? '處理中 (Processing)' : 'Processing'}</option>
            <option value="error">{isZh ? '失敗 (Error)' : 'Error'}</option>
          </select>
        </div>

        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={{ display: 'block', color: '#aaa', fontSize: '12px', marginBottom: '4px' }}>{isZh ? '搜尋關鍵字' : 'Search'}</label>
          <input 
            type="text" 
            placeholder={isZh ? '搜尋 Job ID, 風格, 檔名...' : 'Search Job ID, style, filename...'}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
          />
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>{isZh ? '載入任務歷程中...' : 'Loading history...'}</div>
      ) : filteredJobs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#aaa', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
          {isZh ? '尚無符合條件的任務記錄' : 'No job records found.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.05)', color: '#aaa', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <th style={{ padding: '12px 16px' }}>{isZh ? '縮圖 / Job ID' : 'Thumb / Job ID'}</th>
                <th style={{ padding: '12px 16px' }}>{isZh ? '場次 (Session)' : 'Session'}</th>
                <th style={{ padding: '12px 16px' }}>{isZh ? '風格名稱' : 'Style'}</th>
                <th style={{ padding: '12px 16px' }}>{isZh ? '檔案詳細' : 'File Info'}</th>
                <th style={{ padding: '12px 16px' }}>{isZh ? '下載狀態' : 'Downloaded?'}</th>
                <th style={{ padding: '12px 16px' }}>{isZh ? '列印狀態' : 'Print Status'}</th>
                <th style={{ padding: '12px 16px' }}>{isZh ? '時間與費用' : 'Time & Cost'}</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>{isZh ? '操作' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map((j) => (
                <tr key={j.job_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {j.output_image ? (
                        <img 
                          src={`/api/images/${j.job_id}/output.jpg`} 
                          alt="thumb" 
                          style={{ width: '42px', height: '56px', objectFit: 'cover', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }} 
                        />
                      ) : (
                        <div style={{ width: '42px', height: '56px', background: '#222', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#666' }}>No Pic</div>
                      )}
                      <div>
                        <div style={{ fontWeight: 600, color: '#667eea', fontFamily: 'monospace' }}>{j.job_id}</div>
                        <div style={{ fontSize: '11px', color: '#888' }}>{j.created_at}</div>
                      </div>
                    </div>
                  </td>
                  
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '10px', background: 'rgba(255,255,255,0.08)', color: '#ddd' }}>
                      {j.event_name}
                    </span>
                  </td>

                  <td style={{ padding: '12px 16px', color: '#fff', fontWeight: 500 }}>
                    {j.style_name}
                  </td>

                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: '12px', color: '#ddd' }}>{j.file_name}</div>
                    <div style={{ fontSize: '11px', color: '#888' }}>{j.file_size_formatted}</div>
                  </td>

                  <td style={{ padding: '12px 16px' }}>
                    {j.download_count > 0 ? (
                      <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '10px', background: 'rgba(56,239,125,0.15)', color: '#38ef7d', fontWeight: 600, border: '1px solid rgba(56,239,125,0.3)' }}>
                        ✓ {isZh ? `已下載 (${j.download_count}次)` : `Downloaded (${j.download_count}x)`}
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', color: '#777' }}>
                        {isZh ? '未下載' : 'Not Downloaded'}
                      </span>
                    )}
                  </td>

                  <td style={{ padding: '12px 16px' }}>
                    {j.print_status === 'completed' && (
                      <div>
                        <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '10px', background: 'rgba(79,255,79,0.15)', color: '#4f4', fontWeight: 600 }}>
                          🖨️ {isZh ? '已完成列印' : 'Printed'}
                        </span>
                        {j.printed_at && <div style={{ fontSize: '10px', color: '#777', marginTop: '2px' }}>{j.printed_at}</div>}
                      </div>
                    )}
                    {j.print_status === 'queued' && (
                      <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '10px', background: 'rgba(255,170,0,0.15)', color: '#ffaa00', fontWeight: 600 }}>
                        ⏳ {isZh ? '列印排隊中' : 'Queued'}
                      </span>
                    )}
                    {j.print_status === 'printing' && (
                      <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '10px', background: 'rgba(102,126,234,0.2)', color: '#667eea', fontWeight: 600 }}>
                        ⚙️ {isZh ? '列印中' : 'Printing'}
                      </span>
                    )}
                    {j.print_status === 'failed' && (
                      <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '10px', background: 'rgba(255,79,79,0.15)', color: '#f44', fontWeight: 600 }}>
                        ❌ {isZh ? '列印失敗' : 'Print Failed'}
                      </span>
                    )}
                    {(!j.print_status || j.print_status === 'none') && (
                      <span style={{ fontSize: '11px', color: '#666' }}>-</span>
                    )}
                  </td>

                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: '12px', color: '#aaa' }}>{j.cost_time ? `${(j.cost_time/1000).toFixed(1)}s` : '-'}</div>
                    <div style={{ fontSize: '11px', color: '#888' }}>${j.cost_money ? j.cost_money.toFixed(4) : '0'}</div>
                  </td>

                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <a 
                        href={`/api/images/${j.job_id}/download`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="btn-secondary" 
                        style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none', display: 'inline-block' }}
                      >
                        ⬇️ {isZh ? '下載照片' : 'Download'}
                      </a>
                      <button 
                        onClick={() => handleReprint(j.job_id)}
                        className="btn-primary" 
                        style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
                      >
                        🖨️ {isZh ? '補印照片' : 'Reprint'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
