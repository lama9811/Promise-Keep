import { useEffect, useRef, useState } from 'react'

// In-app camera only. There is deliberately no "upload from gallery" button, so
// old photos and pictures from the internet can't be picked (PRD cheat check 3).
export default function LiveCamera({ word, onCapture, busy }) {
  const video = useRef(null)
  const [facing, setFacing] = useState('user')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let stream
    let cancelled = false
    setReady(false)
    setError('')
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop())
        stream = s
        if (video.current) {
          video.current.srcObject = s
          video.current.onloadedmetadata = () => setReady(true)
        }
      })
      .catch(() =>
        setError('Camera is blocked. Allow camera access for this site in your browser settings, then try again.'),
      )
    if (!navigator.mediaDevices) setError("This browser can't open the camera.")
    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [facing])

  const capture = () => {
    const v = video.current
    if (!v || !ready) return
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    const ctx = canvas.getContext('2d')
    if (facing === 'user') {
      // Un-mirror so the word reads correctly in the saved photo.
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(v, 0, 0)
    canvas.toBlob((blob) => blob && onCapture(blob, canvas.toDataURL('image/jpeg', 0.6)), 'image/jpeg', 0.88)
  }

  return (
    <div>
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-ink">
        <video
          ref={video}
          autoPlay
          playsInline
          muted
          className={`h-full w-full object-cover ${facing === 'user' ? '-scale-x-100' : ''}`}
        />
        {word && (
          <div className="pointer-events-none absolute left-3 top-3 rounded-xl bg-surface/95 px-3 py-1.5 font-display text-lg font-extrabold tracking-tight text-ink shadow">
            {word}
          </div>
        )}
        {error && <p className="absolute inset-0 grid place-items-center p-6 text-center text-white">{error}</p>}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={capture}
          disabled={!ready || busy}
          className="flex-1 rounded-full bg-cobalt py-4 font-display text-lg font-bold text-white shadow-[0_18px_40px_-14px_rgba(30,59,255,0.65)] transition-colors disabled:bg-ink/10 disabled:text-ink/40 disabled:shadow-none"
        >
          {busy ? 'The AI referee is checking…' : 'Take the photo'}
        </button>
        <button
          type="button"
          onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
          className="rounded-full border border-line bg-surface px-5 py-4 text-sm font-semibold"
        >
          Flip
        </button>
      </div>
    </div>
  )
}
