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

  const statusBadge = (status: string): JSX.Element => {
    if (status === 'completed') return (
      <div className="flex items-center gap-1.5 badge-success px-2 py-0.5">
        <Check size={10} />
        <span className="text-[9px] font-mono">done</span>
      </div>
    )
    if (status === 'failed') return (
      <div className="flex items-center gap-1.5 badge-error px-2 py-0.5">
        <X size={10} />
        <span className="text-[9px] font-mono">failed</span>
      </div>
    )
    return (
      <div className="flex items-center gap-1.5 badge-warning px-2 py-0.5">
        <X size={10} />
        <span className="text-[9px] font-mono">cancelled</span>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full page-enter">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#141414] flex-shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="t-page-title">History</h1>
          <span className="t-mono-xs text-[#333] border border-[#181818] px-2.5 py-1">{entries.length} entries</span>
        </div>
        <button
          onClick={() => useMemoryStore.getState().clearHistory()}
          className="btn-secondary text-[10px] px-4 py-1.5"
        >
          Clear all
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {entries.map((entry) => (
          <div key={entry.id} className="border-b border-[#0e0e0e]">
            <button
              onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
              className="w-full flex items-center gap-5 px-6 py-4 row-hover text-left group"
            >
              {statusBadge(entry.status)}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-[#ccc] truncate group-hover:text-white transition-colors">{entry.command}</p>
              </div>
              <div className="flex items-center gap-5 flex-shrink-0">
                <span className="t-mono-xs text-[#333]">{entry.stepsCount} steps</span>
                <span className="t-mono-xs text-[#333]">{entry.duration}s</span>
                <span className="t-mono-xs text-[#333]">
                  {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-[#333] group-hover:text-[#666] transition-colors">
                  {expanded === entry.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </span>
              </div>
            </button>

            {/* Expanded steps */}
            {expanded === entry.id && (
              <div className="px-6 pb-4 pl-[52px]">
                <div className="border-l border-[#181818] pl-4 space-y-1">
                  {entry.steps.map((step, i) => (
                    <div key={i} className="flex items-center gap-3 py-1.5">
                      <span className="t-mono-xs text-[#222] w-5">{String(i + 1).padStart(2, '0')}</span>
                      <span className={`text-[12px] ${
                        step.status === 'done' ? 'text-[#666]' :
                        step.status === 'failed' ? 'text-[#ef4444]' : 'text-[#555]'
                      }`}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
