import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, Shield, User } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

type LoginAs = 'student' | 'organizer'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginAs, setLoginAs] = useState<LoginAs>('student')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password, loginAs)
      navigate(loginAs === 'organizer' ? '/organizer' : '/search')
    } catch (err: any) {
      if (!err.response) {
        setError('Cannot connect to server. Ensure backend is running on port 8001.')
      } else {
        const detail = err.response?.data?.detail
        const msg = Array.isArray(detail) ? detail.map((d: any) => d.msg || d).join(', ') : (detail || 'Login failed')
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="card p-8 md:p-10">
          <div className="text-center mb-8">
            <img src="/logo.png" alt="Rashtriya Raksha University" className="h-28 w-auto max-h-28 mx-auto mb-4 object-contain object-center bg-transparent border-0 inline-block" />
            <h1 className="text-2xl font-bold text-navy">Welcome Back</h1>
            <p className="text-navy/70 mt-1">Sign in to find your photos</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-navy mb-2">Login as</label>
              <div className="flex gap-4 p-2 rounded-xl bg-navy/5">
                <label className="flex-1 flex items-center justify-center gap-2 cursor-pointer has-[:checked]:bg-primary has-[:checked]:text-white p-3 rounded-lg transition-all">
                  <input type="radio" name="loginAs" value="student" checked={loginAs === 'student'} onChange={() => setLoginAs('student')} className="sr-only" />
                  <User className="w-5 h-5" />
                  <span className="font-medium">Student</span>
                </label>
                <label className="flex-1 flex items-center justify-center gap-2 cursor-pointer has-[:checked]:bg-primary has-[:checked]:text-white p-3 rounded-lg transition-all">
                  <input type="radio" name="loginAs" value="organizer" checked={loginAs === 'organizer'} onChange={() => setLoginAs('organizer')} className="sr-only" />
                  <Shield className="w-5 h-5" />
                  <span className="font-medium">Organizer</span>
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-navy mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-navy/40" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field pl-12"
                  placeholder="you@university.edu"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-navy mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-navy/40" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pl-12"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-navy/70 mt-6">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="text-primary font-semibold hover:underline">Register</Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
