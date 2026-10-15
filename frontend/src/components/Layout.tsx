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
  { to: '/admin', label: 'Dashboard', roles: ['ADMIN'] },
  { to: '/camp-manager', label: 'Dashboard', roles: ['CAMP_MANAGER'] },
  { to: '/warehouse-manager', label: 'Dashboard', roles: ['WAREHOUSE_MANAGER'] },
  { to: '/transport-officer', label: 'Dashboard', roles: ['TRANSPORT_OFFICER'] },
  { to: '/facilities', label: 'Facilities', roles: ['ADMIN'] },
  { to: '/relief-items', label: 'Relief Items', roles: ['ADMIN', 'WAREHOUSE_MANAGER', 'CAMP_MANAGER'] },
  { to: '/inventory', label: 'Inventory', roles: ['ADMIN', 'WAREHOUSE_MANAGER', 'CAMP_MANAGER'] },
  { to: '/vehicles', label: 'Vehicles', roles: ['ADMIN', 'TRANSPORT_OFFICER'] },
  { to: '/supply-requests', label: 'Supply Requests', roles: ['ADMIN', 'WAREHOUSE_MANAGER', 'CAMP_MANAGER', 'TRANSPORT_OFFICER'] },
  { to: '/shipments', label: 'Shipments', roles: ['ADMIN', 'WAREHOUSE_MANAGER', 'TRANSPORT_OFFICER'] },
  { to: '/audit', label: 'Audit Trail', roles: ['ADMIN'] },
  { to: '/notifications', label: 'Notifications', roles: ['ADMIN', 'WAREHOUSE_MANAGER', 'CAMP_MANAGER', 'TRANSPORT_OFFICER'] },
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
