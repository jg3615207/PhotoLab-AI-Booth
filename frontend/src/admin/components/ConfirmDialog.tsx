import React from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = '確定 / Confirm',
  cancelText = '取消 / Cancel',
  isDanger = true,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          background: '#151528',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '20px',
          maxWidth: '440px',
          width: '100%',
          padding: '28px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
          color: '#fff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <span style={{ fontSize: '28px' }}>{isDanger ? '⚠️' : '❓'}</span>
          <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>{title}</h3>
        </div>

        <p style={{ color: '#aaa', fontSize: '14px', lineHeight: '1.6', margin: '0 0 24px 0' }}>
          {message}
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.05)',
              color: '#fff',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              border: 'none',
              background: isDanger ? 'linear-gradient(135deg, #ff4b2b, #ff416c)' : 'linear-gradient(135deg, #667eea, #764ba2)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: isDanger ? '0 4px 15px rgba(255,75,43,0.4)' : '0 4px 15px rgba(102,126,234,0.4)',
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
