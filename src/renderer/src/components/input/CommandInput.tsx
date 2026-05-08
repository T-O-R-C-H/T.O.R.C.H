import { useState, useRef, type KeyboardEvent } from 'react'
import { ArrowUp, Mic } from 'lucide-react'
import { ModeTabs } from './ModeTabs'
import { WaveStrip } from './WaveStrip'
import { useTorchStore } from '../../store/torchStore'

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
      <div className="px-4 py-3">
        {/* Mode tabs */}
        <div className="flex items-center justify-between mb-3">
          <ModeTabs />
          {isProcessing && (
            <span className="mono-xs text-[#333]">processing...</span>
          )}
        </div>

        {/* Input row */}
        {inputMode === 'type' && (
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask TORCH to do anything — find files, send emails, browse the web..."
                className="w-full bg-transparent text-[12px] text-white border border-[#1c1c1c] px-4 py-2.5 pr-10 focus:border-[#2a2a2a] placeholder:text-[#2a2a2a]"
                disabled={isProcessing}
              />
            </div>
            <button
              onClick={() => useTorchStore.getState().setInputMode('voice')}
              className="p-2.5 border border-[#1c1c1c] text-[#444] hover:text-white hover:border-[#2a2a2a] transition-colors duration-120"
            >
              <Mic size={14} />
            </button>
            <button
              onClick={handleSend}
              disabled={!text.trim() || isProcessing}
              className="p-2.5 bg-white text-black border border-white hover:opacity-90 transition-opacity duration-120 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowUp size={14} />
            </button>
          </div>
        )}

        {inputMode === 'voice' && (
          <div className="flex items-center justify-center gap-3">
            <button
              className="p-3 bg-white text-black border border-white"
            >
              <Mic size={16} />
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
              <div className="w-2 h-2 bg-[#22c55e] animate-pulse" />
              <span className="mono-xs text-[#333]">wake word detection active</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
