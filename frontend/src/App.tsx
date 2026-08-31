import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import OrganizationsPage from './pages/OrganizationsPage'
import FacilitiesPage from './pages/FacilitiesPage'
import ReliefItemsPage from './pages/ReliefItemsPage'
import InventoryPage from './pages/InventoryPage'
import VehiclesPage from './pages/VehiclesPage'
import SupplyRequestsPage from './pages/SupplyRequestsPage'
import ShipmentsPage from './pages/ShipmentsPage'
import AuditPage from './pages/AuditPage'
import NotificationsPage from './pages/NotificationsPage'
import './App.css'

function Protected() {
  const { token } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  return <Layout />
}

function AuthGuard() {
  const { token } = useAuth()
  if (token) return <Navigate to="/dashboard" replace />
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AuthGuard />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>
          <Route path="/" element={<Protected />}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="organizations" element={<OrganizationsPage />} />
            <Route path="facilities" element={<FacilitiesPage />} />
            <Route path="relief-items" element={<ReliefItemsPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="vehicles" element={<VehiclesPage />} />
            <Route path="supply-requests" element={<SupplyRequestsPage />} />
            <Route path="shipments" element={<ShipmentsPage />} />
            <Route path="audit" element={<AuditPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route index element={<Navigate to="/dashboard" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
