// Money is stored as whole cents everywhere. Only format at the very end.
export const formatCents = (cents) => `$${(cents / 100).toFixed(2).replace(/\.00$/, '')}`

export const dollarsToCents = (value) => Math.round(Number(value) * 100)

export const TYPE_LABEL = { gym: '🏋️ Gym visits', study: '📚 Study sessions', run: '🏃 Runs' }
