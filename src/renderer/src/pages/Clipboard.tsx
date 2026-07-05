import { useEffect, useState } from 'react'
import { formatClipboardText, clipboardPreview } from '../utils/clipboardFormat'

interface ClipboardEntry {
  id: string
  text: string
  timestamp: number
  dateKey: string
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function Clipboard(): JSX.Element {
  const [entries, setEntries] = useState<ClipboardEntry[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const loadEntries = async (): Promise<void> => {
    const data = await window.torchAPI?.getClipboardEntries?.()
    if (data) setEntries(data)
  }

  useEffect(() => {
    void loadEntries()
    const timer = setInterval(() => { void loadEntries() }, 2000)
    return () => clearInterval(timer)
  }, [])

  const handleCopy = (entry: ClipboardEntry): void => {
    window.torchAPI?.copyToClipboard(entry.text)
    setCopiedId(entry.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  return (
    <div className="page-shell page-enter">
      <div className="page-shell__body">
        <p className="today-intro">
          Everything you copy today appears here automatically. Click any item to copy it again.
        </p>

        {entries.length === 0 ? (
          <div className="card today-empty">
            <p>No copies yet today.</p>
            <p className="text-[var(--color-torch-text-tertiary)] text-[12px] mt-2">
              Copy text anywhere on your PC and it will show up here.
            </p>
          </div>
        ) : (
          <div className="clipboard-list">
            {entries.map((entry) => {
              const formatted = formatClipboardText(entry.text)
              return (
                <button
                  key={entry.id}
                  type="button"
                  className="clipboard-item"
                  onClick={() => handleCopy(entry)}
                >
                  <div className="clipboard-item__preview">{clipboardPreview(formatted)}</div>
                  <div className="clipboard-item__text">{formatted}</div>
                  <div className="clipboard-item__meta">
                    <span>{formatTime(entry.timestamp)}</span>
                    <span>{copiedId === entry.id ? 'Copied' : 'Click to copy'}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
