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

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchQueue = async () => {
    try {
      const res = await fetch('/api/admin/print-queue');
      const data = await res.json();
      setQueue(data.queue || []);
      setPaused(!!data.paused);
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
    if (!confirm(isZh ? "確定清除所有已完成及失敗的列印紀錄？" : "Clear completed & failed print jobs?")) return;
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

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/admin/print-queue/${id}`, { method: 'DELETE' });
      fetchQueue();
    } catch (e) {
      alert("Delete failed");
    }
  };

  const queuedCount = queue.filter(q => q.status === 'queued').length;
  const printingCount = queue.filter(q => q.status === 'printing').length;
  const completedCount = queue.filter(q => q.status === 'completed').length;
  const failedCount = queue.filter(q => q.status === 'failed').length;

  return (
    <div style={{ color: '#fff' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', color: '#fff', fontWeight: 700 }}>
            🖨️ {isZh ? '列印隊列管理器' : 'Print Queue Manager'}
          </h2>
          <p style={{ margin: '4px 0 0 0', color: '#aaa', fontSize: '13px' }}>
            {isZh ? '即時監控、暫停/恢復列印隊列、手動重印與清理失敗/完成項目' : 'Real-time print queue monitor, pause/resume spooler, reprint & job management'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={handleTogglePause} 
            style={{ 
              padding: '8px 16px', 
              borderRadius: '6px', 
              fontSize: '13px', 
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              background: paused ? 'linear-gradient(135deg, #ff9900, #ff5500)' : 'linear-gradient(135deg, #38ef7d, #11998e)',
              color: '#fff' 
            }}
          >
            {paused ? (isZh ? '▶️ 恢復列印隊列' : '▶️ Resume Queue') : (isZh ? '⏸️ 暫停列印隊列' : '⏸️ Pause Queue')}
          </button>
          
          <button 
            onClick={handleClearCompleted} 
            className="btn-secondary" 
            style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '13px' }}
          >
            🧹 {isZh ? '清除完成/失敗項目' : 'Clear Completed'}
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
          <span><strong>{isZh ? '列印隊列已暫停' : 'Print Queue is Paused'}</strong>: {isZh ? '系統目前不會將新的排隊相片送往印表機。點擊右上角「恢復列印隊列」解除暫停。' : 'New jobs will remain in queue until resumed.'}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px' }}>
          <span style={{ color: '#aaa', fontSize: '12px', display: 'block', marginBottom: '4px' }}>{isZh ? '等待列印中' : 'Queued Jobs'}</span>
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
          <span style={{ color: '#aaa', fontSize: '12px', display: 'block', marginBottom: '4px' }}>{isZh ? '列印失敗數' : 'Failed'}</span>
          <span style={{ fontSize: '24px', fontWeight: 700, color: '#ff4f4f' }}>{failedCount}</span>
        </div>
      </div>

      {/* Main Queue Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>{isZh ? '載入列印隊列中...' : 'Loading queue...'}</div>
      ) : queue.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#aaa', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
          {isZh ? '🎉 目前隊列空空如也，沒有排隊中的列印任務' : 'No jobs in queue.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.05)', color: '#aaa', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <th style={{ padding: '12px 16px' }}># ID</th>
                <th style={{ padding: '12px 16px' }}>{isZh ? 'Session / 預覽' : 'Session / Preview'}</th>
                <th style={{ padding: '12px 16px' }}>{isZh ? '列印檔案與份數' : 'File & Copies'}</th>
                <th style={{ padding: '12px 16px' }}>{isZh ? '狀態' : 'Status'}</th>
                <th style={{ padding: '12px 16px' }}>{isZh ? '入佇時間 / 完成時間' : 'Enqueued / Printed'}</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>{isZh ? '操作' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#888' }}>#{item.id}</td>
                  
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {item.session_id ? (
                        <img 
                          src={`/api/images/${item.session_id}/output.jpg`} 
                          alt="thumb" 
                          style={{ width: '40px', height: '52px', objectFit: 'cover', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }} 
                        />
                      ) : (
                        <div style={{ width: '40px', height: '52px', background: '#222', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#666' }}>No Pic</div>
                      )}
                      <div>
                        <div style={{ fontWeight: 600, color: '#667eea', fontFamily: 'monospace' }}>{item.session_id || 'Direct Print'}</div>
                        <div style={{ fontSize: '11px', color: '#aaa' }}>{item.event_name}</div>
                      </div>
                    </div>
                  </td>

                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 500, color: '#ddd' }}>{item.file_name}</div>
                    <div style={{ fontSize: '11px', color: '#aaa' }}>{item.copies} {isZh ? '份' : 'copies'}</div>
                  </td>

                  <td style={{ padding: '12px 16px' }}>
                    {item.status === 'queued' && (
                      <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '10px', background: 'rgba(255,170,0,0.15)', color: '#ffaa00', fontWeight: 600, border: '1px solid rgba(255,170,0,0.3)' }}>
                        ⏳ {isZh ? '排隊等待中' : 'Queued'}
                      </span>
                    )}
                    {item.status === 'printing' && (
                      <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '10px', background: 'rgba(102,126,234,0.2)', color: '#667eea', fontWeight: 600, border: '1px solid rgba(102,126,234,0.4)' }}>
                        ⚙️ {isZh ? '正在傳送印表機...' : 'Printing...'}
                      </span>
                    )}
                    {item.status === 'completed' && (
                      <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '10px', background: 'rgba(56,239,125,0.15)', color: '#38ef7d', fontWeight: 600, border: '1px solid rgba(56,239,125,0.3)' }}>
                        ✓ {isZh ? '列印成功' : 'Completed'}
                      </span>
                    )}
                    {item.status === 'failed' && (
                      <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '10px', background: 'rgba(255,79,79,0.15)', color: '#ff4f4f', fontWeight: 600, border: '1px solid rgba(255,79,79,0.3)' }}>
                        ❌ {isZh ? '列印失敗' : 'Failed'}
                      </span>
                    )}
                  </td>

                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: '11px', color: '#aaa' }}>{isZh ? '建立: ' : 'Created: '}{item.created_at}</div>
                    {item.printed_at && <div style={{ fontSize: '11px', color: '#38ef7d' }}>{isZh ? '完成: ' : 'Printed: '}{item.printed_at}</div>}
                  </td>

                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button 
                        onClick={() => handleReprint(item.id)}
                        className="btn-secondary" 
                        style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px' }}
                      >
                        🔄 {isZh ? '重印' : 'Reprint'}
                      </button>
                      <button 
                        onClick={() => handleDelete(item.id)}
                        style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', background: 'rgba(255,79,79,0.15)', color: '#ff4f4f', border: '1px solid rgba(255,79,79,0.3)', cursor: 'pointer' }}
                      >
                        🗑️ {isZh ? '刪除' : 'Delete'}
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
