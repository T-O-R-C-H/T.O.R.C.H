import { useEffect, useRef, useState } from 'react'
import { 
  RiFileTextLine, 
  RiMailLine, 
  RiGlobalLine, 
  RiBrowserLine, 
  RiFolderLine, 
  RiListCheck 
} from 'react-icons/ri'
import { Message } from './Message'
import { useTorchStore } from '../../store/torchStore'
import { TorchLogo } from '../ui/TorchLogo'

/* ═══════════════════════════════════════════════════════════════
   TORCH COMMAND AREA — Immersive AI Execution Interface
   Pure black #000 · centered cinematic idle state · 920px max width
   ═══════════════════════════════════════════════════════════════ */

const promptSuggestions = [
  { icon: RiFileTextLine, title: "Find and summarize my latest report", desc: "FILESYSTEM • SUMMARIZATION" },
  { icon: RiMailLine, title: "Draft a reply to my last email", desc: "GMAIL • GENERATION" },
  { icon: RiGlobalLine, title: "Search web for latest AI news", desc: "BROWSER • RESEARCH" },
  { icon: RiBrowserLine, title: "Open browser and research competitors", desc: "AUTOMATION • ANALYSIS" },
  { icon: RiFolderLine, title: "Analyse today's downloads folder", desc: "FILESYSTEM • CLEANUP" },
  { icon: RiListCheck, title: "Prepare client delivery workflow", desc: "PLANNING • TASKS" }
]

interface ChatAreaProps {
  onApprove?: (messageId: string, stepId: string) => void
  onEdit?: (messageId: string, stepId: string) => void
  onCancel?: (messageId: string, stepId: string) => void
  onSend?: (command: string) => void
}

/* ─── 84px Animated Logo ─── */
function HeroOrb(): JSX.Element {
  return (
    <div style={{
      marginBottom: '32px',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      animation: 'hero-logo-breathe 4s ease-in-out infinite',
    }}>
      <style>{`
        @keyframes hero-logo-breathe {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.02); opacity: 1; }
        }
      `}</style>
      <TorchLogo size={84} />
    </div>
  )
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
        height: '56px',
        background: hovered ? '#080808' : '#050505',
        border: `1px solid ${hovered ? '#242424' : '#141414'}`,
        padding: '0 20px',
        cursor: 'pointer',
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
        transition: 'all 160ms ease',
        textAlign: 'left',
        width: '100%',
      }}
    >
      <div style={{ color: hovered ? '#fff' : '#666', transition: 'color 160ms ease', flexShrink: 0 }}>
        <Icon size={18} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
        <div style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: '13px',
          fontWeight: 500,
          color: '#ffffff',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          lineHeight: 1,
        }}>
          {s.title}
        </div>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '9px',
          fontWeight: 500,
          color: '#5a5a5a',
          letterSpacing: '0.06em',
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
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, agentStatus])

  if (messages.length === 0) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        backgroundColor: '#000',
        animation: 'fade-in-up 400ms ease-out',
      }}>
        <style>{`
          @keyframes fade-in-up {
            0% { opacity: 0; transform: translateY(10px); }
            100% { opacity: 1; transform: translateY(0); }
          }
        `}</style>
        <HeroOrb />
        
        <h1 style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: '28px',
          fontWeight: 600,
          color: '#ffffff',
          letterSpacing: '-0.04em',
          margin: '0 0 12px 0',
          lineHeight: 1,
        }}>
          COMMAND CENTER
        </h1>
        
        <p style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '11px',
          fontWeight: 500,
          color: '#5a5a5a',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          margin: '0 0 48px 0',
        }}>
          Autonomous AI system ready for execution.
        </p>

        {/* Suggestion Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px',
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
        backgroundColor: '#000',
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fade-in 200ms ease-out' }}>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '12px',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <span style={{ color: '#fff' }}>[•••]</span>
              <span style={{ color: '#fff' }}>
                {agentStatus === 'processing' ? 'planning execution path' : 'executing task sequence'}
              </span>
              <div style={{
                width: '6px',
                height: '6px',
                background: '#fff',
                animation: 'pulse-dot 1s infinite'
              }} />
            </div>
            {/* Terminal Feed Stub for loading state */}
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              lineHeight: 1.8,
              color: '#4f4f4f',
              paddingLeft: '32px'
            }}>
              [{new Date().toLocaleTimeString('en-US', { hour12: false })}] System sequence engaged...
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
