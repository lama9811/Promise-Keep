import { Component, lazy, Suspense, useEffect, useState } from 'react'

const CoinScene = lazy(() => import('./CoinScene'))

// Shown while the 3D code loads, or if the device has no WebGL.
function StillCoin() {
  return (
    <div className="grid h-full w-full place-items-center" aria-hidden="true">
      <div className="aspect-square w-[52%] rounded-full bg-[radial-gradient(circle_at_35%_30%,#ffffff,#c9cff0_45%,#7d88c9_75%,#3a49b8)] shadow-[0_40px_80px_-30px_#07116b]" />
    </div>
  )
}

class WebGLBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? <StillCoin /> : this.props.children
  }
}

export default function CoinStage({ className = '', ringSegments = 1 }) {
  // Engravings are drawn with the page font, so wait until it has loaded.
  const [fontsReady, setFontsReady] = useState(false)
  useEffect(() => {
    let alive = true
    document.fonts.ready.then(() => alive && setFontsReady(true))
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className={className}>
      {fontsReady ? (
        <WebGLBoundary>
          <Suspense fallback={<StillCoin />}>
            <CoinScene ringSegments={ringSegments} />
          </Suspense>
        </WebGLBoundary>
      ) : (
        <StillCoin />
      )}
    </div>
  )
}
