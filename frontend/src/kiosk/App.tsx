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
          setScreen('attract');
        })
        .catch(err => {
          console.error(err);
          setScreen('join');
        });
    } else {
      setScreen('join');
    }
  }, [setScreen, setSession]);

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

export default function App() {
  return (
    <KioskProvider>
      <KioskApp />
    </KioskProvider>
  )
}
