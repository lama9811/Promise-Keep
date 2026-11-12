import { useEffect } from 'react'
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate } from 'react-router'
import { MotionConfig } from 'motion/react'
import { PayPalScriptProvider } from '@paypal/react-paypal-js'
import Lenis from 'lenis'
import Home from './pages/Home'
import SignIn from './pages/SignIn'
import AppShell from './app/AppShell'
import Overview from './pages/app/Overview'
import NewPromise from './pages/app/NewPromise'
import Promises from './pages/app/Promises'
import Activity from './pages/app/Activity'
import Wallet from './pages/app/Wallet'
import Account from './pages/app/Account'
import Lab from './lab/Lab'
import ConnectCallback from './pages/app/ConnectCallback'
import PromisePage from './pages/PromisePage'
import NotFound from './pages/NotFound'
import { AuthProvider, RequireAuth, signOut, useAuth } from './auth'

const PAYPAL_OPTIONS = {
  clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID || 'test',
  currency: 'USD',
  intent: 'capture',
}

let lenis = null

function useSmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    lenis = new Lenis({ autoRaf: true, lerp: 0.12 })
    return () => {
      lenis.destroy()
      lenis = null
    }
  }, [])
}

function scrollToTarget(target, immediate) {
  if (lenis) lenis.scrollTo(target, { immediate, offset: 0 })
  else if (typeof target === 'number') window.scrollTo(0, target)
  else document.querySelector(target)?.scrollIntoView()
}

// The browser's own scroll restoration fights the smooth scroller on reload.
if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual'
}

// New page: jump to the top (or to #section). The smooth scroller keeps its
// own position, so it has to be told too, or it drags the page back.
function ScrollManager() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      requestAnimationFrame(() => scrollToTarget(hash, false))
    } else {
      scrollToTarget(0, true)
    }
  }, [pathname, hash])
  return null
}

function Header() {
  const { session, ready } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const link = 'text-sm text-ink-soft transition-colors hover:text-cobalt'
  // Signed-in screens have their own sidebar and top bar.
  if (pathname.startsWith('/app') || pathname.startsWith('/connect')) return null
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 md:px-10">
        <Link to={session ? '/app' : '/'} className="font-display text-xl font-bold tracking-tight text-ink">
          Promise Keeper
        </Link>
        <nav className={`flex items-center gap-5 transition-opacity md:gap-7 ${ready ? 'opacity-100' : 'opacity-0'}`}>
          {session ? (
            <>
              {pathname !== '/app' && (
                <Link to="/app" className={link}>
                  Your dashboard
                </Link>
              )}
              <button
                onClick={async () => {
                  await signOut()
                  navigate('/')
                }}
                className={link}
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/#how" className={`${link} hidden sm:inline`}>
                How it works
              </Link>
              {pathname !== '/signin' && (
                <Link
                  to="/signin"
                  className="rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-cobalt hover:text-cobalt"
                >
                  Sign in
                </Link>
              )}
            </>
          )}
        </nav>
      </div>
    </header>
  )
}

export default function App() {
  useSmoothScroll()
  return (
    <AuthProvider>
    <PayPalScriptProvider options={PAYPAL_OPTIONS}>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <ScrollManager />
          <Header />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/signin" element={<SignIn />} />
            <Route
              path="/app"
              element={
                <RequireAuth>
                  <AppShell />
                </RequireAuth>
              }
            >
              <Route index element={<Overview />} />
              <Route path="new" element={<NewPromise />} />
              <Route path="promises" element={<Promises />} />
              <Route path="activity" element={<Activity />} />
              <Route path="wallet" element={<Wallet />} />
              <Route path="account" element={<Account />} />
              <Route path="lab" element={<Lab />} />
            </Route>
            <Route
              path="/connect/:provider"
              element={
                <RequireAuth>
                  <AppShell />
                </RequireAuth>
              }
            >
              <Route index element={<ConnectCallback />} />
            </Route>
            <Route path="/p/:id" element={<PromisePage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </MotionConfig>
    </PayPalScriptProvider>
    </AuthProvider>
  )
}
