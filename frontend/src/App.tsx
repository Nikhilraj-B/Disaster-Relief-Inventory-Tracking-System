import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import CampManagerDashboardPage from './pages/CampManagerDashboardPage'
import WarehouseManagerDashboardPage from './pages/WarehouseManagerDashboardPage'
import TransportOfficerDashboardPage from './pages/TransportOfficerDashboardPage'
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
  if (token) return <Navigate to="/" replace />
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

function RoleRouter() {
  const { user } = useAuth()
  if (!user) return <div>Loading...</div>
  switch (user.role) {
    case 'ADMIN': return <Navigate to="/admin" replace />
    case 'CAMP_MANAGER': return <Navigate to="/camp-manager" replace />
    case 'WAREHOUSE_MANAGER': return <Navigate to="/warehouse-manager" replace />
    case 'TRANSPORT_OFFICER': return <Navigate to="/transport-officer" replace />
    default: return <div>Unknown Role</div>
  }
}

function RoleGuard({ allowedRole, children }: { allowedRole: string, children: React.ReactElement }) {
  const { user } = useAuth()
  if (user?.role !== allowedRole) return <Navigate to="/" replace />
  return children
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AuthGuard />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>
          <Route path="/" element={<Protected />}>
            <Route index element={<RoleRouter />} />
            
            <Route path="admin" element={<RoleGuard allowedRole="ADMIN"><AdminDashboardPage /></RoleGuard>} />
            <Route path="camp-manager" element={<RoleGuard allowedRole="CAMP_MANAGER"><CampManagerDashboardPage /></RoleGuard>} />
            <Route path="warehouse-manager" element={<RoleGuard allowedRole="WAREHOUSE_MANAGER"><WarehouseManagerDashboardPage /></RoleGuard>} />
            <Route path="transport-officer" element={<RoleGuard allowedRole="TRANSPORT_OFFICER"><TransportOfficerDashboardPage /></RoleGuard>} />
            
            <Route path="organizations" element={<OrganizationsPage />} />
            <Route path="facilities" element={<RoleGuard allowedRole="ADMIN"><FacilitiesPage /></RoleGuard>} />
            <Route path="relief-items" element={<ReliefItemsPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="vehicles" element={<VehiclesPage />} />
            <Route path="supply-requests" element={<SupplyRequestsPage />} />
            <Route path="shipments" element={<ShipmentsPage />} />
            <Route path="audit" element={<AuditPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
