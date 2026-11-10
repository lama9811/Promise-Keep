// The three steps of a promise and the small 3D scenes that illustrate them.
// Home.jsx lays them out next to the pinned coin.
import { motion } from 'motion/react'

const EASE = [0.16, 1, 0.3, 1]

// ---------- Little live illustrations, one per step ----------

export function LockIllustration() {
  return (
    <div className="relative w-full max-w-sm" style={{ transformStyle: 'preserve-3d' }}>
      <motion.div
        style={{ translateZ: 40 }}
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.9, ease: EASE }}
        className="rounded-3xl bg-surface p-6 shadow-[0_30px_60px_-30px_rgba(10,18,64,0.35)]"
      >
        <p className="font-display text-xl font-semibold leading-snug">
          I'll <span className="text-cobalt underline decoration-2 underline-offset-4">go to the gym</span>{' '}
          <span className="text-cobalt underline decoration-2 underline-offset-4">3</span> times by{' '}
          <span className="text-cobalt underline decoration-2 underline-offset-4">Sunday</span>. If I don't,{' '}
          <span className="text-cobalt underline decoration-2 underline-offset-4">$20</span> goes to{' '}
          <span className="text-cobalt underline decoration-2 underline-offset-4">Alex</span>.
        </p>
      </motion.div>
      <motion.div
        style={{ translateZ: 90 }}
        initial={{ opacity: 0, y: 20, scale: 0.9 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.8, ease: EASE, delay: 0.35 }}
        className="-mt-4 ml-auto mr-4 flex w-fit items-center gap-3 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-[0_20px_40px_-15px_rgba(10,18,64,0.6)]"
      >
        <span className="grid size-6 place-items-center rounded-full bg-sun text-ink">✓</span>
        PayPal is holding $20
      </motion.div>
    </div>
  )
}

export function ProveIllustration() {
  return (
    <div className="relative mx-auto w-40 md:w-56" style={{ transformStyle: 'preserve-3d' }}>
      <div
        style={{ transform: 'translateZ(20px)' }}
        className="aspect-[9/17] rounded-[2.2rem] border-[6px] border-ink bg-[linear-gradient(160deg,#c9d3e6,#8e9bb8)] p-3 shadow-[0_40px_70px_-30px_rgba(10,18,64,0.5)]"
      >
        <div className="flex h-full flex-col items-center justify-center">
          <motion.div
            initial={{ rotate: -14, opacity: 0, y: 20 }}
            whileInView={{ rotate: -6, opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.9, ease: EASE }}
            className="rounded-lg bg-white px-4 py-3 font-display text-2xl font-extrabold tracking-tight shadow-lg"
          >
            BANANA
          </motion.div>
        </div>
      </div>
      <motion.div
        style={{ translateZ: 80 }}
        initial={{ opacity: 0, x: -30 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.8, ease: EASE, delay: 0.25 }}
        className="absolute -left-10 top-8 rounded-2xl md:-left-14 md:top-10 bg-surface px-4 py-2.5 text-sm font-semibold shadow-[0_20px_40px_-18px_rgba(10,18,64,0.45)]"
      >
        At your gym, 42 m away
      </motion.div>
      <motion.div
        style={{ translateZ: 110 }}
        initial={{ opacity: 0, x: 30 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.8, ease: EASE, delay: 0.5 }}
        className="absolute -right-10 bottom-8 flex md:-right-16 md:bottom-12 items-center gap-2 rounded-2xl bg-surface px-4 py-2.5 text-sm font-semibold shadow-[0_20px_40px_-18px_rgba(10,18,64,0.45)]"
      >
        <span className="grid size-5 place-items-center rounded-full bg-kept text-[11px] text-white">✓</span>
        Word matches. Looks like a gym.
      </motion.div>
    </div>
  )
}

function Receipt({ tone, title, line, id, z, delay }) {
  const tones = {
    kept: 'bg-kept-soft text-kept',
    broke: 'bg-broke-soft text-broke',
  }
  return (
    <motion.div
      style={{ translateZ: z }}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 0.8, ease: EASE, delay }}
      className="rounded-3xl bg-surface p-5 shadow-[0_30px_60px_-30px_rgba(10,18,64,0.4)]"
    >
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}>{title}</span>
      <p className="mt-3 font-display text-2xl font-bold tracking-tight">{line}</p>
      <p className="mt-1 text-xs text-ink-soft">PayPal ID {id}</p>
    </motion.div>
  )
}

export function SettleIllustration() {
  return (
    <div className="w-full max-w-sm space-y-3" style={{ transformStyle: 'preserve-3d' }}>
      <Receipt tone="kept" title="You kept it" line="$20.00 refunded to you" id="3Y741303PN1111611" z={40} delay={0} />
      <div className="pl-10">
        <Receipt tone="broke" title="You broke it" line="$20.00 sent to Alex" id="C3C2QQ3TJ5YMW" z={90} delay={0.3} />
      </div>
    </div>
  )
}

export const STEPS = [
  {
    title: 'Lock it in',
    body: 'Type your fitness goal in plain words, like “10,000 steps a day” or “gym 4 times this week”. The AI turns it into a clear deal, and PayPal holds your stake.',
    tint: 'bg-cobalt-soft',
    Art: LockIllustration,
  },
  {
    title: 'Prove it',
    body: 'Your workouts are the proof. Runs and rides come straight from Strava, workouts from WHOOP, steps from your Apple Watch. At the gym, check in on your phone and snap a photo with a secret word. Any other screenshot, the AI reads.',
    tint: 'bg-kept-soft',
    Art: ProveIllustration,
  },
  {
    title: 'Settle up',
    body: 'Keep your promise and PayPal refunds you. Break it and your stake goes to your friend or a charity, automatically.',
    tint: 'bg-sun-soft',
    Art: SettleIllustration,
  },
]
