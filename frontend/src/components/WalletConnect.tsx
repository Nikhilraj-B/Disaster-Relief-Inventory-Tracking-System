import { useEffect, useState } from 'react'
import { BrowserProvider } from 'ethers'
import { useAuth } from '../context/AuthContext'

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
      on?: (event: string, handler: () => void) => void
      removeListener?: (event: string, handler: () => void) => void
    }
  }
}

export default function WalletConnect({
  onAddress,
}: {
  onAddress?: (address: string) => void
}) {
  const { user, linkWallet } = useAuth()
  const [address, setAddress] = useState('')
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [linking, setLinking] = useState(false)

  useEffect(() => {
    if (window.ethereum?.on) {
      const handler = () => setConnected(false)
      window.ethereum.on('accountsChanged', handler)
      return () => window.ethereum?.removeListener?.('accountsChanged', handler)
    }
  }, [])

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
      setError(err instanceof Error ? err.message : 'Wallet connection failed')
    } finally {
      setBusy(false)
    }
  }

  const linked =
    connected && !!user && user.walletAddress?.toLowerCase() === address.toLowerCase()

  const link = async () => {
    if (!connected || !address || !user) return
    setError('')
    setLinking(true)
    try {
      await linkWallet(address)
      setError('Wallet linked to your account.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link wallet')
    } finally {
      setLinking(false)
    }
  }

  return (
    <div className="wallet-connect">
      {connected ? (
        <div className="wallet-connected">
          <span className="wallet-dot" />
          <code className="cid">{address.slice(0, 8)}...{address.slice(-6)}</code>
          {linked ? (
            <span className="muted"> (linked)</span>
          ) : user ? (
            <button className="btn btn-outline btn-sm" onClick={link} disabled={busy || linking}>
              {linking ? 'Linking...' : 'Link wallet to account'}
            </button>
          ) : (
            <span className="muted"> (not linked to account)</span>
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