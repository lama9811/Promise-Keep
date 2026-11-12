// Direction A: one live 3D world. A big chrome coin in the middle, the idea
// coins orbiting it, real reflections, and you can grab and turn the whole thing.
import { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, Environment, Float, Lightformer, PresentationControls } from '@react-three/drei'
import { makeFaceTextures } from '../three/engraving'

const chrome = { color: '#ffffff', metalness: 1, roughness: 0.17, clearcoat: 1, clearcoatRoughness: 0.08 }

function Coin({ r = 1, stake = 0, onClick, hoverable }) {
  const front = useMemo(() => makeFaceTextures(stake ? 'back' : 'front', stake), [stake])
  const [hover, setHover] = useState(false)
  const g = useRef()
  useFrame((_, dt) => {
    if (!g.current) return
    const s = hover ? 1.15 : 1
    g.current.scale.x += (s - g.current.scale.x) * Math.min(1, dt * 8)
    g.current.scale.y = g.current.scale.z = g.current.scale.x
    if (hover) g.current.rotation.y += dt * 4
  })
  return (
    <group
      ref={g}
      onClick={onClick}
      onPointerOver={(e) => {
        if (!hoverable) return
        e.stopPropagation()
        setHover(true)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        setHover(false)
        document.body.style.cursor = ''
      }}
    >
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[r, r, r * 0.15, 96, 1, true]} />
        <meshPhysicalMaterial {...chrome} roughness={0.3} />
      </mesh>
      {[1, -1].map((side) => (
        <mesh key={side} position={[0, 0, (side * r * 0.15) / 2 + side * 0.001]} rotation={[0, side < 0 ? Math.PI : 0, 0]}>
          <circleGeometry args={[r, 96]} />
          <meshPhysicalMaterial {...chrome} roughness={0.22} map={front.map} bumpMap={front.bumpMap} bumpScale={0.4} />
        </mesh>
      ))}
    </group>
  )
}

function Orbit({ ideas, onPick }) {
  const ring = useRef()
  useFrame((_, dt) => {
    if (ring.current) ring.current.rotation.y += dt * 0.18
  })
  return (
    <group ref={ring} rotation={[0.28, 0, 0]}>
      {ideas.map((idea, i) => {
        const a = (i / ideas.length) * Math.PI * 2
        return (
          <group key={idea.title} position={[Math.sin(a) * 3.4, 0, Math.cos(a) * 3.4]}>
            <Float speed={2} rotationIntensity={0.6} floatIntensity={0.8}>
              <Coin r={0.55} stake={idea.cents} hoverable onClick={() => onPick(idea)} />
            </Float>
          </group>
        )
      })}
    </group>
  )
}

export default function WorldScene({ ideas, stake, onPick }) {
  return (
    <Canvas dpr={[1, 1.75]} camera={{ position: [0, 1.2, 8.5], fov: 38 }} gl={{ antialias: true, alpha: true }}>
      <Environment resolution={256} frames={1}>
        <color attach="background" args={['#26305e']} />
        <Lightformer form="rect" intensity={4} position={[0, 4, 3]} scale={[10, 1.4, 1]} />
        <Lightformer form="rect" intensity={2.5} position={[-5, 0, 2]} rotation-y={Math.PI / 2} scale={[8, 2, 1]} />
        <Lightformer form="rect" color="#1e3bff" intensity={2.4} position={[0, -4, 2]} scale={[10, 2, 1]} />
        <Lightformer form="rect" color="#ffd84a" intensity={1.8} position={[4, 3, -2]} scale={[4, 2, 1]} />
        <Lightformer form="rect" color="#6ef0be" intensity={1.2} position={[-4, -2, -2]} scale={[4, 2, 1]} />
      </Environment>
      <PresentationControls global snap rotation={[0, 0, 0]} polar={[-0.4, 0.4]} azimuth={[-1.2, 1.2]} config={{ mass: 1, tension: 170 }}>
        <Float speed={1.4} rotationIntensity={0.3} floatIntensity={0.5}>
          <group rotation={[0, -0.35, 0]}>
            <Coin r={1.45} stake={stake} />
          </group>
        </Float>
        <Orbit ideas={ideas} onPick={onPick} />
      </PresentationControls>
      <ContactShadows position={[0, -2.3, 0]} opacity={0.3} blur={3} scale={12} far={4} color="#1a2466" />
    </Canvas>
  )
}
