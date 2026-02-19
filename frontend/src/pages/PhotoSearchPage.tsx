import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Upload, Search, Download, X, Scan } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'
import LoadingSpinner from '../components/LoadingSpinner'
import CameraScan from '../components/CameraScan'

interface FaceMatch {
  photo_id: number
  file_path: string
  thumbnail_path: string | null
  event_name: string
  event_id: number
  match_confidence: number
  face_index: number
}

interface Event {
  id: number
  name: string
  status: string
}

type InputMode = 'upload' | 'scan'

export default function PhotoSearchPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [matches, setMatches] = useState<FaceMatch[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedEvent, setSelectedEvent] = useState<number | ''>('')
  const [events, setEvents] = useState<Event[]>([])
  const [inputMode, setInputMode] = useState<InputMode>('upload')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isOrganizer = user?.role === 'organizer' || user?.role === 'admin'
  const [eventCode, setEventCode] = useState('')
  const [eventFromCode, setEventFromCode] = useState<{ id: number; name: string } | null>(null)
  const [codeError, setCodeError] = useState('')

  useEffect(() => {
    const code = searchParams.get('code')?.trim().toUpperCase()
    if (code) {
      setEventCode(code)
      api.events.getByCode(code)
        .then(({ data }) => setEventFromCode({ id: data.id, name: data.name }))
        .catch(() => setEventFromCode(null))
    }
  }, [searchParams])

  const loadEvents = async () => {
    try {
      const { data } = await api.events.list()
      setEvents(data.filter((e: Event) => e.status === 'published'))
    } catch {
      setEvents([])
    }
  }

  const handleSubmitCode = async () => {
    const code = eventCode.trim().toUpperCase()
    if (!code) return
    setCodeError('')
    try {
      const { data } = await api.events.getByCode(code)
      setEventFromCode({ id: data.id, name: data.name })
      setSearchParams({ code })
    } catch {
      setCodeError('Invalid or expired event code. Check with the organizer.')
      setEventFromCode(null)
    }
  }

  const handleClearCode = () => {
    setEventCode('')
    setEventFromCode(null)
    setCodeError('')
    setSearchParams({})
    setMatches([])
    setError('')
  }

  const needsCode = !isOrganizer && !eventFromCode

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPhoto(file)
      setPreview(URL.createObjectURL(file))
      setError('')
      setMatches([])
    }
  }

  const handleCameraCapture = (file: File) => {
    setPhoto(file)
    setPreview(URL.createObjectURL(file))
    setError('')
    setMatches([])
    setInputMode('upload')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      setPhoto(file)
      setPreview(URL.createObjectURL(file))
      setError('')
      setMatches([])
    }
  }

  const handleDragOver = (e: React.DragEvent) => e.preventDefault()

  const handleSearch = async () => {
    if (!photo && !user?.face_registered) {
      setError('Please upload a photo, scan your face, or register your face first.')
      return
    }
    if (!isOrganizer && !eventFromCode && !eventCode) {
      setError('Enter the event code first.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const accessCode = !isOrganizer && eventFromCode ? eventCode : undefined
      const eventId = isOrganizer ? (selectedEvent || undefined) : undefined
      const { data } = await api.photos.search(photo, eventId, accessCode)
      setMatches(data.matches || [])
      if (!data.matches?.length) setError('No matching photos found.')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Search failed')
      setMatches([])
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setPhoto(null)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setMatches([])
    setError('')
  }

  const downloadPhoto = (photoId: number, filename: string) => {
    api.photos.download(photoId, filename || 'photo.jpg')
  }

  const canSearch = (photo || user?.face_registered) && (isOrganizer || eventFromCode)

  if (needsCode) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-8">
          <h1 className="text-2xl font-bold text-navy mb-2">Enter Event Code</h1>
          <p className="text-navy/70 mb-6">Get the code from your event organizer or scan the QR code at the event to find your photos.</p>
          <input
            type="text"
            value={eventCode}
            onChange={(e) => setEventCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
            placeholder="e.g. ABC12XYZ"
            className="input-field w-full text-center text-xl tracking-widest font-mono uppercase"
            maxLength={8}
          />
          {codeError && <p className="text-red-600 text-sm mt-2">{codeError}</p>}
          <button onClick={handleSubmitCode} disabled={!eventCode.trim()} className="btn-primary w-full mt-4">
            Continue
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="text-3xl md:text-4xl font-bold text-navy mb-2">Find Your Photos</h1>
        <p className="text-navy/70">Upload, scan your face, or use your registered face to find photos from events</p>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Upload / Scan area */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="card p-6"
        >
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setInputMode('upload')}
              className={`flex-1 py-2 px-4 rounded-xl font-medium transition-all ${
                inputMode === 'upload' ? 'bg-primary text-white' : 'bg-navy/5 text-navy/70 hover:bg-navy/10'
              }`}
            >
              <Upload className="w-4 h-4 inline mr-2" />
              Upload
            </button>
            <button
              onClick={() => setInputMode('scan')}
              className={`flex-1 py-2 px-4 rounded-xl font-medium transition-all ${
                inputMode === 'scan' ? 'bg-primary text-white' : 'bg-navy/5 text-navy/70 hover:bg-navy/10'
              }`}
            >
              <Scan className="w-4 h-4 inline mr-2" />
              Scan
            </button>
          </div>

          <AnimatePresence mode="wait">
            {inputMode === 'scan' ? (
              <motion.div
                key="scan"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mb-4"
              >
                <h3 className="text-sm font-medium text-navy mb-2">Live camera scan</h3>
                <CameraScan
                  onCapture={handleCameraCapture}
                  onClose={() => setInputMode('upload')}
                />
              </motion.div>
            ) : (
              <motion.div
                key="upload"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <h2 className="text-lg font-semibold text-navy mb-4">Your Photo</h2>
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all
                    ${preview ? 'border-primary/50 bg-primary/5' : 'border-navy/20 hover:border-primary/40 hover:bg-navy/5'}`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="user"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {preview ? (
                    <div className="relative">
                      <img src={preview} alt="Preview" className="max-h-64 mx-auto rounded-xl object-cover" />
                      <button
                        onClick={(e) => { e.stopPropagation(); handleClear(); }}
                        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Camera className="w-16 h-16 text-navy/40 mx-auto mb-4" />
                      <p className="text-navy font-medium mb-1">Drop your selfie here</p>
                      <p className="text-navy/60 text-sm">or click to capture/upload</p>
                      {user?.face_registered && (
                        <p className="text-primary text-sm mt-2">Or search using your registered face</p>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {isOrganizer ? (
            <div className="mt-4">
              <label className="block text-sm font-medium text-navy mb-2">Filter by event (optional)</label>
              <select
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value ? Number(e.target.value) : '')}
                onFocus={loadEvents}
                className="input-field"
              >
                <option value="">All events</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
          ) : eventFromCode && (
            <div className="mt-4 p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between">
              <span className="font-medium text-navy">{eventFromCode.name}</span>
              <button onClick={handleClearCode} className="text-sm text-navy/60 hover:text-navy">Change code</button>
            </div>
          )}

          <button
            onClick={handleSearch}
            disabled={loading || !canSearch}
            className="btn-primary w-full mt-6 flex items-center justify-center gap-2"
          >
            {loading ? <LoadingSpinner size="sm" /> : <><Search className="w-5 h-5" /> Find My Photos</>}
          </button>
        </motion.div>

        {/* Results */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="card p-6"
        >
          <h2 className="text-lg font-semibold text-navy mb-4">Results</h2>
          {error && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 mb-4">
              {error}
            </div>
          )}
          {loading ? (
            <div className="py-16">
              <LoadingSpinner label="Scanning event photos..." />
            </div>
          ) : matches.length > 0 ? (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              <AnimatePresence>
                {matches.map((m, i) => (
                  <motion.div
                    key={`${m.photo_id}-${m.face_index}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-navy/5"
                  >
                    <img
                      src={(m.thumbnail_path || m.file_path).startsWith('/') ? m.thumbnail_path || m.file_path : `/${m.thumbnail_path || m.file_path}`}
                      alt=""
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-navy truncate">{m.event_name}</p>
                    </div>
                    <button
                      onClick={() => downloadPhoto(m.photo_id, `event-${m.event_id}-photo.jpg`)}
                      className="p-2 rounded-lg hover:bg-primary/10 text-primary"
                      title="Download"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : !loading && !error && (
            <div className="py-16 text-center text-navy/60">
              <Upload className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Upload, scan, or use your registered face to find your photos</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
