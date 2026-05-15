import { useEffect, useRef } from 'react'
import { useTorchStore } from '../store/torchStore'

export function Terminal(): JSX.Element {
  const terminalLines = useTorchStore((s) => s.terminalLines)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [terminalLines])

  const getLineColor = (type: string): string => {
    switch (type) {
      case 'success': return 'text-[#22c55e]'
      case 'error': return 'text-[#ef4444]'
      case 'warning': return 'text-[#eab308]'
      case 'hitl': return 'text-[#eab308]'
      default: return 'text-[#888]'
    }
  }

  const lines = terminalLines.length > 0 ? terminalLines : [
    { id: '1', timestamp: '09:14:22', content: 'TORCH agent initialized', type: 'success' as const },
    { id: '2', timestamp: '09:14:22', content: 'WebSocket server: ws://localhost:8000/ws', type: 'info' as const },
    { id: '3', timestamp: '09:14:23', content: 'Voice engine: standby', type: 'info' as const },
    { id: '4', timestamp: '09:14:23', content: 'Screen watcher: disabled', type: 'info' as const },
    { id: '5', timestamp: '09:14:23', content: 'Memory store: 0 entries loaded', type: 'info' as const },
    { id: '6', timestamp: '09:14:24', content: 'Ready — awaiting commands', type: 'success' as const },
    { id: '7', timestamp: '09:14:24', content: '', type: 'info' as const },
    { id: '8', timestamp: '09:14:25', content: '█ TORCH v1.0.0 — Thinking, Observing, Reasoning, Creating & Handling', type: 'info' as const },
  ]

  return (
    <div className="flex-1 flex flex-col h-full page-enter">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#141414] flex-shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="t-page-title">Terminal</h1>
          <div className="flex items-center gap-2 px-3 py-1 border border-[#181818]">
            <div className="w-1.5 h-1.5 bg-[#22c55e] pulse-dot" />
            <span className="t-mono-xs text-[#555]">streaming</span>
          </div>
        </div>
        <button
          onClick={() => useTorchStore.getState().clearTerminal()}
          className="btn-secondary text-[10px] px-4 py-1.5"
        >
          Clear
        </button>
      </div>

      {/* Terminal body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-[#000] px-6 py-5 font-mono text-[12px] leading-[2]">
        {lines.map((line) => (
          <div key={line.id} className={`flex gap-4 ${getLineColor(line.type)}`}>
            <span className="text-[#222] flex-shrink-0 select-none w-[72px]">[{line.timestamp}]</span>
            <span>{line.content}</span>
          </div>
        ))}
        {/* Cursor */}
        <div className="flex gap-4 mt-1">
          <span className="text-[#222] select-none w-[72px]">[{new Date().toLocaleTimeString('en-US', { hour12: false })}]</span>
          <span className="terminal-cursor" />
        </div>
      </div>
    </div>
  )
}
