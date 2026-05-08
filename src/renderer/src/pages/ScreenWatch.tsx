import { Monitor, Eye, EyeOff } from 'lucide-react'
import { useTorchStore } from '../store/torchStore'
import { useMemoryStore } from '../store/memoryStore'

export function ScreenWatch(): JSX.Element {
  const screenWatchEnabled = useTorchStore((s) => s.screenWatchEnabled)
  const setScreenWatchEnabled = useTorchStore((s) => s.setScreenWatchEnabled)
  const activityLog = useMemoryStore((s) => s.activityLog)

  // Demo data
  const demoActivity = activityLog.length > 0 ? activityLog : [
    { id: '1', timestamp: Date.now() - 300000, app: 'VS Code', description: 'Editing TORCH main.ts — Electron configuration', screenshot: '' },
    { id: '2', timestamp: Date.now() - 240000, app: 'Chrome', description: 'Browsing Gemini API documentation', screenshot: '' },
    { id: '3', timestamp: Date.now() - 180000, app: 'Terminal', description: 'Running npm install dependencies', screenshot: '' },
    { id: '4', timestamp: Date.now() - 120000, app: 'Slack', description: 'Messaging team channel — project updates', screenshot: '' },
    { id: '5', timestamp: Date.now() - 60000, app: 'VS Code', description: 'Writing React component — ChatArea.tsx', screenshot: '' },
  ]

  return (
    <div className="flex-1 flex flex-col h-full page-enter">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1c1c1c] flex-shrink-0">
        <div className="flex items-center gap-3">
          <Monitor size={14} className="text-[#666]" />
          <span className="label">SCREEN OBSERVER</span>
          {screenWatchEnabled && (
            <div className="flex items-center gap-1.5 ml-2">
              <div className="w-1.5 h-1.5 bg-[#22c55e] animate-pulse" />
              <span className="mono-xs text-[#22c55e]">active</span>
            </div>
          )}
        </div>
        <button
          onClick={() => setScreenWatchEnabled(!screenWatchEnabled)}
          className={`flex items-center gap-2 px-3 py-1.5 border transition-colors duration-120 ${
            screenWatchEnabled
              ? 'border-[#22c55e] text-[#22c55e] bg-[rgba(34,197,94,0.05)]'
              : 'border-[#1c1c1c] text-[#444]'
          }`}
        >
          {screenWatchEnabled ? <Eye size={12} /> : <EyeOff size={12} />}
          <span className="mono-xs">{screenWatchEnabled ? 'watching' : 'disabled'}</span>
        </button>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="space-y-1">
          {demoActivity.map((entry, i) => (
            <div key={entry.id} className="flex gap-4 py-3 border-b border-[#0d0d0d]">
              {/* Time */}
              <div className="w-16 flex-shrink-0">
                <span className="mono-xs text-[#333]">
                  {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Timeline dot */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div className="w-2 h-2 bg-[#1c1c1c] border border-[#2a2a2a] mt-1" />
                {i < demoActivity.length - 1 && (
                  <div className="w-px flex-1 bg-[#0d0d0d] mt-1" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[12px] text-white font-medium">{entry.app}</span>
                </div>
                <p className="text-[11px] text-[#666] truncate">{entry.description}</p>
              </div>

              {/* Screenshot placeholder */}
              <div className="w-24 h-14 bg-[#060606] border border-[#1c1c1c] flex items-center justify-center flex-shrink-0">
                <Monitor size={12} className="text-[#1c1c1c]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
