import { useEffect, useRef } from 'react'
import { Flame, Sparkles, Send, FileText, Mail, Globe } from 'lucide-react'
import { Message } from './Message'
import { useTorchStore } from '../../store/torchStore'

const promptSuggestions = [
  { icon: FileText, label: 'Find and summarize my latest report' },
  { icon: Mail, label: 'Draft a reply to my last email' },
  { icon: Globe, label: 'Search the web for latest AI news' },
  { icon: Send, label: 'Post an update to social media' }
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
        {/* TORCH Logo */}
        <div className="mb-6 opacity-20">
          <svg width="48" height="64" viewBox="0 0 28 38" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="10" y="20" width="8" height="16" fill="#ffffff" opacity="0.9" />
            <rect x="11" y="21" width="6" height="14" fill="#1c1c1c" />
            <rect x="12" y="22" width="4" height="12" fill="#2a2a2a" />
            <ellipse cx="14" cy="12" rx="10" ry="13" fill="#ffffff" className="torch-flame" opacity="0.95" />
            <ellipse cx="14" cy="13" rx="6" ry="9" fill="#000000" />
            <ellipse cx="14" cy="14" rx="3" ry="5" fill="#ffffff" opacity="0.95" />
          </svg>
        </div>

        <h2 className="text-[16px] font-semibold tracking-[-0.5px] mb-2">What can I help you with?</h2>
        <p className="text-[11px] text-[#444] mb-8">
          Type a command, use voice, or say "Hey TORCH" anytime
        </p>

        {/* Suggestion cards */}
        <div className="grid grid-cols-2 gap-2 w-full max-w-[500px]">
          {promptSuggestions.map((s, i) => (
            <button
              key={i}
              className="flex items-center gap-3 px-4 py-3 border border-[#1c1c1c] bg-[#060606] hover:border-[#2a2a2a] transition-colors duration-120 text-left group"
            >
              <s.icon size={14} className="text-[#333] group-hover:text-[#666] transition-colors" />
              <span className="text-[11px] text-[#666] group-hover:text-[#aaa] transition-colors">
                {s.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
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
