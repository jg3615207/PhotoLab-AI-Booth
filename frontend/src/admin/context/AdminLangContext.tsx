import React, { createContext, useContext, useState, useCallback } from 'react';

type Lang = 'en' | 'zh-Hant';

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

interface AdminLangContextType {
  lang: Lang;
  toggleLang: () => void;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

const AdminLangContext = createContext<AdminLangContextType>({
  lang: 'en',
  toggleLang: () => {},
  showToast: () => {}
});

export const AdminLangProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Lang>('en');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toggleLang = () => {
    setLang(prev => (prev === 'en' ? 'zh-Hant' : 'en'));
  };

  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString() + Math.random().toString().slice(2, 6);
    setToasts(prev => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  return (
    <AdminLangContext.Provider value={{ lang, toggleLang, showToast }}>
      {children}
      {toasts.length > 0 && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'none' }}>
          {toasts.map(t => (
            <div key={t.id} style={{
              padding: '12px 20px',
              borderRadius: '10px',
              background: t.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : t.type === 'success' ? 'rgba(16, 185, 129, 0.95)' : 'rgba(99, 102, 241, 0.95)',
              color: '#fff',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              animation: 'fadeIn 0.2s ease-in'
            }}>
              <span>{t.type === 'error' ? '⚠️' : t.type === 'success' ? '✅' : 'ℹ️'}</span>
              <span>{t.text}</span>
            </div>
          ))}
        </div>
      )}
    </AdminLangContext.Provider>
  );
};

export const useAdminLang = () => useContext(AdminLangContext);
