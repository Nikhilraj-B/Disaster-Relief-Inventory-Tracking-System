import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import WalletConnect from './WalletConnect'
import { roleLabel } from '../utils/format'
import type { Role } from '../api/types'

interface NavItem {
  to: string
  label: string
  roles?: Role[]
}

const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', roles: ['GOVERNMENT_ADMIN', 'WAREHOUSE_MANAGER', 'CAMP_MANAGER', 'TRANSPORT_OFFICER', 'NGO_COORDINATOR'] },
  { to: '/organizations', label: 'Organizations', roles: ['GOVERNMENT_ADMIN', 'NGO_COORDINATOR'] },
  { to: '/facilities', label: 'Facilities', roles: ['GOVERNMENT_ADMIN', 'WAREHOUSE_MANAGER', 'CAMP_MANAGER'] },
  { to: '/relief-items', label: 'Relief Items', roles: ['GOVERNMENT_ADMIN', 'WAREHOUSE_MANAGER', 'CAMP_MANAGER', 'NGO_COORDINATOR'] },
  { to: '/inventory', label: 'Inventory', roles: ['GOVERNMENT_ADMIN', 'WAREHOUSE_MANAGER'] },
  { to: '/vehicles', label: 'Vehicles', roles: ['GOVERNMENT_ADMIN', 'TRANSPORT_OFFICER'] },
  { to: '/supply-requests', label: 'Supply Requests', roles: ['GOVERNMENT_ADMIN', 'WAREHOUSE_MANAGER', 'CAMP_MANAGER', 'TRANSPORT_OFFICER'] },
  { to: '/shipments', label: 'Shipments', roles: ['GOVERNMENT_ADMIN', 'WAREHOUSE_MANAGER', 'TRANSPORT_OFFICER'] },
  { to: '/audit', label: 'Audit Trail', roles: ['GOVERNMENT_ADMIN'] },
  { to: '/notifications', label: 'Notifications', roles: ['GOVERNMENT_ADMIN', 'WAREHOUSE_MANAGER', 'CAMP_MANAGER', 'TRANSPORT_OFFICER', 'NGO_COORDINATOR'] },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  const visible = NAV.filter((item) => !item.roles || item.roles.includes(user.role))

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <h1>ReliefChain</h1>
          <p>Disaster Relief Tracker</p>
        </div>
        <nav className="nav">
          {visible.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="content">
        <header className="topbar">
          <div className="topbar-user">
            <span className="user-name">{user.fullName}</span>
            <span className="user-role">{roleLabel(user.role)}</span>
            {user.walletAddress && (
              <span className="wallet-badge" title={user.walletAddress}>
                {user.walletAddress.slice(0, 6)}...{user.walletAddress.slice(-4)}
              </span>
            )}
          </div>
          <WalletConnect />
          <button className="btn btn-outline" onClick={() => { logout(); navigate('/login') }}>
            Sign out
          </button>
        </header>
        <Outlet />
      </main>
    </div>
  )
}
