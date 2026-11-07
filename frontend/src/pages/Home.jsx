import { useEffect } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import CoinStage from '../three/CoinStage'
import { setCoin } from '../three/coinStore'
import HowItWorks from '../components/HowItWorks'
import { useAuth } from '../auth'

const EASE = [0.16, 1, 0.3, 1]
const HEADLINE = ['Your word,', 'now with', 'money on it.']

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

export default function Home() {
  const { session } = useAuth()

  useEffect(() => {
    setCoin({ mode: 'idle', stakeCents: 0, outcome: null, done: 0, target: 0 })
  }, [])

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
            Bet on your next workout. Your Strava, WHOOP or Apple Watch proves it. PayPal gives the money back when you keep
            it, and pays your friend when you don't.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE, delay: 0.6 } }}
            className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-4"
          >
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
              <Link
                to={session ? '/app' : '/signin'}
                className="inline-block rounded-full bg-cobalt px-8 py-4 font-display text-lg font-bold text-white shadow-[0_18px_40px_-14px_rgba(30,59,255,0.65)]"
              >
                {session ? 'Go to your promises' : 'Make your first promise'}
              </Link>
            </motion.div>
            <Link to="/#how" className="text-ink-soft underline decoration-ink/20 underline-offset-4 transition-colors hover:text-cobalt">
              See how it works
            </Link>
          </motion.div>
          {!session && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 1, delay: 0.8 } }}
              className="mt-5 text-sm text-ink-soft"
            >
              Free to sign up. You only pay when you lock in a promise.
            </motion.p>
          )}
        </div>
        <div className="order-1 md:order-2">
          <CoinHero />
        </div>
      </section>
      <HowItWorks />
    </main>
  )
}
