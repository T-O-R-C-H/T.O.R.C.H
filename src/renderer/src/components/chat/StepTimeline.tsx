import { useEffect, useRef, useState } from 'react'
import styles from './StepTimeline.module.css'

export type TimelineStatus = 'pending' | 'active' | 'done' | 'failed' | 'waiting' | 'cancelled'

export interface TimelineStep {
  id: string
  label: string
  status: TimelineStatus
}

function StatusIcon({ status }: { status: TimelineStatus }): JSX.Element {
  if (status === 'active') {
    return (
      <svg className={styles.spin} viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <circle
          cx="8"
          cy="8"
          r="6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          opacity="0.2"
        />
        <path
          d="M14 8a6 6 0 0 0-6-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  if (status === 'done') {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path
          d="m3.5 8.4 2.9 2.9 6.1-6.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  if (status === 'failed') {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path
          d="m4.5 4.5 7 7m0-7-7 7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  if (status === 'waiting') {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path
          d="M6 4.5v7m4-7v7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  if (status === 'cancelled') {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path
          d="M4.5 8h7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <circle cx="8" cy="8" r="2" fill="currentColor" opacity="0.55" />
    </svg>
  )
}

function formatDuration(ms: number): string {
  const seconds = Math.max(1, Math.round(ms / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`
}

/**
 * How long the steps took, measured only while this component watched them
 * run. A conversation restored from history never saw the work happen, so it
 * reports no duration rather than inventing one.
 */
function useRunDuration(running: boolean): number | null {
  const startedAt = useRef<number | null>(null)
  const [duration, setDuration] = useState<number | null>(null)

  useEffect(() => {
    if (running) {
      if (startedAt.current === null) startedAt.current = Date.now()
      return
    }
    if (startedAt.current === null) return
    const elapsed = Date.now() - startedAt.current
    startedAt.current = null
    const timer = window.setTimeout(() => setDuration(elapsed), 0)
    return () => window.clearTimeout(timer)
  }, [running])

  return duration
}

function headline(steps: TimelineStep[], running: boolean, duration: number | null): string {
  const total = steps.length
  const done = steps.filter((s) => s.status === 'done').length
  const noun = total === 1 ? 'step' : 'steps'

  if (steps.some((s) => s.status === 'waiting')) return 'Waiting for your approval'
  if (running) return `Working · step ${Math.min(done + 1, total)} of ${total}`
  if (steps.some((s) => s.status === 'failed')) return `Stopped after ${done} of ${total} ${noun}`
  if (steps.some((s) => s.status === 'cancelled')) return 'Cancelled'
  return duration === null
    ? `Finished ${total} ${noun}`
    : `Finished ${total} ${noun} in ${formatDuration(duration)}`
}

/**
 * The list of things TORCH did for one request.
 *
 * It replaces two stacked blocks: an "Agenda" checklist, and above it a
 * "Reasoned for Ns" panel whose sentences were templated from the same steps
 * ("Done - Found your file."). The second was the first one restated and
 * labelled as thought, so it is gone; the time it reported now sits in this
 * header, where it is described as what it is - how long the work took.
 */
export function StepTimeline({ steps }: { steps: TimelineStep[] }): JSX.Element {
  const running = steps.some((s) => s.status === 'active' || s.status === 'pending')
  const waiting = steps.some((s) => s.status === 'waiting')
  const duration = useRunDuration(running || waiting)
  /* Open while there is something to watch; the user's own toggle wins after. */
  const [userOpen, setUserOpen] = useState<boolean | null>(null)
  const open = userOpen ?? true

  return (
    <div className={styles.timeline}>
      <button
        type="button"
        className={styles.head}
        aria-expanded={open}
        onClick={() => setUserOpen(!open)}
      >
        <span className={styles.headLabel + (running && !waiting ? ' ' + styles.shimmer : '')}>
          {headline(steps, running, duration)}
        </span>
        <svg
          className={styles.chevron}
          viewBox="0 0 16 16"
          width="12"
          height="12"
          aria-hidden="true"
        >
          <path
            d="m4 6 4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div className={styles.collapsible + (open ? '' : ' ' + styles.collapsed)}>
        <ol className={styles.list}>
          {steps.map((step, i) => (
            <li
              key={step.id}
              className={styles.item}
              data-status={step.status}
              style={{ ['--i' as string]: i }}
            >
              <span className={styles.icon}>
                <StatusIcon status={step.status} />
              </span>
              <span
                className={styles.label + (step.status === 'active' ? ' ' + styles.shimmer : '')}
              >
                {step.label}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
