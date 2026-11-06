import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { motion } from 'motion/react'
import { api } from '../api'
import { formatCents } from '../money'
import CoinStage from '../three/CoinStage'
import ProvePanel from '../components/ProvePanel'
import { setCoin } from '../three/coinStore'

const EASE = [0.16, 1, 0.3, 1]

function timeLeft(deadline) {
  const ms = new Date(deadline) - new Date()
  if (ms <= 0) return 'The deadline has passed'
  const h = Math.floor(ms / 3.6e6)
  const d = Math.floor(h / 24)
  if (d >= 1) return `${d} day${d === 1 ? '' : 's'}, ${h % 24} hour${h % 24 === 1 ? '' : 's'} left`
  const m = Math.floor((ms % 3.6e6) / 6e4)
  return `${h} hour${h === 1 ? '' : 's'}, ${m} min left`
}

function statusLine(p) {
  if (p.status === 'draft') return 'Payment not finished, so this promise is not locked in yet.'
  if (p.status === 'active') return 'Locked in. PayPal is holding the stake.'
  if (p.outcome === 'won' || p.status === 'won') return 'Promise kept. The stake goes back.'
  if (p.outcome === 'lost' || p.status === 'lost') return 'Promise broken. The stake goes out.'
  return 'Settled.'
}

function proofIcon(proof) {
  if (proof.counted) return { mark: '✓', cls: 'bg-kept text-white', label: 'Counted' }
  if (proof.ai_verdict === 'unsure' && !proof.referee_decision) return { mark: '?', cls: 'bg-sun-soft text-ink', label: 'Waiting for your friend' }
  return { mark: '✕', cls: 'bg-broke text-white', label: 'Not counted' }
}

export default function PromisePage() {
  const { id } = useParams()
  const [p, setP] = useState(null)
  const [missing, setMissing] = useState(false)
  const [demoAvailable, setDemoAvailable] = useState(false)

  const show = useCallback((data) => {
    setP(data)
    const outcome = data.outcome || (data.status === 'won' || data.status === 'lost' ? data.status : null)
    setCoin({
      mode: data.status === 'draft' ? 'deal' : 'progress',
      stakeCents: data.stake_cents,
      done: data.done_count,
      target: data.target_count,
      outcome,
    })
  }, [])

  // Pass fresh data in, or call with nothing to reload from the server.
  const refresh = useCallback(
    (data) => (data ? show(data) : api(`/promises/${id}`).then(show).catch(() => {})),
    [id, show],
  )

  useEffect(() => {
    let alive = true
    api(`/promises/${id}`)
      .then((data) => alive && show(data))
      .catch(() => alive && setMissing(true))
    api('/health')
      .then((h) => alive && setDemoAvailable(Boolean(h.demo_mode)))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [id, show])

  if (missing) {
    return (
      <main className="grid min-h-svh place-items-center px-6 text-center">
        <div>
          <h1 className="font-display text-5xl font-extrabold tracking-tight">No promise here.</h1>
          <p className="mt-3 text-ink-soft">The link may be wrong or incomplete.</p>
          <Link to="/" className="mt-8 inline-block rounded-full bg-cobalt px-6 py-3 font-semibold text-white">
            Make a promise
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main>
      <section className="mx-auto grid max-w-7xl gap-6 px-6 pt-24 md:grid-cols-[1fr_1fr] md:gap-10 md:px-10 md:pt-0">
        <div className="order-2 pb-20 md:order-1 md:flex md:min-h-svh md:flex-col md:justify-center md:py-32">
          {p ? (
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE }}>
              <p className="text-ink-soft">{statusLine(p)}</p>
              <h1 className="mt-4 max-w-xl font-display text-[clamp(2rem,4.2vw,3.5rem)] font-extrabold leading-[0.98] tracking-[-0.03em]">
                {p.summary || p.raw_text}
              </h1>

              <div className="mt-12 flex items-end gap-5">
                <span data-testid="progress" className="font-display text-[clamp(5rem,12vw,9.5rem)] font-extrabold leading-[0.8] tracking-[-0.05em]">
                  {p.done_count}
                </span>
                <span className="pb-2 font-display text-2xl font-semibold leading-tight text-ink-soft">
                  of {p.target_count}
                  <br />
                  {p.target_count === 1 ? 'time' : 'times'}
                </span>
              </div>

              <p className="mt-10 max-w-md text-lg leading-relaxed text-ink-soft">
                <span className="font-semibold text-ink">{formatCents(p.stake_cents)}</span> on the line.{' '}
                {p.deadline && <span>{timeLeft(p.deadline)}.</span>} If {p.name || 'you'} {p.name ? 'misses' : 'miss'} it, the
                money goes to <span className="font-semibold text-ink">{p.recipient === 'charity' ? 'charity' : p.recipient}</span>.
              </p>

              <div className="mt-10 max-w-xl">
                <ProvePanel promise={p} onChange={refresh} demoAvailable={demoAvailable} />
              </div>
            </motion.div>
          ) : (
            <p className="text-ink-soft">Loading the promise…</p>
          )}
        </div>
        <div className="order-1 md:order-2">
          <div className="relative h-[42svh] md:sticky md:top-0 md:h-svh">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              <div className="absolute left-[12%] top-[18%] size-[62%] rounded-full bg-cobalt-soft blur-3xl" />
              <div className="absolute bottom-[20%] right-[10%] size-[40%] rounded-full bg-kept-soft blur-3xl" />
            </div>
            <CoinStage className="absolute inset-0" ringSegments={p?.target_count || 1} />
          </div>
        </div>
      </section>

      {p && (
        <section className="border-t border-line bg-surface text-ink">
          <div className="mx-auto grid max-w-7xl gap-14 px-6 py-20 md:grid-cols-[1.4fr_1fr] md:px-10 md:py-28">
            <div>
              <h2 className="font-display text-3xl font-extrabold tracking-[-0.02em]">Proof so far</h2>
              {p.proofs.length === 0 ? (
                <p className="mt-4 max-w-md leading-relaxed text-ink-soft">
                  Nothing yet. Every check-in shows up here with the AI's reason, whether it counts or not.
                </p>
              ) : (
                <ol className="mt-8 space-y-5">
                  {p.proofs.map((proof) => {
                    const icon = proofIcon(proof)
                    return (
                      <li key={proof.id} className="flex gap-4">
                        <span aria-label={icon.label} className={`grid size-9 shrink-0 place-items-center rounded-full font-bold ${icon.cls}`}>
                          {icon.mark}
                        </span>
                        <div>
                          <p className="font-medium">{proof.ai_reason || icon.label}</p>
                          <p className="text-sm text-ink-soft">
                            {new Date(proof.started_at).toLocaleString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' })}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}
            </div>
            <div>
              <h2 className="font-display text-3xl font-extrabold tracking-[-0.02em]">Money trail</h2>
              <p className="mt-4 leading-relaxed text-ink-soft">Every PayPal transaction for this promise, so you can check it moved.</p>
              <dl className="mt-6 space-y-4 text-sm">
                <div>
                  <dt className="text-ink-soft">Stake order</dt>
                  <dd className="mt-0.5 break-all font-medium">{p.paypal_order_id || 'Not created yet'}</dd>
                </div>
                <div>
                  <dt className="text-ink-soft">Stake captured</dt>
                  <dd className="mt-0.5 break-all font-medium">{p.paypal_capture_id || 'Not paid yet'}</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>
      )}
    </main>
  )
}
