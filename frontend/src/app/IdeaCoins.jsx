// Ready-made promises as a ring of chrome coins. Drag to spin the ring, click a
// side coin to bring it forward, and start the one in front.
import { useEffect, useRef, useState } from 'react'
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { Icon } from './ui'

const EASE = [0.16, 1, 0.3, 1]
const CHROME = 'radial-gradient(circle at 32% 28%, #ffffff 0%, #e6e9fb 28%, #b4bdea 58%, #7d88c9 82%, #4352c0 100%)'
const THICK = 10

function Coin({ idea, index, count, rot, radius, size, focused, onPick }) {
  const step = 360 / count
  const angle = useTransform(rot, (r) => index * step + r)
  const x = useTransform(angle, (a) => Math.sin((a * Math.PI) / 180) * radius)
  const z = useTransform(angle, (a) => (Math.cos((a * Math.PI) / 180) - 1) * radius)
  const facing = useTransform(angle, (a) => (Math.cos((a * Math.PI) / 180) + 1) / 2) // 1 in front, 0 behind
  const opacity = useTransform(facing, [0, 1], [0.3, 1])
  // Coins at the back sit higher, as if you look down on the ring; they turn
  // only partly sideways so their faces stay readable.
  const y = useTransform(facing, [0, 1], [-104, 0])
  const turn = useTransform(angle, (a) => Math.sin((a * Math.PI) / 180) * 50)

  return (
    <motion.button
      type="button"
      onClick={onPick}
      aria-label={focused ? `${idea.title}, selected` : `Show ${idea.title}`}
      style={{ x, y, z, rotateY: turn, opacity, width: size, height: size, marginLeft: -size / 2, transformStyle: 'preserve-3d' }}
      whileHover={{ scale: 1.06 }}
      className="absolute left-1/2 top-0 rounded-full focus-visible:outline-cobalt"
    >
      <motion.span
        className="absolute inset-0 rounded-full"
        animate={focused ? { rotateY: [0, 360] } : { rotateY: 0 }}
        transition={focused ? { duration: 1.1, ease: EASE } : { duration: 0.4 }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Edge: stacked discs give the coin its thickness */}
        {Array.from({ length: THICK }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="absolute inset-0 rounded-full"
            style={{
              transform: `translateZ(${-i}px)`,
              background: `linear-gradient(90deg, #4352c0, #b4bdea ${30 + (i % 3) * 8}%, #7d88c9 70%, #3a49b8)`,
            }}
          />
        ))}
        {/* Front face */}
        <span
          className="absolute inset-0 grid place-items-center rounded-full [backface-visibility:hidden]"
          style={{ background: CHROME, transform: 'translateZ(1px)', boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.7), inset 0 -10px 24px rgba(30,59,255,0.25)' }}
        >
          <span className="absolute inset-[9%] rounded-full border border-ink/15" />
          <span className="flex flex-col items-center gap-1 text-ink">
            <Icon name={idea.icon} className="size-[34%] min-h-7 min-w-7" strokeWidth={2} />
            <span className="font-display text-[15px] font-extrabold tracking-tight">{idea.stake}</span>
          </span>
        </span>
        {/* Back face */}
        <span
          className="absolute inset-0 grid place-items-center rounded-full px-5 text-center [backface-visibility:hidden]"
          style={{ background: CHROME, transform: `rotateY(180deg) translateZ(${THICK}px)` }}
        >
          <span className="font-display text-xs font-bold leading-tight text-ink">{idea.title}</span>
        </span>
      </motion.span>
    </motion.button>
  )
}

export default function IdeaCoins({ ideas, onStart }) {
  const reduced = useReducedMotion()
  const stage = useRef(null)
  const [width, setWidth] = useState(640)
  const [focus, setFocus] = useState(0)
  const rot = useMotionValue(0)
  const count = ideas.length
  const step = 360 / count
  const drag = useRef(null)
  const moved = useRef(false)
  const hovering = useRef(false)

  useEffect(() => {
    const el = stage.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const size = width < 480 ? 104 : 132
  const radius = Math.min(width * 0.4, 280)

  const settleOn = (i) => {
    // Turn the shortest way round to coin i.
    const current = rot.get()
    let target = -i * step
    target += Math.round((current - target) / 360) * 360
    animate(rot, target, { type: 'spring', stiffness: 90, damping: 18 })
    setFocus(((i % count) + count) % count)
  }

  // Drift to the next idea every few seconds while nobody is touching it.
  useEffect(() => {
    if (reduced) return
    const id = setInterval(() => {
      if (!hovering.current && !drag.current) settleOn(focus + 1)
    }, 4200)
    return () => clearInterval(id)
  })

  const onDown = (e) => {
    drag.current = { x: e.clientX, rot: rot.get(), moved: false }
    moved.current = false
  }
  const onMove = (e) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    if (Math.abs(dx) > 4) d.moved = true
    rot.set(d.rot + dx * 0.35)
  }
  const onUp = () => {
    const d = drag.current
    drag.current = null
    if (d?.moved) moved.current = true
    if (d?.moved) settleOn(Math.round(-rot.get() / step))
  }

  const idea = ideas[focus]

  return (
    <section>
      <div className="mb-2 px-1">
        <h2 className="font-display text-lg font-bold">Ideas to try</h2>
        <p className="text-sm text-ink-soft">Spin the coins and pick one. The AI drafts the deal for you.</p>
      </div>

      <div
        ref={stage}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerEnter={() => (hovering.current = true)}
        onPointerLeave={() => {
          hovering.current = false
          onUp()
        }}
        className="relative cursor-grab touch-pan-y select-none active:cursor-grabbing"
        style={{ height: size + 150, perspective: 1100 }}
      >
        <div className="absolute inset-x-0 top-[120px]" style={{ transformStyle: 'preserve-3d' }}>
          {ideas.map((it, i) => (
            <Coin
              key={it.title}
              idea={it}
              index={i}
              count={count}
              rot={rot}
              radius={radius}
              size={size}
              focused={i === focus}
              onPick={(e) => {
                if (moved.current) return
                e.stopPropagation()
                if (i === focus) onStart(it.text)
                else settleOn(focus + ((i - focus + count + count / 2) % count) - count / 2)
              }}
            />
          ))}
        </div>
        <div aria-hidden="true" className="absolute bottom-1 left-1/2 h-5 w-[55%] -translate-x-1/2 rounded-[100%] bg-ink/15 blur-xl" />
      </div>

      <div className="glass spot mt-2 flex flex-wrap items-center justify-between gap-4 rounded-3xl px-5 py-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={idea.title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="min-w-0"
          >
            <p className="font-display text-lg font-bold leading-tight">{idea.title}</p>
            <p className="text-sm text-ink-soft">
              {idea.proof}, {idea.stake} on the line
            </p>
          </motion.div>
        </AnimatePresence>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5" aria-hidden="true">
            {ideas.map((it, i) => (
              <span key={it.title} className={`h-1.5 rounded-full transition-all duration-300 ${i === focus ? 'w-5 bg-cobalt' : 'w-1.5 bg-ink/15'}`} />
            ))}
          </div>
          <button
            type="button"
            onClick={() => onStart(idea.text)}
            className="rounded-xl bg-cobalt px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_-12px_rgba(30,59,255,0.8)] transition-colors hover:bg-[#1631e0]"
          >
            Start this promise
          </button>
        </div>
      </div>
    </section>
  )
}
