import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { AnimatePresence } from 'motion/react'
import { api } from '../../api'
import { dealFromParse } from '../../deal'
import { kickCoin, setCoin } from '../../three/coinStore'
import Composer from '../../components/Composer'
import DealSheet from '../../components/DealSheet'
import { CoinHero } from '../Home'
import { Card, Icon, PageTitle } from '../../app/ui'

const STEPS = ['Write it', 'Check the deal', 'Lock it with PayPal']

function Steps({ at }) {
  return (
    <ol className="flex items-center gap-2 text-sm">
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span
            className={`grid size-6 place-items-center rounded-full text-xs font-bold ${
              i < at ? 'bg-kept text-white' : i === at ? 'bg-cobalt text-white' : 'bg-ink/[0.07] text-ink-soft'
            }`}
          >
            {i < at ? <Icon name="check" className="size-3.5" strokeWidth={3} /> : i + 1}
          </span>
          <span className={`hidden sm:inline ${i === at ? 'font-semibold text-ink' : 'text-ink-soft'}`}>{s}</span>
          {i < STEPS.length - 1 && <span className="h-px w-5 bg-line sm:w-8" />}
        </li>
      ))}
    </ol>
  )
}

export default function NewPromise() {
  const location = useLocation()
  const [text, setText] = useState(location.state?.text || '')
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState('')
  const [deal, setDeal] = useState(null)
  const autoRan = useRef(false)

  useEffect(() => {
    document.title = 'New promise · Promise Keeper'
    setCoin({ mode: 'idle', stakeCents: 0, outcome: null, done: 0, target: 0 })
  }, [])

  // Keep the coin spinning while the AI reads the promise.
  useEffect(() => {
    if (!parsing) return
    const id = setInterval(() => kickCoin(1.2), 250)
    return () => clearInterval(id)
  }, [parsing])

  const submit = async (e) => {
    e?.preventDefault()
    if (parsing || text.trim().length < 3) return
    setError('')
    setParsing(true)
    try {
      const parsed = await api('/promises/parse', {
        method: 'POST',
        body: JSON.stringify({ text, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      })
      setDeal(dealFromParse(parsed))
      setCoin({ mode: 'deal', stakeCents: parsed.stake_cents })
    } catch {
      setError("The AI couldn't read that just now. Try again in a moment.")
    } finally {
      setParsing(false)
    }
  }

  // Coming from the quick box on Overview: read it straight away.
  useEffect(() => {
    if (location.state?.go && !autoRan.current && text.trim().length >= 3) {
      autoRan.current = true
      submit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reset = () => {
    setDeal(null)
    setCoin({ mode: 'idle', stakeCents: 0 })
  }

  return (
    <div className="space-y-6">
      <PageTitle title="New promise" hint="Put money on your fitness goal." action={<Steps at={deal ? 1 : 0} />} />

      <div className="grid items-start gap-6 lg:grid-cols-[1.25fr_1fr]">
        <div>
          <AnimatePresence mode="wait">
            {deal ? (
              <DealSheet key="deal" text={text} deal={deal} setDeal={setDeal} onEdit={reset} />
            ) : (
              <Card key="composer" className="p-5 md:p-7">
                <Composer text={text} setText={setText} onSubmit={submit} parsing={parsing} error={error} />
              </Card>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-4 lg:sticky lg:top-8">
          <Card className="overflow-hidden">
            <CoinHero className="h-64 md:h-80" />
          </Card>
          <Card className="p-5">
            <p className="font-display font-bold">What happens next</p>
            <ol className="mt-3 space-y-3 text-sm text-ink-soft">
              {[
                ['spark', 'The AI turns your words into a clear deal you can edit.'],
                ['lock', 'You pay the stake with PayPal and it stays locked until the deadline.'],
                ['run', 'Your workouts prove it: Strava, WHOOP, Apple Health, your gym check-in or a screenshot.'],
                ['wallet', 'Keep it and the money comes back. Miss it and it goes where you said.'],
              ].map(([icon, t]) => (
                <li key={t} className="flex gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-canvas text-ink">
                    <Icon name={icon} className="size-4" />
                  </span>
                  <span className="pt-1 leading-snug">{t}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  )
}
