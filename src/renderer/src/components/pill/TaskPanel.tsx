import { useEffect, useState } from 'react'
import { useTorchStore } from '../../store/torchStore'
import { useWebSocket } from '../../hooks/useWebSocket'

/**
 * Live narration of the running task, shown at the right edge while the main
 * window is away.
 *
 * The panel is task-scoped: it appears when work starts and leaves shortly
 * after it ends, so an idle desktop is not carrying a permanent widget. It
 * lingers briefly on the last state rather than vanishing the instant a task
 * finishes, which would leave the user unsure what happened.
 */
const LINGER_AFTER_FINISH_MS = 3000

function elapsedLabel(startedAt: number | null): string {
  if (!startedAt) return ''
  const seconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000))
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

export function TaskPanel(): JSX.Element | null {
  const messages = useTorchStore((s) => s.messages)
  const agentStatus = useTorchStore((s) => s.agentStatus)
  const { sendStopCommand } = useWebSocket()

  const [, setTick] = useState(0)

  const running = agentStatus !== 'idle'

  // The most recent agent message carries the steps for the current task.
  const current = [...messages].reverse().find((m) => m.role === 'torch' && m.steps?.length)
  const steps = current?.steps ?? []
  const lastCommand = [...messages].reverse().find((m) => m.role === 'user')
  const userCommand = lastCommand?.content ?? ''

  // Elapsed time comes from when the command was issued, not from when this
  // panel first rendered - the panel can appear part-way through a task.
  const startedAt = lastCommand?.timestamp ?? null

  useEffect(() => {
    if (running) {
      window.torchAPI?.showTaskPanel?.()
      return undefined
    }
    // Hold the finished state briefly so the result is readable, then go.
    const timer = setTimeout(() => window.torchAPI?.hideTaskPanel?.(), LINGER_AFTER_FINISH_MS)
    return () => clearTimeout(timer)
  }, [running])

  // Keep the elapsed time moving while work is in progress.
  useEffect(() => {
    if (!running) return undefined
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [running])

  if (!running && steps.length === 0) return null

  return (
    <div className="task-panel">
      <div className="task-panel__head drag-region">
        <span className="task-panel__title">{running ? 'Working' : 'Finished'}</span>
        <span className="task-panel__elapsed">{elapsedLabel(startedAt)}</span>
      </div>

      {userCommand && <div className="task-panel__command">{userCommand}</div>}

      <div className="task-panel__steps">
        {steps.map((step) => (
          <div key={step.id} className={`task-step task-step--${step.status}`}>
            <span className="task-step__dot" aria-hidden="true" />
            <div className="task-step__body">
              <span className="task-step__label">{step.label}</span>
              {step.error && <span className="task-step__error">{step.error}</span>}
            </div>
          </div>
        ))}
      </div>

      {running && (
        <button
          type="button"
          className="task-panel__stop no-drag"
          onClick={() => sendStopCommand()}
        >
          Stop
        </button>
      )}
    </div>
  )
}
