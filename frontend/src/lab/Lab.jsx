// Throwaway preview: three directions for the dashboard, stacked on one page
// with the real numbers, so we can pick one. Not linked from the menu.
import { lazy, Suspense, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { formatCents } from '../money'
import { moneyFrom, outcomeOf, streakFrom, useActivity, useMyPromises, useNow, weekFrom } from '../app/data'
import { Icon, spotMove } from '../app/ui'
import CountUp from '../fx/CountUp'

const WorldScene = lazy(() => import('./WorldScene'))
const EASE = [0.16, 1, 0.3, 1]

const IDEAS = [
  { icon: 'steps', title: '10k steps a day', text: '10,000 steps every day this week or $20 to Alex', cents: 2000, grad: 'from-[#4f6bff] to-[#1e3bff]' },
  { icon: 'gym', title: 'Gym 4x a week', text: 'gym 4 times this week or $25 to Alex', cents: 2500, grad: 'from-[#2fd39a] to-[#0e9f72]' },
  { icon: 'run', title: 'Run 5 km 3x', text: 'run 5 km 3 times this week or $15 to Alex', cents: 1500, grad: 'from-[#ffd84a] to-[#ff9f1c]' },
  { icon: 'flame', title: '45-min workouts', text: 'work out 45 minutes 5 times this week or $20 to Alex', cents: 2000, grad: 'from-[#ff7a8a] to-[#e5364f]' },
  { icon: 'ring', title: 'Close Exercise ring', text: 'close my exercise ring every day this week or $20 to Alex', cents: 2000, grad: 'from-[#8af7cf] to-[#12b886]' },
  { icon: 'ring', title: '500 Move calories', text: 'burn 500 move calories 5 days this week or $15 to Alex', cents: 1500, grad: 'from-[#ff9ab0] to-[#ff4d6d]' },
]

const dollars = (cents) => (v) => formatCents(Math.abs(v - cents) < 1 ? cents : Math.round(v / 100) * 100)

function useDash() {
  const { promises } = useMyPromises()
  const activity = useActivity(promises)
  const money = moneyFrom(promises)
  const streak = streakFrom(activity?.events)
  const week = weekFrom(activity?.events)
  const now = useNow(1000)
  const next = (promises || [])
    .filter((p) => !outcomeOf(p) && p.deadline && new Date(p.deadline) > now)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))[0]
  return { money, streak, week, next, now, loading: promises === null }
}

function Heading({ letter, title, children }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <p className="font-display text-sm font-bold text-cobalt">Direction {letter}</p>
        <h2 className="font-display text-3xl font-extrabold tracking-[-0.03em]">{title}</h2>
        <p className="mt-1 max-w-xl text-ink-soft">{children}</p>
      </div>
    </div>
  )
}

// ---------------- A: one live 3D world ----------------

function World({ d, go }) {
  const kept = d.money.keptRate ?? 0
  return (
    <section id="a">
      <Heading letter="A" title="One live 3D world">
        The dashboard top is a real 3D scene. Grab it to turn it; hover an idea coin to spin it, click to start it.
      </Heading>
      <div className="relative h-[620px] overflow-hidden rounded-[36px] bg-[radial-gradient(120%_90%_at_50%_0%,#ffffff_0%,#e9edff_45%,#dfe5ff_70%,#fff5d0_100%)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.8),0_40px_80px_-50px_rgba(30,59,255,0.5)]">
        <Suspense fallback={null}>
          <WorldScene ideas={IDEAS} stake={d.money.onTheLine} onPick={(i) => go(i.text)} />
        </Suspense>
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-6 md:p-8">
          <div className="flex items-start justify-between">
            <div className="glass rounded-2xl px-5 py-4">
              <p className="text-sm font-semibold text-ink/60">On the line</p>
              <p className="font-display text-4xl font-extrabold tracking-tight tabular-nums">
                <CountUp value={d.money.onTheLine} format={dollars(d.money.onTheLine)} />
              </p>
            </div>
            <p className="glass rounded-full px-4 py-2 text-sm font-semibold text-ink/70">Drag to turn the world</p>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="glass rounded-2xl px-5 py-4">
              <p className="text-sm font-semibold text-ink/60">Kept rate</p>
              <p className="font-display text-3xl font-extrabold tabular-nums">{d.money.keptRate === null ? 'New' : `${kept}%`}</p>
            </div>
            <div className="glass rounded-2xl px-5 py-4">
              <p className="text-sm font-semibold text-ink/60">Streak</p>
              <p className="font-display text-3xl font-extrabold tabular-nums">
                {d.streak} {d.streak === 1 ? 'day' : 'days'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------------- B: bold bento + live charts ----------------

function Panel({ className = '', children, i = 0 }) {
  return (
    <motion.div
      onPointerMove={spotMove}
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.8, ease: EASE, delay: i * 0.07 }}
      whileHover={{ y: -4 }}
      className={`glass spot relative overflow-hidden rounded-[28px] p-6 ${className}`}
    >
      {children}
    </motion.div>
  )
}

function Spark({ week }) {
  const vals = week.map((w) => w.count || 0)
  const max = Math.max(1, ...vals)
  const pts = vals.map((v, i) => [(i / (vals.length - 1)) * 100, 36 - (v / max) * 30])
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ')
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-28 w-full overflow-visible">
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#1e3bff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#1e3bff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={`${line} L100,40 L0,40 Z`}
        fill="url(#spark-fill)"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1, delay: 0.8 }}
      />
      <motion.path
        d={line}
        fill="none"
        stroke="#1e3bff"
        strokeWidth="1.6"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.6, ease: EASE }}
      />
    </svg>
  )
}

