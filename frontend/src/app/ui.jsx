// Small building blocks shared by the signed-in screens.
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { formatCents } from '../money'
import { outcomeOf } from './data'

export const EASE = [0.16, 1, 0.3, 1]

// Line icons, 24px grid, drawn with currentColor.
const PATHS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  plus: 'M12 5v14M5 12h14',
  pulse: 'M3 12h4l3-8 4 16 3-8h4',
  wallet: 'M3 7a2 2 0 0 1 2-2h13v4M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2zM16 14.5h.01',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  logout: 'M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l-4-4 4-4M6 12h10',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  camera: 'M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  gym: 'M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7',
  friends: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14a6 6 0 0 1 3.5 6',
  check: 'M5 12.5 10 17.5 19.5 7',
  x: 'M6 6l12 12M18 6 6 18',
  flame: 'M12 21c-4 0-7-2.7-7-6.5 0-3 2-5 3.5-6.5.3 2 1.3 3 2.5 3.5C11 8 12 5 14.5 3c.5 3 4.5 5.5 4.5 11 0 4-3 7-7 7z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  lock: 'M6 11h12v10H6zM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11',
  share: 'M16 6a2.5 2.5 0 1 0 0-.01M8 12a2.5 2.5 0 1 0 0-.01M16 18a2.5 2.5 0 1 0 0-.01M10.2 10.8l3.6-2.1M10.2 13.2l3.6 2.1',
  shield: 'M12 3 4.5 6v5.5c0 4.5 3.2 8.3 7.5 9.5 4.3-1.2 7.5-5 7.5-9.5V6z',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  ring: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z',
  steps: 'M8 3c1.7 0 2.5 1.8 2.5 4S9.7 12 8 12 5.5 9.2 5.5 7 6.3 3 8 3zM6 14.5h4V17a2 2 0 0 1-4 0zM16 7c1.7 0 2.5 1.8 2.5 4S17.7 16 16 16s-2.5-2.8-2.5-5S14.3 7 16 7zM14 18.5h4V21a2 2 0 0 1-4 0z',
  run: 'M13.5 5.5a1.5 1.5 0 1 0 0-.01M9 20l2.5-5 3 2.5V22M7 12l3-3.5 4 1.5 2.5 3H20M11.5 15l-1.5-4',
}

export function Icon({ name, className = 'size-5', strokeWidth = 1.8 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}

export const PROOF_ICON = { gym: 'gym', steps: 'steps', run: 'run', workout: 'flame', exercise: 'ring', move: 'ring', photo: 'camera', quiz: 'book', friend: 'friends' }
export const PROOF_SHORT = { gym: 'Gym visits', steps: 'Daily steps', run: 'Runs', workout: 'Workouts', exercise: 'Exercise ring', move: 'Move ring', photo: 'Live photo', quiz: 'Notes quiz', friend: 'Friend confirms' }

// The brand mark: a tiny chrome coin with a check.
export function CoinMark({ className = 'size-8' }) {
  return (
    <span
      className={`grid place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#ffffff,#c9cff0_45%,#7d88c9_78%,#3a49b8)] text-ink shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.7),0_6px_14px_-6px_rgba(10,18,64,0.5)] ${className}`}
    >
      <Icon name="check" className="size-[55%]" strokeWidth={3} />
    </span>
  )
}

// Tells a .spot surface where the cursor is, so its border can glow there.
export function spotMove(e) {
  const r = e.currentTarget.getBoundingClientRect()
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
}

export function Card({ className = '', children, ...rest }) {
  return (
    <div onPointerMove={spotMove} className={`glass spot rounded-3xl ${className}`} {...rest}>
      {children}
    </div>
  )
}

export function CardHeader({ title, hint, action }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-ink/[0.06] px-5 py-4">
      <div>
        <h2 className="font-display text-base font-bold tracking-[-0.01em]">{title}</h2>
        {hint && <p className="mt-0.5 text-sm text-ink-soft">{hint}</p>}
      </div>
      {action}
    </div>
  )
}

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-ink/[0.06] ${className}`} />
}

export function statusOf(p) {
  const o = outcomeOf(p)
  if (o === 'won') return { label: 'Kept', tone: 'bg-kept-soft text-kept', dot: 'bg-kept' }
  if (o === 'lost') return { label: 'Missed', tone: 'bg-broke-soft text-broke', dot: 'bg-broke' }
  if (p.deadline && new Date(p.deadline) < new Date()) return { label: 'Settling', tone: 'bg-sun-soft text-ink', dot: 'bg-sun' }
  return { label: 'Active', tone: 'bg-cobalt-soft text-cobalt', dot: 'bg-cobalt' }
}

export function StatusPill({ p }) {
  const s = statusOf(p)
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${s.tone}`}>
      <span className={`size-1.5 rounded-full ${s.dot} ${s.label === 'Active' ? 'animate-pulse' : ''}`} />
      {s.label}
    </span>
  )
}

