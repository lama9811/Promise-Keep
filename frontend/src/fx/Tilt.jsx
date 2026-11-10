// A surface that leans toward the cursor like a card held in your hand, with a
// soft highlight that follows the pointer. Children marked with `depth` float
// above it (translateZ). Off on touch screens and for reduced motion.
import { createContext, useContext } from 'react'
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react'

const SPRING = { stiffness: 170, damping: 18, mass: 0.6 }
const TiltContext = createContext(false)

export function Tilt({ as = 'div', max = 7, glare = true, className = '', style, children, ...rest }) {
  const reduced = useReducedMotion()
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const sx = useSpring(px, SPRING)
  const sy = useSpring(py, SPRING)
  const rotateY = useTransform(sx, [0, 1], [-max, max])
  const rotateX = useTransform(sy, [0, 1], [max * 0.8, -max * 0.8])
  const gx = useTransform(sx, (v) => `${v * 100}%`)
  const gy = useTransform(sy, (v) => `${v * 100}%`)
  const glareBg = useMotionTemplate`radial-gradient(420px circle at ${gx} ${gy}, rgba(255,255,255,0.55), transparent 55%)`
  const glareOpacity = useSpring(0, SPRING)

  const onMove = (e) => {
    if (reduced || e.pointerType === 'touch') return
    const r = e.currentTarget.getBoundingClientRect()
    px.set((e.clientX - r.left) / r.width)
    py.set((e.clientY - r.top) / r.height)
    glareOpacity.set(1)
  }
  const onLeave = () => {
    px.set(0.5)
    py.set(0.5)
    glareOpacity.set(0)
  }

  const Tag = motion[as]
  return (
    <TiltContext.Provider value={!reduced}>
      <Tag
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        style={{ rotateX, rotateY, transformPerspective: 1100, transformStyle: 'preserve-3d', ...style }}
        className={`relative ${className}`}
        {...rest}
      >
        {children}
        {glare && !reduced && (
          <motion.span
            aria-hidden="true"
            style={{ background: glareBg, opacity: glareOpacity }}
            className="pointer-events-none absolute inset-0 rounded-[inherit] mix-blend-soft-light"
          />
        )}
      </Tag>
    </TiltContext.Provider>
  )
}

// Lifts its content off the tilting surface.
export function Depth({ z = 30, className = '', children }) {
  const on = useContext(TiltContext)
  return (
    <div className={className} style={on ? { transform: `translateZ(${z}px)`, transformStyle: 'preserve-3d' } : undefined}>
      {children}
    </div>
  )
}
