// Rolls a number up from where it was to where it is now.
import { useEffect, useRef } from 'react'
import { animate, useReducedMotion } from 'motion/react'

export default function CountUp({ value, format = (v) => String(Math.round(v)), duration = 1.2, className = '' }) {
  const el = useRef(null)
  const from = useRef(0)
  const reduced = useReducedMotion()

  useEffect(() => {
    const node = el.current
    if (!node) return
    if (reduced) {
      node.textContent = format(value)
      from.current = value
      return
    }
    const controls = animate(from.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => (node.textContent = format(v)),
    })
    from.current = value
    return () => controls.stop()
    // format is a fresh function each render; the value is what matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, reduced])

  return (
    <span ref={el} className={className}>
      {format(reduced ? value : from.current)}
    </span>
  )
}
