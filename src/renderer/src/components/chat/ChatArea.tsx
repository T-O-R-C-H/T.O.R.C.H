import { useEffect, useRef, useState } from 'react'
import { 
  IconFile, 
  IconMail, 
  IconList 
} from '../icons'
import { Message } from './Message';
import { useTorchStore } from '../../store/torchStore'

/* ═══════════════════════════════════════════════════════════════
   TORCH COMMAND AREA — Immersive AI Execution Interface
   Pure black #000 · centered cinematic idle state · 920px max width
   ═══════════════════════════════════════════════════════════════ */

const promptSuggestions = [
  { icon: IconFile, title: "Find a file", desc: "Just describe it — TORCH searches your computer for you" },
  { icon: IconMail, title: "Check my emails", desc: "TORCH will look at your inbox and tell you what matters" },
  { icon: IconList, title: "Summarise a document", desc: "Point TORCH at any file and get the short version" }
]

interface ChatAreaProps {
  onApprove?: (messageId: string, stepId: string) => void
  onEdit?: (messageId: string, stepId: string) => void
  onCancel?: (messageId: string, stepId: string) => void
  onSend?: (command: string) => void
}

function SuggestionCard({ s, onClick }: { s: typeof promptSuggestions[0]; onClick: () => void }): JSX.Element {
  const [hovered, setHovered] = useState(false)
  const Icon = s.icon

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        height: '64px',
        background: hovered ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.01)',
        border: `1px solid ${hovered ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)'}`,
        padding: '0 24px',
        cursor: 'pointer',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered ? '0 8px 20px -6px rgba(0, 0, 0, 0.5), 0 0 12px 1px rgba(255, 255, 255, 0.02)' : 'none',
        transition: 'all 240ms cubic-bezier(0.16, 1, 0.3, 1)',
        textAlign: 'left',
        width: '100%',
        borderRadius: '12px',
      }}
    >
      <div style={{ color: hovered ? '#ffffff' : '#888899', transition: 'color 200ms ease', flexShrink: 0 }}>
        <Icon size={20} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', overflow: 'hidden' }}>
        <div style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: '13.5px',
          fontWeight: 500,
          color: hovered ? '#ffffff' : '#e2e8f0',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          lineHeight: 1.2,
          transition: 'color 200ms ease',
        }}>
          {s.title}
        </div>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '9px',
          fontWeight: 500,
          color: hovered ? 'rgba(255, 255, 255, 0.4)' : '#64748b',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          lineHeight: 1,
        }}>
          {s.desc}
        </div>
      </div>
    </button>
  )
}

export function ChatArea({ onApprove, onEdit, onCancel, onSend }: ChatAreaProps): JSX.Element {
  const messages = useTorchStore((s) => s.messages)
  const agentStatus = useTorchStore((s) => s.agentStatus)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, agentStatus]);

  if (messages.length === 0) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        background: 'radial-gradient(circle at top, #0e0d1b 0%, #030206 60%, #000000 100%)',
        animation: 'fade-in-up 500ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        <style>{`
          @keyframes fade-in-up {
            0% { opacity: 0; transform: translateY(16px); }
            100% { opacity: 1; transform: translateY(0); }
          }
        `}</style>
        
        <h1 style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: '32px',
          fontWeight: 700,
          backgroundImage: 'linear-gradient(135deg, #ffffff 0%, #94a3b8 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '-0.04em',
          margin: '0 0 8px 0',
          lineHeight: 1.1,
        }}>
          COMMAND CENTER
        </h1>
        
        <p style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: '13px',
          fontWeight: 400,
          color: '#64748b',
          margin: '0 0 40px 0',
          letterSpacing: '-0.01em',
        }}>
          How can I help you automate your workspace today?
        </p>

        {/* Suggestion Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '16px',
          width: '100%',
          maxWidth: '760px',
        }}>
          {promptSuggestions.map((s, i) => (
            <SuggestionCard key={i} s={s} onClick={() => onSend?.(s.title)} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      style={{
        flex: 1,
        overflowY: 'auto',
        background: 'radial-gradient(circle at top, #090812 0%, #020204 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: '36px',
        paddingBottom: '140px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '920px', display: 'flex', flexDirection: 'column', gap: '32px', padding: '0 24px' }}>
        {messages.map((msg) => (
          <Message
            key={msg.id}
            message={msg}
            onApprove={(stepId) => onApprove?.(msg.id, stepId)}
            onEdit={(stepId) => onEdit?.(msg.id, stepId)}
            onCancel={(stepId) => onCancel?.(msg.id, stepId)}
          />
        ))}

        {/* System Execution Stream */}
        {(agentStatus === 'processing' || agentStatus === 'executing') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', animation: 'fade-in 200ms ease-out' }}>
            <div style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: '13px',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              padding: '10px 16px',
              alignSelf: 'flex-start',
              borderRadius: '20px',
            }}>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#fff', animation: 'bounce 1s infinite', animationDelay: '0s' }} />
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#fff', animation: 'bounce 1s infinite', animationDelay: '0.15s' }} />
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#fff', animation: 'bounce 1s infinite', animationDelay: '0.3s' }} />
              </div>
              <span style={{ fontSize: '12px', fontWeight: 500 }}>
                {agentStatus === 'processing' ? 'Thinking...' : 'Running operations...'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}