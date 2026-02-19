import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'

export default function CreateEventPage() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.events.create({ name, description })
      navigate(`/organizer/events/${data.id}`)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create event')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <Link to="/organizer" className="inline-flex items-center gap-2 text-navy/70 hover:text-navy mb-8">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-8"
      >
        <h1 className="text-2xl font-bold text-navy mb-6">Create Event</h1>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-navy mb-2">Event Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              placeholder="e.g. Annual Sports Day 2024"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-2">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-field min-h-[100px]"
              placeholder="Brief description of the event"
              rows={4}
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Creating...' : 'Create Event'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}
