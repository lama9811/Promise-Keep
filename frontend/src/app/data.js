// Data for the signed-in app. One small cache so switching tabs is instant,
// and every number on screen is worked out from real promises and proofs.
import { useEffect, useState } from 'react'
import { api } from '../api'

let cache = { promises: null, details: {} }
const listeners = new Set()
const emit = () => listeners.forEach((fn) => fn())

export async function refreshPromises() {
  const list = await api('/me/promises')
  cache = { ...cache, promises: list }
  emit()
  return list
}

export function clearAppCache() {
  cache = { promises: null, details: {} }
  emit()
}

function useCache() {
  const [, force] = useState(0)
  useEffect(() => {
    const fn = () => force((n) => n + 1)
    listeners.add(fn)
    return () => listeners.delete(fn)
  }, [])
  return cache
}

// Every promise the signed-in person has locked in, newest first.
export function useMyPromises() {
  const c = useCache()
  const [error, setError] = useState('')
  useEffect(() => {
    refreshPromises().catch(() => setError("Couldn't load your promises. Reload the page to try again."))
  }, [])
  return { promises: c.promises, error }
}

// Full detail (with proofs) for each promise, for the activity feed and streak.
export function useActivity(promises) {
  const c = useCache()
  const ids = (promises || []).slice(0, 20).map((p) => p.id)
  const key = ids.join(',')
  useEffect(() => {
    const missing = ids.filter((id) => !cache.details[id])
    if (!missing.length) return
    Promise.allSettled(missing.map((id) => api(`/promises/${id}`))).then((results) => {
      const details = { ...cache.details }
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') details[missing[i]] = r.value
      })
      cache = { ...cache, details }
      emit()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (!promises) return null
  const loaded = ids.every((id) => c.details[id])
  const events = []
  for (const p of promises) {
    const d = c.details[p.id]
    if (p.created_at) {
      events.push({ id: `lock-${p.id}`, type: 'locked', at: p.created_at, promise: p })
    }
    for (const proof of d?.proofs || []) {
      events.push({ id: proof.id, type: 'proof', at: proof.ended_at || proof.started_at, promise: p, proof })
    }
    if (p.outcome) {
      events.push({ id: `end-${p.id}`, type: p.outcome, at: p.deadline, promise: p })
    }
  }
  events.sort((a, b) => new Date(b.at) - new Date(a.at))
  return { events, loaded }
}

const dayKey = (d) => {
  const x = new Date(d)
  return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`
}

// Days in a row (ending today or yesterday) with at least one counted proof.
export function streakFrom(events) {
  const days = new Set(
    (events || []).filter((e) => e.type === 'proof' && e.proof.counted).map((e) => dayKey(e.at)),
  )
  let streak = 0
  const d = new Date()
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1)
  while (days.has(dayKey(d))) {
    streak += 1
    d.setDate(d.getDate() - 1)
  }
  return streak
}

// The last 7 days, oldest first: { label, count } of counted proofs.
export function weekFrom(events) {
  const out = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const k = dayKey(d)
    out.push({
      key: k,
      label: d.toLocaleDateString(undefined, { weekday: 'narrow' }),
      full: d.toLocaleDateString(undefined, { weekday: 'long' }),
      today: i === 0,
      date: d.getDate(),
      count: (events || []).filter((e) => e.type === 'proof' && e.proof.counted && dayKey(e.at) === k).length,
    })
  }
  return out
}

export const outcomeOf = (p) => p.outcome || (p.status === 'won' || p.status === 'lost' ? p.status : null)

// Money totals, all in whole cents.
export function moneyFrom(promises) {
  const t = { onTheLine: 0, returned: 0, paidOut: 0, total: 0, active: 0, kept: 0, missed: 0 }
  for (const p of promises || []) {
    t.total += p.stake_cents
    const o = outcomeOf(p)
    if (o === 'won') {
      t.returned += p.stake_cents
      t.kept += 1
    } else if (o === 'lost') {
      t.paidOut += p.stake_cents
      t.missed += 1
    } else {
      t.onTheLine += p.stake_cents
      t.active += 1
    }
  }
  const finished = t.kept + t.missed
  t.keptRate = finished ? Math.round((t.kept / finished) * 100) : null
  return t
}

// Re-render every `ms` so countdowns stay live.
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

// The promise agent: what it's watching and what it did. Refreshes every 15 seconds,
// and reloads the promise list when the agent settles something.
export function useAgent() {
  const [state, setState] = useState(null)
  useEffect(() => {
    let alive = true
    let lastTop = null
    const load = () =>
      api('/me/agent')
        .then((a) => {
          if (!alive) return
          const top = a.events[0]?.id || null
          if (lastTop !== null && top !== lastTop) {
            cache = { ...cache, details: {} }
            refreshPromises().catch(() => {})
          }
          lastTop = top
          setState(a)
        })
        .catch(() => {})
    load()
    const id = setInterval(load, 15000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])
  return state
}
