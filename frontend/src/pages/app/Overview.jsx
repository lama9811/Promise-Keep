import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { displayName, useAuth } from '../../auth'
import { formatCents } from '../../money'
import { setCoin } from '../../three/coinStore'
import { moneyFrom, outcomeOf, streakFrom, useActivity, useAgent, useMyPromises, useNow, weekFrom } from '../../app/data'
import { ButtonLink, Card, CardHeader, EASE, Icon, PromiseRow, Skeleton, shortLeft, spotMove } from '../../app/ui'
import { CoinHero } from '../Home'
import FlapText from '../../fx/FlapBoard'
import IdeaCoins from '../../app/IdeaCoins'
import { EventItem, ago } from './Activity'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

// Ready-made promises. Tapping one sends it straight to the AI.
const IDEAS = [
  { icon: 'steps', title: '10k steps a day', text: '10,000 steps every day this week or $20 to Alex', stake: '$20', proof: 'Apple Health or screenshot', tint: 'bg-cobalt-soft', ink: 'text-cobalt' },
  { icon: 'gym', title: 'Gym 4x a week', text: 'gym 4 times this week or $25 to Alex', stake: '$25', proof: 'Check-in, WHOOP or gym app', tint: 'bg-kept-soft', ink: 'text-kept' },
  { icon: 'run', title: 'Run 5 km 3x', text: 'run 5 km 3 times this week or $15 to Alex', stake: '$15', proof: 'Strava', tint: 'bg-sun-soft', ink: 'text-[#a07000]' },
  { icon: 'flame', title: '45-min workouts', text: 'work out 45 minutes 5 times this week or $20 to Alex', stake: '$20', proof: 'WHOOP or Strava', tint: 'bg-broke-soft', ink: 'text-broke' },
  { icon: 'ring', title: 'Close Exercise ring', text: 'close my exercise ring every day this week or $20 to Alex', stake: '$20', proof: 'Apple Watch', tint: 'bg-kept-soft', ink: 'text-kept' },
  { icon: 'ring', title: '500 Move calories', text: 'burn 500 move calories 5 days this week or $15 to Alex', stake: '$15', proof: 'Apple Watch', tint: 'bg-broke-soft', ink: 'text-broke' },
]

function Hero({ first, money, loading }) {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const go = (t) => navigate('/app/new', { state: { text: t, go: true } })
  const submit = (e) => {
    e.preventDefault()
    if (text.trim().length >= 3) go(text.trim())
  }
  const line = loading
    ? 'Loading your promises…'
    : money.active > 0
      ? `You have ${formatCents(money.onTheLine)} on the line across ${money.active} promise${money.active === 1 ? '' : 's'}. Keep going.`
      : 'Put money on your next workout. Hit your steps, runs or gym days and every cent comes back.'

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: EASE }}
      className="relative overflow-hidden rounded-[28px] border border-line bg-[linear-gradient(135deg,#e9edff_0%,#f7f8ff_45%,#fff8dc_100%)]"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 -top-24 size-80 rounded-full bg-cobalt/15 blur-3xl" />
        <div className="absolute -bottom-24 right-10 size-72 rounded-full bg-sun/40 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(10,18,64,0.06)_1px,transparent_1px)] [background-size:18px_18px] [mask-image:linear-gradient(to_right,black,transparent_70%)]" />
      </div>

      <div className="relative grid items-center md:grid-cols-[1.25fr_1fr]">
        <div className="order-2 p-6 pt-0 md:order-1 md:p-10">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-ink-soft shadow-sm">
            <span className="size-1.5 animate-pulse rounded-full bg-kept" />
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1 className="mt-4 font-display text-[2.3rem] font-extrabold leading-[0.95] tracking-[-0.04em] md:text-[3.4rem]">
            {greeting()}
            {first ? `, ${first}` : ''}.
          </h1>
          <p className="mt-3 max-w-md text-[17px] leading-relaxed text-ink-soft">{line}</p>

          <form
            onSubmit={submit}
            className="mt-6 flex flex-col gap-2 rounded-2xl border border-white bg-white p-2 shadow-[0_20px_40px_-24px_rgba(30,59,255,0.55)] focus-within:ring-4 focus-within:ring-cobalt/15 sm:flex-row sm:items-center"
          >
            <div className="flex flex-1 items-center gap-2">
            <Icon name="spark" className="ml-2 size-5 text-cobalt" />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              placeholder="What do you promise next?"
              aria-label="What do you promise next?"
              className="min-w-0 flex-1 bg-transparent py-2 text-[15px] placeholder:text-ink/40 focus:outline-none"
            />
            </div>
            <button
              type="submit"
              disabled={text.trim().length < 3}
              className="shrink-0 rounded-xl bg-cobalt px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1631e0] disabled:bg-ink/10 disabled:text-ink/40"
            >
              Make it a deal
            </button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {IDEAS.slice(0, 3).map((idea) => (
              <button
                key={idea.title}
                onClick={() => go(idea.text)}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-sm text-ink-soft transition-colors hover:bg-white hover:text-cobalt"
              >
                <Icon name={idea.icon} className="size-4" />
                {idea.title}
              </button>
            ))}
          </div>
        </div>
        <div className="order-1 md:order-2">
          <CoinHero className="h-56 md:h-[360px]" glow="bg-sun-soft" />
        </div>
      </div>
    </motion.section>
  )
}

