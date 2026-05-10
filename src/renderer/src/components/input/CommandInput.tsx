import { useState, useRef, type KeyboardEvent } from 'react'
import { ModeTabs } from './ModeTabs'
import { WaveStrip } from './WaveStrip'
import { useTorchStore } from '../../store/torchStore'

/* ─── INLINE SVG ICONS ─── */
function IconArrowUp(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  )
}

function IconMic(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

interface CommandInputProps {
  onSend: (command: string) => void
}

export function CommandInput({ onSend }: CommandInputProps): JSX.Element {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const inputMode = useTorchStore((s) => s.inputMode)
  const agentStatus = useTorchStore((s) => s.agentStatus)

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

  return (
    <div className="border-t border-[#1c1c1c] bg-[#000] flex-shrink-0">
      {/* Voice wave strip */}
      {inputMode === 'voice' && (
        <div className="flex flex-col items-center py-4 border-b border-[#1c1c1c]">
          <WaveStrip />
          <span className="mono-xs text-[#444] mt-2">listening — speak your command</span>
        </div>
      )}

      {/* Input area */}
      <div className="px-5 py-[11px]">
        {/* Mode tabs */}
        <div className="flex items-center justify-between mb-3">
          <ModeTabs />
          {isProcessing && (
            <span className="mono-xs text-[#333]">processing...</span>
          )}
        </div>

        {/* Input row */}
        {inputMode === 'type' && (
          <div className="flex items-center border border-[#1c1c1c]">
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask TORCH to do anything — find files, send emails, browse the web..."
              className="flex-1 bg-[#000] text-[12px] text-[#aaa] border-0 px-4 py-2.5 placeholder:text-[#2a2a2a] focus:border-0"
              disabled={isProcessing}
            />
            <button
              onClick={() => useTorchStore.getState().setInputMode('voice')}
              className="w-10 h-10 flex items-center justify-center text-[#444] hover:text-white border-l border-[#1c1c1c] transition-colors duration-120"
            >
              <IconMic />
            </button>
            <button
              onClick={handleSend}
              disabled={!text.trim() || isProcessing}
              className="w-10 h-10 flex items-center justify-center bg-white text-black border-l border-[#1c1c1c] hover:opacity-90 transition-opacity duration-120 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <IconArrowUp />
            </button>
          </div>
        )}

        {inputMode === 'voice' && (
          <div className="flex items-center justify-center gap-3">
            <button className="p-3 bg-white text-black border border-white">
              <IconMic />
            </button>
            <span className="mono-xs text-[#444]">Tap to stop</span>
          </div>
        )}

        {inputMode === 'heytorch' && (
          <div className="flex flex-col items-center gap-2 py-2">
            <span className="mono-xs text-[#444]">
              say "hey torch" to activate — listening in background
            </span>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-white animate-pulse" />
              <span className="mono-xs text-[#333]">wake word detection active</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
