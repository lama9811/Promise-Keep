import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { api } from '../api'
import CoinStage from '../three/CoinStage'
import { kickCoin, setCoin } from '../three/coinStore'
import DealSheet from '../components/DealSheet'
import HowItWorks from '../components/HowItWorks'
import { dealFromParse } from '../deal'

const EASE = [0.16, 1, 0.3, 1]
const HEADLINE = ['Your word,', 'now with', 'money on it.']
const EXAMPLES = ['gym 3x this week or $20 to Alex', 'practice guitar 4 times, or $15 to charity']

function Headline() {
  return (
    <h1 className="font-display text-[clamp(2.75rem,5.6vw,5.25rem)] font-extrabold leading-[0.92] tracking-[-0.035em] text-ink">
      {HEADLINE.map((line, i) => (
        <span key={line} className="block overflow-hidden pb-[0.06em]">
          <motion.span
            className="block"
            initial={{ y: '105%' }}
            animate={{ y: 0 }}
            transition={{ duration: 1.1, ease: EASE, delay: 0.25 + i * 0.09 }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </h1>
  )
}

function Composer({ text, setText, onSubmit, parsing, error }) {
  const inputRef = useRef()
  return (
    <motion.form
      key="composer"
      onSubmit={onSubmit}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE, delay: 0.6 } }}
      exit={{ opacity: 0, y: -12, transition: { duration: 0.35, ease: EASE } }}
      className="mt-8 max-w-xl"
    >
      <label htmlFor="goal" className="block text-lg text-ink-soft">
        What do you promise?
      </label>
      <textarea
        id="goal"
        ref={inputRef}
        value={text}
        rows={1}
        maxLength={500}
        onChange={(e) => {
          setText(e.target.value)
          kickCoin(0.5)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            onSubmit()
          }
        }}
        placeholder={EXAMPLES[0]}
        className="mt-3 w-full resize-none [field-sizing:content] border-b-2 border-ink/15 bg-transparent pb-3 font-display text-[clamp(1.2rem,2.4vw,1.9rem)] font-medium leading-tight text-ink placeholder:text-ink/30 transition-colors focus:border-cobalt focus:outline-none"
      />
      <p className="mt-3 text-sm text-ink-soft">
        Try{' '}
        {EXAMPLES.map((ex, i) => (
          <span key={ex}>
            <button
              type="button"
              onClick={() => {
                setText(ex)
                kickCoin(2)
                inputRef.current?.focus()
              }}
              className="underline decoration-ink/20 underline-offset-4 transition-colors hover:text-cobalt hover:decoration-cobalt"
            >
              {ex}
            </button>
            {i < EXAMPLES.length - 1 ? ' or ' : ''}
          </span>
        ))}
      </p>
      <motion.button
        type="submit"
        disabled={parsing || text.trim().length < 3}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        className="mt-7 rounded-full bg-cobalt px-8 py-4 font-display text-lg font-bold text-white shadow-[0_18px_40px_-14px_rgba(30,59,255,0.65)] transition-colors disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink/40 disabled:shadow-none"
      >
        {parsing ? 'Reading your promise…' : 'Make it a deal'}
      </motion.button>
      <p role="status" className="mt-4 min-h-6 text-broke">
        {error}
      </p>
    </motion.form>
  )
}

export default function Home() {
  const [text, setText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState('')
  const [deal, setDeal] = useState(null)

  useEffect(() => {
    setCoin({ mode: 'idle', stakeCents: 0, outcome: null, done: 0, target: 0 })
  }, [])

  // Keep the coin spinning while the AI reads the promise.
  useEffect(() => {
    if (!parsing) return
    const id = setInterval(() => kickCoin(1.2), 250)
    return () => clearInterval(id)
  }, [parsing])

  const submit = async (e) => {
    e?.preventDefault()
    if (parsing || text.trim().length < 3) return
    setError('')
    setParsing(true)
    try {
      const parsed = await api('/promises/parse', {
        method: 'POST',
        body: JSON.stringify({ text, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      })
      setDeal(dealFromParse(parsed))
      setCoin({ mode: 'deal', stakeCents: parsed.stake_cents })
    } catch {
      setError("The AI couldn't read that just now. Try again in a moment.")
    } finally {
      setParsing(false)
    }
  }

  const reset = () => {
    setDeal(null)
    setCoin({ mode: 'idle', stakeCents: 0 })
  }

  return (
    <main>
      <section className="relative mx-auto grid max-w-7xl gap-6 px-6 pt-24 md:grid-cols-[1.05fr_1fr] md:gap-10 md:px-10 md:pt-0">
        <div className="order-2 pb-24 md:order-1 md:flex md:min-h-svh md:flex-col md:justify-center md:py-24">
          <Headline />
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 1, delay: 0.55 } }}
            className="mt-6 max-w-md text-lg leading-relaxed text-ink-soft"
          >
            Bet on your own goal. AI checks your proof. PayPal gives the money back when you keep it, and pays your friend
            when you don't.
          </motion.p>
          <AnimatePresence mode="wait">
            {deal ? (
              <DealSheet key="deal" text={text} deal={deal} setDeal={setDeal} onEdit={reset} />
            ) : (
              <Composer key="composer" text={text} setText={setText} onSubmit={submit} parsing={parsing} error={error} />
            )}
          </AnimatePresence>
        </div>
        <div className="order-1 md:order-2">
          <div className="relative h-[42svh] md:sticky md:top-0 md:h-svh">
            {/* Daylight behind the coin: a soft sky and sun glow */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              <div className="absolute left-[12%] top-[18%] size-[62%] rounded-full bg-cobalt-soft blur-3xl" />
              <div className="absolute bottom-[20%] right-[10%] size-[40%] rounded-full bg-sun-soft blur-3xl" />
            </div>
            <CoinStage className="absolute inset-0" />
          </div>
        </div>
      </section>
      <HowItWorks />
    </main>
  )
}
