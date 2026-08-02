import React, { useEffect } from 'react'
import { KioskProvider, useKiosk } from './context/KioskContext'
import JoinScreen from './screens/JoinScreen'
import AttractScreen from './screens/AttractScreen'
import StyleSelectionScreen from './screens/StyleSelectionScreen'
import CaptureScreen from './screens/CaptureScreen'
import PreviewScreen from './screens/PreviewScreen'
import ProcessingScreen from './screens/ProcessingScreen'
import ResultScreen from './screens/ResultScreen'
import './styles.css'

function KioskApp() {
  const { currentScreen, setScreen, setSession } = useKiosk();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session');

    if (sessionId) {
      // Fetch session info
      fetch(`/api/events/${sessionId}`)
        .then(r => {
          if (!r.ok) throw new Error("Invalid or expired session ID.");
          return r.json();
        })
        .then(data => {
          if (!data.active) throw new Error("This session is currently inactive.");
          setSession(data);
          const savedScreen = sessionStorage.getItem('photolab_kiosk_screen');
          if (!savedScreen || savedScreen === 'join') {
            setScreen('attract');
          }
        })
        .catch(err => {
          console.error(err);
          setScreen('join');
        });
    } else {
      setScreen('join');
    }
  }, []);

  return (
    <div id="app">
      {currentScreen === 'join' && <JoinScreen />}
      {currentScreen === 'attract' && <AttractScreen />}
      {currentScreen === 'styles' && <StyleSelectionScreen />}
      {currentScreen === 'capture' && <CaptureScreen />}
      {currentScreen === 'preview' && <PreviewScreen />}
      {currentScreen === 'processing' && <ProcessingScreen />}
      {currentScreen === 'result' && <ResultScreen />}
    </div>
  );
}

class KioskErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Kiosk Error Boundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0b0c16', color: '#fff', padding: '24px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '24px', marginBottom: '12px' }}>⚠️ 系統暫時發生錯誤</h2>
          <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '24px' }}>Something went wrong while rendering the kiosk screen.</p>
          <button 
            onClick={() => { this.setState({ hasError: false }); window.location.href = '/'; }}
            style={{ padding: '12px 24px', borderRadius: '12px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}
          >
            🔄 重新載入相照亭 (Restart)
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <KioskErrorBoundary>
      <KioskProvider>
        <KioskApp />
      </KioskProvider>
    </KioskErrorBoundary>
  )
}
