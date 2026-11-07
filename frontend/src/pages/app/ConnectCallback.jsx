// Strava / WHOOP send people back here after they approve: /connect/strava?code=...&state=...
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { api } from '../../api'
import { Card, CoinMark } from '../../app/ui'

const NAME = { strava: 'Strava', whoop: 'WHOOP' }

export default function ConnectCallback() {
  const { provider } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [msg, setMsg] = useState(`Connecting ${NAME[provider] || 'your app'}…`)
  const [failed, setFailed] = useState(false)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    const code = params.get('code')
    const state = params.get('state')
    if (!code || !state || params.get('error')) {
      setFailed(true)
      setMsg(`${NAME[provider] || 'The app'} wasn't connected. You can try again from your account page.`)
      return
    }
    api(`/connect/${provider}/finish`, { method: 'POST', body: JSON.stringify({ code, state }) })
      .then((r) => {
        setMsg(
          r.new_proofs
            ? `${NAME[provider]} is connected. We found ${r.new_proofs} workout${r.new_proofs === 1 ? '' : 's'} that count.`
            : `${NAME[provider]} is connected. Workouts you log there now count automatically.`,
        )
        let back = '/app/account'
        try {
          back = sessionStorage.getItem('pk-connect-back') || back
          sessionStorage.removeItem('pk-connect-back')
        } catch {
          /* ignore */
        }
        setTimeout(() => navigate(back, { replace: true }), 1800)
      })
      .catch((e) => {
        setFailed(true)
        setMsg(e.message)
      })
  }, [params, provider, navigate])

  return (
    <div className="grid min-h-[60svh] place-items-center">
      <Card className="max-w-md p-8 text-center">
        <CoinMark className="mx-auto size-12" />
        <p className="mt-5 font-display text-xl font-bold">{msg}</p>
        {failed && (
          <Link to="/app/account" className="mt-5 inline-block text-sm font-semibold text-cobalt underline underline-offset-4">
            Back to your account
          </Link>
        )}
      </Card>
    </div>
  )
}
