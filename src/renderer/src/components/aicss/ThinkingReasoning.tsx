import styles from './ThinkingReasoning.module.css'
import { useEffect, useRef, useState } from 'react'

export interface ThinkingReasoningProps {
  sentences?: string[]
  running: boolean
  width?: number | string
}

const SENT_H = 40
const GAP = 4
const MAX_H = 180
const FADE = 16
const REVEAL_MS = 480

export function ThinkingReasoning({
  sentences,
  running,
  width
}: ThinkingReasoningProps): JSX.Element {
  const SENTENCES = sentences ?? []
  const [revealed, setRevealed] = useState(0)
  const [elapsedS, setElapsedS] = useState(0)
  const [open, setOpen] = useState(false)
  const [fade, setFade] = useState({ top: false, bottom: true })
  const viewportRef = useRef<HTMLDivElement>(null)
  const startedAtRef = useRef<number | null>(null)

  useEffect(() => {
    if (startedAtRef.current === null) startedAtRef.current = Date.now()
  }, [])

  useEffect(() => {
    if (running) return
    const t = window.setTimeout(() => {
      const start = startedAtRef.current ?? Date.now()
      setElapsedS(Math.max(1, Math.round((Date.now() - start) / 1000)))
    }, 0)
    return () => clearTimeout(t)
  }, [running])

  useEffect(() => {
    if (!running) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      const t = window.setTimeout(() => setRevealed(SENTENCES.length), 0)
      return () => clearTimeout(t)
    }
    const timer = window.setInterval(() => {
      setRevealed((r) => Math.min(r + 1, SENTENCES.length))
    }, REVEAL_MS)
    return () => clearInterval(timer)
  }, [running, SENTENCES.length])

  const done = !running
  const count = done ? SENTENCES.length : revealed

  const expanded = done ? open : true
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
    <div className={styles.tr} style={width ? { width } : undefined}>
      <button
        type="button"
        className={styles.trHeader + (done ? ' ' + styles.isClickable : '')}
        aria-expanded={expanded}
        aria-label="Toggle reasoning"
        onClick={done ? toggle : undefined}
      >
        {done ? (
          <span className={styles.trLabel}>
            <span className={styles.trVerb}>Reasoned</span> for {elapsedS}s
          </span>
        ) : (
          <span className={styles.trLabel + ' ' + styles.trShimmer}>Reasoning…</span>
        )}
        {done && (
          <svg
            className={styles.trChevron}
            viewBox="0 0 24 24"
            width="12"
            height="12"
            aria-hidden="true"
          >
            <path
              d="m4.5 15.75 7.5-7.5 7.5 7.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
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
                <p key={i} className={styles.trSentence}>
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
