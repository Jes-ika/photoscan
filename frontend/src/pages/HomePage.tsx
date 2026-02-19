import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Calendar, Sparkles, ArrowRight } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function HomePage() {
  const { user } = useAuth()

  return (
    <div className="relative overflow-hidden">
      {/* Hero gradient background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-navy/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-4xl mx-auto"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center gap-4 mb-6"
          >
            <img src="/logo.png" alt="Rashtriya Raksha University" className="h-32 w-auto max-h-32 object-contain object-center bg-transparent border-0 inline-block" />
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-medium">
              <Sparkles className="w-4 h-4" /> AI-Powered Face Recognition
            </span>
          </motion.div>
          <h1 className="text-4xl md:text-6xl font-bold text-navy mb-6 leading-tight">
            Find Your Photos in
            <span className="block text-primary">University Events</span>
          </h1>
          <p className="text-xl text-navy/70 mb-10 max-w-2xl mx-auto">
            Upload your selfie, and our AI will instantly find every photo of you from university events. 
            Fast, accurate, and private.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {user ? (
              <>
                <Link to="/search" className="btn-primary inline-flex items-center justify-center gap-2">
                  <Search className="w-5 h-5" /> Find My Photos
                </Link>
                {(user.role === 'organizer' || user.role === 'admin') && (
                  <Link to="/organizer" className="btn-secondary inline-flex items-center justify-center gap-2">
                    <Calendar className="w-5 h-5" /> Organizer Dashboard
                  </Link>
                )}
              </>
            ) : (
              <>
                <Link to="/register" className="btn-primary inline-flex items-center justify-center gap-2">
                  Get Started <ArrowRight className="w-5 h-5" />
                </Link>
                <Link to="/login" className="btn-outline inline-flex items-center justify-center gap-2">
                  Sign In
                </Link>
              </>
            )}
          </div>
        </motion.div>
      </section>
    </div>
  )
}
