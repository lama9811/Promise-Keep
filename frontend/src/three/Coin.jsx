import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils, Color, RepeatWrapping } from 'three'
import { coin } from './coinStore'
import { makeFaceTextures, makeReedTexture } from './engraving'

const R = 1.4
const H = 0.2
const TAU = Math.PI * 2
const MINT = new Color('#6ef0be')
const ROSE = new Color('#ff4d6d')
const BLACK = new Color('#000000')

const chrome = { color: '#ffffff', metalness: 1, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.08 }

function Face({ side, z }) {
  const mat = useRef()
  const version = useRef(-1)
  const initial = useMemo(() => makeFaceTextures(side, coin.stakeCents), [side])

  useEffect(() => () => {
    initial.map.dispose()
    initial.bumpMap.dispose()
  }, [initial])

  // Redraw the engraving when the stake changes (back face only).
  useFrame(() => {
    if (side !== 'back' || version.current === coin.version || !mat.current) return
    version.current = coin.version
    const next = makeFaceTextures('back', coin.stakeCents)
    mat.current.map?.dispose()
    mat.current.bumpMap?.dispose()
    mat.current.map = next.map
    mat.current.bumpMap = next.bumpMap
    mat.current.needsUpdate = true
  })

  return (
    <mesh position={[0, 0, z]} rotation={[0, side === 'back' ? Math.PI : 0, 0]}>
      <circleGeometry args={[R - 0.01, 128]} />
      <meshPhysicalMaterial ref={mat} {...chrome} roughness={0.22} map={initial.map} bumpMap={initial.bumpMap} bumpScale={0.45} />
    </mesh>
  )
}

function Ring({ segments }) {
  const group = useRef()
  const mats = useRef([])
  const count = Math.max(1, segments)
  const gap = count > 1 ? 0.12 : 0
  const arc = TAU / count - gap

  useFrame((_, dt) => {
    const show = coin.mode === 'locked' || coin.mode === 'progress'
    const g = group.current
    if (!g) return
    const s = MathUtils.damp(g.scale.x, show ? 1 : 0.7, 6, dt)
    g.scale.setScalar(s)
    g.rotation.z += dt * (show ? 0.05 : 0.4)
    mats.current.forEach((m, i) => {
      if (!m) return
      m.opacity = MathUtils.damp(m.opacity, show ? 1 : 0, 6, dt)
      const lit = coin.mode === 'progress' && i < coin.done
      const glow = coin.outcome === 'lost' ? ROSE : MINT
      m.emissive.lerp(lit || coin.outcome === 'won' ? glow : BLACK, 1 - Math.exp(-6 * dt))
      m.emissiveIntensity = 1.4
    })
  })

  return (
    <group ref={group} scale={0.7}>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={`${count}-${i}`} rotation={[0, 0, Math.PI / 2 - i * (TAU / count) - arc - gap / 2]}>
          <torusGeometry args={[1.82, 0.065, 24, 96, arc]} />
          <meshPhysicalMaterial
            ref={(m) => (mats.current[i] = m)}
            {...chrome}
            roughness={0.25}
            transparent
            opacity={0}
            emissive="#000000"
          />
        </mesh>
      ))}
    </group>
  )
}

export default function Coin({ pointer, reducedMotion, ringSegments = 1 }) {
  const body = useRef()
  const lift = useRef({ y: reducedMotion ? 0 : 3.2, v: 0 })
  const spin = useRef(0)
  const reed = useMemo(() => {
    const t = makeReedTexture()
    t.wrapS = t.wrapT = RepeatWrapping
    t.repeat.set(24, 1)
    return t
  }, [])

  useFrame((state, dt) => {
    const g = body.current
    if (!g) return
    dt = Math.min(dt, 1 / 30)
    const t = state.clock.elapsedTime
    const p = pointer.current

    // Entrance: a heavy drop with one small bounce.
    const L = lift.current
    L.v += -L.y * 90 * dt
    L.v *= Math.exp(-7 * dt)
    L.y += L.v * dt
    g.position.y = L.y + (reducedMotion ? 0 : Math.sin(t * 1.1) * 0.04)

    // Keystrokes spin the coin; it then settles on a whole turn.
    coin.kick = MathUtils.damp(coin.kick, 0, 3, dt)
    if (!reducedMotion) spin.current += coin.kick * dt * 2.2
    if (coin.kick < 0.05) {
      spin.current = MathUtils.damp(spin.current, Math.round(spin.current / TAU) * TAU, 5, dt)
    }

    const showBack = coin.mode !== 'idle' && coin.outcome !== 'won'
    const drift = reducedMotion || coin.mode !== 'idle' ? 0 : Math.sin(t * 0.45) * 0.35
    const targetY = (showBack ? Math.PI : 0) + drift + p.x * 0.45 + spin.current
    const targetX = -p.y * 0.3 + (reducedMotion ? 0 : Math.sin(t * 0.7) * 0.04)

    g.rotation.y = MathUtils.damp(g.rotation.y, targetY, 4.5, dt)
    g.rotation.x = MathUtils.damp(g.rotation.x, targetX, 4.5, dt)
  })

  return (
    <group>
      <group ref={body}>
        {/* Edge with fine ridges */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[R, R, H, 160, 1, true]} />
          <meshPhysicalMaterial {...chrome} roughness={0.28} bumpMap={reed} bumpScale={2} />
        </mesh>
        {/* Rounded rims */}
        {[H / 2, -H / 2].map((z) => (
          <mesh key={z} position={[0, 0, z]}>
            <torusGeometry args={[R - 0.02, 0.035, 16, 160]} />
            <meshPhysicalMaterial {...chrome} />
          </mesh>
        ))}
        <Face side="front" z={H / 2 + 0.001} />
        <Face side="back" z={-H / 2 - 0.001} />
      </group>
      <Ring segments={ringSegments} />
    </group>
  )
}
