import { useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, PerformanceMonitor } from '@react-three/drei'
import { useReducedMotion } from 'motion/react'
import Coin from './Coin'

// Tracks the cursor across the whole window (not just over the canvas),
// so the coin looks at you wherever you are on the page.
function useWindowPointer() {
  const pointer = useRef({ x: 0, y: 0 })
  useEffect(() => {
    const onMove = (e) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1
      pointer.current.y = -((e.clientY / window.innerHeight) * 2 - 1)
    }
    const onOrient = (e) => {
      if (e.gamma == null) return
      pointer.current.x = Math.max(-1, Math.min(1, e.gamma / 30))
      pointer.current.y = Math.max(-1, Math.min(1, (45 - e.beta) / 30))
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('deviceorientation', onOrient, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('deviceorientation', onOrient)
    }
  }, [])
  return pointer
}

// Keep the coin and its ring (about 4.2 units across) inside the frame,
// whatever the shape of the canvas.
const SUBJECT = 4.3
function FitCamera() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  useEffect(() => {
    const aspect = size.width / size.height
    const fit = 2 * Math.tan((camera.fov * Math.PI) / 360)
    camera.position.z = SUBJECT / (fit * Math.min(1, aspect))
    camera.updateProjectionMatrix()
  }, [camera, size])
  return null
}

export default function CoinScene({ ringSegments = 1 }) {
  const pointer = useWindowPointer()
  const reducedMotion = useReducedMotion()
  const [dpr, setDpr] = useState(1.75)

  return (
    <Canvas
      dpr={dpr}
      camera={{ position: [0, 0, 9.2], fov: 32 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      aria-hidden="true"
    >
      <FitCamera />
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.75)} />
      <directionalLight position={[3, 4, 5]} intensity={1.2} />

      {/* Studio reflections built locally, so the chrome needs no downloads. */}
      <Environment resolution={256} frames={1}>
        <color attach="background" args={['#0b1a8f']} />
        <Lightformer form="rect" intensity={4} position={[0, 4, 3]} scale={[10, 1.4, 1]} />
        <Lightformer form="rect" intensity={2.5} position={[-5, 0, 2]} rotation-y={Math.PI / 2} scale={[8, 2, 1]} />
        <Lightformer form="rect" intensity={2.5} position={[5, -1, 2]} rotation-y={-Math.PI / 2} scale={[8, 0.8, 1]} />
        <Lightformer form="rect" color="#6f86ff" intensity={3} position={[0, -4, 2]} scale={[10, 2, 1]} />
        <Lightformer form="ring" color="#ffffff" intensity={1.5} position={[0, 0, 6]} scale={3} />
      </Environment>

      <Coin pointer={pointer} reducedMotion={reducedMotion} ringSegments={ringSegments} />
      <ContactShadows position={[0, -2.4, 0]} opacity={0.45} blur={2.8} scale={7} far={4} color="#07116b" />
    </Canvas>
  )
}
