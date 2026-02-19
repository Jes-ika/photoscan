import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Calendar, Image, HardDrive, Shield } from 'lucide-react'
import { api } from '../lib/api'

interface StorageUsage {
  used_gb: number
  limit_gb: number
  used_percent: number
  remaining_gb: number
}

interface Event {
  id: number
  name: string
  description: string | null
  event_date: string | null
  status: string
  cover_image_url: string | null
  photo_count: number
  created_at: string
}

export default function OrganizerDashboard() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [storage, setStorage] = useState<StorageUsage | null>(null)

  useEffect(() => {
    api.events.list()
      .then(({ data }) => setEvents(data))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    api.events.storageUsage()
      .then(({ data }) => setStorage(data))
      .catch(() => setStorage(null))
  }, [])

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h1 className="text-3xl font-bold text-navy">Event Dashboard</h1>
          <p className="text-navy/70 mt-1">Manage your events and upload photos</p>
        </motion.div>
        <div className="flex items-center gap-4 flex-wrap">
          {storage && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-navy/5 border border-primary/20">
              <HardDrive className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-navy">
                  {storage.used_gb} GB / {storage.limit_gb} GB
                </p>
                <div className="w-24 h-1.5 bg-navy/10 rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${Math.min(storage.used_percent, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}
          <Link to="/profile" className="btn-outline inline-flex items-center gap-2">
            <Shield className="w-5 h-5" /> 2FA Settings
          </Link>
          <Link to="/organizer/events/new" className="btn-primary inline-flex items-center gap-2">
            <Plus className="w-5 h-5" /> New Event
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
              <div className="h-4 bg-gray-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-12 text-center"
        >
          <Calendar className="w-16 h-16 text-navy/40 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-navy mb-2">No events yet</h2>
          <p className="text-navy/70 mb-6">Create your first event to start uploading photos</p>
          <Link to="/organizer/events/new" className="btn-primary inline-flex items-center gap-2">
            <Plus className="w-5 h-5" /> Create Event
          </Link>
        </motion.div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((e, i) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link to={`/organizer/events/${e.id}`} className="card block overflow-hidden group">
                <div className="aspect-video bg-gradient-to-br from-primary/20 to-navy/20 flex items-center justify-center">
                  {e.cover_image_url ? (
                    <img src={e.cover_image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <Image className="w-16 h-16 text-navy/30" />
                  )}
                </div>
                <div className="p-5">
                  <h3 className="font-semibold text-navy truncate">{e.name}</h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-navy/60">
                    <span className="flex items-center gap-1">
                      <Image className="w-4 h-4" /> {e.photo_count} photos
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      e.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {e.status}
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
