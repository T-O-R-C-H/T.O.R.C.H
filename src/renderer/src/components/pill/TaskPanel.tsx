import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTorchStore, type Message, type Step } from '../../store/torchStore'
import { useWebSocket } from '../../hooks/useWebSocket'
import { StepList } from '../chat/StepList'
import { AttentionCard } from '../chat/AttentionCard'
import { TorchLogo } from '../ui/TorchLogo'

/**
 * TORCH's panel in the bottom-right corner, over whatever app is in front.
 *
 * While TORCH works in another app its own window steps aside, and this is
 * where the user follows along and answers it: the live to-do list, Approve
 * or Reject, "your turn" with Continue, a question with choices, and the
 * result at the end. Nobody has to switch back to TORCH to keep it going.
 *
 * The window sizes itself to this content and stays anchored to the corner.
 */
const LINGER_AFTER_DONE_MS = 5000
const LINGER_AFTER_FAILURE_MS = 12000

type Tone = 'working' | 'waiting' | 'done' | 'failed'

function elapsedLabel(startedAt: number | null): string {
  if (!startedAt) return ''
  const seconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000))
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`
}

function findTask(messages: Message[]): {
  request: Message | undefined
  plan: Message | undefined
  closing: Message | undefined
} {
  let requestIndex = -1
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user') {
      requestIndex = i
      break
    }
  }
  const after = requestIndex >= 0 ? messages.slice(requestIndex + 1) : messages
  const plan = [...after].reverse().find((m) => m.role === 'torch' && m.steps?.length)
  const closing = [...after]
    .reverse()
    .find((m) => m.role === 'torch' && !m.steps?.length && m.content?.trim())
  return { request: messages[requestIndex], plan, closing }
}

function ApprovalBlock({ message, step }: { message: Message; step: Step }): JSX.Element {
  const { sendApprovalFromAnywhere } = useWebSocket()
  const [sent, setSent] = useState<'approve' | 'cancel' | null>(null)
  const detail = String(step.args?.task ?? step.args?.command ?? step.args?.to ?? '').trim()

  const answer = (action: 'approve' | 'cancel'): void => {
    if (sent) return
    if (sendApprovalFromAnywhere(message.id, step.id, action)) setSent(action)
  }

  return (
    <section className="dock-approval" aria-live="assertive">
      <div className="dock-approval__head">
        <span className="dock-approval__shield" aria-hidden="true">
          <svg viewBox="0 0 20 20" width="15" height="15">
            <path
              d="M10 2.5 4 5v4.6c0 3.7 2.5 6.6 6 7.9 3.5-1.3 6-4.2 6-7.9V5l-6-2.5Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="dock-approval__title">Approve this step?</span>
      </div>
      <p className="dock-approval__label">{step.label}</p>
      {detail && <p className="dock-approval__detail">{detail}</p>}
      <div className="dock-approval__actions">
        <button
          type="button"
          className="dock-button dock-button--ghost"
          disabled={sent !== null}
          onClick={() => answer('cancel')}
        >
          {sent === 'cancel' ? 'Rejected' : 'Reject'}
        </button>
        <button
          type="button"
          className="dock-button dock-button--primary"
          disabled={sent !== null}
          onClick={() => answer('approve')}
        >
          {sent === 'approve' ? 'Approved' : 'Approve'}
        </button>
      </div>
    </section>
  )
}

function QuestionBlock(): JSX.Element | null {
  const clarification = useTorchStore((s) => s.clarificationRequest)
  const { sendClarification } = useWebSocket()
  const [sentFor, setSentFor] = useState<string | null>(null)
  if (!clarification) return null
  const sent = sentFor === clarification.taskId
  return (
    <section className="dock-question">
      <p className="dock-question__text">{clarification.question}</p>
      <div className="dock-question__options">
        {clarification.options.map((option) => (
          <button
            key={option}
            type="button"
            className="dock-button dock-button--ghost"
            disabled={sent}
            onClick={() => {
              if (sendClarification(clarification.taskId, option)) {
                setSentFor(clarification.taskId)
              }
            }}
          >
            {option}
          </button>
        ))}
      </div>
    </section>
  )
}

export function TaskPanel(): JSX.Element | null {
  const messages = useTorchStore((s) => s.messages)
  const agentStatus = useTorchStore((s) => s.agentStatus)
  const attention = useTorchStore((s) => s.attentionRequest)
  const { sendStopCommand } = useWebSocket()
  const rootRef = useRef<HTMLDivElement>(null)
  const [, setTick] = useState(0)

  const running = agentStatus !== 'idle'
  const { request, plan, closing } = findTask(messages)
  const steps = plan?.steps ?? []
  const waitingStep = steps.find((s) => s.status === 'hitl_required')
  const failed = steps.some((s) => s.status === 'failed')
  const startedAt = request?.timestamp ?? null

  const tone: Tone =
    waitingStep || attention || agentStatus === 'awaiting_input'
      ? 'waiting'
      : running
        ? 'working'
        : failed
          ? 'failed'
          : 'done'
  const statusText: Record<Tone, string> = {
    working: 'Working',
    waiting: waitingStep ? 'Needs your OK' : 'Your turn',
    done: 'Done',
    failed: 'Stopped'
  }

  // Show while there is work; linger on the result long enough to read it.
  useEffect(() => {
    if (running) {
      window.torchAPI?.showTaskPanel?.()
      return undefined
    }
    const timer = setTimeout(
      () => window.torchAPI?.hideTaskPanel?.(),
      failed ? LINGER_AFTER_FAILURE_MS : LINGER_AFTER_DONE_MS
    )
    return () => clearTimeout(timer)
  }, [running, failed])

  useEffect(() => {
    if (!running) return undefined
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [running])

  // The window takes exactly the height of the card, so the empty part of a
  // tall transparent window never sits over the user's app catching clicks.
  useLayoutEffect(() => {
    const node = rootRef.current
    if (!node) return undefined
    const report = (): void => {
      window.torchAPI?.resizeTaskPanel?.(
        Math.ceil(Math.max(node.scrollHeight, node.getBoundingClientRect().height)) + 8
      )
    }
    report()
    const observer = new ResizeObserver(report)
    observer.observe(node)
    return () => observer.disconnect()
  })

  if (!running && steps.length === 0) return null

  return (
    <div ref={rootRef} className="dock" data-tone={tone}>
      <div className="dock__glow" aria-hidden="true" />
      <header className="dock__head drag-region">
        <TorchLogo width={58} />
        <span className="dock__status">
          <span className="dock__dot" aria-hidden="true" />
          {statusText[tone]}
        </span>
        <span className="dock__elapsed">{elapsedLabel(startedAt)}</span>
        <button
          type="button"
          className="dock__icon-button no-drag"
          aria-label="Open TORCH"
          title="Open TORCH"
          onClick={() => window.torchAPI?.openMainWindow?.()}
        >
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
            <path
              d="M6 3.5H3.5v9h9V10M9 3.5h3.5V7m0-3.5L7 9"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          className="dock__icon-button no-drag"
          aria-label="Hide panel"
          title="Hide"
          onClick={() => window.torchAPI?.hideTaskPanel?.()}
        >
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
            <path
              d="m4.5 4.5 7 7m0-7-7 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>

      {request?.content && <p className="dock__request">{request.content}</p>}

      <div className="dock__body no-drag">
        {waitingStep && plan && <ApprovalBlock message={plan} step={waitingStep} />}
        <AttentionCard compact />
        <QuestionBlock />
        {steps.length > 0 && <StepList steps={steps} />}
        {!running && closing?.content && (
          <p className={'dock__result dock__result--' + tone}>{closing.content}</p>
        )}
      </div>

      {running && !waitingStep && (
        <footer className="dock__foot no-drag">
          <button type="button" className="dock__stop" onClick={() => sendStopCommand()}>
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
              <rect x="4" y="4" width="8" height="8" rx="1.5" fill="currentColor" />
            </svg>
            Stop
          </button>
        </footer>
      )}
    </div>
  )
}