export function ProgressRing({ done, target, size = 48, stroke = 5, tone = 'text-cobalt' }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = target ? Math.min(1, done / target) : 0
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-ink/[0.08]" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke="currentColor"
          className={tone}
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 1.1, ease: EASE }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[11px] font-bold tabular-nums">
        {done}/{target}
      </span>
    </div>
  )
}

// "2d 4h", "5h 12m", "12m 08s"
export function shortLeft(deadline, now = Date.now()) {
  const ms = new Date(deadline) - now
  if (ms <= 0) return 'Time is up'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d >= 1) return `${d}d ${h}h left`
  if (h >= 1) return `${h}h ${String(m).padStart(2, '0')}m left`
  return `${m}m ${String(s % 60).padStart(2, '0')}s left`
}

export function ringTone(p) {
  const o = outcomeOf(p)
  return o === 'won' ? 'text-kept' : o === 'lost' ? 'text-broke' : 'text-cobalt'
}

// One promise as a row: ring, title, proof type, countdown, stake.
export function PromiseRow({ p, now, i = 0 }) {
  const active = !outcomeOf(p)
  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay: 0.04 * i }}
    >
      <Link
        to={`/p/${p.id}`}
        className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-white/70"
      >
        <ProgressRing done={p.done_count} target={p.target_count} tone={ringTone(p)} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold group-hover:text-cobalt">{p.summary}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
            <span className="inline-flex items-center gap-1.5">
              <Icon name={PROOF_ICON[p.proof] || 'check'} className="size-4" />
              {PROOF_SHORT[p.proof] || 'Proof'}
            </span>
            {active && p.deadline && (
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <Icon name="clock" className="size-4" />
                {shortLeft(p.deadline, now)}
              </span>
            )}
          </p>
        </div>
        <div className="hidden text-right sm:block">
          <p className="font-display font-bold tabular-nums">{formatCents(p.stake_cents)}</p>
          <div className="mt-1">
            <StatusPill p={p} />
          </div>
        </div>
      </Link>
    </motion.li>
  )
}

export function ButtonLink({ to, children, variant = 'primary', className = '', icon, ...rest }) {
  const look =
    variant === 'primary'
      ? 'bg-cobalt text-white shadow-[0_10px_24px_-12px_rgba(30,59,255,0.8)] hover:bg-[#1631e0]'
      : 'border border-line bg-surface text-ink hover:border-ink/25'
  return (
    <Link
      to={to}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${look} ${className}`}
      {...rest}
    >
      {icon && <Icon name={icon} className="size-4" strokeWidth={2.2} />}
      {children}
    </Link>
  )
}

export function PageTitle({ title, hint, action }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[1.9rem] font-extrabold leading-tight tracking-[-0.03em] md:text-[2.25rem]">
          {title}
        </h1>
        {hint && <p className="mt-1 text-ink-soft">{hint}</p>}
      </div>
      {action}
    </div>
  )
}

export function EmptyState({ icon = 'spark', title, children, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-cobalt-soft text-cobalt">
        <Icon name={icon} className="size-6" />
      </span>
      <p className="mt-4 font-display text-lg font-bold">{title}</p>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-ink-soft">{children}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
