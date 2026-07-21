import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Screen = 'join' | 'attract' | 'styles' | 'capture' | 'preview' | 'processing' | 'reveal' | 'result';

interface SessionData {
  id: string;
  name: string;
  active: boolean;
  logo_path?: string;
  allowed_styles?: string[];
}

interface KioskContextType {
  currentScreen: Screen;
  setScreen: (screen: Screen) => void;
  session: SessionData | null;
  setSession: (session: SessionData | null) => void;
  selectedStyleId: string | null;
  setSelectedStyleId: (id: string | null) => void;
  capturedImage: string | null; // Data URL
  setCapturedImage: (image: string | null) => void;
  jobData: any | null;
  setJobData: (data: any | null) => void;
}

const KioskContext = createContext<KioskContextType | undefined>(undefined);

export function KioskProvider({ children }: { children: ReactNode }) {
  const [currentScreen, setScreen] = useState<Screen>('join');
  const [session, setSession] = useState<SessionData | null>(null);
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [jobData, setJobData] = useState<any | null>(null);

  return (
    <KioskContext.Provider
      value={{
        currentScreen,
        setScreen,
        session,
        setSession,
        selectedStyleId,
        setSelectedStyleId,
        capturedImage,
        setCapturedImage,
        jobData,
        setJobData,
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
