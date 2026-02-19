import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Camera, Trash2, Upload, Scan } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'
import CameraScan from '../components/CameraScan'

type InputMode = 'upload' | 'scan'

export default function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [inputMode, setInputMode] = useState<InputMode>('upload')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const registerFaceFromFile = async (file: File) => {
    setUploading(true)
    setMessage(null)
    try {
      await api.face.register(file)
      await refreshUser()
      setMessage({ type: 'success', text: 'Face registered successfully!' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to register face' })
    } finally {
      setUploading(false)
    }
  }

  const handleFaceRegister = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await registerFaceFromFile(file)
    e.target.value = ''
  }

  const handleCameraCapture = (file: File) => {
    setInputMode('upload')
    registerFaceFromFile(file)
  }

  const handleRemoveFace = async () => {
    setMessage(null)
    try {
      await api.face.remove()
      await refreshUser()
      setMessage({ type: 'success', text: 'Face registration removed' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to remove' })
    }
  }

  if (!user) return null

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-8"
      >
        <div className="flex items-center gap-6 mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-navy flex items-center justify-center">
            <User className="w-10 h-10 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-navy">{user.full_name}</h1>
            <p className="text-navy/70">{user.email}</p>
            <span className="inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium bg-primary/10 text-primary">
              {user.role}
            </span>
          </div>
        </div>

        {message && (
          <div className={`p-4 rounded-xl mb-6 ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            {message.text}
          </div>
        )}

        <section>
          <h2 className="text-lg font-semibold text-navy mb-4">Face Registration</h2>
          <p className="text-navy/70 mb-4">
            Register your face for faster photo searches. You can use a selfie or any clear photo of your face.
          </p>
          {user.face_registered ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-green-600">
                <Camera className="w-5 h-5" /> Face registered
              </div>
              <button onClick={handleRemoveFace} className="btn-outline py-2 text-sm flex items-center gap-1">
                <Trash2 className="w-4 h-4" /> Remove
              </button>
            </div>
          ) : (
            <div>
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
                  >
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
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="user"
                      onChange={handleFaceRegister}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="btn-primary flex items-center gap-2"
                    >
                      <Camera className="w-5 h-5" /> {uploading ? 'Uploading...' : 'Register Face'}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </section>

      </motion.div>
    </div>
  )
}
