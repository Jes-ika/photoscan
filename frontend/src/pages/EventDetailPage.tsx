import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowLeft, Upload, Trash2, Image, Loader2, CheckCircle, XCircle, Copy } from 'lucide-react'
import { api } from '../lib/api'

interface Photo {
  id: number
  file_path: string
  thumbnail_path: string | null
  face_count: number
  processing_status: string
  created_at: string
}

interface Event {
  id: number
  name: string
  description: string | null
  status: string
  access_code?: string | null
  photos: Photo[]
}

export default function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<{ processed: number; total: number } | null>(null)

  const loadEvent = useCallback(() => {
    if (!eventId) return
    api.events.get(Number(eventId))
      .then(({ data }) => setEvent(data))
      .catch(() => setEvent(null))
      .finally(() => setLoading(false))
  }, [eventId])

  useEffect(() => {
    loadEvent()
  }, [loadEvent])

  useEffect(() => {
    if (!eventId || !event?.photos?.length) return
    const interval = setInterval(async () => {
      try {
        const { data } = await api.events.processingStatus(Number(eventId))
        setProcessingStatus({ processed: data.processed_photos, total: data.total_photos })
        if (data.progress_percent < 100) loadEvent()
      } catch {
        clearInterval(interval)
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [eventId, event?.photos?.length, loadEvent])

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length || !eventId) return
    setUploading(true)
    try {
      await api.photos.upload(Number(eventId), Array.from(files))
      loadEvent()
    } catch (err) {
      alert('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (photoId: number) => {
    if (!confirm('Delete this photo?')) return
    try {
      await api.photos.delete(photoId)
      loadEvent()
    } catch {
      alert('Delete failed')
    }
  }

  const handlePublish = async () => {
    if (!eventId) return
    try {
      await api.events.update(Number(eventId), { status: 'published' })
      loadEvent()
    } catch {
      alert('Failed to publish')
    }
  }

  if (loading || !event) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 flex justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    )
  }

  const pendingCount = event.photos?.filter((p) => p.processing_status !== 'completed').length || 0

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <Link to="/organizer" className="inline-flex items-center gap-2 text-navy/70 hover:text-navy mb-8">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-navy">{event.name}</h1>
            <p className="text-navy/70 mt-1">{event.photos?.length || 0} photos</p>
            <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium ${
              event.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
            }`}>
              {event.status}
            </span>
          </div>
          {event.status !== 'published' && (
            <button onClick={handlePublish} className="btn-primary">
              Publish Event
            </button>
          )}
        </div>
        {event.access_code && (
          <div className="mt-6 p-6 rounded-xl bg-navy/5 border border-navy/10 flex flex-col sm:flex-row items-center gap-6">
            <div className="flex flex-col items-center">
              <QRCodeSVG value={`${window.location.origin}/search?code=${event.access_code}`} size={160} level="M" />
              <p className="text-xs text-navy/60 mt-2">Scan to find photos</p>
            </div>
            <div>
              <p className="text-sm font-medium text-navy mb-1">Event access code</p>
              <p className="text-2xl font-bold tracking-widest font-mono text-primary">{event.access_code}</p>
              <p className="text-xs text-navy/60 mt-1">Share this code with attendees to find their photos</p>
              <button
                onClick={() => { navigator.clipboard?.writeText(event.access_code!); alert('Code copied!'); }}
                className="mt-2 text-sm text-primary hover:underline flex items-center gap-1"
              >
                <Copy className="w-4 h-4" /> Copy code
              </button>
            </div>
          </div>
        )}
        {processingStatus && pendingCount > 0 && (
          <div className="mt-4 p-4 rounded-xl bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 text-primary font-medium mb-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Processing faces...
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${(processingStatus.processed / processingStatus.total) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="text-sm text-navy/70 mt-2">{processingStatus.processed} / {processingStatus.total} processed</p>
          </div>
        )}
      </motion.div>

      {/* Upload zone */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => document.getElementById('file-input')?.click()}
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all mb-8
          ${dragActive ? 'border-primary bg-primary/5' : 'border-navy/20 hover:border-primary/40 hover:bg-navy/5'}`}
      >
        <input
          id="file-input"
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
        {uploading ? (
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
        ) : (
          <>
            <Upload className="w-12 h-12 text-navy/40 mx-auto mb-4" />
            <p className="text-navy font-medium">Drop photos here or click to upload</p>
            <p className="text-navy/60 text-sm mt-1">Face detection runs automatically</p>
          </>
        )}
      </motion.div>

      {/* Photo grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {event.photos?.map((photo, i) => (
          <motion.div
            key={photo.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.02 }}
            className="card overflow-hidden group relative"
          >
            <div className="aspect-square bg-gray-100">
              <img
                src={`/${photo.thumbnail_path || photo.file_path}`}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent flex items-center justify-between">
              <span className="text-white text-xs font-medium flex items-center gap-1">
                {photo.processing_status === 'completed' ? (
                  <CheckCircle className="w-3 h-3 text-green-400" />
                ) : photo.processing_status === 'failed' ? (
                  <XCircle className="w-3 h-3 text-red-400" />
                ) : (
                  <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                )}
                {photo.face_count} faces
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(photo.id); }}
                className="p-1 rounded hover:bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {event.photos?.length === 0 && (
        <div className="text-center py-16 text-navy/60">
          <Image className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>No photos yet. Upload some to get started.</p>
        </div>
      )}
    </div>
  )
}
