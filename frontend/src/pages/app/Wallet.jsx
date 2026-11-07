import { useEffect } from 'react'
import { Link } from 'react-router'
import { formatCents } from '../../money'
import { moneyFrom, outcomeOf, useMyPromises } from '../../app/data'
import { ButtonLink, Card, CardHeader, EmptyState, Icon, PageTitle, Skeleton } from '../../app/ui'

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

export default function Wallet() {
  const { promises, error } = useMyPromises()
  const m = moneyFrom(promises)
  const loading = promises === null

  useEffect(() => {
    document.title = 'Wallet · Promise Keeper'
  }, [])

  const money = (v) => (loading ? <Skeleton className="mt-2 h-8 w-20" /> : <p className="mt-1 font-display text-2xl font-bold tabular-nums">{formatCents(v)}</p>)

  return (
    <div className="space-y-6">
      <PageTitle title="Wallet" hint="Where every dollar you put on a promise is right now." />

      {error && <p className="rounded-xl bg-broke-soft px-4 py-3 text-sm text-broke">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="relative overflow-hidden rounded-2xl bg-ink p-6 text-white md:p-7">
          <div aria-hidden="true" className="absolute -right-16 -top-20 size-64 rounded-full bg-cobalt/50 blur-3xl" />
          <div aria-hidden="true" className="absolute -bottom-24 right-24 size-48 rounded-full bg-sun/25 blur-3xl" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white/70">On the line right now</p>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold">
                <Icon name="lock" className="size-3.5" />
                Locked in
              </span>
            </div>
            {loading ? (
              <Skeleton className="mt-3 h-14 w-40 bg-white/10" />
            ) : (
              <p className="mt-2 font-display text-[3.4rem] font-extrabold leading-none tracking-[-0.04em] tabular-nums">
                {formatCents(m.onTheLine)}
              </p>
            )}
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/70">
              Keep your promise and it all comes back to the PayPal account you paid with. Miss it and it goes where you
              said it would.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
          <Card className="p-4">
            <p className="text-sm text-ink-soft">Back to you</p>
            {money(m.returned)}
          </Card>
          <Card className="p-4">
            <p className="text-sm text-ink-soft">Paid out</p>
            {money(m.paidOut)}
          </Card>
          <Card className="p-4">
            <p className="text-sm text-ink-soft">Staked in total</p>
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
          <ul className="divide-y divide-line">
            {promises.map((p) => {
              const r = rowOf(p)
              return (
                <li key={p.id}>
                  <Link to={`/p/${p.id}`} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-canvas">
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
