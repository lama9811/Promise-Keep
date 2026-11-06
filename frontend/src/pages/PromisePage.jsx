import { useEffect, useState } from 'react'
import { api } from '../api'
import { formatCents, TYPE_LABEL } from '../money'

function timeLeft(deadline) {
  const ms = new Date(deadline) - new Date()
  if (ms <= 0) return 'Deadline passed'
  const h = Math.floor(ms / 3.6e6)
  const d = Math.floor(h / 24)
  return d >= 1 ? `${d}d ${h % 24}h left` : `${h}h ${Math.floor((ms % 3.6e6) / 6e4)}m left`
}

const STATUS = {
  draft: { label: 'Waiting for payment', color: 'bg-stone-200 text-stone-700' },
  active: { label: 'Active', color: 'bg-blue-100 text-blue-800' },
  won: { label: 'Kept! 🎉', color: 'bg-green-100 text-green-800' },
  lost: { label: 'Broken', color: 'bg-red-100 text-red-800' },
  settled: { label: 'Settled', color: 'bg-stone-800 text-white' },
}

export default function PromisePage({ id }) {
  const [p, setP] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    api(`/promises/${id}`)
      .then((data) => alive && setP(data))
      .catch(() => alive && setError('Promise not found.'))
    return () => { alive = false }
  }, [id])

  if (error) return <p className="mt-8 text-red-700">{error}</p>
  if (!p) return <p className="mt-8 text-stone-500">Loading…</p>

  const status = STATUS[p.status] || STATUS.draft
  const pct = Math.min(100, Math.round((p.done_count / p.target_count) * 100))

  return (
    <div className="mt-4 space-y-5">
      <section className="rounded-2xl bg-white border border-stone-200 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold rounded-full px-3 py-1 ${status.color}`}>{status.label}</span>
          <span className="text-sm text-stone-500">{p.deadline && timeLeft(p.deadline)}</span>
        </div>
        <p className="mt-3 text-xl font-semibold">{p.summary || p.raw_text}</p>
        <p className="text-sm text-stone-500">{TYPE_LABEL[p.type]}</p>

        <div className="mt-6 text-center">
          <p className="text-5xl font-bold" data-testid="progress">{p.done_count} of {p.target_count}</p>
          <div className="mt-3 h-3 rounded-full bg-stone-200 overflow-hidden">
            <div className="h-full bg-green-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <p className="mt-5 text-sm text-stone-600">
          <b>{formatCents(p.stake_cents)}</b> on the line. If {p.name || 'you'} miss{p.name ? 'es' : ''} it, it goes to{' '}
          <b>{p.recipient === 'charity' ? 'charity' : p.recipient}</b>.
        </p>
      </section>

      {p.proofs.length > 0 && (
        <section className="rounded-2xl bg-white border border-stone-200 p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-stone-500 mb-2">Proof so far</p>
          <ul className="space-y-2">
            {p.proofs.map((proof) => (
              <li key={proof.id} className="text-sm">
                {proof.counted ? '✅' : proof.ai_verdict === 'unsure' ? '⏳' : '❌'}{' '}
                {new Date(proof.started_at).toLocaleString()} · {proof.ai_reason || proof.kind}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="text-xs text-stone-500 space-y-1">
        <p>PayPal order: <span className="font-mono">{p.paypal_order_id || '—'}</span></p>
        <p>PayPal capture: <span className="font-mono">{p.paypal_capture_id || '—'}</span></p>
      </section>
    </div>
  )
}
