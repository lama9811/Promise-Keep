import { useEffect } from 'react'
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router'
import { MotionConfig } from 'motion/react'
import { PayPalScriptProvider } from '@paypal/react-paypal-js'
import Lenis from 'lenis'
import Home from './pages/Home'
import PromisePage from './pages/PromisePage'
import NotFound from './pages/NotFound'

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
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 md:px-10">
        <Link to="/" className="font-display text-xl font-bold tracking-tight text-ink">
          Promise Keeper
        </Link>
        <Link to="/#how" className="text-sm text-ink-soft transition-colors hover:text-cobalt">
          How it works
        </Link>
      </div>
    </header>
  )
}

export default function App() {
  useSmoothScroll()
  return (
    <PayPalScriptProvider options={PAYPAL_OPTIONS}>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <ScrollManager />
          <Header />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/p/:id" element={<PromisePage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </MotionConfig>
    </PayPalScriptProvider>
  )
}
