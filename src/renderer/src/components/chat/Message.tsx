import { StepList } from './StepList'
import { ApprovalCard } from './ApprovalCard'
import type { Message as MessageType } from '../../store/torchStore'
import { useTorchStore } from '../../store/torchStore'

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

  const hitlStep = message.steps?.find((s) => s.status === 'hitl_required')

  const hitlWarning = hitlStep?.error?.includes('not configured')
    ? 'Service not configured — check Settings before approving'
    : hitlStep?.tool === 'send_email' && !wsConnected
    ? 'Gmail credentials not configured in Settings'
    : undefined

  if (isSystem) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0', animation: 'fade-in 200ms ease' }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: '#333' }}>
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
          background: '#0f0f0f',
          border: '1px solid #1a1a1a',
          padding: '12px 16px',
          maxWidth: '70%',
          fontFamily: "'Inter', sans-serif",
          fontSize: '13px',
          color: '#ffffff',
          lineHeight: '1.5',
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
        background: 'transparent',
        padding: '4px 0',
        width: '100%',
      }}>
        {/* Content text (optional for TORCH, mostly it's just steps) */}
        {message.content && (
          <p style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '13px',
            color: '#d0d0d0',
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
              summary={`${hitlStep.tool}: ${hitlStep.label}`}
              warning={hitlWarning}
              onApprove={() => onApprove?.(hitlStep.id)}
              onEdit={() => onEdit?.(hitlStep.id)}
              onCancel={() => onCancel?.(hitlStep.id)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
