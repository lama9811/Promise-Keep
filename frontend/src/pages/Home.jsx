import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion, useInView, useMotionValueEvent, useScroll } from 'motion/react'
import CoinStage from '../three/CoinStage'
import { kickCoin, setCoin } from '../three/coinStore'
import { STEPS } from '../components/HowItWorks'
import { Tilt } from '../fx/Tilt'
import Magnetic from '../fx/Magnetic'
import { useAuth } from '../auth'

const EASE = [0.16, 1, 0.3, 1]
const HEADLINE = ['Your word,', 'now with', 'money on it.']
const STAKE = 2000 // the $20 the story's coin carries
const PROOFS = 5 // the five check-ins it needs

function Headline() {
  return (
    <h1 className="font-display text-[clamp(2.9rem,6vw,5.75rem)] font-extrabold leading-[0.9] tracking-[-0.04em] text-ink">
      {HEADLINE.map((line, i) => (
        <span key={line} className="block overflow-hidden pb-[0.07em]">
          <motion.span
            className="block"
            initial={{ y: '110%', rotate: 4 }}
            animate={{ y: 0, rotate: 0 }}
            transition={{ duration: 1.15, ease: EASE, delay: 0.25 + i * 0.1 }}
            style={{ transformOrigin: 'left bottom' }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </h1>
  )
}

export function CoinHero({ glow = 'bg-sun-soft', ringSegments, className = 'h-[42svh] md:sticky md:top-0 md:h-svh' }) {
  return (
    <div className={`relative ${className}`}>
      {/* Daylight behind the coin: a soft sky and sun glow */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute left-[12%] top-[18%] size-[62%] rounded-full bg-cobalt-soft blur-3xl" />
        <div className={`absolute bottom-[20%] right-[10%] size-[40%] rounded-full ${glow} blur-3xl`} />
      </div>
      <CoinStage className="absolute inset-0" ringSegments={ringSegments} />
    </div>
  )
}

// What the coin is doing in each act, shown as a small live caption under it.
const ACTS = [
  { coin: { mode: 'idle', outcome: null, done: 0 }, caption: null },
  { coin: { mode: 'locked', outcome: null, done: 0 }, caption: '$20 locked with PayPal' },
  { coin: { mode: 'progress', outcome: null }, caption: 'proofs' },
  { coin: { mode: 'progress', outcome: 'won', done: PROOFS }, caption: 'Kept. $20 back to you' },
]

function Act({ index, onEnter, children, className = '' }) {
  const ref = useRef(null)
  // An act is "on stage" while it crosses the middle of the screen.
  const inView = useInView(ref, { margin: '-48% 0px -48% 0px' })
  useEffect(() => {
    if (inView) onEnter(index)
  }, [inView, index, onEnter])
  return (
    <section ref={ref} className={className}>
      {children}
    </section>
  )
}

function StepAct({ step, index, onEnter, proveRef }) {
  const { Art } = step
  return (
    <Act index={index + 1} onEnter={onEnter} className="flex min-h-[100svh] flex-col justify-center py-20 md:py-28">
      <div ref={proveRef}>
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 1, ease: EASE }}
        >
          <p className="font-display text-lg font-bold text-cobalt">Step {index + 1} of 3</p>
          <h2 className="mt-2 font-display text-[clamp(2.6rem,5vw,4.5rem)] font-extrabold leading-[0.92] tracking-[-0.04em]">
            {step.title}
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-soft">{step.body}</p>
        </motion.div>
        <Tilt
          max={6}
          className={`mt-10 flex min-h-[300px] items-center justify-center rounded-[36px] ${step.tint} px-8 py-12 md:min-h-[340px]`}
        >
          <Art />
        </Tilt>
      </div>
    </Act>
  )
}

function CoinCaption({ act, done }) {
  const text = act === 2 ? `${done} of ${PROOFS} proofs counted` : ACTS[act]?.caption
  const tone = act === 3 ? 'bg-kept text-white' : 'bg-white text-ink'
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[7%] flex justify-center md:bottom-[12%]">
      <AnimatePresence mode="wait">
        {text && (
          <motion.p
            key={text}
            initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(6px)' }}
            transition={{ duration: 0.45, ease: EASE }}
            className={`rounded-full px-5 py-2.5 font-display text-base font-bold tabular-nums shadow-[0_18px_40px_-18px_rgba(10,18,64,0.45)] md:text-lg ${tone}`}
          >
            {text}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

function Closing({ session }) {
  return (
    <section className="relative overflow-hidden border-t border-line bg-surface">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-10 size-[520px] rounded-full bg-cobalt-soft blur-3xl" />
        <div className="absolute -right-24 bottom-0 size-[380px] rounded-full bg-sun-soft blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-7xl px-6 py-28 md:px-10 md:py-40">
        <motion.h2
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 1.1, ease: EASE }}
          className="max-w-4xl font-display text-[clamp(2.8rem,7vw,6.5rem)] font-extrabold leading-[0.9] tracking-[-0.045em] text-balance"
        >
          What will you promise this week?
        </motion.h2>
        <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-soft">
          Write it the way you'd text a friend. The AI drafts the deal, PayPal holds the stake, and your workouts do the
          rest.
        </p>
        <div className="mt-10">
          <Magnetic>
            <Link
              to={session ? '/app/new' : '/signin'}
              className="inline-block rounded-full bg-cobalt px-9 py-5 font-display text-xl font-bold text-white shadow-[0_24px_50px_-16px_rgba(30,59,255,0.7)] transition-colors hover:bg-[#1631e0]"
            >
              {session ? 'Make a promise' : 'Make your first promise'}
            </Link>
          </Magnetic>
        </div>
        <p className="mt-16 max-w-2xl text-ink-soft">
          What it can't stop: fake-GPS apps, or sitting in the gym for 30 minutes without lifting anything. That's why
          your friend gets the final say on any proof the AI isn't sure about.
        </p>
      </div>
      <footer className="relative border-t border-line">
        <p className="mx-auto max-w-7xl px-6 py-8 text-sm text-ink-soft md:px-10">
          Built with PayPal and Claude for the PayPal + AI hackathon. Payments run in the PayPal sandbox, so no real
          money moves.
        </p>
      </footer>
    </section>
  )
}

export default function Home() {
  const { session } = useAuth()
  const [act, setAct] = useState(0)
  const [done, setDone] = useState(0)
  const proveRef = useRef(null)

  // Scrolling through "Prove it" lights the ring one segment at a time.
  const { scrollYProgress } = useScroll({ target: proveRef, offset: ['start 75%', 'end 60%'] })
  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    const n = Math.max(0, Math.min(PROOFS, Math.floor(p * (PROOFS + 0.99))))
    setDone((d) => (d === n ? d : n))
  })

  useEffect(() => {
    setCoin({ mode: 'idle', stakeCents: STAKE, outcome: null, done: 0, target: PROOFS })
    return () => setCoin({ mode: 'idle', stakeCents: 0, outcome: null, done: 0, target: 0 })
  }, [])

  useEffect(() => {
    setCoin({ ...ACTS[act].coin, ...(act === 2 ? { done } : {}) })
  }, [act, done])

  const enter = useRef((i) => {
    setAct((prev) => {
      if (prev !== i) kickCoin(2.5)
      return i
    })
  }).current

  return (
    <main className="overflow-x-clip">
      <div className="relative mx-auto max-w-7xl px-6 md:flex md:flex-row-reverse md:gap-10 md:px-10">
        {/* The coin: pinned beside the story on desktop, across the top on phones */}
        <div className="sticky top-0 z-10 -mx-6 h-[44svh] bg-[linear-gradient(to_bottom,var(--color-canvas)_82%,transparent)] md:static md:mx-0 md:h-auto md:w-1/2 md:bg-none">
          <div className="relative h-full md:sticky md:top-0 md:h-svh">
            <CoinHero className="h-full" ringSegments={PROOFS} />
            <CoinCaption act={act} done={done} />
          </div>
        </div>

        <div className="relative md:w-1/2">
          <Act index={0} onEnter={enter} className="flex flex-col pb-24 pt-4 md:min-h-svh md:justify-center md:py-24">
            <Headline />
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 1, delay: 0.6 } }}
              className="mt-7 max-w-md text-lg leading-relaxed text-ink-soft"
            >
              Bet on your next workout. Your Strava, WHOOP or Apple Watch proves it. PayPal gives the money back when you
              keep it, and pays your friend when you don't.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE, delay: 0.7 } }}
              className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-4"
            >
              <Magnetic>
                <Link
                  to={session ? '/app' : '/signin'}
                  className="inline-block rounded-full bg-cobalt px-8 py-4 font-display text-lg font-bold text-white shadow-[0_18px_40px_-14px_rgba(30,59,255,0.65)] transition-colors hover:bg-[#1631e0]"
                >
                  {session ? 'Go to your promises' : 'Make your first promise'}
                </Link>
              </Magnetic>
              <Link
                to="/#how"
                className="text-ink-soft underline decoration-ink/20 underline-offset-4 transition-colors hover:text-cobalt"
              >
                See how it works
              </Link>
            </motion.div>
            {!session && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 1, delay: 0.9 } }}
                className="mt-5 text-sm text-ink-soft"
              >
                Free to sign up. You only pay when you lock in a promise.
              </motion.p>
            )}
          </Act>

          <div id="how" className="scroll-mt-0">
            {STEPS.map((step, i) => (
              <StepAct key={step.title} step={step} index={i} onEnter={enter} proveRef={i === 1 ? proveRef : undefined} />
            ))}
          </div>
        </div>
      </div>
      <Closing session={session} />
    </main>
  )
}
