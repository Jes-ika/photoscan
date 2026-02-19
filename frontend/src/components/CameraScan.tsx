import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Camera, X } from 'lucide-react'

/** Eye aspect ratio for blink detection. Below = closed. */
const EAR_THRESHOLD_CLOSED = 0.2
const EAR_THRESHOLD_OPEN = 0.25
/* MediaPipe Face Mesh eye landmark indices (6 pts each for EAR) */
const LEFT_EYE = [33, 160, 158, 133, 153, 144]
const RIGHT_EYE = [362, 385, 387, 263, 373, 380]

function eyeAspectRatio(landmarks: { x: number; y: number }[], indices: number[]): number {
  const p = indices.map((i) => landmarks[i])
  const v1 = Math.hypot(p[1].x - p[5].x, p[1].y - p[5].y)
  const v2 = Math.hypot(p[2].x - p[4].x, p[2].y - p[4].y)
  const h = Math.hypot(p[0].x - p[3].x, p[0].y - p[3].y)
  return h > 0 ? (v1 + v2) / (2 * h) : 0
}

interface CameraScanProps {
  onCapture: (file: File) => void
  onClose?: () => void
}

export default function CameraScan({ onCapture, onClose }: CameraScanProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [blinkDetected, setBlinkDetected] = useState(false)
  const [blinkStatus, setBlinkStatus] = useState<'waiting' | 'detecting' | 'ready'>('waiting')
  const [detectorFailed, setDetectorFailed] = useState(false)
  const detectorRef = useRef<any>(null)
  const rafRef = useRef<number>(0)
  const wasClosedRef = useRef(false)

  useEffect(() => {
    let mediaStream: MediaStream | null = null
    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError('Camera not supported in this browser')
          return
        }
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        })
        setStream(mediaStream)
        setError(null)
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
        }
      } catch (err: any) {
        setError(err.message || 'Unable to access camera')
      }
    }
    startCamera()
    return () => {
      if (mediaStream) mediaStream.getTracks().forEach((t) => t.stop())
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const loadDetector = async () => {
      try {
        const faceLandmarksDetection = await import('@tensorflow-models/face-landmarks-detection')
        const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh
        const detectorConfig = {
          runtime: 'tfjs' as const,
        }
        const detector = await faceLandmarksDetection.createDetector(model, detectorConfig)
        if (mounted) detectorRef.current = detector
      } catch (e) {
        console.warn('Blink detector failed, capture enabled without liveness:', e)
        if (mounted) {
          setDetectorFailed(true)
          setBlinkDetected(true)
        }
      }
    }
    loadDetector()
    return () => { mounted = false }
  }, [])

  const runBlinkDetection = useCallback(async () => {
    if (!videoRef.current || !detectorRef.current || blinkDetected) return
    const video = videoRef.current
    if (video.readyState < 2) {
      rafRef.current = requestAnimationFrame(runBlinkDetection)
      return
    }
    try {
      const faces = await detectorRef.current.estimateFaces(video)
      if (faces.length > 0 && faces[0].keypoints) {
        const kp = faces[0].keypoints.map((p: any) => ({ x: p.x, y: p.y }))
        const leftEAR = eyeAspectRatio(kp, LEFT_EYE)
        const rightEAR = eyeAspectRatio(kp, RIGHT_EYE)
        const ear = (leftEAR + rightEAR) / 2
        if (blinkStatus === 'waiting') setBlinkStatus('detecting')
        if (ear < EAR_THRESHOLD_CLOSED) {
          wasClosedRef.current = true
        } else if (ear > EAR_THRESHOLD_OPEN && wasClosedRef.current) {
          wasClosedRef.current = false
          setBlinkDetected(true)
          setBlinkStatus('ready')
        }
      }
    } catch (_) {}
    rafRef.current = requestAnimationFrame(runBlinkDetection)
  }, [blinkDetected, blinkStatus])

  useEffect(() => {
    if (stream && videoRef.current && !blinkDetected) {
      runBlinkDetection()
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [stream, blinkDetected, runBlinkDetection])

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current || !stream) return
    if (!blinkDetected) return
    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.save()
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0)
    ctx.restore()
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' })
          onCapture(file)
        }
      },
      'image/jpeg',
      0.9
    )
  }

  const canCapture = blinkDetected && stream

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative rounded-2xl overflow-hidden bg-navy/5 border-2 border-primary/30"
    >
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
        >
          <X className="w-5 h-5" />
        </button>
      )}
      <div className="aspect-video bg-navy/10 relative">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center">
            <div>
              <p className="text-red-600 font-medium">{error}</p>
              <p className="text-navy/60 text-sm mt-2">Allow camera access or use the upload option.</p>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute top-2 left-2 right-2 text-center z-10">
              {blinkStatus === 'waiting' && (
                <span className="inline-block px-3 py-1 rounded-full bg-amber-500/90 text-white text-sm font-medium">
                  Blink to verify you're live
                </span>
              )}
              {blinkStatus === 'detecting' && !blinkDetected && (
                <span className="inline-block px-3 py-1 rounded-full bg-navy/80 text-white text-sm">
                  Blink once...
                </span>
              )}
              {(blinkDetected || detectorFailed) && (
                <span className="inline-block px-3 py-1 rounded-full bg-green-500/90 text-white text-sm font-medium">
                  {detectorFailed ? 'Ready to capture' : 'Verified — You can capture'}
                </span>
              )}
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
              <button
                onClick={handleCapture}
                disabled={!canCapture}
                className="w-14 h-14 mx-auto flex items-center justify-center rounded-full bg-primary hover:bg-primary-700 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Camera className="w-7 h-7" />
              </button>
              <p className="text-white/90 text-sm mt-2 text-center">
                {blinkDetected ? 'Tap to capture' : 'Blink first to verify'}
              </p>
            </div>
          </>
        )}
      </div>
    </motion.div>
  )
}
