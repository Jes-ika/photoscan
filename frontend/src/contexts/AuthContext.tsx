import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { api } from '../lib/api'

const API_BASE = '/api'

export interface User {
  id: number
  email: string
  full_name: string
  role: 'student' | 'organizer' | 'admin'
  is_active: boolean
  face_registered: boolean
  totp_enabled?: boolean
  phone_number?: string
  created_at: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, password: string, loginAs?: string) => Promise<void>
  register: (data: { email: string; password: string; full_name: string; role?: string }) => Promise<void>
  registerOrganizer: (data: { email: string; password: string; full_name: string; phone_number: string }) => Promise<{ temp_token: string; dev_otp?: string } | void>
  registerOrganizerVerify: (tempToken: string, code: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  const setAuthHeader = useCallback((t: string | null) => {
    if (t) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${t}`
    } else {
      delete axios.defaults.headers.common['Authorization']
    }
  }, [])

  useEffect(() => {
    setAuthHeader(token)
    if (token) {
      axios.get(`${API_BASE}/auth/me`)
        .then(({ data }) => setUser(data))
        .catch(() => {
          localStorage.removeItem('token')
          setToken(null)
          setUser(null)
        })
        .finally(() => setLoading(false))
    } else {
      setUser(null)
      setLoading(false)
    }
  }, [token, setAuthHeader])

  const refreshUser = useCallback(async () => {
    if (!token) return
    const { data } = await axios.get(`${API_BASE}/auth/me`)
    setUser(data)
  }, [token])

  const login = async (email: string, password: string, loginAs?: string) => {
    const { data } = await axios.post(`${API_BASE}/auth/login`, { email, password, login_as: loginAs || 'student' })
    localStorage.setItem('token', data.access_token)
    setToken(data.access_token)
    setUser(data.user)
    setAuthHeader(data.access_token)
  }

  const registerOrganizer = async (data: { email: string; password: string; full_name: string; phone_number: string }) => {
    const { data: res } = await api.auth.registerOrganizerSendOtp(data)
    return { temp_token: res.temp_token, dev_otp: res.dev_otp }
  }

  const registerOrganizerVerify = async (tempToken: string, code: string) => {
    const { data } = await api.auth.registerOrganizerVerify(tempToken, code)
    localStorage.setItem('token', data.access_token)
    setToken(data.access_token)
    setUser(data.user)
    setAuthHeader(data.access_token)
  }

  const register = async (data: { email: string; password: string; full_name: string; role?: string }) => {
    const res = await axios.post(`${API_BASE}/auth/register`, data)
    localStorage.setItem('token', res.data.access_token)
    setToken(res.data.access_token)
    setUser(res.data.user)
    setAuthHeader(res.data.access_token)
  }

  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
    setAuthHeader(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, registerOrganizer, registerOrganizerVerify, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
