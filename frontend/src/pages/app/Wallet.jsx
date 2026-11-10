import { useEffect, useState } from 'react'
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react'
import CountUp from '../../fx/CountUp'
import { Link } from 'react-router'
import { formatCents } from '../../money'
import { moneyFrom, outcomeOf, useMyPromises } from '../../app/data'
import { ButtonLink, Card, CardHeader, CoinMark, EmptyState, Icon, PageTitle, Skeleton } from '../../app/ui'

function rowOf(p) {
  const o = outcomeOf(p)
  if (o === 'won') return { label: 'Refunded', tone: 'bg-kept-soft text-kept', sign: '+', amount: 'text-kept', note: 'Back to your PayPal' }
  if (o === 'lost')
    return {
      label: 'Paid out',
      tone: 'bg-broke-soft text-broke',
      sign: '−',
      amount: 'text-ink',
      note: p.recipient === 'charity' ? 'Sent to charity' : `Sent to ${p.recipient || 'your friend'}`,
    }
  return { label: 'Held', tone: 'bg-cobalt-soft text-cobalt', sign: '', amount: 'text-ink', note: 'Held until the deadline' }
}


const dollars = (cents) => (v) => formatCents(Math.abs(v - cents) < 1 ? cents : Math.round(v / 100) * 100)
const CHROME =
  'bg-[radial-gradient(120%_140%_at_15%_10%,#ffffff_0%,#e4e8fb_30%,#b9c1ec_62%,#7d88c9_88%,#4a58c4_100%)]'

// The money you have on promises, as a chrome card you can hold: it leans
// toward the cursor, catches the light, and flips over when clicked.
function MoneyCard({ m, loading }) {
  const reduced = useReducedMotion()
  const [flipped, setFlipped] = useState(false)
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const sx = useSpring(px, { stiffness: 140, damping: 16 })
  const sy = useSpring(py, { stiffness: 140, damping: 16 })
  const tiltY = useTransform(sx, [0, 1], [-16, 16])
  const tiltX = useTransform(sy, [0, 1], [12, -12])
  const flip = useSpring(0, { stiffness: 90, damping: 15 })
  const rotateY = useTransform([tiltY, flip], ([t, f]) => t + f)
  const sheenX = useTransform(sx, [0, 1], [0, 100])
  const sheenY = useTransform(sy, [0, 1], [0, 100])
  const sheen = useMotionTemplate`radial-gradient(70% 90% at ${sheenX}% ${sheenY}%, rgba(255,255,255,0.85), transparent 60%), linear-gradient(115deg, transparent 20%, rgba(255,216,74,0.35) ${sheenX}%, rgba(110,240,190,0.3) calc(${sheenX}% + 12%), transparent 80%)`
  const shadowX = useTransform(sx, [0, 1], [30, -30])

  useEffect(() => {
    flip.set(flipped ? 180 : 0)
  }, [flipped, flip])

  const onMove = (e) => {
    if (reduced || e.pointerType === 'touch') return
    const r = e.currentTarget.getBoundingClientRect()
    px.set((e.clientX - r.left) / r.width)
    py.set((e.clientY - r.top) / r.height)
  }
  const onLeave = () => {
    px.set(0.5)
    py.set(0.5)
  }

  const face = `absolute inset-0 overflow-hidden rounded-[26px] ${CHROME} shadow-[inset_0_0_0_1px_rgba(255,255,255,0.7),inset_0_-30px_60px_-30px_rgba(30,59,255,0.35)] [backface-visibility:hidden]`
  const Sheen = () => (
    <motion.span aria-hidden="true" style={{ background: sheen }} className="pointer-events-none absolute inset-0 mix-blend-overlay" />
  )

  return (
    <div
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className="relative grid place-items-center overflow-hidden rounded-3xl px-6 py-12 md:py-16"
      style={{ perspective: 1200 }}
    >
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_40%,rgba(228,233,255,0.9),transparent)]" />
      <motion.button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? 'Show the amount on the line' : 'Show where your money went'}
        animate={reduced ? undefined : { y: [0, -8, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        style={{ rotateX: tiltX, rotateY, transformStyle: 'preserve-3d' }}
        className="relative aspect-[1.586] w-full max-w-[420px] cursor-pointer rounded-[26px] text-left text-ink focus-visible:outline-cobalt"
      >
        {/* Thickness: a few slightly darker layers behind each face */}
        {[1, 2, 3, 4, 5].map((z) => (
          <span
            key={z}
            aria-hidden="true"
            className="absolute inset-0 rounded-[26px] bg-[#7d88c9]"
            style={{ transform: `translateZ(${-z}px)`, opacity: 0.9 - z * 0.08 }}
          />
        ))}

        {/* Front */}
        <div className={face} style={{ transform: 'translateZ(1px)' }}>
          <div className="absolute inset-0 bg-[repeating-linear-gradient(100deg,rgba(255,255,255,0.08)_0_2px,transparent_2px_6px)]" />
          <div className="relative flex h-full flex-col justify-between p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 whitespace-nowrap font-display text-sm font-bold tracking-tight sm:text-base">
                <CoinMark className="size-7" />
                Promise Keeper
              </span>
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-cobalt sm:text-xs">
                <Icon name="lock" className="size-3.5" />
                Held by PayPal
              </span>
            </div>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-ink/70">On the line right now</p>
                {loading ? (
                  <Skeleton className="mt-2 h-12 w-36 bg-white/50" />
                ) : (
                  <p className="font-display text-[2.5rem] font-extrabold sm:text-[3.2rem] leading-none tracking-[-0.045em] tabular-nums [text-shadow:0_1px_0_rgba(255,255,255,0.8)]">
                    <CountUp value={m.onTheLine} format={dollars(m.onTheLine)} />
                  </p>
                )}
              </div>
              {/* The card's chip, in sun gold */}
              <span aria-hidden="true" className="grid h-10 w-13 shrink-0 grid-cols-3 gap-px overflow-hidden rounded-lg bg-[#c99a1e] p-px shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                {Array.from({ length: 6 }, (_, i) => (
                  <span key={i} className="bg-[linear-gradient(135deg,#ffe58a,#ffd84a_50%,#e0b020)]" />
                ))}
              </span>
            </div>
          </div>
          <Sheen />
        </div>

        {/* Back */}
        <div className={face} style={{ transform: 'rotateY(180deg) translateZ(6px)' }}>
          <div className="absolute inset-x-0 top-7 h-11 bg-ink/85" />
          <div className="relative flex h-full flex-col justify-end gap-2 p-4 sm:gap-3 sm:p-6">
            {[
              ['Back to you', m.returned, 'text-kept'],
              ['Paid out', m.paidOut, 'text-broke'],
              ['Staked in total', m.total, 'text-ink'],
            ].map(([label, v, tone]) => (
              <div key={label} className="flex items-baseline justify-between rounded-xl bg-white/65 px-3.5 py-2">
                <span className="text-sm font-semibold text-ink/70">{label}</span>
                <span className={`font-display text-lg font-bold tabular-nums ${tone}`}>{formatCents(v)}</span>
              </div>
            ))}
          </div>
          <Sheen />
        </div>
      </motion.button>
      {/* Floor shadow that slides opposite the tilt */}
      <motion.div
        aria-hidden="true"
        style={{ x: shadowX }}
        className="mt-6 h-6 w-[70%] max-w-[340px] rounded-[100%] bg-ink/25 blur-xl"
      />
      <p className="relative mt-3 text-sm text-ink-soft">{flipped ? 'Tap the card to flip it back.' : 'Tap the card to see where your money went.'}</p>
    </div>
  )
}

