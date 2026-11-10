// The frame around every signed-in screen: a sidebar on desktop,
// a top bar and bottom tabs on phones.
import { Link, NavLink, useLocation, useNavigate, useOutlet } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { displayName, signOut, useAuth } from '../auth'
import { clearAppCache } from './data'
import { CoinMark, Icon } from './ui'

const NAV = [
  { to: '/app', label: 'Overview', icon: 'home', end: true },
  { to: '/app/promises', label: 'Promises', icon: 'list' },
  { to: '/app/activity', label: 'Activity', icon: 'pulse' },
  { to: '/app/wallet', label: 'Wallet', icon: 'wallet' },
  { to: '/app/account', label: 'Account', icon: 'user' },
]

export function initials(name) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('') || '?'
  )
}

export function Avatar({ name, className = 'size-9 text-sm' }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-ink font-semibold text-white ${className}`}>
      {initials(name)}
    </span>
  )
}

function SandboxBadge() {
  return (
    <span
      title="Payments use PayPal's sandbox. No real money moves."
      className="inline-flex items-center gap-1.5 rounded-full bg-sun-soft px-2.5 py-1 text-xs font-semibold text-ink"
    >
      <span className="size-1.5 rounded-full bg-[#e0a800]" />
      Test money
    </span>
  )
}

export function useSignOut() {
  const navigate = useNavigate()
  return async () => {
    await signOut()
    clearAppCache()
    navigate('/')
  }
}

function Sidebar({ name, email }) {
  const out = useSignOut()
  const item = ({ isActive }) =>
    `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors ${
      isActive ? 'text-cobalt' : 'text-ink-soft hover:bg-canvas hover:text-ink'
    }`
  return (
    <aside className="glass fixed inset-y-3 left-3 z-30 hidden w-60 flex-col rounded-[28px] lg:flex">
      <Link to="/app" className="flex items-center gap-2.5 px-5 pb-6 pt-6">
        <CoinMark />
        <span className="font-display text-lg font-bold tracking-tight">Promise Keeper</span>
      </Link>

      <div className="px-4">
        <Link
          to="/app/new"
          className="group relative flex items-center justify-center gap-2 overflow-hidden rounded-2xl bg-cobalt px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_-12px_rgba(30,59,255,0.85),inset_0_1px_0_rgba(255,255,255,0.35)] transition-transform hover:-translate-y-0.5"
        >
          <span aria-hidden="true" className="absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-white/25 blur-md transition-transform duration-700 group-hover:translate-x-[300%]" />
          <Icon name="plus" className="size-4" strokeWidth={2.4} />
          New promise
        </Link>
      </div>

      <nav className="mt-6 flex flex-col gap-1 px-4">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={item}>
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="nav-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    className="absolute inset-0 rounded-xl bg-white shadow-[0_8px_20px_-10px_rgba(30,59,255,0.45),inset_0_0_0_1px_rgba(30,59,255,0.12)]"
                  />
                )}
                <Icon name={n.icon} className="relative size-5" />
                <span className="relative">{n.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto p-4">
        <div className="rounded-2xl bg-white/60 p-4">
          <SandboxBadge />
          <p className="mt-2 text-xs leading-relaxed text-ink-soft">
            Payments run on PayPal's sandbox, so you can try everything without real money.
          </p>
        </div>
        <div className="mt-3 flex items-center gap-3 rounded-2xl px-2 py-2">
          <Avatar name={name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="truncate text-xs text-ink-soft">{email}</p>
          </div>
          <button
            onClick={out}
            title="Sign out"
            aria-label="Sign out"
            className="grid size-9 place-items-center rounded-lg text-ink-soft transition-colors hover:bg-white hover:text-broke"
          >
            <Icon name="logout" className="size-[18px]" />
          </button>
        </div>
      </div>
    </aside>
  )
}

function MobileTop({ name }) {
  return (
    <header className="glass sticky top-2 z-30 mx-2 mt-2 flex items-center justify-between rounded-2xl px-4 py-2.5 lg:hidden">
      <Link to="/app" className="flex items-center gap-2">
        <CoinMark className="size-7" />
        <span className="font-display font-bold tracking-tight">Promise Keeper</span>
      </Link>
      <div className="flex items-center gap-2.5">
        <SandboxBadge />
        <Link to="/app/account" aria-label="Your account">
          <Avatar name={name} className="size-8 text-xs" />
        </Link>
      </div>
    </header>
  )
}

function MobileTabs() {
  const tabs = [NAV[0], NAV[1], { to: '/app/new', label: 'New', icon: 'plus', big: true }, NAV[2], NAV[3]]
  return (
    <nav className="glass fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 rounded-[26px] lg:hidden">
      <div className="grid grid-cols-5">
        {tabs.map((t) =>
          t.big ? (
            <NavLink key={t.to} to={t.to} aria-label="New promise" className="grid place-items-center py-2">
              <span className="grid size-11 place-items-center rounded-2xl bg-cobalt text-white shadow-[0_10px_20px_-10px_rgba(30,59,255,0.9)]">
                <Icon name="plus" strokeWidth={2.4} />
              </span>
            </NavLink>
          ) : (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${isActive ? 'text-cobalt' : 'text-ink-soft'}`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="tab-dot"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      className="absolute top-0 h-[3px] w-8 rounded-full bg-cobalt"
                    />
                  )}
                  <Icon name={t.icon} className="size-[22px]" />
                  {t.label}
                </>
              )}
            </NavLink>
          ),
        )}
      </div>
    </nav>
  )
}

// Each screen eases in from slightly below and out of focus, so moving
// between tabs feels like one surface changing rather than a page reload.
function PageSwap() {
  const { pathname } = useLocation()
  const outlet = useOutlet()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
        exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      >
        {outlet}
      </motion.div>
    </AnimatePresence>
  )
}

export default function AppShell() {
  const { session } = useAuth()
  const name = displayName(session) || 'You'
  const email = session?.user?.email || ''
  return (
    <div className="relative min-h-svh bg-canvas">
      <div aria-hidden="true" className="aurora pointer-events-none fixed inset-0 overflow-hidden">
        <span className="-left-[10%] -top-[15%] size-[55vw] bg-cobalt-soft" />
        <span className="-right-[15%] top-[20%] size-[45vw] bg-sun-soft opacity-80" />
        <span className="-bottom-[20%] left-[25%] size-[40vw] bg-kept-soft opacity-80" />
      </div>
      <Sidebar name={name} email={email} />
      <MobileTop name={name} />
      <div className="relative pb-32 lg:pb-0 lg:pl-[16.5rem]">
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:py-10 lg:px-10">
          <PageSwap />
        </main>
      </div>
      <MobileTabs />
    </div>
  )
}
