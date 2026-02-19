import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LayoutDashboard, Search, User, LogOut, Menu } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/')
    setMobileMenuOpen(false)
  }

  return (
    <div className="min-h-screen">
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <Link to="/" className="flex items-center gap-2 group">
              <img src="/logo.png" alt="Rashtriya Raksha University" className="h-12 w-auto max-h-12 object-contain object-center bg-transparent border-0 flex-shrink-0 group-hover:scale-105 transition-transform" />
              <span className="font-bold text-xl text-navy hidden sm:block">UniPhotos</span>
            </Link>

            <div className="hidden md:flex items-center gap-6">
              <Link to="/" className="text-navy/80 hover:text-primary font-medium transition-colors">Home</Link>
              {user ? (
                <>
                  <Link to="/search" className="text-navy/80 hover:text-primary font-medium transition-colors flex items-center gap-1">
                    <Search className="w-4 h-4" /> Find Photos
                  </Link>
                  {(user.role === 'organizer' || user.role === 'admin') && (
                    <Link to="/organizer" className="text-navy/80 hover:text-primary font-medium transition-colors flex items-center gap-1">
                      <LayoutDashboard className="w-4 h-4" /> Dashboard
                    </Link>
                  )}
                  <Link to="/profile" className="text-navy/80 hover:text-primary font-medium transition-colors flex items-center gap-1">
                    <User className="w-4 h-4" /> Profile
                  </Link>
                  <button onClick={handleLogout} className="flex items-center gap-1 text-red-600 hover:text-red-700 font-medium">
                    <LogOut className="w-4 h-4" /> Logout
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="btn-outline py-2 text-sm">Login</Link>
                  <Link to="/register" className="btn-primary py-2 text-sm">Register</Link>
                </>
              )}
            </div>

            <button
              className="md:hidden p-2 rounded-lg hover:bg-navy/5"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu className="w-6 h-6 text-navy" />
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-white/20 bg-white/50 backdrop-blur-lg"
          >
            <div className="px-4 py-4 space-y-2">
              <Link to="/" className="block py-2 text-navy font-medium" onClick={() => setMobileMenuOpen(false)}>Home</Link>
              {user ? (
                <>
                  <Link to="/search" className="block py-2 text-navy font-medium" onClick={() => setMobileMenuOpen(false)}>Find Photos</Link>
                  {(user.role === 'organizer' || user.role === 'admin') && (
                    <Link to="/organizer" className="block py-2 text-navy font-medium" onClick={() => setMobileMenuOpen(false)}>Dashboard</Link>
                  )}
                  <Link to="/profile" className="block py-2 text-navy font-medium" onClick={() => setMobileMenuOpen(false)}>Profile</Link>
                  <button onClick={handleLogout} className="block py-2 text-red-600 font-medium w-full text-left">Logout</button>
                </>
              ) : (
                <>
                  <Link to="/login" className="block py-2 text-navy font-medium" onClick={() => setMobileMenuOpen(false)}>Login</Link>
                  <Link to="/register" className="block py-2 text-primary font-medium" onClick={() => setMobileMenuOpen(false)}>Register</Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </nav>

      <main className="pt-16 md:pt-20">
        {children}
      </main>
    </div>
  )
}
