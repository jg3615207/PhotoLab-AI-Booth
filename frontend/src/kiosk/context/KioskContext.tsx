import { createContext, useContext, useState, type ReactNode } from 'react';

export type Screen = 'join' | 'attract' | 'styles' | 'capture' | 'preview' | 'processing' | 'reveal' | 'result';
export type KioskLang = 'en' | 'zh-Hant';

interface SessionData {
  id: string;
  name: string;
  active: boolean;
  logo_path?: string;
  allowed_styles?: string[];
  retake_limit?: number;
  enable_filters?: number | boolean;
  enable_gesture_capture?: number | boolean;
  max_prints_per_capture?: number;
  booth_mode?: 'ai' | 'normal';
}

interface KioskContextType {
  currentScreen: Screen;
  setScreen: (screen: Screen) => void;
  session: SessionData | null;
  setSession: (session: SessionData | null) => void;
  selectedStyleId: string | null;
  setSelectedStyleId: (id: string | null) => void;
  selectedStyle: any | null;
  setSelectedStyle: (style: any | null) => void;
  capturedImage: string | null; // Data URL
  setCapturedImage: (image: string | null) => void;
  jobData: any | null;
  setJobData: (data: any | null) => void;
  lang: KioskLang;
  toggleLang: () => void;
  retakeCount: number;
  setRetakeCount: (count: number) => void;
}

const KioskContext = createContext<KioskContextType | undefined>(undefined);

export function KioskProvider({ children }: { children: ReactNode }) {
  const [currentScreen, setScreenState] = useState<Screen>(() => {
    try {
      const saved = sessionStorage.getItem('photolab_kiosk_screen');
      if (saved && ['join', 'attract', 'styles', 'capture', 'preview', 'processing', 'reveal', 'result'].includes(saved)) {
        return saved as Screen;
      }
    } catch (e) {}
    return 'join';
  });

  const setScreen = (screen: Screen) => {
    setScreenState(screen);
    try {
      sessionStorage.setItem('photolab_kiosk_screen', screen);
    } catch (e) {}
  };

  const [session, setSession] = useState<SessionData | null>(null);
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<any | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [jobData, setJobData] = useState<any | null>(null);
  const [lang, setLang] = useState<KioskLang>('zh-Hant');
  const [retakeCount, setRetakeCount] = useState(0);

  const toggleLang = () => {
    setLang(prev => (prev === 'en' ? 'zh-Hant' : 'en'));
  };

  return (
    <KioskContext.Provider
      value={{
        currentScreen,
        setScreen,
        session,
        setSession,
        selectedStyleId,
        setSelectedStyleId,
        selectedStyle,
        setSelectedStyle,
        capturedImage,
        setCapturedImage,
        jobData,
        setJobData,
        lang,
        toggleLang,
        retakeCount,
        setRetakeCount,
      }}
    >
      {children}
    </KioskContext.Provider>
  );
}

export function useKiosk() {
  const context = useContext(KioskContext);
  if (context === undefined) {
    throw new Error('useKiosk must be used within a KioskProvider');
  }
  return context;
}
