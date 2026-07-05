import { useState, useEffect } from 'react'
import { StepList } from './StepList'
import { ApprovalCard } from './ApprovalCard'
import type { Message as MessageType } from '../../store/torchStore'
import { useTorchStore } from '../../store/torchStore'
import { IconSparkles } from '../icons'
import { useWebSocket } from '../../hooks/useWebSocket'

interface MessageProps {
  message: MessageType
  onApprove?: (stepId: string) => void
  onEdit?: (stepId: string) => void
  onCancel?: (stepId: string) => void
}

export function Message({ message, onApprove, onEdit, onCancel }: MessageProps): JSX.Element {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const wsConnected = useTorchStore((s) => s.wsConnected)
  const { sendUndoCommand } = useWebSocket()
  const [expired, setExpired] = useState(false)

  const hitlStep = message.steps?.find((s) => s.status === 'hitl_required')

  const hitlWarning = hitlStep?.error?.includes('not configured')
    ? 'Service not configured — check Settings before approving'
    : hitlStep?.tool === 'send_email' && !wsConnected
    ? 'Credentials not configured in Settings'
    : undefined

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    if (message.reversible && message.undoState === 'available') {
      const elapsed = Date.now() - message.timestamp
      const remaining = 300000 - elapsed
      if (remaining <= 0) {
        setExpired(true)
      } else {
        timer = setTimeout(() => setExpired(true), remaining)
      }
    }
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [message.reversible, message.undoState, message.timestamp])

  if (isSystem) {
    return (
      <div className="chat-system fade-in">{message.content}</div>
    )
  }

  if (isUser) {
    return (
      <div className="chat-user-wrap fade-in">
        <div className="chat-user-bubble">{message.content}</div>
      </div>
    )
  }

  return (
    <div className="chat-agent-wrap fade-in">
      <div className="chat-agent-card">
        <div className="chat-agent-header">
          <div className="chat-agent-avatar">
            <IconSparkles size={12} />
          </div>
          <span className="chat-agent-name">TORCH</span>
        </div>

        {message.content && (
          <p className="chat-agent-body">{message.content}</p>
        )}

        {message.steps && message.steps.length > 0 && (
          <StepList steps={message.steps} />
        )}

        {hitlStep && (
          <ApprovalCard
            summary={hitlStep.label}
            warning={hitlWarning}
            onApprove={() => onApprove?.(hitlStep.id)}
            onEdit={() => onEdit?.(hitlStep.id)}
            onCancel={() => onCancel?.(hitlStep.id)}
          />
        )}

        {message.reversible && (
          <div className="chat-undo">
            {message.undoState === 'undone' ? (
              <span className="chat-undo__success">{message.undoResult || 'Actions undone.'}</span>
            ) : expired ? (
              <span className="chat-undo__muted">This can no longer be undone</span>
            ) : (
              <>
                <span className="chat-undo__muted">Need to reverse this?</span>
                <button type="button" className="btn-secondary" onClick={() => sendUndoCommand(message.id)}>
                  Undo last action
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
