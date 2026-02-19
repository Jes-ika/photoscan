import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search } from 'lucide-react'

export default function MyPhotosPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-12 text-center"
      >
        <Search className="w-16 h-16 text-primary/60 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-navy mb-2">Find Your Event Photos</h2>
        <p className="text-navy/70 mb-6">Use face search to find all photos of you from university events.</p>
        <Link to="/search" className="btn-primary inline-flex items-center gap-2">
          <Search className="w-5 h-5" /> Go to Photo Search
        </Link>
      </motion.div>
    </div>
  )
}