// The four numbers as one departures board: each value flips into place.
function Scoreboard({ money, streak, week, loading, streakLoading }) {
  const cells = [
    {
      label: 'On the line',
      icon: 'lock',
      tone: 'text-cobalt',
      value: formatCents(money.onTheLine),
      note: `${money.active} active promise${money.active === 1 ? '' : 's'}`,
      busy: loading,
    },
    {
      label: 'Back to you',
      icon: 'wallet',
      tone: 'text-kept',
      value: formatCents(money.returned),
      note: `From ${money.kept} kept promise${money.kept === 1 ? '' : 's'}`,
      busy: loading,
    },
    {
      label: 'Kept rate',
      icon: 'check',
      tone: 'text-kept',
      value: money.keptRate === null ? 'New' : `${money.keptRate}%`,
      note:
        money.keptRate === null ? (
          'Shows after your first deadline'
        ) : (
          <span className="flex items-center gap-2">
            <MiniRing pct={money.keptRate} />
            {money.kept} of {money.kept + money.missed} kept
          </span>
        ),
      busy: loading,
    },
    {
      label: 'Streak',
      icon: 'flame',
      tone: 'text-[#e0a800]',
      value: String(streak),
      unit: streak === 1 ? 'day' : 'days',
      note: <StreakDots week={week} />,
      busy: streakLoading,
    },
  ]
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
      onPointerMove={spotMove}
      className="glass spot grid grid-cols-2 overflow-hidden rounded-3xl xl:grid-cols-4"
    >
      {cells.map((c, i) => (
        <div
          key={c.label}
          className={`relative p-5 md:p-6 ${i % 2 ? 'border-l border-ink/[0.06]' : ''} ${i > 1 ? 'border-t border-ink/[0.06] xl:border-t-0' : ''} ${i === 2 ? 'xl:border-l' : ''}`}
        >
          <p className="flex items-center gap-2 text-sm font-semibold text-ink/65">
            <Icon name={c.icon} className={`size-4 ${c.tone}`} strokeWidth={2.2} />
            {c.label}
          </p>
          <div className="mt-3 flex min-h-[3.2rem] items-end gap-2">
            {c.busy ? (
              <Skeleton className="h-12 w-28" />
            ) : (
              <>
                <FlapText text={c.value} start={200 + i * 180} className="font-display text-[2.1rem] font-extrabold tracking-tight md:text-[2.4rem]" />
                {c.unit && <span className="pb-1 font-display text-lg font-bold text-ink/60">{c.unit}</span>}
              </>
            )}
          </div>
          <div className="mt-3 min-h-6 text-sm text-ink/60">{c.note}</div>
        </div>
      ))}
    </motion.section>
  )
}

