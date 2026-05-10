import { useState } from 'react'
import { IconCheck as Check, IconX as X, IconChevronDown as ChevronDown, IconChevronUp as ChevronUp, IconClock as Clock } from '../components/icons'
import { useMemoryStore, type HistoryEntry } from '../store/memoryStore'

const demoHistory: HistoryEntry[] = [
  {
    id: '1', command: 'Find Sales.pdf and email it to john@company.com',
    timestamp: Date.now() - 3600000, status: 'completed', stepsCount: 5, duration: 12,
    steps: [
      { label: 'Scanning /Documents for Sales.pdf', status: 'done' },
      { label: 'Found: /Documents/Reports/Sales.pdf (2.3MB)', status: 'done' },
      { label: 'Extracting text — 12 pages', status: 'done' },
      { label: 'Generating email subject line', status: 'done' },
      { label: 'Sent email via smtp.gmail.com ✓', status: 'done' },
    ]
  },
  {
    id: '2', command: 'Search the web for latest AI agent frameworks and summarize',
    timestamp: Date.now() - 7200000, status: 'completed', stepsCount: 4, duration: 8,
    steps: [
      { label: 'Searching: "latest AI agent frameworks 2026"', status: 'done' },
      { label: 'Scraped 5 articles', status: 'done' },
      { label: 'Generating summary with Gemini', status: 'done' },
      { label: 'Summary delivered', status: 'done' },
    ]
  },
  {
    id: '3', command: 'Delete all temp files from Downloads',
    timestamp: Date.now() - 10800000, status: 'cancelled', stepsCount: 3, duration: 2,
    steps: [
      { label: 'Scanning /Downloads for temp files', status: 'done' },
      { label: 'Found 23 files (145MB total)', status: 'done' },
      { label: 'HITL: Delete 23 files — Cancelled by user', status: 'failed' },
    ]
  }
]

export function History(): JSX.Element {
  const history = useMemoryStore((s) => s.history)
  const [expanded, setExpanded] = useState<string | null>(null)

  const entries = history.length > 0 ? history : demoHistory

  const statusIcon = (status: string): JSX.Element => {
    if (status === 'completed') return <Check size={12} className="text-[#22c55e]" />
    if (status === 'failed') return <X size={12} className="text-[#ef4444]" />
    return <X size={12} className="text-[#eab308]" />
  }

  return (
    <div className="flex-1 flex flex-col h-full page-enter">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1c1c1c] flex-shrink-0">
        <div className="flex items-center gap-3">
          <Clock size={14} className="text-[#666]" />
          <span className="label">TASK HISTORY</span>
          <span className="mono-xs text-[#333]">{entries.length} entries</span>
        </div>
        <button
          onClick={() => useMemoryStore.getState().clearHistory()}
          className="mono-xs text-[#333] hover:text-[#666] transition-colors"
        >
          clear all
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {entries.map((entry) => (
          <div key={entry.id} className="border-b border-[#0d0d0d]">
            {/* Entry header */}
            <button
              onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
              className="w-full flex items-center gap-4 px-6 py-3 hover:bg-[#060606] transition-colors duration-120 text-left"
            >
              {statusIcon(entry.status)}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-[#ccc] truncate">{entry.command}</p>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                <span className="mono-xs text-[#333]">{entry.stepsCount} steps</span>
                <span className="mono-xs text-[#333]">{entry.duration}s</span>
                <span className="mono-xs text-[#333]">
                  {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
                </span>
                {expanded === entry.id ? <ChevronUp size={12} className="text-[#333]" /> : <ChevronDown size={12} className="text-[#333]" />}
              </div>
            </button>

            {/* Expanded steps */}
            {expanded === entry.id && (
              <div className="px-6 pb-4 pl-12">
                {entry.steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2 py-1">
                    <span className="mono-xs text-[#333] w-5">{String(i + 1).padStart(2, '0')}</span>
                    <span className={`text-[11px] ${
                      step.status === 'done' ? 'text-[#555]' :
                      step.status === 'failed' ? 'text-[#ef4444]' : 'text-[#666]'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
