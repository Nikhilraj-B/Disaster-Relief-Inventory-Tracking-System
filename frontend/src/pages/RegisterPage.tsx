import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ErrorBanner } from '../components/Page'
import WalletConnect from '../components/WalletConnect'
import type { Role } from '../api/types'

const ROLES: { value: Role; label: string }[] = [
  { value: 'GOVERNMENT_ADMIN', label: 'Government Admin' },
  { value: 'WAREHOUSE_MANAGER', label: 'Warehouse Manager' },
  { value: 'CAMP_MANAGER', label: 'Camp Manager' },
  { value: 'NGO_COORDINATOR', label: 'NGO Coordinator' },
  { value: 'TRANSPORT_OFFICER', label: 'Transport Officer' },
]

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<Role>('NGO_COORDINATOR')
  const [walletAddress, setWalletAddress] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await register({ email, password, fullName, role, walletAddress: walletAddress || undefined })
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <h1>ReliefChain</h1>
        <p className="auth-sub">Create an account</p>
        {error && <ErrorBanner message={error} />}
        <label>
          Full name
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
        </label>
        <label>
          Role
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Wallet address (optional)
          <input
            type="text"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            placeholder="0x..."
          />
        </label>
        <WalletConnect
          onAddress={(addr) => {
            setWalletAddress(addr)
          }}
        />
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Creating...' : 'Register'}
        </button>
        <p className="auth-alt">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  )
}
