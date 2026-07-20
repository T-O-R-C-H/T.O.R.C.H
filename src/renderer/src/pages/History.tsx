import { useState, useEffect } from 'react'
import {
  IconCheck as Check,
  IconX as X,
  IconChevronDown as ChevronDown,
  IconChevronUp as ChevronUp
} from '../components/icons'
import { useMemoryStore, type HistoryEntry } from '../store/memoryStore'
import { useTorchStore } from '../store/torchStore'
import { API_BASE } from '../config/api'

const demoHistory: HistoryEntry[] = [
  {
    id: '1',
    command: 'Find Sales.pdf and email it to john@company.com',
    timestamp: Date.now() - 3600000,
    status: 'completed',
    stepsCount: 5,
    duration: 12,
    steps: [
      { label: 'Scanning /Documents for Sales.pdf', status: 'done' },
      { label: 'Found: /Documents/Reports/Sales.pdf (2.3MB)', status: 'done' },
      { label: 'Extracting text — 12 pages', status: 'done' },
      { label: 'Generating email subject line', status: 'done' },
      { label: 'Sent email via smtp.gmail.com ✓', status: 'done' }
    ]
  },
  {
    id: '2',
    command: 'Search the web for latest AI agent frameworks and summarize',
    timestamp: Date.now() - 7200000,
    status: 'completed',
    stepsCount: 4,
    duration: 8,
    steps: [
      { label: 'Searching: "latest AI agent frameworks 2026"', status: 'done' },
      { label: 'Scraped 5 articles', status: 'done' },
      { label: 'Generating summary with Gemini', status: 'done' },
      { label: 'Summary delivered', status: 'done' }
    ]
  },
  {
    id: '3',
    command: 'Delete all temp files from Downloads',
    timestamp: Date.now() - 10800000,
    status: 'cancelled',
    stepsCount: 3,
    duration: 2,
    steps: [
      { label: 'Scanning /Downloads for temp files', status: 'done' },
      { label: 'Found 23 files (145MB total)', status: 'done' },
      { label: 'HITL: Delete 23 files — Cancelled by user', status: 'failed' }
    ]
  }
]

export function History(): JSX.Element {
  const history = useMemoryStore((s) => s.history)
  const setHistory = useMemoryStore((s) => s.setHistory)
  const clearHistory = useMemoryStore((s) => s.clearHistory)
  const demoMode = useTorchStore((s) => s.demoMode)

  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (demoMode) {
      return
    }

    let active = true
    const fetchHistory = async (): Promise<void> => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${API_BASE}/api/history`)
        if (!res.ok) throw new Error('Failed to fetch history')
        const data = await res.json()
        if (active) setHistory(data)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Error loading history')
      } finally {
        if (active) setLoading(false)
      }
    }

    void fetchHistory()
    return () => {
      active = false
    }
  }, [demoMode, setHistory])

  const handleClearAll = async (): Promise<void> => {
    if (demoMode) {
      clearHistory()
      return
    }

    try {
      const res = await fetch(`${API_BASE}/api/history`, { method: 'DELETE' })
      if (res.ok) {
        clearHistory()
      } else {
        alert('Failed to clear history on server')
      }
    } catch (err) {
      console.error('Error clearing history:', err)
      alert('Error clearing history')
    }
  }

  const entries = demoMode ? demoHistory : history

  const statusBadge = (status: string): JSX.Element => {
    if (status === 'completed')
      return (
        <div className="flex items-center gap-1.5 badge-success px-2 py-0.5">
          <Check size={10} />
          <span className="text-[9px] font-mono">done</span>
        </div>
      )
    if (status === 'failed')
      return (
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
    <div className="page-shell page-enter">
      <div className="page-list">
        <div className="page-toolbar">
          <span className="pill-count">{entries.length} entries</span>
          <button
            type="button"
            onClick={() => void handleClearAll()}
            className="btn-secondary text-[10px] px-4 py-1.5"
            disabled={loading || entries.length === 0}
          >
            Clear all
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center p-12 text-sm text-[var(--color-torch-text-secondary)]">
            Loading history...
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center justify-center p-12 text-sm text-[var(--color-torch-error)]">
            {error}
          </div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center p-12">
            <p className="text-sm text-[var(--color-torch-text-secondary)] mb-2">No history yet</p>
            <p className="text-xs text-[var(--color-torch-text-tertiary)]">
              Run a task in the Command Center to see it here.
            </p>
          </div>
        )}

        {!loading && !error && entries.map((entry) => (
          <div key={entry.id}>
            <button
              type="button"
              onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
              className="page-list-row group"
            >
              {statusBadge(entry.status)}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-[var(--color-torch-text)] truncate">
                  {entry.command}
                </p>
              </div>
              <div className="flex items-center gap-5 flex-shrink-0">
                <span className="t-mono-xs">{entry.stepsCount} steps</span>
                <span className="t-mono-xs">{entry.duration}s</span>
                <span className="t-mono-xs">
                  {new Date(entry.timestamp).toLocaleTimeString('en-US', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
                <span style={{ color: 'var(--color-torch-text-tertiary)' }}>
                  {expanded === entry.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </span>
              </div>
            </button>

            {expanded === entry.id && (
              <div className="px-6 pb-4 pl-[52px]">
                <div className="border-l border-[var(--color-torch-border)] pl-4 space-y-1">
                  {entry.steps.map((step, i) => (
                    <div key={i} className="flex items-center gap-3 py-1.5">
                      <span className="t-mono-xs w-5">{String(i + 1).padStart(2, '0')}</span>
                      <span
                        className={`text-[12px] ${
                          step.status === 'done'
                            ? 'text-[var(--color-torch-text-secondary)]'
                            : step.status === 'failed'
                              ? 'text-[var(--color-torch-error)]'
                              : 'text-[var(--color-torch-text-tertiary)]'
                        }`}
                      >
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
