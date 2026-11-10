// Split-flap characters, like an airport departures board. When the value
// changes, each cell clatters through a few characters and lands on the new one.
import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'

const SPIN = '0123456789$%'

function Cell({ ch, delay }) {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(reduced ? ch : ' ')
  const timer = useRef(null)

  useEffect(() => {
    if (reduced) {
      setShown(ch)
      return
    }
    let steps = 6 + Math.floor(Math.random() * 5)
    const tick = () => {
      if (steps-- <= 0) {
        setShown(ch)
        return
      }
      setShown(SPIN[Math.floor(Math.random() * SPIN.length)])
      timer.current = setTimeout(tick, 55)
    }
    timer.current = setTimeout(tick, delay)
    return () => clearTimeout(timer.current)
  }, [ch, delay, reduced])

  const space = ch === ' '
  return (
    <span
      className={`relative inline-grid h-[1.32em] place-items-center overflow-hidden rounded-[0.14em] ${
        space ? 'w-[0.32em]' : 'min-w-[0.74em] px-[0.08em] bg-[linear-gradient(to_bottom,#ffffff_0%,#ffffff_49.5%,#eef0f8_50.5%,#f7f8fc_100%)] shadow-[inset_0_0_0_1px_rgba(10,18,64,0.07),0_1px_0_rgba(10,18,64,0.08),0_6px_10px_-6px_rgba(10,18,64,0.35)]'
      }`}
      style={{ perspective: 300 }}
    >
      {!space && (
        <motion.span
          key={shown}
          initial={reduced ? false : { rotateX: -100, opacity: 0.4 }}
          animate={{ rotateX: 0, opacity: 1 }}
          transition={{ duration: 0.11, ease: 'easeOut' }}
          style={{ transformOrigin: '50% 50%' }}
          className="leading-none"
        >
          {shown}
        </motion.span>
      )}
      {/* The hinge across the middle of every flap */}
      {!space && <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-ink/15" />}
    </span>
  )
}

export default function FlapText({ text, className = '', start = 0 }) {
  return (
    <span aria-label={text} role="img" className={`inline-flex gap-[0.06em] ${className}`}>
      {[...text].map((ch, i) => (
        <Cell key={`${i}-${text.length}`} ch={ch} delay={start + i * 70} />
      ))}
    </span>
  )
}
