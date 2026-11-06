import { useEffect, useRef, useState } from 'react'
import { PayPalButtons } from '@paypal/react-paypal-js'
import { api } from '../api'
import { formatCents, dollarsToCents, TYPE_LABEL } from '../money'
import GymPicker from '../components/GymPicker'

const EXAMPLES = ['gym 3x this week or $20 to Alex', 'study 4 nights before Friday, $15 to charity']
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// "2026-11-08T23:59:00-05:00" -> "2026-11-08T23:59" in the phone's local time
function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const field = 'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base'

export default function CreatePromise() {
  const [text, setText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState('')
  const [deal, setDeal] = useState(null)
  const [me, setMe] = useState({ name: '', email: '' })
  const [gym, setGym] = useState(null)
  const promiseIdRef = useRef(null)

  const parse = async (e) => {
    e?.preventDefault()
    setError('')
    setParsing(true)
    try {
      const d = await api('/promises/parse', {
        method: 'POST',
        body: JSON.stringify({ text, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      })
      const isCharity = d.recipient.toLowerCase() === 'charity'
      setDeal({
        ...d,
        stake_dollars: d.stake_cents / 100,
        deadline_local: toLocalInput(d.deadline),
        to_charity: isCharity,
        friend_name: isCharity || EMAIL_RE.test(d.recipient) ? '' : d.recipient,
        friend_email: EMAIL_RE.test(d.recipient) ? d.recipient : '',
      })
    } catch (err) {
      setError('Could not read that. Try again in a moment.')
      console.error(err)
    } finally {
      setParsing(false)
    }
  }

  const set = (key) => (e) => setDeal({ ...deal, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  const stakeCents = deal ? dollarsToCents(deal.stake_dollars) : 0
  const problems = []
  if (deal) {
    if (!me.name.trim()) problems.push('your name')
    if (!EMAIL_RE.test(me.email)) problems.push('your PayPal email')
    if (!deal.to_charity && !EMAIL_RE.test(deal.friend_email)) problems.push("your friend's PayPal email")
    if (!deal.to_charity && me.email.trim() && deal.friend_email.trim().toLowerCase() === me.email.trim().toLowerCase())
      problems.push('a friend other than you')
    if (stakeCents < 100 || stakeCents > 10000) problems.push('a stake from $1 to $100')
    if (!deal.deadline_local || new Date(deal.deadline_local) <= new Date()) problems.push('a future deadline')
    if (deal.type === 'gym' && !gym) problems.push('your gym on the map')
  }

  // PayPal keeps the first createOrder it was given, so read the newest form
  // values through a ref instead of the closure.
  const latest = useRef()
  useEffect(() => {
    latest.current = { deal, me, gym, text, stakeCents }
  })

  const createOrder = async () => {
    const { deal, me, gym, text, stakeCents } = latest.current
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
    const id = promiseIdRef.current
    await api(`/promises/${id}/capture`, { method: 'POST', body: JSON.stringify({ order_id: data.orderID }) })
    window.location.hash = `#/p/${id}`
  }

  if (!deal) {
    return (
      <form onSubmit={parse} className="mt-6">
        <h1 className="text-3xl font-bold leading-tight">Your promises finally cost something.</h1>
        <p className="mt-2 text-stone-600">
          Bet money on your own goal. AI checks your proof. PayPal refunds you if you keep it, or pays your friend if you don't.
        </p>
        <label className="block mt-8 text-sm font-medium" htmlFor="goal">What do you promise?</label>
        <textarea
          id="goal"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder={EXAMPLES[0]}
          className={`${field} mt-2 text-lg`}
        />
        <div className="flex flex-wrap gap-2 mt-2">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => setText(ex)} className="text-xs rounded-full bg-stone-200 px-3 py-1">
              {ex}
            </button>
          ))}
        </div>
        <button
          disabled={parsing || text.trim().length < 3}
          className="mt-6 w-full rounded-xl bg-stone-900 py-4 text-lg font-semibold text-white disabled:opacity-40"
        >
          {parsing ? 'Reading your promise…' : 'Make it a deal'}
        </button>
        {error && <p className="mt-3 text-red-700">{error}</p>}
      </form>
    )
  }

  return (
    <div className="mt-4 space-y-5">
      <button onClick={() => setDeal(null)} className="text-sm text-stone-500">← Change my promise</button>

      {deal.needs_clarification && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-amber-900 text-sm">
          🤔 {deal.needs_clarification} You can fix it below.
        </div>
      )}

      <section className="rounded-2xl bg-white border border-stone-200 p-5 shadow-sm space-y-4">
        <p className="text-xs uppercase tracking-wide text-stone-500">The deal</p>
        <p className="text-xl font-semibold">{deal.summary}</p>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            What
            <select value={deal.type} onChange={set('type')} className={field}>
              {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="text-sm">
            How many times
            <input type="number" min="1" max="30" value={deal.target_count} onChange={set('target_count')} className={field} />
          </label>
          <label className="text-sm">
            Stake ($)
            <input type="number" min="1" max="100" step="1" value={deal.stake_dollars} onChange={set('stake_dollars')} className={field} />
          </label>
          <label className="text-sm">
            Deadline
            <input type="datetime-local" value={deal.deadline_local} onChange={set('deadline_local')} className={field} />
          </label>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">If I break it, the money goes to…</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setDeal({ ...deal, to_charity: false })}
              className={`flex-1 rounded-lg py-2 border ${!deal.to_charity ? 'bg-stone-900 text-white' : 'bg-white'}`}>
              A friend{deal.friend_name ? ` (${deal.friend_name})` : ''}
            </button>
            <button type="button" onClick={() => setDeal({ ...deal, to_charity: true })}
              className={`flex-1 rounded-lg py-2 border ${deal.to_charity ? 'bg-stone-900 text-white' : 'bg-white'}`}>
              Charity
            </button>
          </div>
          {!deal.to_charity && (
            <input type="email" placeholder={`${deal.friend_name || 'Friend'}'s PayPal email`} value={deal.friend_email}
              onChange={set('friend_email')} className={field} />
          )}
        </div>

        {deal.type === 'gym' && <GymPicker value={gym} onChange={setGym} />}
      </section>

      <section className="rounded-2xl bg-white border border-stone-200 p-5 shadow-sm space-y-3">
        <p className="text-xs uppercase tracking-wide text-stone-500">About you</p>
        <input placeholder="Your name" value={me.name} onChange={(e) => setMe({ ...me, name: e.target.value })} className={field} />
        <input type="email" placeholder="Your PayPal email (refunds go here)" value={me.email}
          onChange={(e) => setMe({ ...me, email: e.target.value })} className={field} />
      </section>

      <section className="space-y-3">
        {problems.length > 0 ? (
          <p className="text-sm text-stone-600">Still needed: {problems.join(', ')}.</p>
        ) : (
          <p className="text-center font-semibold">Lock in my promise: {formatCents(stakeCents)}</p>
        )}
        <div className={problems.length ? 'pointer-events-none opacity-40' : ''}>
          <PayPalButtons
            style={{ layout: 'vertical', shape: 'rect', label: 'pay' }}
            fundingSource="paypal"
            disabled={problems.length > 0}
            forceReRender={[stakeCents]}
            createOrder={createOrder}
            onApprove={onApprove}
            onError={(err) => {
              console.error(err)
              setError('PayPal had a problem. Please try again.')
            }}
          />
        </div>
        {error && <p className="text-red-700">{error}</p>}
      </section>
    </div>
  )
}
