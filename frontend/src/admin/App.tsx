import React from 'react'
import AdminDashboard from './components/AdminDashboard'
import { ToastProvider } from './context/ToastContext'
import './styles.css'

export default function App() {
  return (
    <ToastProvider>
      <AdminDashboard />
    </ToastProvider>
  )
}
