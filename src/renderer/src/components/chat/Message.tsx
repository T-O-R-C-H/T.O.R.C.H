import { Flame, User } from 'lucide-react'
import { StepList } from './StepList'
import { ApprovalCard } from './ApprovalCard'
import type { Message as MessageType } from '../../store/torchStore'

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
        <div className={`w-7 h-7 flex items-center justify-center flex-shrink-0 border border-[#1c1c1c] ${
          isUser ? 'bg-[#0d0d0d]' : 'bg-[#060606]'
        }`}>
          {isUser ? (
            <User size={12} className="text-[#666]" />
          ) : (
            <Flame size={12} className="text-white" />
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
            ? 'bg-[#1c1c1c] px-4 py-2.5'
            : isSystem
            ? 'text-center'
            : 'border border-[#1c1c1c] px-4 py-2.5'
        }`}>
          <p className={`text-[12px] leading-relaxed ${
            isUser ? 'text-white' : isSystem ? 'text-[#444] mono-xs' : 'text-[#ccc]'
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
