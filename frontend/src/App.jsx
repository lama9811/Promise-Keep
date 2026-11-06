import { useEffect, useState } from 'react'
import { api } from './api'

export default function App() {
  const [health, setHealth] = useState('checking...')

  useEffect(() => {
    api('/health')
      .then((data) => setHealth(data.status))
      .catch((err) => setHealth(`error: ${err.message}`))
  }, [])

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 flex flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-bold">Promise Keeper</h1>
      <p className="mt-2 text-stone-600 text-center">
        Bet on yourself. AI is the referee, PayPal holds the money.
      </p>
      <p className="mt-6 text-sm">
        Backend: <span data-testid="health" className="font-mono">{health}</span>
      </p>
    </main>
  )
}
