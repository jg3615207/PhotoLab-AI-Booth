import React, { createContext, useContext, useState } from 'react';

type Lang = 'en' | 'zh-Hant';

interface AdminLangContextType {
  lang: Lang;
  toggleLang: () => void;
}

const AdminLangContext = createContext<AdminLangContextType>({
  lang: 'en',
  toggleLang: () => {}
});

export const AdminLangProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Lang>('en');

  const toggleLang = () => {
    setLang(prev => (prev === 'en' ? 'zh-Hant' : 'en'));
  };

  return (
    <AdminLangContext.Provider value={{ lang, toggleLang }}>
      {children}
    </AdminLangContext.Provider>
  );
};

export const useAdminLang = () => useContext(AdminLangContext);
