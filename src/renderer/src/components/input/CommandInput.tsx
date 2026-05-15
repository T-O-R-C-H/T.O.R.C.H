import { useState, useRef, type KeyboardEvent } from 'react'
import { useTorchStore } from '../../store/torchStore'
import { useWebSocket } from '../../hooks/useWebSocket'

/* ─── ICONS ─── */
function IconArrowUp(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  )
}

function IconMic(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

function TorchSymbol(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
      <rect x="12" y="19" width="8" height="11" rx="0" fill="#ffffff" />
      <ellipse cx="16" cy="12" rx="4.5" ry="7" fill="#ffffff" />
      <ellipse cx="16" cy="11" rx="3" ry="5" fill="#000000" />
      <ellipse cx="16" cy="10" rx="1.5" ry="3" fill="#ffffff" />
      <path d="M16 4 L14.5 8 L16 7 L17.5 8 Z" fill="#ffffff" />
    </svg>
  )
}

interface CommandInputProps {
  onSend: (command: string) => void
}

export function CommandInput({ onSend }: CommandInputProps): JSX.Element {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const inputMode = useTorchStore((s) => s.inputMode)
  const agentStatus = useTorchStore((s) => s.agentStatus)
  const wsConnected = useTorchStore((s) => s.wsConnected)

  const handleSend = (): void => {
    const trimmed = text.trim()
    if (!trimmed) return
    onSend(trimmed)
    setText('')
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const isProcessing = agentStatus === 'processing' || agentStatus === 'executing'

  // Adjust textarea height automatically
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setText(e.target.value)
    e.target.style.height = '58px'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`
  }

  return (
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: '14px 28px',
      background: 'linear-gradient(to bottom, transparent, #000000 15%)',
      zIndex: 10,
    }}>
      <div style={{
        margin: '0 auto',
        maxWidth: '980px',
        background: '#050505',
        border: '1px solid #1a1a1a',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '60px',
      }}>
        {/* TOP ROW: Mode Tabs & Status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px 0 12px',
        }}>
          {/* Mode Tabs */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {['type', 'voice', 'heytorch'].map((mode) => (
              <button
                key={mode}
                onClick={() => useTorchStore.getState().setInputMode(mode as any)}
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '9px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  color: inputMode === mode ? '#ffffff' : '#4a4a4a',
                  background: 'transparent',
                  border: 'none',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  transition: 'color 160ms ease',
                }}
              >
                {mode === 'heytorch' ? 'HEY TORCH' : mode}
              </button>
            ))}
          </div>

          {/* Right Status */}
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '9px',
            fontWeight: 500,
            textTransform: 'uppercase',
            color: '#4a4a4a',
            paddingRight: '4px',
          }}>
            {wsConnected ? 'CONNECTED TO GEMINI' : 'LOCAL MODEL ACTIVE'}
          </div>
        </div>

        {/* MAIN INPUT AREA */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          padding: '6px 12px 10px 16px',
          gap: '12px',
        }}>
          {/* Textarea */}
          <textarea
            ref={inputRef}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Tell TORCH what to do..."
            disabled={isProcessing || inputMode !== 'type'}
            style={{
              flex: 1,
              minHeight: '46px',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#ffffff',
              fontFamily: "'Inter', sans-serif",
              fontSize: '13px',
              resize: 'none',
              paddingTop: '6px',
              lineHeight: '1.5',
            }}
          />

          {/* Right Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '2px' }}>
            <button
              onClick={() => useTorchStore.getState().setInputMode(inputMode === 'voice' ? 'type' : 'voice')}
              style={{
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: inputMode === 'voice' ? '#ffffff' : 'transparent',
                color: inputMode === 'voice' ? '#000000' : '#666',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 160ms ease',
              }}
            >
              <IconMic />
            </button>
            
            <button
              onClick={handleSend}
              disabled={!text.trim() || isProcessing || inputMode !== 'type'}
              style={{
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: (!text.trim() || isProcessing) ? '#222' : '#ffffff',
                color: (!text.trim() || isProcessing) ? '#555' : '#000000',
                border: 'none',
                cursor: (!text.trim() || isProcessing) ? 'not-allowed' : 'pointer',
                transition: 'all 160ms ease',
              }}
              onMouseEnter={(e) => {
                if (!text.trim() || isProcessing) return
                const el = e.currentTarget as HTMLElement
                el.style.background = '#e0e0e0'
              }}
              onMouseLeave={(e) => {
                if (!text.trim() || isProcessing) return
                const el = e.currentTarget as HTMLElement
                el.style.background = '#ffffff'
              }}
            >
              <IconArrowUp />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
