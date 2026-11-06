import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { PayPalButtons } from '@paypal/react-paypal-js'
import { api } from '../api'
import { formatCents, dollarsToCents } from '../money'
import { kickCoin, setCoin } from '../three/coinStore'
import { EMAIL_RE, VERB, friendlyDeadline } from '../deal'

const GymPicker = lazy(() => import('./GymPicker'))

const EASE = [0.16, 1, 0.3, 1]
const field =
  'mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-base text-ink placeholder:text-ink/35 transition-colors focus:border-cobalt focus:outline-none focus:ring-4 focus:ring-cobalt/15'

export default function DealSheet({ text, deal, setDeal, onEdit }) {
  const navigate = useNavigate()
  const [me, setMe] = useState({ name: '', email: '' })
  const [gym, setGym] = useState(null)
  const [error, setError] = useState('')
  const [locking, setLocking] = useState(false)
  const promiseIdRef = useRef(null)

  const set = (key) => (e) => setDeal({ ...deal, [key]: e.target.value })
  const stakeCents = dollarsToCents(deal.stake_dollars || 0)

  useEffect(() => {
    if (stakeCents >= 100 && stakeCents <= 10000) setCoin({ stakeCents })
  }, [stakeCents])

  const friendLabel = deal.friend_name || 'my friend'
  const problems = []
  if (!deal.to_charity && !EMAIL_RE.test(deal.friend_email)) problems.push(`${deal.friend_name || 'your friend'}'s PayPal email`)
  if (!deal.to_charity && me.email.trim() && deal.friend_email.trim().toLowerCase() === me.email.trim().toLowerCase())
    problems.push('a friend other than you')
  if (stakeCents < 100 || stakeCents > 10000) problems.push('a stake from $1 to $100')
  if (!deal.deadline_local || new Date(deal.deadline_local) <= new Date()) problems.push('a deadline in the future')
  if (deal.type === 'gym' && !gym) problems.push('your gym on the map')
  if (!me.name.trim()) problems.push('your name')
  if (!EMAIL_RE.test(me.email)) problems.push('your PayPal email')

  // PayPal keeps the first createOrder it was given, so read the newest
  // values through a ref instead of the closure.
  const latest = useRef()
  useEffect(() => {
    latest.current = { deal, me, gym, text, stakeCents }
  })

  const createOrder = async () => {
    const { deal, me, gym, text, stakeCents } = latest.current
    setError('')
    const res = await api('/promises', {
      method: 'POST',
      body: JSON.stringify({
        name: me.name.trim(),
        paypal_email: me.email.trim(),
        raw_text: text,
        type: deal.type,
        target_count: Number(deal.target_count),
        deadline: new Date(deal.deadline_local).toISOString(),
        stake_cents: stakeCents,
        recipient: deal.to_charity ? 'charity' : deal.friend_email.trim(),
        summary: deal.summary,
        gym_lat: deal.type === 'gym' ? gym?.lat : null,
        gym_lng: deal.type === 'gym' ? gym?.lng : null,
      }),
    })
    promiseIdRef.current = res.promise_id
    return res.order_id
  }

  const onApprove = async (data) => {
    setLocking(true)
    const id = promiseIdRef.current
    await api(`/promises/${id}/capture`, { method: 'POST', body: JSON.stringify({ order_id: data.orderID }) })
    // The ring clamps around the coin before we move on.
    setCoin({ mode: 'locked' })
    kickCoin(3)
    setTimeout(() => navigate(`/p/${id}`), 1100)
  }

  const blank = 'blank rounded-md'

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, rotateX: 8 }}
      animate={{ opacity: 1, y: 0, rotateX: 0, transition: { duration: 0.9, ease: EASE } }}
      exit={{ opacity: 0, y: 20, transition: { duration: 0.3 } }}
      style={{ transformPerspective: 1200 }}
      className="mt-10 max-w-xl rounded-[28px] border border-line bg-surface p-6 text-ink shadow-[0_50px_100px_-45px_rgba(30,59,255,0.35)] md:p-9"
    >
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm text-ink-soft">Here's your deal. Tap anything blue to change it.</p>
        <button onClick={onEdit} className="shrink-0 text-sm text-ink-soft underline underline-offset-4 hover:text-ink">
          Rewrite
        </button>
      </div>

      {deal.needs_clarification && (
        <p className="mt-5 rounded-xl bg-sun-soft px-4 py-3 text-sm text-ink">{deal.needs_clarification}</p>
      )}

      {/* The contract, as one sentence with editable blanks */}
      <p className="mt-6 font-display text-[1.65rem] font-semibold leading-[1.45] tracking-[-0.01em] md:text-[1.9rem]">
        I'll{' '}
        <select aria-label="What" value={deal.type} onChange={set('type')} className={`${blank} cursor-pointer appearance-none`}>
          {Object.entries(VERB).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>{' '}
        <input
          aria-label="How many times"
          type="number"
          min="1"
          max="30"
          value={deal.target_count}
          onChange={set('target_count')}
          className={`${blank} text-center`}
        />{' '}
        {Number(deal.target_count) === 1 ? 'time' : 'times'} by{' '}
        <span className="blank relative cursor-pointer whitespace-nowrap rounded-md">
          {friendlyDeadline(deal.deadline_local)}
          <input
            aria-label="Deadline"
            type="datetime-local"
            value={deal.deadline_local}
            onChange={set('deadline_local')}
            onClick={(e) => e.currentTarget.showPicker?.()}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </span>
        . If I don't,{' '}
        <span className="blank whitespace-nowrap rounded-md">
          $
          <input
            aria-label="Stake in dollars"
            type="number"
            min="1"
            max="100"
            value={deal.stake_dollars}
            onChange={set('stake_dollars')}
            className="bg-transparent [field-sizing:content] focus:outline-none"
          />
        </span>{' '}
        goes to{' '}
        <select
          aria-label="Who gets the money"
          value={deal.to_charity ? 'charity' : 'friend'}
          onChange={(e) => setDeal({ ...deal, to_charity: e.target.value === 'charity' })}
          className={`${blank} cursor-pointer appearance-none`}
        >
          <option value="friend">{friendLabel}</option>
          <option value="charity">charity</option>
        </select>
        .
      </p>

      <div className="mt-8 space-y-6">
        {!deal.to_charity && (
          <label className="block text-sm font-medium">
            {deal.friend_name ? `${deal.friend_name}'s` : "Your friend's"} PayPal email
            <input type="email" value={deal.friend_email} onChange={set('friend_email')} placeholder="name@example.com" className={field} />
          </label>
        )}

        {deal.type === 'gym' && (
          <Suspense fallback={<div className="h-72 animate-pulse rounded-2xl bg-ink/5" />}>
            <GymPicker value={gym} onChange={setGym} />
          </Suspense>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Your name
            <input value={me.name} onChange={(e) => setMe({ ...me, name: e.target.value })} className={field} autoComplete="given-name" />
          </label>
          <label className="block text-sm font-medium">
            Your PayPal email
            <input
              type="email"
              value={me.email}
              onChange={(e) => setMe({ ...me, email: e.target.value })}
              className={field}
              autoComplete="email"
            />
          </label>
        </div>
      </div>

      <div className="mt-9 border-t border-ink/10 pt-7">
        {problems.length > 0 ? (
          <p className="text-sm leading-relaxed text-ink-soft">Before you pay, add {problems.join(', ')}.</p>
        ) : (
          <p className="font-display text-xl font-bold">
            {locking ? 'Locking it in…' : `Lock in ${formatCents(stakeCents)} with PayPal`}
          </p>
        )}
        <p className="mt-1 text-sm text-ink-soft">You get it all back if you keep your promise.</p>
        <div className={`mt-5 transition-opacity ${problems.length ? 'pointer-events-none opacity-30' : ''}`}>
          <PayPalButtons
            style={{ layout: 'vertical', shape: 'pill', label: 'pay', height: 52 }}
            fundingSource="paypal"
            disabled={problems.length > 0}
            createOrder={createOrder}
            onApprove={onApprove}
            onError={() => setError('PayPal stopped the payment. Check your details and try again.')}
            onCancel={() => setError('Payment cancelled. Your promise is not locked in yet.')}
          />
        </div>
        <p role="status" className="mt-3 min-h-5 text-sm text-broke">
          {error}
        </p>
      </div>
    </motion.div>
  )
}
