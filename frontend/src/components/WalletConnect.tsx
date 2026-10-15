import { useEffect, useState } from 'react'
import { BrowserProvider } from 'ethers'
import { useAuth } from '../context/AuthContext'

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
      on?: (event: string, handler: (...args: any[]) => void) => void
      removeListener?: (event: string, handler: (...args: any[]) => void) => void
    }
  }
}

export default function WalletConnect({
  onAddress,
}: {
  onAddress?: (address: string) => void
}) {
  const { user } = useAuth()
  const [address, setAddress] = useState('')
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (window.ethereum?.on) {
      const handler = (accounts: unknown) => {
        const accs = accounts as string[]
        if (accs && accs.length > 0) {
          setAddress(accs[0])
          setConnected(true)
          onAddress?.(accs[0])
        } else {
          setConnected(false)
          setAddress('')
        }
      }
      window.ethereum.on('accountsChanged', handler)
      return () => window.ethereum?.removeListener?.('accountsChanged', handler)
    }
  }, [onAddress])

  const connect = async () => {
    setError('')
    setBusy(true)
    try {
      if (!window.ethereum) {
        setError('MetaMask is not installed. Install it from https://metamask.io')
        return
      }
      const provider = new BrowserProvider(window.ethereum)
      await provider.send('eth_requestAccounts', [])
      const signer = await provider.getSigner()
      const addr = await signer.getAddress()
      setAddress(addr)
      setConnected(true)
      onAddress?.(addr)
    } catch (err) {
      console.error('Wallet connection error:', err)
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message || 'Wallet connection failed'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  const switchAccount = async () => {
    setError('')
    try {
      if (window.ethereum?.request) {
        await window.ethereum.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }],
        })
        await connect()
      }
    } catch (err) {
      console.error('Switch account error:', err)
    }
  }

  const linked =
    connected && !!user && user.walletAddress?.toLowerCase() === address.toLowerCase()

  return (
    <div className="wallet-connect">
      {connected ? (
        <div className="wallet-connected" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="wallet-dot" />
          <code className="cid" title={`Connected: ${address}`}>
            {address.slice(0, 8)}...{address.slice(-6)}
          </code>
          {linked ? (
            <span className="muted" style={{ color: '#27ae60' }}> (matches account ✓)</span>
          ) : user ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="error-text">
                (mismatch: switch to {user.walletAddress ? `${user.walletAddress.slice(0, 6)}...` : 'registered wallet'} in MetaMask)
              </span>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                onClick={switchAccount}
                title="Select matching account in MetaMask"
              >
                Switch Account
              </button>
            </span>
          ) : (
            <span className="muted"> (ready to use)</span>
          )}
        </div>
      ) : (
        <button className="btn btn-outline btn-sm" onClick={connect} disabled={busy}>
          {busy ? 'Connecting...' : 'Connect MetaMask'}
        </button>
      )}
      {error && <p className="error-text">{error}</p>}
    </div>
  )
}