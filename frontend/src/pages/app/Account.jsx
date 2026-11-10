import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { displayName, useAuth } from '../../auth'
import { Avatar, useSignOut } from '../../app/AppShell'
import { Card, CardHeader, Icon, PageTitle } from '../../app/ui'
import { api, API_URL } from '../../api'
import { startConnect, useConnections } from '../../components/FitnessProof'

const APP_INFO = {
  strava: { name: 'Strava', text: 'Runs, walks, rides and hikes count automatically.', brand: 'bg-[#fc4c02] text-white' },
  whoop: { name: 'WHOOP', text: 'Gym sessions and workouts count automatically.', brand: 'bg-ink text-white' },
}

function ConnectedApps() {
  const [conns, reload] = useConnections()
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const go = async (key, fn) => {
    setBusy(key)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy('')
    }
  }
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Connected apps" hint="Connect once and your workouts prove your promises for you." />
      <div className="divide-y divide-ink/[0.06]">
        {(conns?.providers || []).map((c) => {
          const info = APP_INFO[c.provider]
          return (
            <div key={c.provider} className="flex items-center gap-4 px-5 py-4">
              <span className={`grid size-11 shrink-0 place-items-center rounded-xl font-display text-lg font-extrabold ${info.brand}`}>
                {info.name[0]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {info.name}{' '}
                  {c.connected && <span className="ml-1 rounded-full bg-kept-soft px-2 py-0.5 text-xs font-semibold text-kept">Connected</span>}
                </p>
                <p className="text-sm text-ink-soft">{c.available ? info.text : 'Not set up on this server yet.'}</p>
              </div>
              {c.available &&
                (c.connected ? (
                  <button
                    onClick={() => go(c.provider, async () => { await api(`/connect/${c.provider}`, { method: 'DELETE' }); await reload() })}
                    disabled={Boolean(busy)}
                    className="text-sm font-semibold text-ink-soft hover:text-broke"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={() => go(c.provider, () => startConnect(c.provider, '/app/account'))}
                    disabled={Boolean(busy)}
                    className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${info.brand}`}
                  >
                    {busy === c.provider ? 'Opening…' : `Connect ${info.name}`}
                  </button>
                ))}
            </div>
          )
        })}
        <AppleHealth hasKey={conns?.shortcut} onKey={reload} />
      </div>
      {error && <p className="px-5 pb-4 text-sm text-broke">{error}</p>}
    </Card>
  )
}

function AppleHealth({ hasKey, onKey }) {
  const [key, setKey] = useState('')
  const [copied, setCopied] = useState('')
  const make = async () => {
    const r = await api('/me/shortcut-key', { method: 'POST' })
    setKey(r.key)
    onKey()
  }
  const copy = (label, text) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(label)
      setTimeout(() => setCopied(''), 1500)
    })
  }
  const url = `${API_URL}/shortcut/activity`
  return (
    <div id="apple-health" className="px-5 py-4">
      <div className="flex items-center gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#ff2d55] text-xl text-white">♥</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            Apple Watch / Apple Fitness{' '}
            {hasKey && <span className="ml-1 rounded-full bg-kept-soft px-2 py-0.5 text-xs font-semibold text-kept">Set up</span>}
          </p>
          <p className="text-sm text-ink-soft">An iPhone Shortcut sends today’s steps, Exercise minutes and Move calories here with one tap, or every evening by itself.</p>
        </div>
        <button onClick={make} className="rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold hover:border-ink/25">
          {hasKey ? 'New key' : 'Get my key'}
        </button>
      </div>
      {key && (
        <div className="mt-4 rounded-2xl bg-canvas p-4 text-sm">
          <p className="font-semibold">Your key (shown once, keep it private)</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2">{key}</code>
            <button onClick={() => copy('key', key)} className="rounded-lg bg-ink px-3 py-2 font-semibold text-white">
              {copied === 'key' ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}
      <details className="mt-4 rounded-2xl border border-line p-4 text-sm leading-relaxed text-ink-soft" open={Boolean(key)}>
        <summary className="cursor-pointer font-semibold text-ink">How to make the Shortcut (2 minutes, on your iPhone)</summary>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          <li>Open the <b className="text-ink">Shortcuts</b> app, tap <b className="text-ink">+</b>, name it <b className="text-ink">Send my activity</b>.</li>
          <li>
            Add <b className="text-ink">Find Health Samples</b> (type <b className="text-ink">Steps</b>, Start Date is Today), then{' '}
            <b className="text-ink">Calculate Statistics</b> → <b className="text-ink">Sum</b>. Do the same twice more for{' '}
            <b className="text-ink">Exercise Minutes</b> and <b className="text-ink">Active Energy</b> (that’s your Move ring).
          </li>
          <li>
            Add <b className="text-ink">Get Contents of URL</b>: URL{' '}
            <button onClick={() => copy('url', url)} className="rounded bg-white px-1.5 font-mono text-ink underline">
              {copied === 'url' ? 'copied' : url}
            </button>
            , Method <b className="text-ink">POST</b>, Header <b className="text-ink">X-Shortcut-Key</b> = your key, Request Body{' '}
            <b className="text-ink">JSON</b> with three Number fields: <b className="text-ink">steps</b>,{' '}
            <b className="text-ink">exercise_minutes</b> and <b className="text-ink">move_calories</b>, each set to its Statistics result.
          </li>
          <li>Add <b className="text-ink">Show Result</b> so you see “Counted” or why not.</li>
          <li>Optional: in <b className="text-ink">Automation</b>, run it every day at 9 PM.</li>
        </ol>
        <p className="mt-3">Your iPhone must reach this server. On your own computer that means the deployed app, not localhost.</p>
      </details>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-ink-soft">{label}</p>
      <div className="text-sm font-medium">{children}</div>
    </div>
  )
}

export default function Account() {
  const { session } = useAuth()
  const out = useSignOut()
  const name = displayName(session) || 'You'
  const email = session?.user?.email || ''
  const provider = session?.user?.app_metadata?.provider
  const method = provider === 'google' ? 'Google' : provider === 'email' ? 'Email' : provider || 'Email'
  const since = session?.user?.created_at
    ? new Date(session.user.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : ''

  useEffect(() => {
    document.title = 'Account · Promise Keeper'
  }, [])

  return (
    <div className="max-w-3xl space-y-6">
      <PageTitle title="Account" />

      <Card className="flex items-center gap-4 p-5">
        <Avatar name={name} className="size-14 text-lg" />
        <div className="min-w-0">
          <p className="font-display text-xl font-bold">{name}</p>
          <p className="truncate text-sm text-ink-soft">{email}</p>
        </div>
      </Card>

      <ConnectedApps />

      <Card className="overflow-hidden">
        <CardHeader title="Profile" />
        <div className="divide-y divide-ink/[0.06]">
          <Row label="Name">{name}</Row>
          <Row label="Email">{email}</Row>
          <Row label="Signed in with">{method}</Row>
          {since && <Row label="Member since">{since}</Row>}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="Payments" />
        <div className="divide-y divide-ink/[0.06]">
          <Row label="Mode">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sun-soft px-2.5 py-1 text-xs font-semibold">
              <span className="size-1.5 rounded-full bg-[#e0a800]" />
              PayPal sandbox (test money)
            </span>
          </Row>
          <Row label="Refunds go to">The PayPal account you paid with</Row>
          <Row label="Stakes">$1 to $100 per promise</Row>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="Privacy" />
        <div className="space-y-3 px-5 py-4 text-sm leading-relaxed text-ink-soft">
          <p className="flex gap-2.5">
            <Icon name="shield" className="mt-0.5 size-4 text-ink" />
            Proof photos are kept in private storage and only shown through short-lived links.
          </p>
          <p className="flex gap-2.5">
            <Icon name="share" className="mt-0.5 size-4 text-ink" />
            Anyone with a promise's link can see its progress, but only you can prove it or pay for it.
          </p>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={out}
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-broke transition-colors hover:border-broke/40"
        >
          <Icon name="logout" className="size-4" />
          Sign out
        </button>
        <Link to="/#how" className="text-sm text-ink-soft underline underline-offset-4 hover:text-cobalt">
          How Promise Keeper works
        </Link>
      </div>
    </div>
  )
}
