import React, { useEffect, useState } from 'react';
import { useAdminLang } from '../context/AdminLangContext';

interface JobRecord {
  job_id: string;
  event_id: string;
  event_name: string;
  style_id: string;
  style_name: string;
  status: string;
  capture_source: string;
  input_image: string;
  output_image: string;
  print_image: string;
  print_status: string;
  download_count: number;
  is_downloaded: boolean;
  file_name: string;
  file_size_formatted: string;
  cost_time: number;
  cost_money: number;
  created_at: string;
  updated_at: string;
  printed_at: string;
}

interface RefGenRecord {
  id: number;
  style_id: string;
  style_name: string;
  prompt: string;
  aspect_ratio: string;
  resolution: string;
  v2_model: string;
  v2_quality: string;
  preview_url: string;
  cost_time: number;
  cost_money: number;
  status: string;
  created_at: string;
}

export default function JobHistoryTab() {
  const { lang } = useAdminLang();
  const isZh = lang === 'zh-Hant';

  const [activeSubTab, setActiveSubTab] = useState<'photo_jobs' | 'ref_gens'>('photo_jobs');
  
  // Photo Jobs states
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Ref Gens states
  const [refLogs, setRefLogs] = useState<RefGenRecord[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);

  // Filters
  const [selectedEvent, setSelectedEvent] = useState('all');
  const [selectedSource, setSelectedSource] = useState('all');
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

  const loadRefLogs = async () => {
    setLoadingRefs(true);
    try {
      const res = await fetch('/api/admin/ref-gen-history');
      const data = await res.json();
      setRefLogs(data || []);
    } catch (err) {
      console.error("Failed to fetch ref gen history", err);
    } finally {
      setLoadingRefs(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'photo_jobs') {
      loadData();
    } else {
      loadRefLogs();
    }
  }, [activeSubTab, selectedEvent, selectedStatus]);

  const handleReprint = async (jobId: string) => {
    try {
      const r = await fetch(`/api/capture/reprint/${jobId}`, { method: 'POST' });
      if (r.ok) {
        alert(isZh ? "已成功重新加入列印隊列！" : "Successfully queued reprint!");
        loadData();
      } else {
        alert(isZh ? "加入列印隊列失敗" : "Failed to queue print");
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const filteredJobs = jobs.filter(j => {
    if (selectedSource !== 'all') {
      if (selectedSource === 'test' && j.capture_source !== 'test') return false;
      if (selectedSource === 'kiosk' && j.capture_source === 'test') return false;
    }
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return j.job_id.toLowerCase().includes(term) ||
      (j.style_name && j.style_name.toLowerCase().includes(term)) ||
      (j.event_name && j.event_name.toLowerCase().includes(term)) ||
      (j.file_name && j.file_name.toLowerCase().includes(term));
  });

  // Stats
  const totalJobs = filteredJobs.length;
  const testJobsCount = filteredJobs.filter(j => j.capture_source === 'test').length;
  const downloadedJobs = filteredJobs.filter(j => j.download_count > 0).length;
  const printedJobs = filteredJobs.filter(j => j.print_status === 'completed').length;
  const totalCost = filteredJobs.reduce((acc, j) => acc + (j.cost_money || 0), 0);

  return (
    <div style={{ color: '#fff' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', color: '#fff', fontWeight: 700 }}>
            📋 {isZh ? '任務歷史與活動日誌' : 'Job History & Activity Logs'}
          </h2>
          <p style={{ margin: '4px 0 0 0', color: '#aaa', fontSize: '13px' }}>
            {isZh ? '追蹤相片生成任務來源、測試標籤、檔案記錄、下載次數與 AI 參考圖生成歷程' : 'Track photo generations, test sources, file sizes, download counts & AI reference generation history'}
          </p>
        </div>

        <button onClick={activeSubTab === 'photo_jobs' ? loadData : loadRefLogs} className="btn-secondary" style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '13px' }}>
          🔄 {isZh ? '刷新紀錄' : 'Refresh'}
        </button>
      </div>

      {/* Sub-Tab Navigation Bar */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveSubTab('photo_jobs')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            background: activeSubTab === 'photo_jobs' ? 'linear-gradient(135deg, #667eea, #764ba2)' : 'rgba(255,255,255,0.05)',
            color: activeSubTab === 'photo_jobs' ? '#fff' : '#aaa',
            transition: 'all 0.2s'
          }}
        >
          📸 {isZh ? '相片生成任務 (Photo Jobs)' : 'Photo Jobs'} ({totalJobs})
        </button>

        <button
          onClick={() => setActiveSubTab('ref_gens')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            background: activeSubTab === 'ref_gens' ? 'linear-gradient(135deg, #ff007f, #764ba2)' : 'rgba(255,255,255,0.05)',
            color: activeSubTab === 'ref_gens' ? '#fff' : '#aaa',
            transition: 'all 0.2s'
          }}
        >
          🎨 {isZh ? 'AI 參考圖生成紀錄 (Ref Gen Log)' : 'AI Ref Gen Log'} ({refLogs.length})
        </button>
      </div>

      {/* PHOTO JOBS SUB-TAB */}
      {activeSubTab === 'photo_jobs' && (
        <>
          {/* Summary Stats Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px' }}>
              <span style={{ color: '#aaa', fontSize: '12px', display: 'block', marginBottom: '4px' }}>{isZh ? '總拍照任務' : 'Total Jobs'}</span>
              <span style={{ fontSize: '24px', fontWeight: 700, color: '#667eea' }}>{totalJobs}</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px' }}>
              <span style={{ color: '#aaa', fontSize: '12px', display: 'block', marginBottom: '4px' }}>{isZh ? '測試與機台' : 'Test / Kiosk'}</span>
              <span style={{ fontSize: '18px', fontWeight: 700, color: '#e0c3fc' }}>🧪 {testJobsCount} <span style={{ fontSize: '12px', color: '#aaa', fontWeight: 400 }}>測試 / 📸 {totalJobs - testJobsCount} 機台</span></span>
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
              <span style={{ color: '#aaa', fontSize: '12px', display: 'block', marginBottom: '4px' }}>{isZh ? '總 API 費用' : 'Total API Cost'}</span>
              <span style={{ fontSize: '24px', fontWeight: 700, color: '#ff77bc' }}>${totalCost.toFixed(4)}</span>
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
              <label style={{ display: 'block', color: '#aaa', fontSize: '12px', marginBottom: '4px' }}>{isZh ? '來源種類 (Source)' : 'Source'}</label>
              <select 
                value={selectedSource} 
                onChange={e => setSelectedSource(e.target.value)}
                style={{ padding: '8px 12px', background: '#0d0d1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
              >
                <option value="all">{isZh ? '全部來源 (All Sources)' : 'All Sources'}</option>
                <option value="kiosk">{isZh ? '📸 機台拍攝 (Kiosk)' : 'Kiosk Booth'}</option>
                <option value="test">{isZh ? '🧪 後台測試 (Admin Test)' : 'Admin Test'}</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', color: '#aaa', fontSize: '12px', marginBottom: '4px' }}>{isZh ? '任務狀態' : 'Status'}</label>
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
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left', minWidth: '950px' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.05)', color: '#aaa', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ padding: '16px 18px', width: '220px' }}>{isZh ? '預覽 / Job ID' : 'Thumb / Job ID'}</th>
                    <th style={{ padding: '16px 18px', width: '180px' }}>{isZh ? '場次與來源' : 'Session & Source'}</th>
                    <th style={{ padding: '16px 18px', width: '160px' }}>{isZh ? '風格名稱' : 'Style'}</th>
                    <th style={{ padding: '16px 18px', width: '160px' }}>{isZh ? '檔案詳細' : 'File Info'}</th>
                    <th style={{ padding: '16px 18px', width: '140px' }}>{isZh ? '下載狀態' : 'Downloaded?'}</th>
                    <th style={{ padding: '16px 18px', width: '140px' }}>{isZh ? '列印狀態' : 'Print Status'}</th>
                    <th style={{ padding: '16px 18px', width: '120px' }}>{isZh ? '耗時與費用' : 'Time & Cost'}</th>
                    <th style={{ padding: '16px 18px', textAlign: 'right', width: '180px' }}>{isZh ? '操作' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.map((j) => {
                    const isTest = j.capture_source === 'test';
                    return (
                      <tr key={j.job_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: isTest ? 'rgba(118,75,162,0.05)' : 'transparent' }}>
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <img 
                              src={`/api/images/${j.job_id}/print_ready.jpg`} 
                              onError={(e: any) => {
                                e.target.onerror = null;
                                e.target.src = `/api/images/${j.job_id}/output.jpg`;
                              }}
                              alt="thumb" 
                              style={{ width: '48px', height: '64px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }} 
                            />
                            <div>
                              <div style={{ fontWeight: 700, color: '#667eea', fontFamily: 'monospace', fontSize: '13px' }}>{j.job_id}</div>
                              <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{j.created_at}</div>
                            </div>
                          </div>
                        </td>
                        
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ fontWeight: 600, color: '#fff', fontSize: '13px', marginBottom: '4px' }}>{j.event_name}</div>
                          {isTest ? (
                            <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: 'rgba(155,89,182,0.25)', color: '#d5a6bd', border: '1px solid rgba(155,89,182,0.4)', fontWeight: 600 }}>
                              🧪 {isZh ? '後台測試' : 'Admin Test'}
                            </span>
                          ) : (
                            <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: 'rgba(56,239,125,0.15)', color: '#38ef7d', border: '1px solid rgba(56,239,125,0.3)', fontWeight: 600 }}>
                              📸 {isZh ? '機台拍照' : 'Kiosk Booth'}
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '14px 18px', color: '#fff', fontWeight: 600 }}>
                          {j.style_name}
                        </td>

                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ fontSize: '12px', color: '#ddd', fontWeight: 500 }}>{j.file_name}</div>
                          <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{j.file_size_formatted}</div>
                        </td>

                        <td style={{ padding: '14px 18px' }}>
                          {j.download_count > 0 ? (
                            <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '12px', background: 'rgba(56,239,125,0.15)', color: '#38ef7d', fontWeight: 700, border: '1px solid rgba(56,239,125,0.3)', display: 'inline-block' }}>
                              ✓ {isZh ? `已下載 (${j.download_count}次)` : `Downloaded (${j.download_count}x)`}
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', color: '#777', display: 'inline-block' }}>
                              {isZh ? '未下載' : 'Not Downloaded'}
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '14px 18px' }}>
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
                              ❌ {isZh ? '列印失敗' : 'Failed'}
                            </span>
                          )}
                          {(!j.print_status || j.print_status === 'none') && (
                            <span style={{ fontSize: '12px', color: '#555' }}>-</span>
                          )}
                        </td>

                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ fontSize: '12px', color: '#aaa' }}>{j.cost_time ? `${(j.cost_time/1000).toFixed(1)}s` : '-'}</div>
                          <div style={{ fontSize: '11px', color: '#888' }}>${j.cost_money ? j.cost_money.toFixed(4) : '0'}</div>
                        </td>

                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <a 
                              href={`/api/images/${j.job_id}/download`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="btn-secondary" 
                              style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none', display: 'inline-block' }}
                            >
                              ⬇️ {isZh ? '下載' : 'Download'}
                            </a>
                            <button 
                              onClick={() => handleReprint(j.job_id)}
                              className="btn-primary" 
                              style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
                            >
                              🖨️ {isZh ? '補印' : 'Reprint'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* REF GENS SUB-TAB */}
      {activeSubTab === 'ref_gens' && (
        <>
          {loadingRefs ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>{isZh ? '載入參考圖生成紀錄中...' : 'Loading AI reference generation history...'}</div>
          ) : refLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#aaa', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
              {isZh ? '尚無 AI 參考圖生成紀錄' : 'No AI Reference Image Generation records found.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left', minWidth: '950px' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,0,127,0.08)', color: '#aaa', borderBottom: '1px solid rgba(255,0,127,0.2)' }}>
                    <th style={{ padding: '16px 18px', width: '200px' }}>{isZh ? '生成圖片 / 風格' : 'Image / Style'}</th>
                    <th style={{ padding: '16px 18px' }}>{isZh ? '生成提示詞 (Prompt)' : 'Prompt'}</th>
                    <th style={{ padding: '16px 18px', width: '160px' }}>{isZh ? '模型與設定' : 'Model & Config'}</th>
                    <th style={{ padding: '16px 18px', width: '140px' }}>{isZh ? '採納狀態' : 'Status'}</th>
                    <th style={{ padding: '16px 18px', width: '140px' }}>{isZh ? '生成時間與費用' : 'Time & Cost'}</th>
                  </tr>
                </thead>
                <tbody>
                  {refLogs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <img 
                            src={log.preview_url} 
                            alt="ref preview" 
                            style={{ width: '54px', height: '72px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #ff007f' }}
                          />
                          <div>
                            <div style={{ fontWeight: 700, color: '#fff', fontSize: '13px' }}>{log.style_name}</div>
                            <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{log.created_at}</div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontSize: '12px', color: '#ddd', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '6px', maxHeight: '64px', overflowY: 'auto' }}>
                          {log.prompt}
                        </div>
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontSize: '12px', color: '#ff77bc', fontWeight: 600 }}>{log.v2_model}</div>
                        <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>{log.aspect_ratio} | {log.resolution}</div>
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        {log.status === 'accepted' ? (
                          <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '12px', background: 'rgba(56,239,125,0.15)', color: '#38ef7d', fontWeight: 700, border: '1px solid rgba(56,239,125,0.3)' }}>
                            ✅ {isZh ? '已採納為參考圖' : 'Accepted'}
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: '#aaa' }}>
                            ✨ {isZh ? '生成預覽' : 'Generated'}
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontSize: '12px', color: '#aaa' }}>{(log.cost_time/1000).toFixed(1)}s</div>
                        <div style={{ fontSize: '11px', color: '#888' }}>${log.cost_money.toFixed(4)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
