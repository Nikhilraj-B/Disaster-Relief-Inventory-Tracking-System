import { createContext, useContext, useState, type ReactNode } from 'react'
import { api, clearToken, getToken, setToken } from '../api/client'
import type { AuthResponse } from '../api/types'

interface AuthContextValue {
  token: string | null
  user: AuthResponse | null
  login: (email: string, password: string) => Promise<void>
  register: (data: {
    email: string
    password: string
    fullName: string
    role: string
    walletAddress?: string
  }) => Promise<void>
  linkWallet: (walletAddress: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function loadUser(): AuthResponse | null {
  const raw = localStorage.getItem('dr_user')
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthResponse
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(getToken())
  const [user, setUser] = useState<AuthResponse | null>(loadUser())

  const persist = (res: AuthResponse) => {
    setToken(res.token)
    localStorage.setItem('dr_user', JSON.stringify(res))
    setTokenState(res.token)
    setUser(res)
  }

  const login = async (email: string, password: string) => {
    const res = await api.post<AuthResponse>('/auth/login', { email, password })
    persist(res)
  }

  const register = async (data: {
    email: string
    password: string
    fullName: string
    role: string
    walletAddress?: string
  }) => {
    const res = await api.post<AuthResponse>('/auth/register', data)
    persist(res)
  }

  /** Links the authenticated account to a connected MetaMask wallet (server returns updated user). */
  const linkWallet = async (walletAddress: string) => {
    const res = await api.put<AuthResponse>('/users/me/wallet', { walletAddress })
    persist(res)
  }

  const logout = () => {
    clearToken()
    localStorage.removeItem('dr_user')
    setTokenState(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ token, user, login, register, linkWallet, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
