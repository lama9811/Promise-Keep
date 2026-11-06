// Turns the API's parsed deal into form state for the contract sheet.
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
export const VERB = { gym: 'go to the gym', study: 'study', run: 'go for a run' }

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
