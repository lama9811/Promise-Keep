// Pulls its child a few pixels toward the cursor, so the main button feels
// like it wants to be pressed.
import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react'

export default function Magnetic({ strength = 0.28, className = '', children }) {
  const reduced = useReducedMotion()
  const x = useSpring(useMotionValue(0), { stiffness: 220, damping: 15, mass: 0.4 })
  const y = useSpring(useMotionValue(0), { stiffness: 220, damping: 15, mass: 0.4 })

  const onMove = (e) => {
    if (reduced || e.pointerType === 'touch') return
    const r = e.currentTarget.getBoundingClientRect()
    x.set((e.clientX - (r.left + r.width / 2)) * strength)
    y.set((e.clientY - (r.top + r.height / 2)) * strength)
  }
  const onLeave = () => {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      whileTap={{ scale: 0.96 }}
      style={{ x, y }}
      className={`inline-block ${className}`}
    >
      {children}
    </motion.div>
  )
}