function Ring({ pct, size = 150, stroke = 14, from, to, id, children }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor={from} />
            <stop offset="1" stopColor={to} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke={from} strokeOpacity="0.13" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={`url(#${id})`}
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          whileInView={{ strokeDashoffset: c * (1 - Math.max(0.02, Math.min(1, pct))) }}
          viewport={{ once: true }}
          transition={{ duration: 1.6, ease: EASE, delay: 0.2 }}
          style={{ filter: `drop-shadow(0 0 8px ${to}88)` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}

function Countdown({ next, now }) {
  if (!next)
    return (
      <>
        <p className="text-sm font-semibold text-white/60">Next deadline</p>
        <p className="mt-3 font-display text-3xl font-extrabold">Nothing due</p>
        <p className="mt-1 text-sm text-white/60">Lock in a promise and the clock starts here.</p>
      </>
    )
  const ms = new Date(next.deadline) - now
  const parts = [
    [Math.floor(ms / 864e5), 'd'],
    [Math.floor((ms % 864e5) / 36e5), 'h'],
    [Math.floor((ms % 36e5) / 6e4), 'm'],
    [Math.floor((ms % 6e4) / 1e3), 's'],
  ]
  return (
    <>
      <p className="text-sm font-semibold text-white/60">Next deadline</p>
      <p className="mt-3 flex gap-3 font-display text-5xl font-extrabold tabular-nums">
        {parts.map(([n, u]) => (
          <span key={u}>
            {String(n).padStart(2, '0')}
            <span className="text-xl text-white/50">{u}</span>
          </span>
        ))}
      </p>
      <p className="mt-2 truncate text-sm text-white/70">{next.summary}</p>
    </>
  )
}

function Bento({ d, go }) {
  const proofs = d.week.reduce((n, w) => n + (w.count || 0), 0)
  return (
    <section id="b">
      <Heading letter="B" title="Bold panels and live charts">
        Mixed-size panels like Apple's or Linear's sites. Charts draw themselves, rings glow, everything lifts under the cursor.
      </Heading>
      <div className="grid auto-rows-[minmax(150px,auto)] grid-cols-1 gap-4 md:grid-cols-6">
        <Panel i={0} className="md:col-span-4 md:row-span-2">
          <p className="text-sm font-semibold text-ink/60">On the line right now</p>
          <p className="mt-1 font-display text-[clamp(3.5rem,8vw,6.5rem)] font-extrabold leading-none tracking-[-0.05em] tabular-nums">
            <CountUp value={d.money.onTheLine} format={dollars(d.money.onTheLine)} />
          </p>
          <p className="mt-2 text-ink-soft">
            {d.money.active} active, {formatCents(d.money.returned)} back to you so far
          </p>
          <div className="mt-6">
            <Spark week={d.week} />
            <div className="mt-2 flex justify-between text-xs font-semibold text-ink/40">
              {d.week.map((w) => (
                <span key={w.key}>{w.label}</span>
              ))}
            </div>
          </div>
        </Panel>
        <Panel i={1} className="flex flex-col items-center justify-center md:col-span-2 md:row-span-2">
          <Ring pct={(d.money.keptRate ?? 0) / 100} size={170} from="#2fd39a" to="#0e9f72" id="kept-ring">
            <div>
              <p className="font-display text-4xl font-extrabold">{d.money.keptRate === null ? 'New' : `${d.money.keptRate}%`}</p>
              <p className="text-sm text-ink-soft">kept</p>
            </div>
          </Ring>
          <p className="mt-4 text-sm text-ink-soft">
            {d.money.kept} of {d.money.kept + d.money.missed} promises kept
          </p>
        </Panel>
        <Panel i={2} className="md:col-span-2">
          <p className="text-sm font-semibold text-ink/60">Streak</p>
          <p className="mt-1 font-display text-5xl font-extrabold">
            {d.streak}
            <span className="ml-2 text-xl text-ink/50">{d.streak === 1 ? 'day' : 'days'}</span>
          </p>
          <div className="mt-4 flex h-10 items-end gap-1.5">
            {d.week.map((w, i) => (
              <motion.span
                key={w.key}
                initial={{ height: 4 }}
                whileInView={{ height: w.count ? 40 : 8 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, ease: EASE, delay: 0.3 + i * 0.06 }}
                className={`flex-1 rounded-md ${w.count ? 'bg-[linear-gradient(to_top,#ff9f1c,#ffd84a)]' : 'bg-ink/[0.07]'}`}
              />
            ))}
          </div>
        </Panel>
        <Panel i={3} className="bg-ink! text-white md:col-span-2">
          <Countdown next={d.next} now={d.now} />
        </Panel>
        <Panel i={4} className="md:col-span-2">
          <p className="text-sm font-semibold text-ink/60">This week</p>
          <p className="mt-1 font-display text-5xl font-extrabold">{proofs}</p>
          <p className="text-sm text-ink-soft">{proofs === 1 ? 'proof counted' : 'proofs counted'}</p>
        </Panel>
        <Panel i={5} className="overflow-hidden md:col-span-6">
          <p className="mb-4 text-sm font-semibold text-ink/60">Ideas to try</p>
          <div className="group flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
            {[0, 1].map((k) => (
              <div key={k} className="flex shrink-0 animate-[marquee_28s_linear_infinite] gap-3 pr-3 group-hover:[animation-play-state:paused]">
                {IDEAS.map((idea) => (
                  <button
                    key={idea.title}
                    onClick={() => go(idea.text)}
                    className="flex shrink-0 items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left shadow-[0_10px_24px_-16px_rgba(10,18,64,0.4)] transition-transform hover:-translate-y-1"
                  >
                    <span className={`grid size-10 place-items-center rounded-xl bg-gradient-to-br text-white ${idea.grad}`}>
                      <Icon name={idea.icon} className="size-5" strokeWidth={2.2} />
                    </span>
                    <span>
                      <span className="block font-display font-bold">{idea.title}</span>
                      <span className="block text-sm text-ink-soft">{formatCents(idea.cents)} on the line</span>
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </section>
  )
}

// ---------------- C: fitness-app energy ----------------

function Confetti({ burst }) {
  const bits = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        a: (i / 36) * Math.PI * 2 + Math.random() * 0.3,
        d: 120 + Math.random() * 140,
        c: ['#1e3bff', '#0e9f72', '#ffd84a', '#ff4d6d', '#6ef0be'][i % 5],
        s: 6 + Math.random() * 6,
      })),
    // a fresh spray for every burst
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [burst],
  )
  if (!burst) return null
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2">
      {bits.map((b, i) => (
        <motion.span
          key={`${burst}-${i}`}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: Math.cos(b.a) * b.d, y: Math.sin(b.a) * b.d + 60, opacity: 0, rotate: 360 }}
          transition={{ duration: 1.3, ease: [0.2, 0.8, 0.3, 1] }}
          className="absolute rounded-sm"
          style={{ width: b.s, height: b.s * 0.6, background: b.c }}
        />
      ))}
    </div>
  )
}

function Rings({ d }) {
  const [burst, setBurst] = useState(0)
  const daysWithProof = d.week.filter((w) => w.count).length
  const rings = [
    { label: 'Kept', value: d.money.keptRate === null ? 'New' : `${d.money.keptRate}%`, pct: (d.money.keptRate ?? 0) / 100, from: '#ff4d6d', to: '#ff9ab0', size: 300 },
    { label: 'Streak', value: `${d.streak} of 7 days`, pct: d.streak / 7, from: '#0e9f72', to: '#8af7cf', size: 236 },
    { label: 'Proved this week', value: `${daysWithProof} of 7 days`, pct: daysWithProof / 7, from: '#1e3bff', to: '#8fa2ff', size: 172 },
  ]
  return (
    <div className="grid items-center gap-10 md:grid-cols-[auto_1fr]">
      <button type="button" onClick={() => setBurst((b) => b + 1)} aria-label="Celebrate" className="relative mx-auto grid size-[300px] place-items-center">
        {rings.map((r, i) => (
          <motion.div
            key={r.label}
            className="absolute"
            animate={{ scale: [1, 1.015, 1] }}
            transition={{ duration: 3, repeat: Infinity, delay: i * 0.4, ease: 'easeInOut' }}
          >
            <Ring pct={r.pct} size={r.size} stroke={26} from={r.from} to={r.to} id={`fit-${i}`} />
          </motion.div>
        ))}
        <Confetti burst={burst} />
      </button>
      <div className="space-y-5">
        {rings.map((r) => (
          <div key={r.label}>
            <p className="font-display text-lg font-bold" style={{ color: r.from }}>
              {r.label}
            </p>
            <p className="font-display text-4xl font-extrabold tracking-tight">{r.value}</p>
          </div>
        ))}
        <p className="text-sm text-ink-soft">Tap the rings to celebrate.</p>
      </div>
    </div>
  )
}

function Fitness({ d, go }) {
  return (
    <section id="c">
      <Heading letter="C" title="Fitness-app energy">
        Big glowing rings like Apple Fitness, bright gradient icons, and a burst of confetti when you hit something.
      </Heading>
      <div className="overflow-hidden rounded-[36px] bg-[radial-gradient(90%_80%_at_20%_10%,#ffffff,#f0f3ff_50%,#fff6dc)] p-6 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.9),0_40px_80px_-50px_rgba(30,59,255,0.45)] md:p-10">
        <Rings d={d} />
        <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3">
          {IDEAS.map((idea, i) => (
            <motion.button
              key={idea.title}
              onClick={() => go(idea.text)}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: EASE, delay: i * 0.05 }}
              whileHover={{ y: -6, rotate: i % 2 ? 1.5 : -1.5 }}
              whileTap={{ scale: 0.96 }}
              className="flex items-center gap-4 rounded-3xl bg-white p-4 text-left shadow-[0_18px_40px_-26px_rgba(10,18,64,0.45)]"
            >
              <motion.span
                whileHover={{ scale: 1.15, rotate: -8 }}
                className={`grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.45),inset_0_-6px_12px_rgba(0,0,0,0.15),0_12px_20px_-10px_rgba(10,18,64,0.5)] ${idea.grad}`}
              >
                <Icon name={idea.icon} className="size-7" strokeWidth={2.3} />
              </motion.span>
              <span>
                <span className="block font-display text-lg font-bold leading-tight">{idea.title}</span>
                <span className="block text-sm text-ink-soft">{formatCents(idea.cents)} on the line</span>
              </span>
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function Lab() {
  const d = useDash()
  const navigate = useNavigate()
  const go = (text) => navigate('/app/new', { state: { text, go: true } })
  return (
    <div className="space-y-20 pb-20">
      <div>
        <h1 className="font-display text-[2.4rem] font-extrabold tracking-[-0.03em]">Three directions</h1>
        <p className="text-ink-soft">The same real numbers in three styles. Scroll through, play with each, and pick one (or mix).</p>
        <div className="glass mt-4 flex w-fit gap-1 rounded-full p-1">
          {[
            ['#a', 'A. 3D world'],
            ['#b', 'B. Panels and charts'],
            ['#c', 'C. Fitness energy'],
          ].map(([href, label]) => (
            <button
              key={href}
              type="button"
              onClick={() => document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' })}
              className="rounded-full px-4 py-2 text-sm font-semibold text-ink-soft transition-colors hover:bg-white hover:text-ink"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <World d={d} go={go} />
      <Bento d={d} go={go} />
      <Fitness d={d} go={go} />
    </div>
  )
}
