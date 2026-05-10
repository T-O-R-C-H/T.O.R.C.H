import { useEffect, useRef } from 'react'
import { IconFile, IconMail, IconGlobe, IconSend } from '../icons'
import { Message } from './Message'
import { useTorchStore } from '../../store/torchStore'

const promptSuggestions = [
  { icon: IconFile, label: 'Find and summarize my latest report' },
  { icon: IconMail, label: 'Draft a reply to my last email' },
  { icon: IconGlobe, label: 'Search the web for latest AI news' },
  { icon: IconSend, label: 'Post an update to social media' }
]

interface ChatAreaProps {
  onApprove?: (messageId: string, stepId: string) => void
  onEdit?: (messageId: string, stepId: string) => void
  onCancel?: (messageId: string, stepId: string) => void
}

export function ChatArea({ onApprove, onEdit, onCancel }: ChatAreaProps): JSX.Element {
  const messages = useTorchStore((s) => s.messages)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        {/* TORCH Logo (spec: 32x32 viewBox) */}
        <div className="mb-6 opacity-20">
          <svg width="48" height="48" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="12" y="19" width="8" height="11" rx="0" fill="#ffffff" />
            <line x1="12" y1="22" x2="20" y2="22" stroke="#000" strokeWidth="0.8" />
            <line x1="12" y1="25" x2="20" y2="25" stroke="#000" strokeWidth="0.8" />
            <ellipse cx="16" cy="12" rx="4.5" ry="7" fill="#ffffff" className="torch-flame" />
            <ellipse cx="16" cy="11" rx="3" ry="5" fill="#000000" />
            <ellipse cx="16" cy="10" rx="1.5" ry="3" fill="#ffffff" />
            <path d="M16 4 L14.5 8 L16 7 L17.5 8 Z" fill="#ffffff" />
          </svg>
        </div>

        <h2 className="text-[16px] font-semibold tracking-[-0.5px] mb-2">What can I help you with?</h2>
        <p className="text-[11px] text-[#444] mb-8">
          Type a command, use voice, or say "Hey TORCH" anytime
        </p>

        {/* Suggestion cards */}
        <div className="grid grid-cols-2 gap-2 w-full max-w-[500px]">
          {promptSuggestions.map((s, i) => {
            const Icon = s.icon
            return (
              <button
                key={i}
                className="flex items-center gap-3 px-4 py-3 border border-[#1c1c1c] bg-[#060606] hover:border-[#2a2a2a] transition-colors duration-120 text-left group"
              >
                <span className="text-[#333] group-hover:text-[#666] transition-colors"><Icon size={14} /></span>
                <span className="text-[11px] text-[#666] group-hover:text-[#aaa] transition-colors">
                  {s.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
      {messages.map((msg) => (
        <Message
          key={msg.id}
          message={msg}
          onApprove={(stepId) => onApprove?.(msg.id, stepId)}
          onEdit={(stepId) => onEdit?.(msg.id, stepId)}
          onCancel={(stepId) => onCancel?.(msg.id, stepId)}
        />
      ))}
    </div>
  )
}
