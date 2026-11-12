// The fitness ways to prove a promise: sync Strava / WHOOP, send Apple Health steps with
// or upload a screenshot that the AI reads (the only way for Apple Fitness and steps).
import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { api, apiForm } from '../api'
import { kickCoin, setCoin } from '../three/coinStore'

const EASE = [0.16, 1, 0.3, 1]
const NAME = { strava: 'Strava', whoop: 'WHOOP' }
const BRAND = { strava: 'bg-[#fc4c02] text-white', whoop: 'bg-ink text-white' }

// Which connected apps can prove which kind of promise.
const APPS_FOR = { gym: ['whoop', 'strava'], run: ['strava', 'whoop'], workout: ['whoop', 'strava'], steps: [], exercise: [], move: [] }
const SHOT_HINT = {
  steps: 'Your Health, Fitbit or Google Fit screen showing today’s steps and the word Today or today’s date',
  run: 'Your run summary from Strava, Nike Run Club or Apple Fitness, with distance and date',
  workout: 'Your workout summary showing how long it lasted and the date',
  gym: 'Your gym app’s check-in screen (Planet Fitness, LA Fitness, Crunch…)',
  exercise: 'Your Fitness app rings for today, showing Exercise minutes and the date',
  move: 'Your Fitness app rings for today, showing Move calories and the date',
}

export function useConnections() {
  const [data, setData] = useState(null)
  const load = () =>
    api('/me/connections')
      .then(setData)
      .catch(() => setData({ providers: [] }))
  useEffect(() => {
    load()
  }, [])
  return [data, load]
}

export async function startConnect(provider, back) {
  try {
    sessionStorage.setItem('pk-connect-back', back || window.location.pathname)
  } catch {
    /* private mode: we'll just go to the account page after */
  }
  const { url } = await api(`/connect/${provider}/start`, { method: 'POST' })
  window.location.assign(url)
}

function Row({ icon, title, text, children }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-canvas/60 p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {icon}
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          <p className="text-sm leading-snug text-ink-soft">{text}</p>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

const btn =
  'inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 sm:w-auto'

export default function FitnessProof({ promise, onChange, onResult, setError }) {
  const [conns] = useConnections()
  const [busy, setBusy] = useState('')
  const fileRef = useRef()
  const apps = (APPS_FOR[promise.proof] || []).map((p) => conns?.providers.find((c) => c.provider === p)).filter((c) => c?.available)

  const work = async (key, fn) => {
    setBusy(key)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy('')
    }
  }

  const sync = (provider) =>
    work(provider, async () => {
      const r = await api(`/promises/${promise.id}/sync`, { method: 'POST' })
      const latest = r.promise.proofs[r.promise.proofs.length - 1]
      onResult(
        r.new_proofs
          ? { verdict: latest?.counted ? 'pass' : 'fail', reason: latest?.ai_reason || `Found ${r.new_proofs} new workout(s).` }
          : { verdict: 'fail', reason: `Nothing new from ${NAME[provider]} since your last sync. Log your workout there, then sync again.` },
      )
      if (r.new_proofs) {
        setCoin({ done: r.promise.done_count })
        kickCoin(3)
      }
      onChange(r.promise)
    })

  const upload = (file) =>
    work('shot', async () => {
      const spin = setInterval(() => kickCoin(1), 300)
      try {
        const form = new FormData()
        form.append('screenshot', file, file.name || 'screenshot.png')
        form.append('tz', Intl.DateTimeFormat().resolvedOptions().timeZone)
        const r = await apiForm(`/promises/${promise.id}/screenshot`, form)
        onResult({ verdict: r.counted ? 'pass' : 'fail', reason: r.reason })
        if (r.counted) {
          setCoin({ done: r.promise.done_count })
          kickCoin(4)
        }
        onChange(r.promise)
      } finally {
        clearInterval(spin)
        if (fileRef.current) fileRef.current.value = ''
      }
    })

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="space-y-3"
    >
      {apps.map((c) => (
        <Row
          key={c.provider}
          icon={<span className={`grid size-10 shrink-0 place-items-center rounded-xl font-display font-extrabold ${BRAND[c.provider]}`}>{NAME[c.provider][0]}</span>}
          title={NAME[c.provider]}
          text={
            c.connected
              ? 'Connected. Workouts you log there count automatically. Sync to check now.'
              : `Connect once and your ${promise.proof === 'run' ? 'runs' : 'workouts'} count automatically.`
          }
        >
          {c.connected ? (
            <button onClick={() => sync(c.provider)} disabled={Boolean(busy)} className={`${btn} bg-ink text-white hover:bg-ink/85`}>
              {busy === c.provider ? 'Checking…' : `Sync ${NAME[c.provider]}`}
            </button>
          ) : (
            <button
              onClick={() => work(c.provider, () => startConnect(c.provider))}
              disabled={Boolean(busy)}
              className={`${btn} ${BRAND[c.provider]}`}
            >
              Connect {NAME[c.provider]}
            </button>
          )}
        </Row>
      ))}

      <Row
        icon={<span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cobalt-soft text-lg text-cobalt">⇪</span>}
        title="Upload a screenshot"
        text={`${SHOT_HINT[promise.proof] || 'A screenshot of your workout'}. The AI reads it.`}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
        <button onClick={() => fileRef.current?.click()} disabled={Boolean(busy)} className={`${btn} bg-cobalt text-white hover:bg-[#1631e0]`}>
          {busy === 'shot' ? 'AI is reading…' : 'Choose screenshot'}
        </button>
      </Row>
    </motion.div>
  )
}
