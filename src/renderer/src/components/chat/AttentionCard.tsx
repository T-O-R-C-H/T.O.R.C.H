import { useState } from 'react'
import { useTorchStore } from '../../store/torchStore'
import { useWebSocket } from '../../hooks/useWebSocket'

/**
 * "Your turn": TORCH has stopped at a step that only the user may do - a
 * payment, a password, a CAPTCHA, picking one of their own files.
 *
 * TORCH also watches the screen and carries on by itself when it changes,
 * but a person should never have to guess whether it noticed. Continue says
 * so directly; Stop ends the task.
 *
 * Shown in the chat and in the bottom-right panel, from the same state, so
 * the two never disagree.
 */
export function AttentionCard({ compact = false }: { compact?: boolean }): JSX.Element | null {
  const request = useTorchStore((s) => s.attentionRequest)
  const { sendHandoffContinue, sendStopCommand } = useWebSocket()
  const [sentFor, setSentFor] = useState<string | null>(null)

  if (!request) return null
  const sent = sentFor === `${request.taskId}:${request.message}`

  return (
    <section
      className={'attention-card' + (compact ? ' attention-card--compact' : '')}
      role="alert"
      aria-live="assertive"
    >
      <div className="attention-card__head">
        <span className="attention-card__badge" aria-hidden="true">
          <svg viewBox="0 0 20 20" width="16" height="16">
            <path
              d="M7 9.5V4.8a1.3 1.3 0 0 1 2.6 0V9m0-.6V3.6a1.3 1.3 0 0 1 2.6 0V9m0-4.1a1.3 1.3 0 0 1 2.6 0v5.6c0 3.5-2.3 6-5.4 6-2.2 0-3.6-1-4.8-3l-1.6-2.8a1.3 1.3 0 0 1 2.2-1.3L7 11"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="attention-card__title">Your turn</span>
        <span className="attention-card__pulse" aria-hidden="true" />
      </div>
      <p key={request.message} className="attention-card__message">
        {request.message}
      </p>
      <p className="attention-card__hint">
        {sent
          ? 'Checking the screen…'
          : "Press Continue when you're done. I'll also notice by myself."}
      </p>
      <div className="attention-card__actions">
        <button type="button" className="attention-card__stop" onClick={() => sendStopCommand()}>
          Stop task
        </button>
        <button
          type="button"
          className="attention-card__continue"
          disabled={sent}
          onClick={() => {
            if (sendHandoffContinue(request.taskId)) {
              setSentFor(`${request.taskId}:${request.message}`)
            }
          }}
        >
          {sent ? 'Continuing…' : 'Done, continue'}
          {!sent && (
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path
                d="M3.5 8h9m-3.5-3.5L12.5 8 9 11.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      </div>
    </section>
  )
}
