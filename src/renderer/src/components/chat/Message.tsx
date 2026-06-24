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
    let timer: any;
    if (message.reversible && message.undoState === 'available') {
      const elapsed = Date.now() - message.timestamp
      const remaining = 300000 - elapsed // 5 minutes
      if (remaining <= 0) {
        setExpired(true)
      } else {
        timer = setTimeout(() => {
          setExpired(true)
        }, remaining)
      }
    }
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [message.reversible, message.undoState, message.timestamp])

  if (isSystem) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0', animation: 'fade-in 200ms ease' }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#475569' }}>
          {message.content}
        </span>
      </div>
    )
  }

  if (isUser) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        width: '100%',
        animation: 'fade-in 200ms ease',
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '12px 18px',
          maxWidth: '75%',
          borderRadius: '16px 16px 0px 16px',
          fontFamily: "'Inter', sans-serif",
          fontSize: '13.5px',
          color: '#f8fafc',
          lineHeight: '1.5',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
        }}>
          {message.content}
        </div>
      </div>
    )
  }

  // TORCH Message
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      width: '100%',
      animation: 'fade-in 200ms ease',
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        padding: '16px 20px',
        width: '100%',
        maxWidth: '85%',
        borderRadius: '16px 16px 16px 0px',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(8px)',
      }}>
        {/* Assistant Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 0 8px rgba(139, 92, 246, 0.3)'
          }}>
            <IconSparkles size={13} />
          </div>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12.5px', fontWeight: 600, color: '#f8fafc', letterSpacing: '-0.01em' }}>
            TORCH
          </span>
        </div>

        {/* Content text */}
        {message.content && (
          <p style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '13.5px',
            color: '#f1f5f9',
            lineHeight: '1.6',
            marginBottom: '6px'
          }}>
            {message.content}
          </p>
        )}

        {/* Steps */}
        {message.steps && message.steps.length > 0 && (
          <StepList steps={message.steps} />
        )}

        {/* HITL Approval */}
        {hitlStep && (
          <div style={{ marginTop: '12px' }}>
            <ApprovalCard
              summary={hitlStep.label}
              warning={hitlWarning}
              onApprove={() => onApprove?.(hitlStep.id)}
              onEdit={() => onEdit?.(hitlStep.id)}
              onCancel={() => onCancel?.(hitlStep.id)}
            />
          </div>
        )}

        {/* Undo Action (ADD-4) */}
        {message.reversible && (
          <div style={{
            marginTop: '14px',
            paddingTop: '12px',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            {message.undoState === 'undone' ? (
              <span style={{ fontSize: '11px', color: '#22c55e', fontFamily: "'Inter', sans-serif" }}>
                {message.undoResult || 'Actions undone.'}
              </span>
            ) : expired ? (
              <span style={{ fontSize: '11px', color: '#475569', fontFamily: "'Inter', sans-serif" }}>
                This can no longer be undone
              </span>
            ) : (
              <>
                <span style={{ fontSize: '11px', color: '#64748b', fontFamily: "'Inter', sans-serif" }}>
                  Need to reverse this?
                </span>
                <button
                  onClick={() => sendUndoCommand(message.id)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    color: '#ffffff',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    padding: '4px 12px',
                    fontSize: '11px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    borderRadius: '6px',
                    fontFamily: "'Inter', sans-serif",
                    transition: 'all 150ms ease',
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLElement
                    el.style.background = 'rgba(255, 255, 255, 0.08)'
                    el.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLElement
                    el.style.background = 'rgba(255, 255, 255, 0.04)'
                    el.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                  }}
                >
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
