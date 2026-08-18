import styles from './ThinkingReasoning.module.css'
import { useEffect, useRef, useState } from 'react'

export interface ThinkingReasoningProps {
  sentences?: string[]
  delays?: number[]
  width?: number | string
}

export function ThinkingReasoning({
  sentences,
  delays,
  width = 360
}: ThinkingReasoningProps): JSX.Element {
  const SENTENCES = sentences ?? [
    'Parsing the request and pulling the context together.',
    'Checking which tools are available and which are safe to run.',
    'Planning the steps: gather, act, verify, then report back.',
    'Watching for anything that needs your approval before it runs.'
  ]
  const DELAYS = delays ?? [700, 800, 750, 700]
  const THINK_MS = DELAYS.reduce((a, b) => a + b, 0)
  const ELAPSED_S = Math.max(1, Math.round(THINK_MS / 1000))
  const COLLAPSE_BEAT = 360

  const SENT_H = 40
  const GAP = 4
  const MAX_H = 180
  const FADE = 16

  const [phase, setPhase] = useState<'thinking' | 'done'>('thinking')
  const [revealed, setRevealed] = useState(0)
  const [open, setOpen] = useState(false)
  const [fade, setFade] = useState({ top: false, bottom: true })
  const viewportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      const raf = requestAnimationFrame(() => {
        setRevealed(SENTENCES.length)
        setPhase('done')
      })
      return () => cancelAnimationFrame(raf)
    }
    const timers: ReturnType<typeof setTimeout>[] = []
    const at = (ms: number, fn: () => void): void => {
      timers.push(setTimeout(fn, ms))
    }
    let t = 0
    DELAYS.forEach((d, i) => {
      t += d
      at(t, () => setRevealed(i + 1))
    })
    at(THINK_MS + COLLAPSE_BEAT, () => setPhase('done'))
    return () => timers.forEach(clearTimeout)
  }, [DELAYS, SENTENCES.length])

  const done = phase === 'done'
  const expanded = done ? open : true
  const count = done ? SENTENCES.length : revealed
  const contentH = count > 0 ? count * SENT_H + (count - 1) * GAP : 0
  const capped = contentH > MAX_H
  const viewH = capped ? MAX_H : contentH
  const scrollable = done && open
  const translate = scrollable ? 0 : capped ? MAX_H - FADE - contentH : 0

  const showTop = scrollable ? fade.top : capped
  const showBottom = scrollable ? fade.bottom : capped
  const mask = capped
    ? `linear-gradient(to bottom, transparent 0, #000 ${showTop ? FADE : 0}px, #000 calc(100% - ${showBottom ? FADE : 0}px), transparent 100%)`
    : 'none'

  const onScroll = (): void => {
    const el = viewportRef.current
    if (!el) return
    setFade({
      top: el.scrollTop > 1,
      bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 1
    })
  }

  const toggle = (): void => {
    const next = !open
    if (next) {
      setFade({ top: false, bottom: true })
      if (viewportRef.current) viewportRef.current.scrollTop = 0
    }
    setOpen(next)
  }

  return (
    <div className={styles.tr} style={{ width }}>
      <button
        type="button"
        className={styles.trHeader + (done ? ' ' + styles.isClickable : '')}
        aria-expanded={expanded}
        aria-label="Toggle thought"
        onClick={done ? toggle : undefined}
      >
        {done ? (
          <span className={styles.trLabel}>
            <span className={styles.trVerb}>Thought</span> for {ELAPSED_S}s
          </span>
        ) : (
          <span className={styles.trLabel + ' ' + styles.trShimmer}>Thinking…</span>
        )}
        {done && (
          <svg className={styles.trChevron} viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
            <path d="m4.5 15.75 7.5-7.5 7.5 7.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <div className={styles.trCollapsible + (expanded ? '' : ' ' + styles.isCollapsed)}>
        <div className={styles.trInner}>
          <div
            ref={viewportRef}
            className={styles.trViewport + (scrollable ? ' ' + styles.isScroll : '')}
            style={{ height: `${viewH}px`, WebkitMaskImage: mask, maskImage: mask }}
            onScroll={scrollable ? onScroll : undefined}
          >
            <div className={styles.trStream} style={{ transform: `translateY(${translate}px)` }}>
              {SENTENCES.slice(0, count).map((line, i) => (
                <p key={i} className={styles.trSentence}>{line}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}