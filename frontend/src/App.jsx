import { useEffect, useState } from 'react'
import { PayPalScriptProvider } from '@paypal/react-paypal-js'
import CreatePromise from './pages/CreatePromise'
import PromisePage from './pages/PromisePage'

const PAYPAL_OPTIONS = {
  clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID || 'test',
  currency: 'USD',
  intent: 'capture',
}

// Tiny hash router: #/ and #/p/<promise id>
function useRoute() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  const m = hash.match(/^#\/p\/([\w-]+)/)
  return m ? { page: 'promise', id: m[1] } : { page: 'home' }
}

export default function App() {
  const route = useRoute()
  return (
    <PayPalScriptProvider options={PAYPAL_OPTIONS}>
      <div className="min-h-screen bg-stone-50 text-stone-900">
        <header className="max-w-md mx-auto px-5 pt-6 pb-2">
          <a href="#/" className="text-lg font-bold tracking-tight">🤝 Promise Keeper</a>
        </header>
        <main className="max-w-md mx-auto px-5 pb-16">
          {route.page === 'promise' ? <PromisePage id={route.id} /> : <CreatePromise />}
        </main>
      </div>
    </PayPalScriptProvider>
  )
}
