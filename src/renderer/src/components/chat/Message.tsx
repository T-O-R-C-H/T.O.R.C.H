import { IconFlame, IconUser } from '../icons'
import { StepList } from './StepList'
import { ApprovalCard } from './ApprovalCard'
import type { Message as MessageType } from '../../store/torchStore'

/* ─── TORCH MINI LOGO (for avatar) ─── */
function TorchMini(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 32 32" fill="none">
      <rect x="12" y="19" width="8" height="11" rx="0" fill="#000" />
      <ellipse cx="16" cy="12" rx="4.5" ry="7" fill="#000" />
      <ellipse cx="16" cy="11" rx="3" ry="5" fill="#fff" />
      <ellipse cx="16" cy="10" rx="1.5" ry="3" fill="#000" />
    </svg>
  )
}

interface MessageProps {
  message: MessageType
  onApprove?: (stepId: string) => void
  onEdit?: (stepId: string) => void
  onCancel?: (stepId: string) => void
}

export function Message({ message, onApprove, onEdit, onCancel }: MessageProps): JSX.Element {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  const hitlStep = message.steps?.find((s) => s.status === 'hitl_required')

  return (
    <div className={`message-enter flex gap-3 ${isUser ? 'flex-row-reverse' : ''} ${isSystem ? 'justify-center' : ''}`}>
      {/* Avatar */}
      {!isSystem && (
        <div className={`w-6 h-6 flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-[#000] border border-[#1c1c1c]' : 'bg-white'
        }`}>
          {isUser ? (
            <span className="text-[#666]"><IconUser size={10} /></span>
          ) : (
            <TorchMini />
          )}
        </div>
      )}

      {/* Content */}
      <div className={`flex-1 max-w-[80%] ${isUser ? 'text-right' : ''}`}>
        {/* Role label */}
        <div className={`mono-xs mb-1 ${isUser ? 'text-[#444]' : 'text-[#333]'}`}>
          {isUser ? 'you' : isSystem ? '' : 'torch'}
        </div>

        {/* Message body */}
        <div className={`inline-block text-left ${
          isUser
            ? 'bg-white px-4 py-2.5'
            : isSystem
            ? 'text-center'
            : 'bg-[#0d0d0d] border border-[#1c1c1c] px-4 py-2.5'
        }`} style={{
          borderRadius: isUser ? '6px 0 6px 6px' : isSystem ? '0' : '0 6px 6px 6px'
        }}>
          <p className={`text-[12px] leading-relaxed ${
            isUser ? 'text-black' : isSystem ? 'text-[#444] mono-xs' : 'text-[#aaa]'
          } ${message.isTyping ? 'typewriter-cursor' : ''}`}>
            {message.content}
          </p>

          {/* Steps */}
          {message.steps && message.steps.length > 0 && (
            <StepList steps={message.steps} />
          )}

          {/* HITL Approval */}
          {hitlStep && (
            <ApprovalCard
              summary={`${hitlStep.tool}: ${hitlStep.label}`}
              onApprove={() => onApprove?.(hitlStep.id)}
              onEdit={() => onEdit?.(hitlStep.id)}
              onCancel={() => onCancel?.(hitlStep.id)}
            />
          )}
        </div>

        {/* Timestamp */}
        <div className={`mono-xs text-[#2a2a2a] mt-1 ${isUser ? 'text-right' : ''}`}>
          {new Date(message.timestamp).toLocaleTimeString('en-US', { hour12: false })}
        </div>
      </div>
    </div>
  )
}
