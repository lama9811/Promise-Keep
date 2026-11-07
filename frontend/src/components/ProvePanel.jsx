import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { api, apiForm, getPosition } from '../api'
import { kickCoin, setCoin } from '../three/coinStore'
import LiveCamera from './LiveCamera'
import FitnessProof from './FitnessProof'

const EASE = [0.16, 1, 0.3, 1]

function useNow(active) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [active])
  return now
}

function clock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function Steps({ items, current }) {
  return (
    <ol className="flex gap-2" aria-label="Progress">
      {items.map((label, i) => (
        <li key={label} className="flex-1">
          <div className={`h-1.5 rounded-full transition-colors duration-500 ${i <= current ? 'bg-cobalt' : 'bg-ink/10'}`} />
          <p className={`mt-2 text-xs ${i === current ? 'font-semibold text-ink' : 'text-ink-soft'}`}>{label}</p>
        </li>
      ))}
    </ol>
  )
}

function PrimaryButton({ children, ...props }) {
  return (
    <motion.button
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.97 }}
      className="w-full rounded-full bg-cobalt py-4 font-display text-lg font-bold text-white shadow-[0_18px_40px_-14px_rgba(30,59,255,0.65)] transition-colors disabled:bg-ink/10 disabled:text-ink/40 disabled:shadow-none"
      {...props}
    >
      {children}
    </motion.button>
  )
}

function Result({ result, onAgain }) {
  const tone = {
    pass: { bg: 'bg-kept-soft', mark: '✓', markCls: 'bg-kept text-white', title: 'Counted.' },
    unsure: { bg: 'bg-sun-soft', mark: '?', markCls: 'bg-sun text-ink', title: 'Your friend decides this one.' },
    fail: { bg: 'bg-broke-soft', mark: '✕', markCls: 'bg-broke text-white', title: "That one didn't count." },
  }[result.verdict]
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE }}
      className={`rounded-2xl ${tone.bg} p-5`}
    >
      <div className="flex items-start gap-4">
        <span className={`grid size-10 shrink-0 place-items-center rounded-full text-lg font-bold ${tone.markCls}`}>{tone.mark}</span>
        <div>
          <p className="font-display text-xl font-bold">{tone.title}</p>
          <p className="mt-1 leading-relaxed text-ink-soft">{result.reason}</p>
        </div>
      </div>
      {result.verdict === 'fail' && onAgain && (
        <button onClick={onAgain} className="mt-4 text-sm font-semibold text-cobalt underline underline-offset-4">
          Try again with a new word
        </button>
      )}
    </motion.div>
  )
}

