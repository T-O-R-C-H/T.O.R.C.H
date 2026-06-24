import { useEffect, useRef } from 'react'
import { useTorchStore } from '../store/torchStore'

function ActivityLogLine({ line }: { line: any }): JSX.Element {
  const isError = line.type === 'error'
  const hasStack = isError && (line.content.includes('Traceback') || line.content.includes('line ') || line.content.length > 100)

  if (hasStack) {
    const cleanMsg = line.content.split('\n')[0] || "An unexpected error occurred."
    return (
      <div className="flex gap-4 text-[#ef4444] my-2 p-2 bg-[#080202] border border-[#ef4444]/15 rounded">
        <span className="text-[#333] flex-shrink-0 select-none w-[72px]">[{line.timestamp}]</span>
        <div className="flex-1">
          <div className="font-semibold">{cleanMsg}</div>
          <details className="mt-2 text-[11px] text-[#a15555] cursor-pointer">
            <summary className="hover:text-white select-none outline-none font-sans text-[10px] tracking-wide uppercase">Show raw details</summary>
            <pre className="mt-2 p-3 bg-[#0c0404] border border-[#ef4444]/20 overflow-x-auto whitespace-pre font-mono text-[11px] leading-relaxed text-[#fca5a5]">
              {line.content}
            </pre>
          </details>
        </div>
      </div>
    )
  }

  const getLineColor = (type: string): string => {
    switch (type) {
      case 'success': return 'text-[#22c55e]'
      case 'error': return 'text-[#ef4444]'
      case 'warning': return 'text-[#eab308]'
      case 'hitl': return 'text-[#eab308]'
      default: return 'text-[#888]'
    }
  }

  return (
    <div className={`flex gap-4 my-1 ${getLineColor(line.type)}`}>
      <span className="text-[#222] flex-shrink-0 select-none w-[72px]">[{line.timestamp}]</span>
      <span className="whitespace-pre-wrap">{line.content}</span>
    </div>
  )
}

export function Terminal(): JSX.Element {
  const terminalLines = useTorchStore((s) => s.terminalLines)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [terminalLines])

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
          <h1 className="t-page-title">Activity Log</h1>
          <div className="flex items-center gap-2 px-3 py-1 border border-[#181818]">
            <div className="w-1.5 h-1.5 bg-[#22c55e] pulse-dot" />
            <span className="t-mono-xs text-[#555]">streaming</span>
          </div>
        </div>
        <button
          onClick={() => useTorchStore.getState().clearTerminal()}
          className="btn-secondary text-[10px] px-4 py-1.5 font-mono"
        >
          Clear
        </button>
      </div>

      {/* Terminal body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-[#000] px-6 py-5 font-mono text-[12px] leading-[2]">
        {lines.map((line) => (
          <ActivityLogLine key={line.id} line={line} />
        ))}
        {/* Cursor */}
        <div className="flex gap-4 mt-2">
          <span className="text-[#222] select-none w-[72px]">[{new Date().toLocaleTimeString('en-US', { hour12: false })}]</span>
          <span className="terminal-cursor" />
        </div>
      </div>
    </div>
  )
}
