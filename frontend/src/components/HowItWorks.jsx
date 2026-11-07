import { useRef } from 'react'
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react'

const EASE = [0.16, 1, 0.3, 1]

// ---------- Little live illustrations, one per step ----------

function LockIllustration() {
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

function ProveIllustration() {
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

function SettleIllustration() {
  return (
    <div className="w-full max-w-sm space-y-3" style={{ transformStyle: 'preserve-3d' }}>
      <Receipt tone="kept" title="You kept it" line="$20.00 refunded to you" id="3Y741303PN1111611" z={40} delay={0} />
      <div className="pl-10">
        <Receipt tone="broke" title="You broke it" line="$20.00 sent to Alex" id="C3C2QQ3TJ5YMW" z={90} delay={0.3} />
      </div>
    </div>
  )
}

const STEPS = [
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

// ---------- A card that tilts toward the cursor and shrinks as the next one stacks on it ----------

function MotionCard({ step, index, total, progress }) {
  const reduced = useReducedMotion()
  const rx = useMotionValue(0)
  const ry = useMotionValue(0)
  const rotateX = useSpring(rx, { stiffness: 160, damping: 18 })
  const rotateY = useSpring(ry, { stiffness: 160, damping: 18 })

  // Each earlier card shrinks a little more as later cards slide over it.
  const start = index / total
  const scale = useTransform(progress, [start, 1], [1, reduced ? 1 : 1 - (total - 1 - index) * 0.05])

  const onMove = (e) => {
    if (reduced || e.pointerType === 'touch') return
    const r = e.currentTarget.getBoundingClientRect()
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 6)
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 5)
  }
  const onLeave = () => {
    rx.set(0)
    ry.set(0)
  }

  const { Art } = step
  return (
    <div className="sticky md:h-[64svh] md:min-h-[500px]" style={{ top: `calc(9svh + ${index * 26}px)` }}>
      <motion.article
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        style={{ scale, rotateX, rotateY, transformPerspective: 1400, transformStyle: 'preserve-3d' }}
        className={`grid origin-top gap-10 overflow-hidden rounded-[40px] ${step.tint} px-7 pb-12 pt-8 md:h-full md:grid-cols-[1fr_1.1fr] md:items-center md:p-14`}
      >
        <div style={{ transform: 'translateZ(30px)' }}>
          <span className="font-display text-7xl font-extrabold text-ink/15 md:text-8xl" aria-hidden="true">
            {index + 1}
          </span>
          <h3 className="mt-2 font-display text-4xl font-extrabold tracking-[-0.03em] md:text-5xl">{step.title}</h3>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-ink-soft">{step.body}</p>
        </div>
        <div className="flex items-center justify-center" style={{ transformStyle: 'preserve-3d' }}>
          <Art />
        </div>
      </motion.article>
    </div>
  )
}

export default function HowItWorks() {
  const stack = useRef(null)
  const { scrollYProgress } = useScroll({ target: stack, offset: ['start start', 'end end'] })

  return (
    <section id="how" className="bg-canvas">
      <div className="mx-auto max-w-7xl px-6 pt-28 md:px-10 md:pt-36">
        <h2 className="max-w-3xl font-display text-[clamp(2.25rem,5vw,4.25rem)] font-extrabold leading-[0.95] tracking-[-0.03em] text-balance">
          No honor system.
          <br />
          A referee that checks.
        </h2>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
          Three steps from a promise to money moving. Nothing here runs on trust.
        </p>

        <ol ref={stack} className="relative mt-14 space-y-10 pb-[12svh]">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <MotionCard step={step} index={i} total={STEPS.length} progress={scrollYProgress} />
            </li>
          ))}
        </ol>

        <p className="max-w-2xl pb-24 text-lg leading-relaxed text-ink-soft">
          What it can't stop: fake-GPS apps, or sitting in the gym for 30 minutes without lifting anything. That's why
          your friend gets the final say on any proof the AI isn't sure about.
        </p>
      </div>
      <footer className="border-t border-line">
        <p className="mx-auto max-w-7xl px-6 py-8 text-sm text-ink-soft md:px-10">
          Built with PayPal and Gemini for the PayPal + AI hackathon. Payments run in the PayPal sandbox, so no real
          money moves.
        </p>
      </footer>
    </section>
  )
}
