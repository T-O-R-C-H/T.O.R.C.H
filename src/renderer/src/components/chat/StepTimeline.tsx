import { useEffect, useRef, useState } from 'react'
import styles from './StepTimeline.module.css'

export type TimelineStatus = 'pending' | 'active' | 'done' | 'failed' | 'waiting' | 'cancelled'

export interface TimelineStep {
  id: string
  label: string
  status: TimelineStatus
  /** Which kind of action this is, for its icon. */
  tool?: string
  /** TORCH's own to-do list while it works on the screen. */
  substeps?: { label: string; status: TimelineStatus }[]
  /** What it is doing this second; shown only while the step runs. */
  activity?: string
}

/*
 * A run of work, drawn as a quiet list of action rows: an icon for the kind
 * of action, what it was, and a small status mark at the end. Colour is kept
 * for the marks; the rows themselves stay neutral, so one failed step does not
 * paint a whole sentence red.
 */

const ICONS: Record<string, string> = {
  app: 'M3 4.5h10v7H3zM3 6.5h10',
  cursor: 'M4 2.5 12.5 9 8.6 9.7 10.6 13.6 8.8 14.4 6.9 10.5 4 13Z',
  file: 'M4.5 2h4.8L12 4.7V14H4.5zM9.2 2v2.8H12',
  folder: 'M2.5 4.5h4l1.2 1.4h5.8v6.6h-11z',
  globe:
    'M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2.6 8h10.8M8 2.6c1.7 1.6 2.5 3.4 2.5 5.4S9.7 11.8 8 13.4M8 2.6C6.3 4.2 5.5 6 5.5 8s.8 3.8 2.5 5.4',
  mail: 'M2.5 4h11v8h-11zM2.8 4.4 8 8.6l5.2-4.2',
  terminal: 'M2.5 3.5h11v9h-11zM5 6.5 7 8 5 9.5M8.5 10h2.5',
  eye: 'M1.8 8S4 4 8 4s6.2 4 6.2 4-2.2 4-6.2 4S1.8 8 1.8 8ZM8 6.4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Z',
  dot: 'M8 6.6a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8Z'
}

function iconFor(tool?: string): string {
  if (!tool) return ICONS.dot
  if (tool === 'open_app') return ICONS.app
  if (tool === 'vision_control' || tool.startsWith('click') || tool.startsWith('type'))
    return ICONS.cursor
  if (/file|read_(pdf|word|excel)|list_directory/.test(tool)) return ICONS.file
  if (/folder|zip|move/.test(tool)) return ICONS.folder
  if (/web|browser|download/.test(tool)) return ICONS.globe
  if (/mail|inbox|message|social/.test(tool)) return ICONS.mail
  if (tool === 'run_terminal') return ICONS.terminal
  if (/screen|screenshot/.test(tool)) return ICONS.eye
  return ICONS.dot
}

function ToolIcon({ tool }: { tool?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        d={iconFor(tool)}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Mark({ status }: { status: TimelineStatus }): JSX.Element | null {
  if (status === 'active') return <span className={styles.spinner} aria-label="Working" />
  if (status === 'done')
    return (
      <svg className={styles.markDone} viewBox="0 0 16 16" width="13" height="13" aria-label="Done">
        <path
          d="m3.5 8.4 2.9 2.9 6.1-6.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  if (status === 'failed')
    return (
      <svg
        className={styles.markFailed}
        viewBox="0 0 16 16"
        width="12"
        height="12"
        aria-label="Did not finish"
      >
        <path
          d="m4.5 4.5 7 7m0-7-7 7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    )
  if (status === 'waiting') return <span className={styles.markWaiting}>Waiting for you</span>
  if (status === 'cancelled') return <span className={styles.markMuted}>Stopped</span>
  return null
}

/** One line of the to-do list: a round box, ticked and struck through when done. */
function TodoBox({ status }: { status: TimelineStatus }): JSX.Element {
  if (status === 'done')
    return (
      <span className={styles.boxDone} aria-hidden="true">
        <svg viewBox="0 0 16 16" width="9" height="9">
          <path
            d="m3.5 8.4 2.9 2.9 6.1-6.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    )
  if (status === 'active') return <span className={styles.boxActive} aria-hidden="true" />
  if (status === 'failed')
    return (
      <span className={styles.boxFailed} aria-hidden="true">
        <svg viewBox="0 0 16 16" width="8" height="8">
          <path
            d="m4.5 4.5 7 7m0-7-7 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      </span>
    )
  if (status === 'waiting') return <span className={styles.boxWaiting} aria-hidden="true" />
  if (status === 'cancelled') return <span className={styles.boxStopped} aria-hidden="true" />
  return <span className={styles.box} aria-hidden="true" />
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
  const took = duration === null ? '' : ` for ${formatDuration(duration)}`
  const waitingOnUser =
    steps.some((s) => s.status === 'waiting') ||
    steps.some((s) => s.substeps?.some((sub) => sub.status === 'waiting'))
  if (waitingOnUser) return 'Waiting for you'
  if (running) return 'Working'
  if (steps.some((s) => s.status === 'failed')) {
    return duration === null ? 'Stopped' : `Stopped after ${formatDuration(duration)}`
  }
  if (steps.some((s) => s.status === 'cancelled')) {
    return duration === null ? 'Stopped' : `Stopped after ${formatDuration(duration)}`
  }
  return `Worked${took}`
}

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
        <svg
          className={styles.chevron}
          viewBox="0 0 16 16"
          width="11"
          height="11"
          aria-hidden="true"
        >
          <path
            d="m6 4 4 4-4 4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className={running && !waiting ? styles.shimmer : undefined}>
          {headline(steps, running, duration)}
        </span>
      </button>

      <div className={styles.collapsible + (open ? '' : ' ' + styles.collapsed)}>
        <ol className={styles.list}>
          {steps.map((step, i) => {
            const subs = step.substeps ?? []
            const subsDone = subs.filter((sub) => sub.status === 'done').length
            return (
              <li
                key={step.id}
                className={styles.item}
                data-status={step.status}
                style={{ ['--i' as string]: i }}
              >
                <div className={styles.row}>
                  <span className={styles.icon}>
                    <ToolIcon tool={step.tool} />
                  </span>
                  <span className={styles.label}>{step.label}</span>
                  <span className={styles.mark}>
                    <Mark status={step.status} />
                  </span>
                </div>

                {subs.length > 0 && (
                  <div className={styles.todos}>
                    <div className={styles.todosHead}>
                      <span>To-dos</span>
                      <span className={styles.todosCount}>
                        {subsDone} of {subs.length}
                      </span>
                    </div>
                    <ol className={styles.todoList}>
                      {subs.map((sub, j) => (
                        <li
                          key={`${j}-${sub.label}`}
                          className={styles.todo}
                          data-status={sub.status}
                          style={{ ['--i' as string]: j }}
                        >
                          <TodoBox status={sub.status} />
                          <span className={sub.status === 'active' ? styles.shimmer : undefined}>
                            {sub.label}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {step.status === 'active' && step.activity && (
                  <div key={step.activity} className={styles.activity}>
                    <span className={styles.activityCaret} aria-hidden="true">
                      ›
                    </span>
                    {step.activity}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
