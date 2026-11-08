// Turns the API's parsed deal into form state for the contract sheet.
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
// How each kind of fitness promise gets proven, in the user's words.
export const PROOF_LABEL = {
  steps: 'my daily steps (Apple Health or a screenshot)',
  run: 'my runs, walks or rides (Strava or a screenshot)',
  workout: 'my workouts (WHOOP, Strava, a screenshot or a live photo)',
  gym: 'my gym visits (check-in, WHOOP or my gym app)',
  exercise: 'my Apple Watch Exercise ring (minutes)',
  move: 'my Apple Watch Move ring (calories)',
}

// What one "time" means for each kind, and how to say it.
export const GOAL_UNIT = { steps: 'steps', run: 'km', workout: 'minutes', exercise: 'minutes', move: 'calories' }
export const GOAL_DEFAULT = { steps: 10000, run: 5, workout: 30, exercise: 30, move: 500 }

export function goalText(metric, value) {
  if (metric === 'steps') return `${Number(value).toLocaleString()} steps`
  if (metric === 'distance_km') return `${Number(value)} km`
  if (metric === 'minutes') return `${Number(value)} min`
  if (metric === 'calories') return `${Number(value).toLocaleString()} Move cal`
  return 'a gym session'
}

// "2026-11-08T23:59:00-05:00" -> "2026-11-08T23:59" in the phone's local time
function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function dealFromParse(d) {
  const isCharity = d.recipient.toLowerCase() === 'charity'
  return {
    ...d,
    stake_dollars: String(d.stake_cents / 100),
    goal_value: String(d.goal_value ?? GOAL_DEFAULT[d.proof] ?? ''),
    deadline_local: toLocalInput(d.deadline),
    to_charity: isCharity,
    friend_name: isCharity || EMAIL_RE.test(d.recipient) ? '' : d.recipient,
    friend_email: EMAIL_RE.test(d.recipient) ? d.recipient : '',
  }
}


// "2026-11-08T23:59" -> "Sunday at 11:59 PM" (or the date, if it's over a week away)
export function friendlyDeadline(local) {
  if (!local) return 'pick a time'
  const d = new Date(local)
  const days = (d - new Date()) / 864e5
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const day =
    days < 6.5
      ? d.toLocaleDateString(undefined, { weekday: 'long' })
      : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `${day} at ${time}`
}

// "2 days, 3 hours left"
export function timeLeft(deadline) {
  const ms = new Date(deadline) - new Date()
  if (ms <= 0) return 'The deadline has passed'
  const h = Math.floor(ms / 3.6e6)
  const d = Math.floor(h / 24)
  if (d >= 1) return `${d} day${d === 1 ? '' : 's'}, ${h % 24} hour${h % 24 === 1 ? '' : 's'} left`
  const m = Math.floor((ms % 3.6e6) / 6e4)
  return `${h} hour${h === 1 ? '' : 's'}, ${m} min left`
}
