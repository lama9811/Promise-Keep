import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { api } from '../api'
import CoinStage from '../three/CoinStage'
import { kickCoin, setCoin } from '../three/coinStore'
import DealSheet from '../components/DealSheet'
import { dealFromParse } from '../deal'

const EASE = [0.16, 1, 0.3, 1]
const HEADLINE = ['Your word,', 'now with', 'money on it.']
const EXAMPLES = ['gym 3x this week or $20 to Alex', 'study 4 nights before Friday, $15 to charity']

function Headline() {
  return (
    <h1 className="font-display text-[clamp(2.75rem,5.6vw,5.25rem)] font-extrabold leading-[0.92] tracking-[-0.035em] text-paper">
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
      <label htmlFor="goal" className="block text-lg text-mist">
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
        className="mt-3 w-full resize-none [field-sizing:content] border-b-2 border-paper/30 bg-transparent pb-3 font-display text-[clamp(1.2rem,2.4vw,1.9rem)] font-medium leading-tight text-paper placeholder:text-paper/35 focus:border-paper focus:outline-none"
      />
      <p className="mt-3 text-sm text-mist">
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
              className="underline decoration-paper/30 underline-offset-4 transition-colors hover:text-paper hover:decoration-paper"
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
        className="mt-7 rounded-full bg-paper px-8 py-4 font-display text-lg font-bold text-ink shadow-[0_18px_40px_-18px_#07116b] transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
      >
        {parsing ? 'Reading your promise…' : 'Make it a deal'}
      </motion.button>
      <p role="status" className="mt-4 min-h-6 text-paper">
        {error}
      </p>
    </motion.form>
  )
}

const STEPS = [
  {
    title: 'Lock it in',
    body: 'Type your goal in plain words. The AI turns it into a clear deal, and PayPal holds your stake.',
  },
  {
    title: 'Prove it',
    body: 'At the gym, check in on location and hold up a secret word in a live photo. For studying, the AI quizzes you on your own notes.',
  },
  {
    title: 'Settle up',
    body: 'Keep your promise and PayPal refunds you. Break it and your stake goes to your friend or a charity, automatically.',
  },
]

function HowItWorks() {
  return (
    <section id="how" className="relative bg-cobalt-night">
      <div className="mx-auto max-w-7xl px-6 py-28 md:px-10 md:py-36">
        <h2 className="max-w-3xl font-display text-[clamp(2.25rem,5vw,4rem)] font-extrabold leading-[0.95] tracking-[-0.03em]">
          No honor system. A referee that checks.
        </h2>
        <ol className="mt-16 grid gap-12 md:grid-cols-3 md:gap-10">
          {STEPS.map((step, i) => (
            <li key={step.title} className="border-t border-paper/20 pt-6">
              <span className="font-display text-6xl font-extrabold text-paper/25" aria-hidden="true">
                {i + 1}
              </span>
              <h3 className="mt-4 font-display text-2xl font-bold">{step.title}</h3>
              <p className="mt-3 max-w-sm leading-relaxed text-mist">{step.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-20 max-w-2xl leading-relaxed text-mist">
          What it can't stop: fake-GPS apps, or sitting in the gym for 30 minutes without lifting anything. That's why
          your friend gets the final say on any proof the AI isn't sure about.
        </p>
      </div>
      <footer className="mx-auto max-w-7xl px-6 pb-10 text-sm text-paper/50 md:px-10">
        Built with PayPal and Gemini for the PayPal + AI hackathon. Payments run in the PayPal sandbox, so no real money
        moves.
      </footer>
    </section>
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
            className="mt-6 max-w-md text-lg leading-relaxed text-mist"
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
          <CoinStage className="h-[42svh] md:sticky md:top-0 md:h-svh" />
        </div>
      </section>
      <HowItWorks />
    </main>
  )
}
