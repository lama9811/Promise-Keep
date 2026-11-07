// The frame around every signed-in screen: a sidebar on desktop,
// a top bar and bottom tabs on phones.
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
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
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors ${
      isActive ? 'bg-cobalt-soft text-cobalt' : 'text-ink-soft hover:bg-canvas hover:text-ink'
    }`
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
      <Link to="/app" className="flex items-center gap-2.5 px-6 pb-6 pt-6">
        <CoinMark />
        <span className="font-display text-lg font-bold tracking-tight">Promise Keeper</span>
      </Link>

      <div className="px-4">
        <Link
          to="/app/new"
          className="flex items-center justify-center gap-2 rounded-xl bg-cobalt px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_-12px_rgba(30,59,255,0.8)] transition-colors hover:bg-[#1631e0]"
        >
          <Icon name="plus" className="size-4" strokeWidth={2.4} />
          New promise
        </Link>
      </div>

      <nav className="mt-6 flex flex-col gap-1 px-4">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={item}>
            <Icon name={n.icon} />
            {n.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto p-4">
        <div className="rounded-2xl bg-canvas p-4">
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
            className="grid size-9 place-items-center rounded-lg text-ink-soft transition-colors hover:bg-canvas hover:text-broke"
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
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
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
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
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
                `flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${isActive ? 'text-cobalt' : 'text-ink-soft'}`
              }
            >
              <Icon name={t.icon} className="size-[22px]" />
              {t.label}
            </NavLink>
          ),
        )}
      </div>
    </nav>
  )
}

export default function AppShell() {
  const { session } = useAuth()
  const name = displayName(session) || 'You'
  const email = session?.user?.email || ''
  return (
    <div className="min-h-svh bg-canvas">
      <Sidebar name={name} email={email} />
      <MobileTop name={name} />
      <div className="pb-28 lg:pb-0 lg:pl-64">
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:py-10 lg:px-10">
          <Outlet />
        </main>
      </div>
      <MobileTabs />
    </div>
  )
}
