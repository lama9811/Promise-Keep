import { useRef } from 'react'
import { motion } from 'motion/react'
import { kickCoin } from '../three/coinStore'

const EASE = [0.16, 1, 0.3, 1]
const EXAMPLES = [
  '10,000 steps every day this week or $20 to Alex',
  'gym 4 times this week or $25 to Alex',
  'run 5 km 3 times by Sunday or $15 to Alex',
]

export default function Composer({ text, setText, onSubmit, parsing, error }) {
  const inputRef = useRef()
  return (
    <motion.form
      key="composer"
      onSubmit={onSubmit}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.25, ease: EASE } }}
    >
      <label htmlFor="goal" className="block font-display text-xl font-bold tracking-[-0.01em]">
        What do you promise?
      </label>
      <p className="mt-1 text-sm text-ink-soft">
        Steps, runs, workouts or the gym. Write it like you'd text a friend: the goal, how many times, by when, and who gets the money if you don't.
      </p>
      <textarea
        id="goal"
        ref={inputRef}
        value={text}
        rows={3}
        maxLength={500}
        autoFocus
        onChange={(e) => {
          setText(e.target.value)
          kickCoin(0.5)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            onSubmit()
          }
        }}
        placeholder={EXAMPLES[0]}
        className="mt-4 w-full resize-none rounded-2xl border border-line bg-canvas px-4 py-3.5 font-display text-xl font-medium leading-snug text-ink placeholder:text-ink/30 transition-colors focus:border-cobalt focus:bg-white focus:outline-none focus:ring-4 focus:ring-cobalt/15"
      />
      <div className="mt-2 flex items-center justify-between text-xs text-ink-soft">
        <span>Press Enter to continue</span>
        <span className="tabular-nums">{text.length}/500</span>
      </div>

      <p className="mt-5 text-sm font-medium">Or start from one of these</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => {
              setText(ex)
              kickCoin(2)
              inputRef.current?.focus()
            }}
            className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm text-ink-soft transition-colors hover:border-cobalt hover:text-cobalt"
          >
            {ex}
          </button>
        ))}
      </div>

      <button
        type="submit"
        disabled={parsing || text.trim().length < 3}
        className="mt-7 inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-cobalt px-6 py-3.5 font-semibold text-white shadow-[0_10px_24px_-12px_rgba(30,59,255,0.8)] transition-colors hover:bg-[#1631e0] disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink/40 disabled:shadow-none sm:w-auto"
      >
        {parsing && <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
        {parsing ? 'Reading your promise…' : 'Make it a deal'}
      </button>
      <p role="status" className="mt-3 min-h-5 text-sm text-broke">
        {error}
      </p>
    </motion.form>
  )
}
