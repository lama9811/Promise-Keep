import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { authConfigured, supabase } from '../lib/supabase'
import { useAuth } from '../auth'
import { setCoin } from '../three/coinStore'
import { EMAIL_RE } from '../deal'
import { CoinHero } from './Home'

const EASE = [0.16, 1, 0.3, 1]

// Sandbox demo account. The button only shows when both are set in .env.local.
const DEMO_EMAIL = import.meta.env.VITE_DEMO_EMAIL
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="size-5">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

export default function SignIn() {
  const { session, ready } = useAuth()
  const location = useLocation()
  const next = location.state?.from || '/app'
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setCoin({ mode: 'idle', stakeCents: 0, outcome: null, done: 0, target: 0 })
  }, [])

  if (ready && session) return <Navigate to={next} replace />

  const redirectTo = `${window.location.origin}${next}`

  const google = async () => {
    setError('')
    setBusy('google')
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
    if (error) {
      setBusy('')
      setError("Google sign-in isn't working right now. Use the email link below instead.")
    }
  }

  const sendLink = async (e) => {
    e.preventDefault()
    const to = email.trim()
    if (!EMAIL_RE.test(to)) return setError('That email looks incomplete. Check it and try again.')
    setError('')
    setBusy('email')
    const { error } = await supabase.auth.signInWithOtp({ email: to, options: { emailRedirectTo: redirectTo } })
    setBusy('')
    if (error) {
      setError(
        error.status === 429
          ? 'Too many links sent. Wait a minute, then try again.'
          : "We couldn't send the link. Check the email and try again.",
      )
    } else {
      setSentTo(to)
    }
  }

  const demo = async () => {
    setError('')
    setBusy('demo')
    const { error } = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
    if (error) {
      setBusy('')
      setError("The demo account isn't working right now. Use the email link instead.")
    }
  }

  return (
    <main>
      <section className="mx-auto grid max-w-7xl gap-6 px-6 pt-24 md:grid-cols-[1.05fr_1fr] md:gap-10 md:px-10 md:pt-0">
        <div className="order-2 pb-24 md:order-1 md:flex md:min-h-svh md:flex-col md:justify-center md:py-24">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE }}
            className="max-w-md"
          >
            <h1 className="font-display text-[clamp(2.4rem,4.6vw,4rem)] font-extrabold leading-[0.95] tracking-[-0.035em]">
              Sign in to make a promise.
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-ink-soft">
              Your promises, proof and money trail stay in one place. Free to sign up.
            </p>

            {!authConfigured ? (
              <p className="mt-10 rounded-2xl bg-sun-soft px-5 py-4 text-ink">
                Sign-in isn't set up yet. Add the Supabase publishable key to <code>frontend/.env.local</code>, then reload.
              </p>
            ) : (
              <div className="mt-10 rounded-[28px] border border-line bg-surface p-6 shadow-[0_50px_100px_-45px_rgba(30,59,255,0.35)] md:p-8">
                <AnimatePresence mode="wait">
                  {sentTo ? (
                    <motion.div key="sent" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      <p className="font-display text-2xl font-bold">Check your email.</p>
                      <p className="mt-2 leading-relaxed text-ink-soft">
                        We sent a sign-in link to <span className="font-medium text-ink">{sentTo}</span>. Open it on this
                        device and you're in.
                      </p>
                      <button
                        onClick={() => setSentTo('')}
                        className="mt-5 text-sm text-ink-soft underline underline-offset-4 hover:text-cobalt"
                      >
                        Use a different email
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <motion.button
                        type="button"
                        onClick={google}
                        disabled={Boolean(busy)}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex w-full items-center justify-center gap-3 rounded-full border border-ink/15 bg-white px-6 py-3.5 font-semibold text-ink transition-colors hover:border-ink/30 disabled:opacity-50"
                      >
                        <GoogleMark />
                        {busy === 'google' ? 'Opening Google…' : 'Continue with Google'}
                      </motion.button>

                      <div className="my-6 flex items-center gap-4 text-sm text-ink-soft">
                        <span className="h-px flex-1 bg-line" />
                        or
                        <span className="h-px flex-1 bg-line" />
                      </div>

                      <form onSubmit={sendLink}>
                        <label htmlFor="email" className="block text-sm font-medium">
                          Email
                        </label>
                        <input
                          id="email"
                          type="email"
                          autoComplete="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-base text-ink placeholder:text-ink/35 transition-colors focus:border-cobalt focus:outline-none focus:ring-4 focus:ring-cobalt/15"
                        />
                        <motion.button
                          type="submit"
                          disabled={Boolean(busy) || !email.trim()}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.98 }}
                          className="mt-4 w-full rounded-full bg-cobalt px-6 py-3.5 font-display text-lg font-bold text-white shadow-[0_18px_40px_-14px_rgba(30,59,255,0.65)] transition-colors disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink/40 disabled:shadow-none"
                        >
                          {busy === 'email' ? 'Sending…' : 'Email me a sign-in link'}
                        </motion.button>
                      </form>

                      {DEMO_EMAIL && DEMO_PASSWORD && (
                        <button
                          type="button"
                          onClick={demo}
                          disabled={Boolean(busy)}
                          className="mt-5 w-full text-center text-sm text-ink-soft underline underline-offset-4 transition-colors hover:text-cobalt disabled:opacity-50"
                        >
                          {busy === 'demo' ? 'Signing in…' : 'Just looking? Try the demo account'}
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
                <p role="status" className="mt-4 min-h-5 text-sm text-broke">
                  {error}
                </p>
              </div>
            )}
          </motion.div>
        </div>
        <div className="order-1 md:order-2">
          <CoinHero />
        </div>
      </section>
    </main>
  )
}
