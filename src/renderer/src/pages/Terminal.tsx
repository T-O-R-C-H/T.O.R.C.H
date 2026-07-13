import { useEffect, useRef } from 'react'
import { useTorchStore } from '../store/torchStore'

function ActivityLogLine({
  line
}: {
  line: { id: string; timestamp: string; content: string; type: string }
}): JSX.Element {
  const isError = line.type === 'error'
  const hasStack =
    isError &&
    (line.content.includes('Traceback') ||
      line.content.includes('line ') ||
      line.content.length > 100)

  if (hasStack) {
    const cleanMsg = line.content.split('\n')[0] || 'An unexpected error occurred.'
    return (
      <div className="terminal-error-block">
        <span className="terminal-line-time">[{line.timestamp}]</span>
        <div className="flex-1">
          <div className="font-medium">{cleanMsg}</div>
          <details
            className="mt-2 text-[11px] cursor-pointer"
            style={{ color: 'var(--color-torch-error)' }}
          >
            <summary className="select-none outline-none text-[10px] tracking-wide uppercase">
              Show raw details
            </summary>
            <pre
              className="mt-2 p-3 card overflow-x-auto whitespace-pre text-[11px] leading-relaxed"
              style={{ color: 'var(--color-torch-error)' }}
            >
              {line.content}
            </pre>
          </details>
        </div>
      </div>
    )
  }

  const getLineColor = (type: string): string => {
    switch (type) {
      case 'success':
        return 'text-[var(--color-torch-success)]'
      case 'error':
        return 'text-[var(--color-torch-error)]'
      case 'warning':
        return 'text-[var(--color-torch-warning)]'
      case 'hitl':
        return 'text-[var(--color-torch-warning)]'
      default:
        return 'text-[var(--color-torch-text-secondary)]'
    }
  }

  return (
    <div className={`flex gap-4 my-1 ${getLineColor(line.type)}`}>
      <span className="terminal-line-time">[{line.timestamp}]</span>
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

  const lines =
    terminalLines.length > 0
      ? terminalLines
      : [
          {
            id: '1',
            timestamp: '09:14:22',
            content: 'TORCH agent initialized',
            type: 'success' as const
          },
          {
            id: '2',
            timestamp: '09:14:22',
            content: 'WebSocket server: ws://localhost:8000/ws',
            type: 'info' as const
          },
          {
            id: '3',
            timestamp: '09:14:23',
            content: 'Voice engine: standby',
            type: 'info' as const
          },
          {
            id: '4',
            timestamp: '09:14:23',
            content: 'Screen watcher: disabled',
            type: 'info' as const
          },
          {
            id: '5',
            timestamp: '09:14:23',
            content: 'Memory store: 0 entries loaded',
            type: 'info' as const
          },
          {
            id: '6',
            timestamp: '09:14:24',
            content: 'Ready — awaiting commands',
            type: 'success' as const
          },
          { id: '7', timestamp: '09:14:24', content: '', type: 'info' as const },
          {
            id: '8',
            timestamp: '09:14:25',
            content: '█ TORCH v1.0.0 — Thinking, Observing, Reasoning, Creating & Handling',
            type: 'info' as const
          }
        ]

  return (
    <div className="page-shell page-enter">
      <div className="page-toolbar terminal-toolbar">
        <div className="pill-count flex items-center gap-2">
          <span className="topbar-dot topbar-dot--live pulse-dot" />
          streaming
        </div>
        <button
          type="button"
          onClick={() => useTorchStore.getState().clearTerminal()}
          className="btn-secondary text-[10px] px-4 py-1.5 font-mono"
        >
          Clear
        </button>
      </div>

      <div ref={scrollRef} className="terminal-body">
        {lines.map((line) => (
          <ActivityLogLine key={line.id} line={line} />
        ))}
        <div className="flex gap-4 mt-2">
          <span className="terminal-line-time">
            [{new Date().toLocaleTimeString('en-US', { hour12: false })}]
          </span>
          <span className="terminal-cursor" />
        </div>
      </div>
    </div>
  )
}
