import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, User, Phone } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [role, setRole] = useState<'student' | 'organizer'>('student')
  const [step, setStep] = useState<'form' | 'otp'>('form')
  const [otpCode, setOtpCode] = useState('')
  const [tempToken, setTempToken] = useState('')
  const [devOtp, setDevOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register, registerOrganizer, registerOrganizerVerify } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (role === 'organizer') {
        const res = await registerOrganizer({
          email,
          password,
          full_name: fullName,
          phone_number: phoneNumber.replace(/\D/g, ''),
        })
        if (res?.temp_token) {
          setTempToken(res.temp_token)
          setDevOtp(res.dev_otp || '')
          setStep('otp')
        }
      } else {
        await register({ email, password, full_name: fullName, role: 'student' })
        navigate('/')
      }
    } catch (err: any) {
      if (!err.response) {
        setError('Cannot connect to server. Ensure backend is running on port 8001.')
        return
      }
      const detail = err.response?.data?.detail
      const msg = Array.isArray(detail) ? detail.map((d: any) => d.msg || d).join(', ') : (detail || 'Registration failed')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await registerOrganizerVerify(tempToken, otpCode)
      navigate('/')
    } catch (err: any) {
      const detail = err.response?.data?.detail
      setError(detail || 'Invalid OTP. Please try again.')
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
            <h1 className="text-2xl font-bold text-navy">Create Account</h1>
            <p className="text-navy/70 mt-1">Join to find your event photos</p>
          </div>

          <AnimatePresence mode="wait">
            {step === 'form' ? (
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={handleSubmit}
                className="space-y-5"
              >
                {error && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                    {error}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-navy mb-2">I am a</label>
                  <div className="flex flex-col gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="role" checked={role === 'student'} onChange={() => setRole('student')} />
                      <span>Student (Find photos)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="role" checked={role === 'organizer'} onChange={() => setRole('organizer')} />
                      <span>Event Organizer</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-navy mb-2">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-navy/40" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="input-field pl-12"
                      placeholder="John Doe"
                      required
                    />
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
                      placeholder="Min 8 characters"
                      minLength={8}
                      required
                    />
                  </div>
                </div>
                {role === 'organizer' && (
                  <div>
                    <label className="block text-sm font-medium text-navy mb-2">Mobile Number (for OTP verification)</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-navy/40" />
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        className="input-field pl-12"
                        placeholder="9876543210"
                        required={role === 'organizer'}
                      />
                    </div>
                  </div>
                )}
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? (role === 'organizer' ? 'Sending OTP...' : 'Creating account...') : role === 'organizer' ? 'Send OTP' : 'Create Account'}
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="otp"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={handleOtpSubmit}
                className="space-y-5"
              >
                {error && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                    {error}
                  </div>
                )}
                <p className="text-navy/80 text-sm">
                  Enter the 6-digit OTP sent to ***{phoneNumber.slice(-4)}
                </p>
                {devOtp && (
                  <p className="text-sm font-semibold text-primary">Dev mode OTP: <span className="bg-primary/10 px-2 py-1 rounded">{devOtp}</span></p>
                )}
                <div>
                  <label className="block text-sm font-medium text-navy mb-2">OTP</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    className="input-field w-full text-center text-lg tracking-widest"
                    placeholder="000000"
                    required
                  />
                </div>
                <button type="submit" disabled={loading || otpCode.length !== 6} className="btn-primary w-full">
                  {loading ? 'Verifying...' : 'Verify & Create Account'}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('form'); setOtpCode(''); setError(''); }}
                  className="text-navy/70 text-sm hover:underline"
                >
                  ← Back
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          <p className="text-center text-navy/70 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-semibold hover:underline">Sign In</Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