export default function ProvePanel({ promise, onChange, demoAvailable }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [demo, setDemo] = useState(false)
  const open = promise.open_proof
  const isGym = promise.proof === 'gym' && promise.has_gym  // check-in only works with a pinned gym
  const fitness = ['gym', 'steps', 'run', 'workout'].includes(promise.proof)
  const fitnessResult = (r) => setResult({ ...r, fitness: true })
  const checkedIn = open?.kind === 'checkin'
  const word = open?.word
  const now = useNow(Boolean(open))
  const readyIn = checkedIn ? new Date(open.ready_at) - now : 0
  const wordLeft = word ? new Date(open.word_expires_at) - now : 0

  // The word ran out on screen: refresh so the panel offers a new one.
  useEffect(() => {
    if (word && wordLeft <= 0) onChange()
  }, [word, wordLeft, onChange])

  const run = async (fn) => {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const where = async () => (demo ? { demo: true } : { ...(await getPosition()), demo: false })

  const imHere = () =>
    run(async () => {
      const p = await api(`/promises/${promise.id}/checkin/start`, { method: 'POST', body: JSON.stringify(await where()) })
      setResult(null)
      onChange(p)
    })

  const getWord = () =>
    run(async () => {
      const body = isGym ? await where() : { demo }
      const p = await api(`/promises/${promise.id}/word`, { method: 'POST', body: JSON.stringify(body) })
      setResult(null)
      kickCoin(1.5)
      onChange(p)
    })

  const sendPhoto = (blob) =>
    run(async () => {
      const spin = setInterval(() => kickCoin(1), 300)
      try {
        const form = new FormData()
        form.append('proof_id', open.id)
        form.append('photo', blob, 'proof.jpg')
        const r = await apiForm(`/promises/${promise.id}/photo`, form)
        setResult(r)
        if (r.counted) {
          setCoin({ done: r.promise.done_count })
          kickCoin(4)
        }
        onChange(r.promise)
      } finally {
        clearInterval(spin)
      }
    })

  // ---------- Which step are we on? ----------
  let steps = null
  let step = 0
  let body = null

  if (promise.status !== 'active') {
    body = (
      <p className="leading-relaxed text-ink-soft">
        {promise.status === 'draft'
          ? 'Finish paying to lock in this promise. Then you can start proving it here.'
          : 'This promise is closed, so it no longer takes proof.'}
      </p>
    )
  } else if (promise.proof === 'quiz') {
    body = (
      <p className="leading-relaxed text-ink-soft">
        Study checks work like this: photograph your notes, and the AI asks you 3 questions about them. Get 2 right
        and the session counts. This check opens in the next update.
      </p>
    )
  } else if (promise.proof === 'friend') {
    body = (
      <p className="leading-relaxed text-ink-soft">
        A photo can't prove this one, so your friend confirms it before the deadline. They'll get a link to approve or
        reject it.
      </p>
    )
  } else if (isGym) {
    steps = ["I'm here", 'Stay 30 min', 'Photo']
    if (word) {
      step = 2
    } else if (checkedIn) {
      step = 1
      body =
        readyIn > 0 ? (
          <div className="text-center">
            <p className="text-ink-soft">Your visit counts in</p>
            <p className="mt-1 font-display text-6xl font-extrabold tabular-nums tracking-tight">{clock(readyIn)}</p>
            <p className="mt-3 text-sm text-ink-soft">Keep this page open or come back to it. Your timer is saved.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="leading-relaxed text-ink-soft">
              Done with your workout. We'll check you're still at the gym, then give you a secret word to hold up in a
              photo.
            </p>
            <PrimaryButton onClick={getWord} disabled={busy}>
              {busy ? 'Checking your location…' : "I'm done"}
            </PrimaryButton>
          </div>
        )
    } else {
      step = 0
      body = (
        <div className="space-y-4">
          <p className="leading-relaxed text-ink-soft">
            When you get to your gym, tap below. We check you're within 150 m, then start a 30-minute timer.
          </p>
          <PrimaryButton onClick={imHere} disabled={busy}>
            {busy ? 'Finding you…' : "I'm here"}
          </PrimaryButton>
        </div>
      )
    }
  } else if (promise.proof === 'steps' || promise.proof === 'run' || promise.proof === 'gym') {
    body = (
      <p className="leading-relaxed text-ink-soft">
        {promise.proof === 'steps'
          ? 'Each day you reach your step goal, send it here. One a day counts.'
          : promise.proof === 'run'
            ? 'Every run that reaches your distance counts, one per day.'
            : 'Every gym session counts, one per day.'}
      </p>
    )
  } else {
    steps = ['Get a word', 'Photo']
    step = word ? 1 : 0
    if (!word) {
      body = (
        <div className="space-y-4">
          <p className="leading-relaxed text-ink-soft">
            Mid-workout? Tap below for a secret word, then take a live photo holding it up.
            {promise.proof_hint && <span className="mt-2 block text-ink">Show: {promise.proof_hint}</span>}
          </p>
          <PrimaryButton onClick={getWord} disabled={busy}>
            {busy ? 'Getting your word…' : "I'm doing it now"}
          </PrimaryButton>
        </div>
      )
    }
  }

  if (word && promise.status === 'active') {
    body = (
      <div className="space-y-5">
        <div className="text-center">
          <p className="text-ink-soft">Write this word on paper or a phone screen and hold it up</p>
          <motion.p
            key={word}
            initial={{ scale: 0.6, opacity: 0, rotate: -6 }}
            animate={{ scale: 1, opacity: 1, rotate: -2 }}
            transition={{ type: 'spring', stiffness: 220, damping: 14 }}
            className="mx-auto mt-3 w-fit rounded-2xl bg-sun px-6 py-3 font-display text-5xl font-extrabold tracking-tight"
          >
            {word}
          </motion.p>
          <p className="mt-3 text-sm text-ink-soft">
            {promise.proof_hint ? `${promise.proof_hint} ` : ''}Expires in {clock(wordLeft)}.
          </p>
        </div>
        <LiveCamera word={word} onCapture={sendPhoto} busy={busy} />
      </div>
    )
  }

  return (
    <section className="rounded-[28px] border border-line bg-surface p-6 shadow-[0_40px_80px_-50px_rgba(30,59,255,0.45)] md:p-8">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em]">Prove it</h2>
        {demoAvailable && promise.status === 'active' && steps && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} className="accent-cobalt" />
            Demo shortcuts
          </label>
        )}
      </div>
      {demo && (
        <p className="mt-1 text-sm text-ink-soft">Skips the location check and the 30-minute wait, for trying it on a laptop.</p>
      )}
      {steps && (
        <div className="mt-5">
          <Steps items={steps} current={step} />
        </div>
      )}
      <div className="mt-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${step}-${Boolean(word)}-${Boolean(checkedIn)}`}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            {body}
          </motion.div>
        </AnimatePresence>
      </div>
      {fitness && promise.status === 'active' && !word && !(isGym && checkedIn) && (
        <div className="mt-6">
          <p className="mb-3 text-sm font-semibold text-ink-soft">
            {steps ? 'Or prove it another way' : 'Ways to prove it'}
          </p>
          <FitnessProof promise={promise} onChange={onChange} onResult={fitnessResult} setError={setError} />
        </div>
      )}
      {result && (
        <div className="mt-6">
          <Result result={result} onAgain={result.fitness ? null : isGym ? imHere : getWord} />
        </div>
      )}
      <p role="status" className="mt-4 min-h-5 text-sm text-broke">
        {error}
      </p>
    </section>
  )
}