export default function Wallet() {
  const { promises, error } = useMyPromises()
  const m = moneyFrom(promises)
  const loading = promises === null

  useEffect(() => {
    document.title = 'Wallet · Promise Keeper'
  }, [])

  const money = (v) =>
    loading ? (
      <Skeleton className="mt-2 h-8 w-20" />
    ) : (
      <p className="mt-1 font-display text-xl font-extrabold sm:text-[2rem] tracking-[-0.03em] tabular-nums">
        <CountUp value={v} format={dollars(v)} />
      </p>
    )

  return (
    <div className="space-y-6">
      <PageTitle title="Wallet" hint="Where every dollar you put on a promise is right now." />

      {error && <p className="rounded-xl bg-broke-soft px-4 py-3 text-sm text-broke">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card className="overflow-hidden">
          <MoneyCard m={m} loading={loading} />
        </Card>
        <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
          <Card className="flex flex-col justify-center p-3.5 sm:p-5">
            <p className="text-xs text-ink-soft sm:text-sm">Back to you</p>
            {money(m.returned)}
          </Card>
          <Card className="flex flex-col justify-center p-3.5 sm:p-5">
            <p className="text-xs text-ink-soft sm:text-sm">Paid out</p>
            {money(m.paidOut)}
          </Card>
          <Card className="flex flex-col justify-center p-3.5 sm:p-5">
            <p className="text-xs text-ink-soft sm:text-sm">Staked in total</p>
            {money(m.total)}
          </Card>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="Transactions" hint="One line per stake. Each one ends as a single refund or payout." />
        {loading ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : promises.length === 0 ? (
          <EmptyState
            icon="wallet"
            title="No money moved yet"
            action={
              <ButtonLink to="/app/new" icon="plus">
                Make a promise
              </ButtonLink>
            }
          >
            When you lock in a stake with PayPal it shows up here, then again when it's refunded or paid out.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-ink/[0.06]">
            {promises.map((p) => {
              const r = rowOf(p)
              return (
                <li key={p.id}>
                  <Link to={`/p/${p.id}`} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/70">
                    <span className="hidden w-14 shrink-0 text-sm text-ink-soft sm:block">
                      {p.created_at ? new Date(p.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{p.summary}</p>
                      <p className="truncate text-sm text-ink-soft">{r.note}</p>
                    </div>
                    <span className={`hidden rounded-full px-2.5 py-1 text-xs font-semibold sm:inline ${r.tone}`}>{r.label}</span>
                    <span className={`w-16 text-right font-display font-bold tabular-nums ${r.amount}`}>
                      {r.sign}
                      {formatCents(p.stake_cents)}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
