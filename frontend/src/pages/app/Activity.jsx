import { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useSpring } from 'motion/react'
import { Link } from 'react-router'
import { formatCents } from '../../money'
import { useActivity, useMyPromises } from '../../app/data'
import { ButtonLink, Card, EmptyState, Icon, PageTitle, Skeleton } from '../../app/ui'

// "just now", "5 min ago", "3 h ago", "Tue 4:12 PM", "Oct 2"
export function ago(at) {
  const d = new Date(at)
  const s = (Date.now() - d) / 1000
  if (s < 0) return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  if (s < 6 * 86400)
    return d.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function describe(e) {
  const p = e.promise
  if (e.type === 'locked')
    return { icon: 'lock', tone: 'bg-cobalt-soft text-cobalt', title: `Locked in ${formatCents(p.stake_cents)} with PayPal`, tag: null }
  if (e.type === 'won')
    return { icon: 'check', tone: 'bg-kept-soft text-kept', title: `Kept it. ${formatCents(p.stake_cents)} goes back to you`, tag: null }
  if (e.type === 'lost')
    return { icon: 'x', tone: 'bg-broke-soft text-broke', title: `Missed it. ${formatCents(p.stake_cents)} was paid out`, tag: null }
  const pr = e.proof
  const KIND = {
    checkin: 'Gym check-in',
    photo: 'Photo proof',
    screenshot: 'Screenshot',
    strava: 'Strava activity',
    whoop: 'WHOOP workout',
    health: 'Apple Health',
    quiz: 'Quiz',
    friend: 'Friend check',
  }
  const kind = KIND[pr.kind] || 'Proof'
  const decision = pr.referee_decision
  const passed = decision ? decision === 'approve' : pr.ai_verdict === 'pass'
  if (pr.counted || passed)
    return { icon: 'check', tone: 'bg-kept-soft text-kept', title: `${kind} accepted`, tag: pr.counted ? 'Counted' : 'Passed', reason: pr.ai_reason }
  if (pr.ai_verdict === 'unsure' && !decision)
    return { icon: 'spark', tone: 'bg-sun-soft text-[#a07000]', title: `${kind} sent to a friend to check`, tag: 'Waiting', reason: pr.ai_reason }
  return { icon: 'x', tone: 'bg-broke-soft text-broke', title: `${kind} not accepted`, tag: 'Not counted', reason: pr.ai_reason }
}

export function EventItem({ e, detailed = false }) {
  const d = describe(e)
  return (
    <li>
      <Link to={`/p/${e.promise.id}`} className="flex gap-3.5 px-5 py-3.5 transition-colors hover:bg-white/70">
        <span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ${d.tone}`}>
          <Icon name={d.icon} className="size-[18px]" strokeWidth={2.1} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-sm font-semibold">{d.title}</p>
            <span className="shrink-0 text-xs text-ink-soft">{ago(e.at)}</span>
          </div>
          <p className="truncate text-sm text-ink-soft">{e.promise.summary}</p>
          {detailed && d.reason && (
            <p className="mt-1.5 rounded-lg bg-canvas px-3 py-2 text-sm leading-relaxed text-ink">
              <span className="font-semibold">AI referee:</span> {d.reason}
            </p>
          )}
        </div>
      </Link>
    </li>
  )
}

const FILTERS = [
  ['all', 'Everything'],
  ['proof', 'Proofs'],
  ['money', 'Money'],
]

// Days hang off one line that draws itself down the page as you scroll.
function Timeline({ groups }) {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 70%', 'end 60%'] })
  const draw = useSpring(scrollYProgress, { stiffness: 120, damping: 24 })
  return (
    <div ref={ref} className="relative space-y-7 pl-9">
      <span aria-hidden="true" className="absolute bottom-2 left-[11px] top-2 w-[2px] rounded-full bg-ink/[0.07]" />
      <motion.span
        aria-hidden="true"
        style={{ scaleY: draw }}
        className="absolute bottom-2 left-[11px] top-2 w-[2px] origin-top rounded-full bg-[linear-gradient(to_bottom,#1e3bff,#0e9f72)]"
      />
      {groups.map((g, i) => (
        <motion.section
          key={g.label}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: Math.min(i, 6) * 0.06 }}
        >
          <h2 className="relative mb-2.5 flex items-center px-1 font-display text-sm font-bold text-ink">
            <span aria-hidden="true" className="absolute -left-[33px] grid size-[18px] place-items-center rounded-full bg-white shadow-[0_0_0_4px_rgba(30,59,255,0.12)]">
              <span className="size-2 rounded-full bg-cobalt" />
            </span>
            {g.label}
          </h2>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-ink/[0.06]">
              {g.items.map((e) => (
                <EventItem key={e.id} e={e} detailed />
              ))}
            </ul>
          </Card>
        </motion.section>
      ))}
    </div>
  )
}

export default function Activity() {
  const { promises, error } = useMyPromises()
  const activity = useActivity(promises)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    document.title = 'Activity · Promise Keeper'
  }, [])

  const events = (activity?.events || []).filter((e) =>
    filter === 'all' ? true : filter === 'proof' ? e.type === 'proof' : e.type !== 'proof',
  )

  // Group by day: "Today", "Yesterday", "Monday, Nov 3"
  const groups = []
  for (const e of events) {
    const d = new Date(e.at)
    const y = new Date()
    y.setDate(y.getDate() - 1)
    const label =
      d.toDateString() === new Date().toDateString()
        ? 'Today'
        : d.toDateString() === y.toDateString()
          ? 'Yesterday'
          : d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
    if (!groups.length || groups[groups.length - 1].label !== label) groups.push({ label, items: [] })
    groups[groups.length - 1].items.push(e)
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Activity" hint="Every check-in, photo and payment, with what the AI referee said." />

      <div className="glass flex w-fit gap-1 rounded-full p-1">
        {FILTERS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`relative rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              filter === k ? 'text-white' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {filter === k && (
              <motion.span
                layoutId="activity-filter"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-full bg-ink"
              />
            )}
            <span className="relative">{label}</span>
          </button>
        ))}
      </div>

      {error && <p className="rounded-xl bg-broke-soft px-4 py-3 text-sm text-broke">{error}</p>}

      {!activity || (!activity.loaded && events.length === 0) ? (
        <Card className="space-y-3 p-5">
          {[0, 1, 2, 3].map((k) => (
            <Skeleton key={k} className="h-12" />
          ))}
        </Card>
      ) : events.length === 0 ? (
        <Card>
          <EmptyState
            icon="pulse"
            title="Nothing here yet"
            action={
              <ButtonLink to="/app/new" icon="plus">
                Make a promise
              </ButtonLink>
            }
          >
            Once you lock in a promise and start proving it, every step shows up here.
          </EmptyState>
        </Card>
      ) : (
        <Timeline groups={groups} />
      )}
    </div>
  )
}
