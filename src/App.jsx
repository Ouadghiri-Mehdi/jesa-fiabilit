// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import Layout from './components/layout/Layout'
import LoginPage from './components/login/LoginPage'
import HubPage from './components/hub/HubPage'
import GlobalViewPage from './components/global/GlobalViewPage'
import TUMPage from './components/tum/TUMPage'
import RCAPage from './components/rca/RCAPage'
import ActionsPage from './components/actions/ActionsPage'
import HistoriquePage from './components/historique/HistoriquePage'
import DashboardPage from './components/dashboard/DashboardPage'

function PrivateRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route path="/hub" element={
        <PrivateRoute><HubPage /></PrivateRoute>
      } />

      <Route path="/global" element={
        <PrivateRoute><GlobalViewPage /></PrivateRoute>
      } />

      <Route path="/" element={
        <PrivateRoute><Layout /></PrivateRoute>
      }>
        <Route index element={<Navigate to="/tum" replace />} />
        <Route path="tum" element={<TUMPage />} />
        <Route path="rca" element={<RCAPage />} />
        <Route path="rca/:equipId" element={<RCAPage />} />
        <Route path="actions" element={<ActionsPage />} />
        <Route path="historique" element={<HistoriquePage />} />
        <Route path="historique/:equipId" element={<HistoriquePage />} />
        <Route path="dashboard" element={<DashboardPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
