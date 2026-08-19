import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import type { Message as MessageType } from '../../store/torchStore'
import type { AgentStatus } from '../../store/torchStore'
import { useTorchStore } from '../../store/torchStore'
import { useWebSocket } from '../../hooks/useWebSocket'
import { StepList } from './StepList'
import { ApprovalCard } from '../aicss/ApprovalCard'
import { AgentActivity } from './AgentActivity'
import { TextResponse } from '../aicss/TextResponse'
import { StreamingText } from '../aicss/StreamingText'
import { LinkifiedText } from './LinkifiedText'
import { MailResults } from '../mail/MailResults'
import { AgentQuestion } from './AgentQuestion'
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
  onSend?: (command: string) => void
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
  onCancel,
  onSend
}: ConversationTurnProps): JSX.Element | null {
  const wsConnected = useTorchStore((s) => s.wsConnected)
  const { sendUndoCommand, sendStopCommand } = useWebSocket()
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
      const remaining = Math.max(0, 300000 - elapsed)
      timer = setTimeout(() => setExpired(true), remaining)
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
          onStop={sendStopCommand}
        />
      )}

      {agent && (
        <motion.div
          className="chat-turn__response"
          layout="position"
          initial={{ opacity: 0, y: 12, filter: 'blur(5px)', clipPath: 'inset(0 0 18% 0)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)', clipPath: 'inset(0 0 0% 0)' }}
          transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
        >
          {bodyText && isErrorReply && (
            <div className="chat-error-card">
              <span className="chat-error-card__title">Could not finish</span>
              <p className="chat-error-card__body">{toPlainLanguage(bodyText)}</p>
            </div>
          )}

          {bodyText && !isErrorReply && agent.needsAnswer && (
            <AgentQuestion question={bodyText} onSubmit={(answer) => onSend?.(answer)} />
          )}

          {bodyText && !isErrorReply && !agent.needsAnswer && (
            <motion.div
              className="chat-turn__body chat-turn__body--revealed"
              layout="position"
              transition={{ layout: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } }}
            >
              {agent.isStreaming || agent.isNew ? (
                <StreamingText text={bodyText} />
              ) : (
                <TextResponse>
                  <LinkifiedText text={bodyText} />
                </TextResponse>
              )}
            </motion.div>
          )}

          {agent.emails && agent.emails.length > 0 && <MailResults emails={agent.emails} />}

          {agent.steps && agent.steps.length > 0 && (
            <StepList steps={agent.steps} command={user?.content} />
          )}

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
        </motion.div>
      )}
    </article>
  )
}
