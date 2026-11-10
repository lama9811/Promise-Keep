import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { outcomeOf, useMyPromises, useNow } from '../../app/data'
import { ButtonLink, Card, EmptyState, Icon, PageTitle, PromiseRow, Skeleton } from '../../app/ui'

const TABS = [
  ['active', 'Active'],
  ['won', 'Kept'],
  ['lost', 'Missed'],
  ['all', 'All'],
]

export default function Promises() {
  const { promises, error } = useMyPromises()
  const now = useNow(1000)
  const [tab, setTab] = useState('active')
  const [q, setQ] = useState('')

  useEffect(() => {
    document.title = 'Promises · Promise Keeper'
  }, [])

  const count = (k) =>
    (promises || []).filter((p) => (k === 'all' ? true : k === 'active' ? !outcomeOf(p) : outcomeOf(p) === k)).length

  const shown = (promises || [])
    .filter((p) => (tab === 'all' ? true : tab === 'active' ? !outcomeOf(p) : outcomeOf(p) === tab))
    .filter((p) => !q.trim() || `${p.summary} ${p.activity}`.toLowerCase().includes(q.trim().toLowerCase()))

  return (
    <div className="space-y-6">
      <PageTitle
        title="Promises"
        hint="Everything you've put money on."
        action={
          <span className="hidden sm:block lg:hidden">
            <ButtonLink to="/app/new" icon="plus">
              New promise
            </ButtonLink>
          </span>
        }
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="glass flex gap-1 overflow-x-auto rounded-2xl p-1">
          {TABS.map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`relative flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
                tab === k ? 'text-white' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {tab === k && (
                <motion.span
                  layoutId="promises-tab"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-xl bg-ink"
                />
              )}
              <span className="relative">{label}</span>
              {promises && (
                <span className={`relative rounded-md px-1.5 text-xs tabular-nums ${tab === k ? 'bg-white/20' : 'bg-ink/[0.06]'}`}>
                  {count(k)}
                </span>
              )}
            </button>
          ))}
        </div>
        <label className="glass flex items-center gap-2 rounded-2xl px-3.5 py-2.5 focus-within:ring-4 focus-within:ring-cobalt/15 md:w-72">
          <Icon name="search" className="size-4 text-ink-soft" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search your promises"
            aria-label="Search your promises"
            className="w-full bg-transparent text-sm placeholder:text-ink/40 focus:outline-none"
          />
        </label>
      </div>

      {error && <p className="rounded-xl bg-broke-soft px-4 py-3 text-sm text-broke">{error}</p>}

      <Card className="overflow-hidden">
        {promises === null ? (
          <div className="space-y-4 p-5">
            {[0, 1, 2, 3].map((k) => (
              <div key={k} className="flex items-center gap-4">
                <Skeleton className="size-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : shown.length === 0 ? (
          <EmptyState
            icon={q ? 'search' : 'list'}
            title={q ? 'No matches' : tab === 'active' ? 'Nothing active' : 'Nothing here yet'}
            action={
              !q && (
                <ButtonLink to="/app/new" icon="plus">
                  Make a promise
                </ButtonLink>
              )
            }
          >
            {q
              ? 'Try a different word, or clear the search.'
              : tab === 'active'
                ? 'Promises you lock in show up here with a live countdown.'
                : 'Finished promises land here after their deadline.'}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-ink/[0.06]">
            {shown.map((p, i) => (
              <PromiseRow key={p.id} p={p} now={now} i={i} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
