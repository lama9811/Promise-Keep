import { Link } from 'react-router'

export default function NotFound() {
  return (
    <main className="grid min-h-svh place-items-center px-6 text-center">
      <div>
        <h1 className="font-display text-5xl font-extrabold tracking-tight">Nothing here.</h1>
        <p className="mt-3 text-ink-soft">This link doesn't lead to a promise.</p>
        <Link to="/" className="mt-8 inline-block rounded-full bg-cobalt px-6 py-3 font-semibold text-white">
          Make a promise
        </Link>
      </div>
    </main>
  )
}
