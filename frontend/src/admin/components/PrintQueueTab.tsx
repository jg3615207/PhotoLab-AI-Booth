import React, { useEffect, useState } from 'react';
import { useAdminLang } from '../context/AdminLangContext';

interface QueueItem {
  id: number;
  session_id: string;
  image_path: string;
  file_name: string;
  copies: number;
  status: string;
  created_at: string;
  printed_at: string;
  event_id: string;
  event_name: string;
  style_id: string;
}

export default function PrintQueueTab() {
  const { lang } = useAdminLang();
  const isZh = lang === 'zh-Hant';

  const [activeSubTab, setActiveSubTab] = useState<'queue' | 'history'>('queue');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  const fetchQueue = async () => {
    try {
      const res = await fetch('/api/admin/print-queue');
      const data = await res.json();
      setQueue(data.queue || []);
      setPaused(!!data.paused);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("Failed to load print queue", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const timer = setInterval(fetchQueue, 3000);
    return () => clearInterval(timer);
  }, []);

  const handleTogglePause = async () => {
    try {
      const res = await fetch('/api/admin/print-queue/toggle-pause', { method: 'POST' });
      const data = await res.json();
      setPaused(data.paused);
    } catch (err) {
      alert("Toggle failed");
    }
  };

  const handleClearCompleted = async () => {
    if (!confirm(isZh ? "確定清除所有已完成、已取消及失敗的列印紀錄？" : "Clear completed, cancelled & failed print jobs?")) return;
    try {
      await fetch('/api/admin/print-queue/clear', { method: 'POST' });
      fetchQueue();
    } catch (e) {
      alert("Clear failed");
    }
  };

  const handleReprint = async (id: number) => {
    try {
      await fetch(`/api/admin/print-queue/${id}/reprint`, { method: 'POST' });
      fetchQueue();
    } catch (e) {
      alert("Reprint failed");
    }
  };

  const handleCancel = async (id: number) => {
    if (!confirm(isZh ? "確定要取消此列印任務嗎？取消後該記錄將移至「列印歷史紀錄」。" : "Cancel print task? It will be moved to Print History.")) return;
    try {
      await fetch(`/api/admin/print-queue/${id}/cancel`, { method: 'POST' });
      fetchQueue();
    } catch (e) {
      alert("Cancel failed");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/admin/print-queue/${id}`, { method: 'DELETE' });
      fetchQueue();
    } catch (e) {
      alert("Delete failed");
    }
  };

  // Filter queue groups
  const liveQueueItems = queue.filter(q => q.status === 'queued' || q.status === 'printing');
  const historyQueueItems = queue.filter(q => q.status === 'completed' || q.status === 'failed' || q.status === 'cancelled');

  const queuedCount = queue.filter(q => q.status === 'queued').length;
  const printingCount = queue.filter(q => q.status === 'printing').length;
  const completedCount = queue.filter(q => q.status === 'completed').length;
  const cancelledCount = queue.filter(q => q.status === 'cancelled').length;
  const failedCount = queue.filter(q => q.status === 'failed').length;

  return (
    <div style={{ color: '#fff' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', color: '#fff', fontWeight: 700 }}>
            🖨️ {isZh ? '列印隊列與歷史紀錄' : 'Print Queue & Print History'}
          </h2>
          <p style={{ margin: '4px 0 0 0', color: '#aaa', fontSize: '13px' }}>
            {isZh ? '即時列印監控、取消隊列任務、暫停/恢復印表機與列印歷史歷程' : 'Real-time print spooler, task cancellation, pause/resume & print history'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '12px', background: 'rgba(56,239,125,0.15)', color: '#38ef7d', border: '1px solid rgba(56,239,125,0.3)', padding: '4px 10px', borderRadius: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38ef7d', animation: 'pulse 1.5s infinite' }}></span>
            {isZh ? `自動更新中 (${lastRefreshed})` : `Auto-Refreshing (${lastRefreshed})`}
          </span>

          <button 
            onClick={handleTogglePause} 
            style={{ 
              padding: '8px 16px', 
              borderRadius: '6px', 
              fontSize: '13px', 
              fontWeight: 700,
              cursor: 'pointer',
              border: 'none',
              background: paused ? 'linear-gradient(135deg, #ff9900, #ff5500)' : 'linear-gradient(135deg, #38ef7d, #11998e)',
              color: paused ? '#fff' : '#000'
            }}
          >
            {paused ? (isZh ? '▶️ 恢復列印隊列' : '▶️ Resume Queue') : (isZh ? '⏸️ 暫停列印隊列' : '⏸️ Pause Queue')}
          </button>
          
          <button 
            onClick={handleClearCompleted} 
            className="btn-secondary" 
            style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '13px' }}
          >
            🧹 {isZh ? '清理歷史紀錄' : 'Clear History'}
          </button>

          <button 
            onClick={fetchQueue} 
            className="btn-secondary" 
            style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '13px' }}
          >
            🔄 {isZh ? '刷新' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Queue Status Alert Banner */}
      {paused && (
        <div style={{ background: 'rgba(255,153,0,0.15)', border: '1px solid #ff9900', color: '#ffaa00', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>⚠️</span>
          <span><strong>{isZh ? '列印隊列已暫停' : 'Print Queue is Paused'}</strong>: {isZh ? '系統目前不會將排隊相片送往印表機。點擊右上角「恢復列印隊列」解除暫停。' : 'New jobs will remain in queue until resumed.'}</span>
        </div>
      )}

      {/* Sub-Tab Navigation Bar */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveSubTab('queue')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            background: activeSubTab === 'queue' ? 'linear-gradient(135deg, #ffaa00, #ff5500)' : 'rgba(255,255,255,0.05)',
            color: activeSubTab === 'queue' ? '#fff' : '#aaa',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          🖨️ {isZh ? '即時列印隊列 (Active Queue)' : 'Active Queue'}
          {liveQueueItems.length > 0 && (
            <span style={{ background: '#fff', color: '#000', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700 }}>
              {liveQueueItems.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('history')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            background: activeSubTab === 'history' ? 'linear-gradient(135deg, #667eea, #764ba2)' : 'rgba(255,255,255,0.05)',
            color: activeSubTab === 'history' ? '#fff' : '#aaa',
            transition: 'all 0.2s'
          }}
        >
          📜 {isZh ? '列印歷史紀錄 (Print History)' : 'Print History'} ({historyQueueItems.length})
        </button>
      </div>

      {/* Stats Summary Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px' }}>
          <span style={{ color: '#aaa', fontSize: '12px', display: 'block', marginBottom: '4px' }}>{isZh ? '排隊等待中' : 'Queued Jobs'}</span>
          <span style={{ fontSize: '24px', fontWeight: 700, color: '#ffaa00' }}>{queuedCount}</span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px' }}>
          <span style={{ color: '#aaa', fontSize: '12px', display: 'block', marginBottom: '4px' }}>{isZh ? '正在列印中' : 'Printing Now'}</span>
          <span style={{ fontSize: '24px', fontWeight: 700, color: '#667eea' }}>{printingCount}</span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px' }}>
          <span style={{ color: '#aaa', fontSize: '12px', display: 'block', marginBottom: '4px' }}>{isZh ? '成功列印數' : 'Completed'}</span>
          <span style={{ fontSize: '24px', fontWeight: 700, color: '#38ef7d' }}>{completedCount}</span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px' }}>
          <span style={{ color: '#aaa', fontSize: '12px', display: 'block', marginBottom: '4px' }}>{isZh ? '取消列印數' : 'Cancelled'}</span>
          <span style={{ fontSize: '24px', fontWeight: 700, color: '#ff77bc' }}>{cancelledCount}</span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px' }}>
          <span style={{ color: '#aaa', fontSize: '12px', display: 'block', marginBottom: '4px' }}>{isZh ? '列印失敗數' : 'Failed'}</span>
          <span style={{ fontSize: '24px', fontWeight: 700, color: '#ff4f4f' }}>{failedCount}</span>
        </div>
      </div>

      {/* 1. ACTIVE QUEUE TAB */}
      {activeSubTab === 'queue' && (
        <>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>{isZh ? '載入列印隊列中...' : 'Loading queue...'}</div>
          ) : liveQueueItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px', color: '#aaa' }}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>🎉</div>
              <div style={{ fontSize: '16px', color: '#fff', fontWeight: 600 }}>{isZh ? '目前隊列空空如也，沒有排隊中的列印任務' : 'No active print jobs in queue'}</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left', minWidth: '850px' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,170,0,0.08)', color: '#aaa', borderBottom: '1px solid rgba(255,170,0,0.2)' }}>
                    <th style={{ padding: '14px 18px', width: '80px' }}># Queue ID</th>
                    <th style={{ padding: '14px 18px', width: '220px' }}>{isZh ? '預覽 / Job ID' : 'Preview / Job ID'}</th>
                    <th style={{ padding: '14px 18px', width: '160px' }}>{isZh ? '列印檔案與份數' : 'File & Copies'}</th>
                    <th style={{ padding: '14px 18px', width: '140px' }}>{isZh ? '當前狀態' : 'Status'}</th>
                    <th style={{ padding: '14px 18px', width: '160px' }}>{isZh ? '入隊時間' : 'Enqueued At'}</th>
                    <th style={{ padding: '14px 18px', textAlign: 'right', width: '180px' }}>{isZh ? '操作' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {liveQueueItems.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '14px 18px', fontWeight: 700, color: '#ffaa00', fontFamily: 'monospace' }}>#{item.id}</td>
                      
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {item.session_id ? (
                            <img 
                              src={`/api/images/${item.session_id}/print_ready.jpg`} 
                              onError={(e: any) => {
                                e.target.onerror = null;
                                e.target.src = `/api/images/${item.session_id}/output.jpg`;
                              }}
                              alt="thumb" 
                              style={{ width: '44px', height: '58px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }} 
                            />
                          ) : (
                            <div style={{ width: '44px', height: '58px', background: '#222', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#666' }}>No Pic</div>
                          )}
                          <div>
                            <div style={{ fontWeight: 700, color: '#667eea', fontFamily: 'monospace', fontSize: '13px' }}>{item.session_id || 'Direct Print'}</div>
                            <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>{item.event_name}</div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 500, color: '#ddd' }}>{item.file_name}</div>
                        <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>{item.copies} {isZh ? '份 (copies)' : 'copies'}</div>
                      </td>

                      <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                        {item.status === 'queued' && (
                          <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '12px', background: 'rgba(255,170,0,0.15)', color: '#ffaa00', fontWeight: 700, border: '1px solid rgba(255,170,0,0.3)', display: 'inline-block' }}>
                            ⏳ {isZh ? '排隊等待中' : 'Queued'}
                          </span>
                        )}
                        {item.status === 'printing' && (
                          <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '12px', background: 'rgba(102,126,234,0.2)', color: '#667eea', fontWeight: 700, border: '1px solid rgba(102,126,234,0.4)', display: 'inline-block' }}>
                            ⚙️ {isZh ? '正在送往印表機...' : 'Printing...'}
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '14px 18px', color: '#aaa', fontSize: '12px' }}>
                        {item.created_at}
                      </td>

                      {/* CANCEL BUTTON */}
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button 
                            onClick={() => handleCancel(item.id)}
                            style={{ 
                              padding: '6px 12px', 
                              borderRadius: '6px', 
                              fontSize: '12px', 
                              fontWeight: 700,
                              background: 'rgba(255,79,79,0.15)', 
                              color: '#ff4f4f', 
                              border: '1px solid rgba(255,79,79,0.4)', 
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            ❌ {isZh ? '取消列印' : 'Cancel Print'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* 2. PRINT HISTORY TAB */}
      {activeSubTab === 'history' && (
        <>
          {historyQueueItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#aaa', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
              {isZh ? '尚無列印歷史紀錄' : 'No print history records found.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left', minWidth: '900px' }}>
                <thead>
                  <tr style={{ background: 'rgba(102,126,234,0.08)', color: '#aaa', borderBottom: '1px solid rgba(102,126,234,0.2)' }}>
                    <th style={{ padding: '14px 18px', width: '80px' }}># ID</th>
                    <th style={{ padding: '14px 18px', width: '220px' }}>{isZh ? '預覽 / Job ID' : 'Preview / Job ID'}</th>
                    <th style={{ padding: '14px 18px', width: '160px' }}>{isZh ? '列印檔案與份數' : 'File & Copies'}</th>
                    <th style={{ padding: '14px 18px', width: '140px' }}>{isZh ? '結果狀態' : 'Status'}</th>
                    <th style={{ padding: '14px 18px', width: '180px' }}>{isZh ? '紀錄時間' : 'Timestamp'}</th>
                    <th style={{ padding: '14px 18px', textAlign: 'right', width: '180px' }}>{isZh ? '操作' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {historyQueueItems.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '14px 18px', fontWeight: 600, color: '#888', fontFamily: 'monospace' }}>#{item.id}</td>
                      
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {item.session_id ? (
                            <img 
                              src={`/api/images/${item.session_id}/print_ready.jpg`} 
                              onError={(e: any) => {
                                e.target.onerror = null;
                                e.target.src = `/api/images/${item.session_id}/output.jpg`;
                              }}
                              alt="thumb" 
                              style={{ width: '44px', height: '58px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }} 
                            />
                          ) : (
                            <div style={{ width: '44px', height: '58px', background: '#222', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#666' }}>No Pic</div>
                          )}
                          <div>
                            <div style={{ fontWeight: 700, color: '#667eea', fontFamily: 'monospace', fontSize: '13px' }}>{item.session_id || 'Direct Print'}</div>
                            <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>{item.event_name}</div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 500, color: '#ddd' }}>{item.file_name}</div>
                        <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>{item.copies} {isZh ? '份' : 'copies'}</div>
                      </td>

                      <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                        {item.status === 'completed' && (
                          <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '12px', background: 'rgba(56,239,125,0.15)', color: '#38ef7d', fontWeight: 700, border: '1px solid rgba(56,239,125,0.3)', display: 'inline-block' }}>
                            ✓ {isZh ? '已完成列印' : 'Completed'}
                          </span>
                        )}
                        {item.status === 'cancelled' && (
                          <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '12px', background: 'rgba(255,119,188,0.15)', color: '#ff77bc', fontWeight: 700, border: '1px solid rgba(255,119,188,0.3)', display: 'inline-block' }}>
                            ❌ {isZh ? '已取消列印' : 'Cancelled'}
                          </span>
                        )}
                        {item.status === 'failed' && (
                          <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '12px', background: 'rgba(255,79,79,0.15)', color: '#ff4f4f', fontWeight: 700, border: '1px solid rgba(255,79,79,0.3)', display: 'inline-block' }}>
                            ❌ {isZh ? '列印失敗' : 'Failed'}
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontSize: '12px', color: '#aaa' }}>{item.printed_at || item.created_at}</div>
                      </td>

                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button 
                            onClick={() => handleReprint(item.id)}
                            className="btn-primary" 
                            style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
                          >
                            🔄 {isZh ? '重新排印' : 'Reprint'}
                          </button>
                          <button 
                            onClick={() => handleDelete(item.id)}
                            style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', background: 'rgba(255,255,255,0.05)', color: '#aaa', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
                          >
                            🗑️ {isZh ? '刪除紀錄' : 'Delete'}
                          </button>
                        </div>
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
