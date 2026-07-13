import { useState, useEffect } from 'react'
import type { Message as MessageType } from '../../store/torchStore'
import type { AgentStatus } from '../../store/torchStore'
import { useTorchStore } from '../../store/torchStore'
import { useWebSocket } from '../../hooks/useWebSocket'
import { StepList } from './StepList'
import { ApprovalCard } from './ApprovalCard'
import { AgentActivity } from './AgentActivity'
import {
  formatAgentContent,
  formatUserContent,
  isLikelyErrorMessage,
  toPlainLanguage
} from '../../utils/plainLanguage'

interface ConversationTurnProps {
  user?: MessageType
  agent?: MessageType
  showActivity?: boolean
  activityStatus?: AgentStatus
  activityStartedAt?: number
  onActivityTimeout?: () => void
  onApprove?: (stepId: string) => void
  onEdit?: (stepId: string) => void
  onCancel?: (stepId: string) => void
}

export function ConversationTurn({
  user,
  agent,
  showActivity,
  activityStatus = 'processing',
  activityStartedAt,
  onActivityTimeout,
  onApprove,
  onEdit,
  onCancel
}: ConversationTurnProps): JSX.Element | null {
  const wsConnected = useTorchStore((s) => s.wsConnected)
  const { sendUndoCommand } = useWebSocket()
  const [expired, setExpired] = useState(false)

  const hitlStep = agent?.steps?.find((s) => s.status === 'hitl_required')

  const hitlWarning = hitlStep?.error?.includes('not configured')
    ? 'This service is not set up yet. Check Settings before approving.'
    : hitlStep?.tool === 'send_email' && !wsConnected
      ? 'Email is not connected in Settings yet.'
      : undefined

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    if (agent?.reversible && agent.undoState === 'available') {
      const elapsed = Date.now() - agent.timestamp
      const remaining = 300000 - elapsed
      if (remaining <= 0) setExpired(true)
      else timer = setTimeout(() => setExpired(true), remaining)
    }
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [agent?.reversible, agent?.undoState, agent?.timestamp])

  if (!user && !agent) return null

  const bodyText = agent?.content ? formatAgentContent(agent.content) : ''
  const isErrorReply = Boolean(bodyText && isLikelyErrorMessage(bodyText))
  const waitingForFirstToken = Boolean(agent?.isStreaming && !bodyText)
  const showStatusLine = Boolean(showActivity && (!agent || waitingForFirstToken))
  const hasFailedSteps = Boolean(agent?.steps?.some((s) => s.status === 'failed'))

  return (
    <article className="chat-turn fade-in">
      {user && (
        <div className="chat-turn__query">
          <div className="chat-turn__query-scroll">{formatUserContent(user.content)}</div>
        </div>
      )}

      {showStatusLine && (
        <AgentActivity
          status={activityStatus}
          startedAt={activityStartedAt}
          onTimeout={onActivityTimeout}
        />
      )}

      {agent && (
        <div className="chat-turn__response">
          {bodyText && isErrorReply && (
            <div className="chat-error-card">
              <span className="chat-error-card__title">Could not finish</span>
              <p className="chat-error-card__body">{toPlainLanguage(bodyText)}</p>
            </div>
          )}

          {bodyText && !isErrorReply && (
            <div
              className={`chat-turn__body ${agent.isStreaming ? 'chat-turn__body--streaming' : ''}`}
            >
              {bodyText}
              {agent.isStreaming && <span className="chat-turn__cursor" aria-hidden="true" />}
            </div>
          )}

          {agent.steps && agent.steps.length > 0 && <StepList steps={agent.steps} />}

          {hitlStep && agent && (
            <ApprovalCard
              summary={hitlStep.label}
              warning={hitlWarning}
              onApprove={() => onApprove?.(hitlStep.id)}
              onEdit={() => onEdit?.(hitlStep.id)}
              onCancel={() => onCancel?.(hitlStep.id)}
            />
          )}

          {agent.reversible && (
            <div className="chat-undo">
              {agent.undoState === 'undone' ? (
                <span className="chat-undo__success">{agent.undoResult || 'Actions undone.'}</span>
              ) : expired ? (
                <span className="chat-undo__muted">This can no longer be undone</span>
              ) : (
                <>
                  <span className="chat-undo__muted">Need to reverse this?</span>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => sendUndoCommand(agent.id)}
                  >
                    Undo last action
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  )
}
