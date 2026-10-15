import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { ErrorBanner, PageHeader } from '../components/Page'
import DashboardPage from './DashboardPage'
import { blockchain, friendlyError } from '../blockchain/contract'
import { useAuth } from '../context/AuthContext'
import type { Facility, User } from '../api/types'
import { roleLabel } from '../utils/format'

export default function AdminDashboardPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<'CAMP_MANAGER' | 'WAREHOUSE_MANAGER' | 'TRANSPORT_OFFICER' | 'ADMIN'>('CAMP_MANAGER')
  const [walletAddress, setWalletAddress] = useState('')
  const [selectedFacilityId, setSelectedFacilityId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)

  const [facilities, setFacilities] = useState<Facility[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [assignSelections, setAssignSelections] = useState<Record<string, string>>({})

  const loadData = async () => {
    try {
      const [f, u] = await Promise.all([
        api.get<Facility[]>('/facilities'),
        api.get<User[]>('/users'),
      ])
      setFacilities(f)
      setUsers(u)
    } catch (err) {
      console.error('Failed to load admin management data', err)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const camps = facilities.filter((f) => f.type === 'CAMP')
  const warehouses = facilities.filter((f) => f.type === 'WAREHOUSE')

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setBusy(true)
    try {
      if (!user?.walletAddress) {
        throw new Error('Your admin account is not linked to a wallet address. Please sign out and sign up again.')
      }

      // 1. Grant the role on the blockchain
      setSuccess('Granting role on blockchain. Please confirm in MetaMask...')
      await blockchain.grantRole(role, walletAddress, user.walletAddress)

      // 2. Create the user in the backend with facility assignment
      setSuccess('Role granted! Creating user profile...')
      await api.post('/admin/users', {
        email,
        password,
        fullName,
        role,
        walletAddress,
        facilityId: selectedFacilityId || null,
      })

      setSuccess('User created successfully and assigned.')
      setEmail('')
      setPassword('')
      setFullName('')
      setWalletAddress('')
      setSelectedFacilityId('')
      await loadData()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (
        msg.includes('MetaMask') ||
        msg.includes('revert') ||
        msg.includes('network') ||
        msg.includes('wallet') ||
        msg.includes('user rejected') ||
        msg.includes('denied transaction')
      ) {
        setError(friendlyError(err))
      } else {
        setError(msg)
      }
      setSuccess('')
    } finally {
      setBusy(false)
    }
  }

  const handleAssignUser = async (userId: string, targetFacilityId: string) => {
    setError('')
    setSuccess('')
    setBusy(true)
    try {
      await api.post(`/admin/users/${userId}/assign-facility`, {
        facilityId: targetFacilityId || null,
      })
      setSuccess('Facility assigned successfully.')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign facility.')
    } finally {
      setBusy(false)
    }
  }

  const manageableUsers = users.filter((u) => u.role !== 'ADMIN')

  return (
    <div>
      <PageHeader title="Admin Dashboard" />

      {error && <ErrorBanner message={error} />}
      {success && (
        <div className="badge" style={{ backgroundColor: 'green', color: 'white', padding: '10px', marginBottom: '15px' }}>
          {success}
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <h3>Create New User</h3>
          <form onSubmit={handleCreateUser}>
            <label>Full Name</label>
            <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} />

            <label>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />

            <label>Password</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />

            <label>Role</label>
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value as typeof role)
                setSelectedFacilityId('')
              }}
            >
              <option value="CAMP_MANAGER">Camp Manager</option>
              <option value="WAREHOUSE_MANAGER">Warehouse Manager</option>
              <option value="TRANSPORT_OFFICER">Transport Officer</option>
              <option value="ADMIN">Admin</option>
            </select>

            {role === 'CAMP_MANAGER' && (
              <label>
                Assign Camp
                <select value={selectedFacilityId} onChange={(e) => setSelectedFacilityId(e.target.value)} required>
                  <option value="">Select a Camp</option>
                  {camps.map((c) => {
                    const currentMgr = users.find((u) => u.id === c.managerUserId)
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} {currentMgr ? `(Current Mgr: ${currentMgr.fullName})` : '(Available)'}
                      </option>
                    )
                  })}
                </select>
              </label>
            )}

            {role === 'WAREHOUSE_MANAGER' && (
              <label>
                Assign Warehouse
                <select value={selectedFacilityId} onChange={(e) => setSelectedFacilityId(e.target.value)} required>
                  <option value="">Select a Warehouse</option>
                  {warehouses.map((w) => {
                    const currentMgr = users.find((u) => u.id === w.managerUserId)
                    return (
                      <option key={w.id} value={w.id}>
                        {w.name} {currentMgr ? `(Current Mgr: ${currentMgr.fullName})` : '(Available)'}
                      </option>
                    )
                  })}
                </select>
              </label>
            )}

            {role === 'TRANSPORT_OFFICER' && (
              <label>
                Assign Warehouse (Base Station)
                <select value={selectedFacilityId} onChange={(e) => setSelectedFacilityId(e.target.value)} required>
                  <option value="">Select a Warehouse</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label>Wallet Address (Required for Blockchain Actions)</label>
            <input
              type="text"
              required
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="0x..."
            />

            <button type="submit" style={{ marginTop: '1rem' }} disabled={busy}>
              {busy ? 'Processing...' : 'Create Account'}
            </button>
          </form>
        </div>

        <div className="card">
          <h3>Staff & Officer Facility Assignments</h3>
          <p className="muted">
            Assign or reassign Camp Managers, Warehouse Managers, and Transport Officers to their available facilities.
          </p>

          <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Current Facility</th>
                  <th>Assign to Facility</th>
                </tr>
              </thead>
              <tbody>
                {manageableUsers.map((u) => {
                  const assignedFacility = facilities.find(
                    (f) => f.id === u.facilityId || f.managerUserId === u.id
                  )
                  const availableOptions = u.role === 'CAMP_MANAGER' ? camps : warehouses
                  const selectedId = assignSelections[u.id] ?? (assignedFacility?.id || '')

                  return (
                    <tr key={u.id}>
                      <td>
                        <strong>{u.fullName}</strong>
                        <br />
                        <span className="muted">{u.email}</span>
                      </td>
                      <td>
                        <span className="pill">{roleLabel(u.role)}</span>
                      </td>
                      <td>
                        {assignedFacility ? (
                          <span className="pill ok">
                            {assignedFacility.name} ({assignedFacility.type})
                          </span>
                        ) : (
                          <span className="pill" style={{ backgroundColor: '#f39c12', color: '#fff' }}>
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <select
                            style={{ padding: '0.25rem', fontSize: '0.8rem' }}
                            value={selectedId}
                            onChange={(e) =>
                              setAssignSelections({ ...assignSelections, [u.id]: e.target.value })
                            }
                          >
                            <option value="">-- Choose facility --</option>
                            {availableOptions.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            disabled={busy || selectedId === (assignedFacility?.id || '')}
                            onClick={() => handleAssignUser(u.id, selectedId)}
                          >
                            Assign
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {manageableUsers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      No managers or transport officers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <DashboardPage />
      </div>
    </div>
  )
}