function MiniRing({ pct }) {
  const r = 9
  const c = 2 * Math.PI * r
  return (
    <svg width="24" height="24" className="-rotate-90">
      <circle cx="12" cy="12" r={r} fill="none" strokeWidth="4" className="stroke-kept-soft" />
      <circle cx="12" cy="12" r={r} fill="none" strokeWidth="4" strokeLinecap="round" className="stroke-kept" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
    </svg>
  )
}

function StreakDots({ week }) {
  return (
    <div className="flex gap-1.5">
      {week.map((d) => (
        <span
          key={d.key}
          title={d.full}
          className={`grid size-6 place-items-center rounded-full text-[10px] font-bold ${
            d.count ? 'bg-[#ffb800] text-white' : d.today ? 'border-2 border-dashed border-[#e0a800] bg-white text-ink/50' : 'bg-white/70 text-ink/40'
          }`}
        >
          {d.count ? <Icon name="flame" className="size-3.5" strokeWidth={2.2} /> : d.label}
        </span>
      ))}
    </div>
  )
}

function GetStarted({ promises, events }) {
  const steps = [
    { done: true, title: 'Create your account', text: "You're in. Nice." },
    { done: promises.length > 0, title: 'Lock in your first promise', text: 'Write it, check the deal, pay the stake with PayPal.', to: '/app/new', cta: 'Start' },
    { done: events.some((e) => e.type === 'proof'), title: 'Send your first proof', text: 'Open your promise and tap Prove it. The AI checks it in seconds.', to: promises[0] ? `/p/${promises[0].id}` : null, cta: 'Prove it' },
    { done: promises.some((p) => outcomeOf(p)), title: 'Reach your first deadline', text: 'Keep it and your money comes back to your PayPal.' },
  ]
  const done = steps.filter((s) => s.done).length
  const nextIdx = steps.findIndex((s) => !s.done)
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-5 pb-4 pt-5">
        <div>
          <h2 className="font-display text-lg font-bold">Get started</h2>
          <p className="text-sm text-ink-soft">
            {done} of {steps.length} done
          </p>
        </div>
        <div className="h-2 w-32 overflow-hidden rounded-full bg-ink/[0.07]">
          <motion.div
            className="h-full rounded-full bg-kept"
            initial={{ width: 0 }}
            animate={{ width: `${(done / steps.length) * 100}%` }}
            transition={{ duration: 1, ease: EASE }}
          />
        </div>
      </div>
      <ol className="border-t border-line">
        {steps.map((s, i) => (
          <li key={s.title} className={`flex items-center gap-4 border-b border-line px-5 py-4 last:border-b-0 ${i === nextIdx ? 'bg-cobalt-soft/40' : ''}`}>
            <span
              className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
                s.done ? 'bg-kept text-white' : i === nextIdx ? 'bg-cobalt text-white' : 'border-2 border-line text-ink-soft'
              }`}
            >
              {s.done ? <Icon name="check" className="size-4" strokeWidth={3} /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`font-semibold ${s.done ? 'text-ink-soft line-through decoration-ink/30' : ''}`}>{s.title}</p>
              <p className="text-sm text-ink-soft">{s.text}</p>
            </div>
            {i === nextIdx && s.to && (
              <ButtonLink to={s.to} className="shrink-0 !px-3.5 !py-2">
                {s.cta}
              </ButtonLink>
            )}
          </li>
        ))}
      </ol>
    </Card>
  )
}

function DueSoon({ promises, now }) {
  const next = (promises || [])
    .filter((p) => !outcomeOf(p) && p.deadline && new Date(p.deadline) > now)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))[0]
  if (!next) return null
  const ms = new Date(next.deadline) - now
  const parts = [
    [Math.floor(ms / 864e5), 'days'],
    [Math.floor((ms % 864e5) / 36e5), 'hrs'],
    [Math.floor((ms % 36e5) / 6e4), 'min'],
    [Math.floor((ms % 6e4) / 1e3), 'sec'],
  ]
  const left = next.target_count - next.done_count
  return (
    <div className="relative overflow-hidden rounded-2xl bg-ink p-5 text-white">
      <div aria-hidden="true" className="absolute -right-16 -top-16 size-48 rounded-full bg-cobalt/60 blur-3xl" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-white/70">Next deadline</p>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/80">
            <span className="size-1.5 animate-pulse rounded-full bg-kept" />
            Live
          </span>
        </div>
        <p className="mt-2 line-clamp-2 font-semibold">{next.summary}</p>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {parts.map(([n, unit]) => (
            <div key={unit} className="rounded-xl bg-white/10 py-2.5 text-center backdrop-blur">
              <p className="font-display text-2xl font-bold tabular-nums">{String(n).padStart(2, '0')}</p>
              <p className="text-[11px] text-white/60">{unit}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-white/70">
            {left > 0 ? `${left} more to go, ${formatCents(next.stake_cents)} on it` : 'All done. Nice work.'}
          </p>
          <Link to={`/p/${next.id}`} className="shrink-0 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-ink hover:bg-sun">
            Prove it
          </Link>
        </div>
      </div>
    </div>
  )
}

const AGENT_ICON = { check: 'clock', verify: 'shield', hold: 'clock', refund: 'wallet', payout: 'share', done: 'check', error: 'x' }
const AGENT_TONE = {
  refund: 'bg-kept-soft text-kept',
  payout: 'bg-cobalt-soft text-cobalt',
  done: 'bg-kept-soft text-kept',
  error: 'bg-broke-soft text-broke',
  hold: 'bg-sun-soft text-[#a07000]',
}

function AgentCard({ agent, now }) {
  const watching = agent?.watching || 0
  const next = agent?.next_deadline ? new Date(agent.next_deadline) : null
  const events = (agent?.events || []).slice(0, 4)
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        <span className="relative grid size-10 place-items-center rounded-xl bg-ink text-white">
          <Icon name="spark" className="size-5" />
          <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-white bg-kept">
            <span className="absolute inset-0 animate-ping rounded-full bg-kept" />
          </span>
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold">Promise agent</h2>
          <p className="truncate text-sm text-ink-soft">
            {!agent
              ? 'Connecting…'
              : watching
                ? `Watching ${watching} deadline${watching === 1 ? '' : 's'}${next && next > now ? `, next in ${shortLeft(next, now).replace(' left', '')}` : ''}`
                : 'On duty. Nothing due right now.'}
          </p>
        </div>
      </div>
      <p className="px-5 pt-4 text-sm leading-relaxed text-ink-soft">
        When a deadline passes, the agent checks your proof, confirms the stake with PayPal, then refunds you or pays it out
        on its own, and tells you why.
      </p>
      {events.length > 0 ? (
        <ul className="mt-3 space-y-3 px-5 pb-5">
          {events.map((e) => (
            <li key={e.id} className="flex gap-3">
              <span className={`grid size-7 shrink-0 place-items-center rounded-lg ${AGENT_TONE[e.kind] || 'bg-canvas text-ink'}`}>
                <Icon name={AGENT_ICON[e.kind] || 'spark'} className="size-3.5" strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <p className="text-sm leading-snug">{e.message}</p>
                <p className="text-xs text-ink-soft">{ago(e.at)}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 pb-5 pt-3 text-sm text-ink-soft">Its work will show up here, step by step.</p>
      )}
    </Card>
  )
}

function ThisWeek({ week, loading }) {
  const total = week.reduce((s, d) => s + d.count, 0)
  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-base font-bold">This week</h2>
        <span className="text-sm text-ink-soft">{loading ? 'Loading…' : `${total} proof${total === 1 ? '' : 's'}`}</span>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1.5">
        {week.map((d, i) => (
          <div key={d.key} className="flex flex-col items-center gap-1.5" title={`${d.full}: ${d.count} counted`}>
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.05 * i }}
              className={`grid aspect-square w-full max-w-10 place-items-center rounded-xl text-sm font-bold ${
                d.count
                  ? 'bg-cobalt text-white shadow-[0_8px_16px_-8px_rgba(30,59,255,0.9)]'
                  : d.today
                    ? 'border-2 border-dashed border-cobalt/50 text-cobalt'
                    : 'bg-canvas text-ink/30'
              }`}
            >
              {d.count ? <Icon name="check" className="size-4" strokeWidth={3} /> : d.date}
            </motion.span>
            <span className={`text-xs ${d.today ? 'font-bold text-ink' : 'text-ink-soft'}`}>{d.label}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-ink-soft">
        {total ? 'Every blue day is a proof that counted.' : 'Prove something today and it lights up here.'}
      </p>
    </Card>
  )
}

function HowProofWorks() {
  const steps = [
    ['run', 'Strava and WHOOP', 'Connect once. Runs and workouts you log there count by themselves.', 'bg-sun-soft text-[#c2410c]'],
    ['steps', 'Apple Watch and rings', 'Upload a screenshot of your rings or steps from the Fitness or Health app.', 'bg-broke-soft text-broke'],
    ['gym', 'Gym check-in', 'Your phone checks you’re at your gym for 30 minutes, then a quick live photo.', 'bg-kept-soft text-kept'],
    ['spark', 'AI reads screenshots', 'Upload any fitness screenshot. Claude reads the number and the date.', 'bg-cobalt-soft text-cobalt'],
  ]
  return (
    <Card>
      <CardHeader title="How proof works" />
      <ul className="space-y-4 p-5">
        {steps.map(([icon, title, text, tone]) => (
          <li key={title} className="flex gap-3">
            <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tone}`}>
              <Icon name={icon} className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-sm leading-relaxed text-ink-soft">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export default function Overview() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const first = displayName(session).split(' ')[0]
  const { promises, error } = useMyPromises()
  const activity = useActivity(promises)
  const now = useNow(1000)
  const loading = promises === null
  const money = moneyFrom(promises)
  const streak = streakFrom(activity?.events)
  const week = weekFrom(activity?.events)
  const active = (promises || []).filter((p) => !outcomeOf(p))
  const events = activity?.events || []
  const agent = useAgent()

  useEffect(() => {
    document.title = 'Overview · Promise Keeper'
  }, [])

  // The coin shows what's on the line, or the plain check when nothing is.
  useEffect(() => {
    if (money.onTheLine > 0) setCoin({ mode: 'deal', stakeCents: money.onTheLine, outcome: null })
    else setCoin({ mode: 'idle', stakeCents: 0, outcome: null, done: 0, target: 0 })
  }, [money.onTheLine])

  const showStarter = !loading && (promises.length === 0 || !events.some((e) => e.type === 'proof'))

  return (
    <div className="space-y-6">
      <Hero first={first} money={money} loading={loading} />

      {error && <p className="rounded-xl bg-broke-soft px-4 py-3 text-sm text-broke">{error}</p>}

      <Scoreboard money={money} streak={streak} week={week} loading={loading} streakLoading={loading || !activity?.loaded} />

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          {active.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader
                title="Active promises"
                hint={`${active.length} going right now`}
                action={
                  <Link to="/app/promises" className="text-sm font-semibold text-cobalt hover:underline">
                    View all
                  </Link>
                }
              />
              <ul className="divide-y divide-ink/[0.06]">
                {active.slice(0, 5).map((p, i) => (
                  <PromiseRow key={p.id} p={p} now={now} i={i} />
                ))}
              </ul>
            </Card>
          )}

          {loading ? (
            <Card className="space-y-3 p-5">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </Card>
          ) : (
            showStarter && <GetStarted promises={promises} events={events} />
          )}

          <IdeaCoins ideas={IDEAS} onStart={(text) => navigate('/app/new', { state: { text, go: true } })} />

          {events.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader
                title="Recent activity"
                action={
                  <Link to="/app/activity" className="text-sm font-semibold text-cobalt hover:underline">
                    See all
                  </Link>
                }
              />
              <ul className="divide-y divide-ink/[0.06]">
                {events.slice(0, 5).map((e) => (
                  <EventItem key={e.id} e={e} />
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <DueSoon promises={promises} now={now} />
          <AgentCard agent={agent} now={now} />
          <ThisWeek week={week} loading={!activity?.loaded} />
          <HowProofWorks />
        </div>
      </div>
    </div>
  )
}
