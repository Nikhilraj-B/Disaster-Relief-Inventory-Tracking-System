import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ErrorBanner } from '../components/Page'

export default function LoginPage() {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role] = useState('ADMIN')
  const [walletAddress, setWalletAddress] = useState('')
  
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (isLogin) {
        await login(email, password)
      } else {
        await register({ email, password, fullName, role, walletAddress })
      }
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : (isLogin ? 'Login failed' : 'Registration failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <h1>ReliefChain</h1>
        <p className="auth-sub">Blockchain-Based Disaster Relief Inventory Tracker</p>
        
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <button 
            type="button" 
            className={`btn ${isLogin ? 'btn-primary' : ''}`} 
            onClick={() => { setIsLogin(true); setError(''); }}
            style={{ flex: 1 }}
          >
            Login
          </button>
          <button 
            type="button" 
            className={`btn ${!isLogin ? 'btn-primary' : ''}`} 
            onClick={() => { setIsLogin(false); setError(''); }}
            style={{ flex: 1 }}
          >
            Sign Up
          </button>
        </div>

        {error && <ErrorBanner message={error} />}
        
        {!isLogin && (
          <>
            <label>
              Full Name
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </label>
            <label>
              Wallet Address
              <input type="text" value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} required placeholder="0x..." />
            </label>
            <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem' }}>
              Note: Public sign up is restricted to Admin accounts only.
            </p>
          </>
        )}
        
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </label>
        
        <button className="btn btn-primary" disabled={busy} style={{ marginTop: '1rem' }}>
          {busy ? 'Processing...' : (isLogin ? 'Sign in' : 'Sign up')}
        </button>
      </form>
    </div>
  )
}
