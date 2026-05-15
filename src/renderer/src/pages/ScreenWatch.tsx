import { IconMonitor as Monitor, IconEye as Eye, IconEyeOff as EyeOff } from '../components/icons'
import { useTorchStore } from '../store/torchStore'
import { useMemoryStore } from '../store/memoryStore'

export function ScreenWatch(): JSX.Element {
  const screenWatchEnabled = useTorchStore((s) => s.screenWatchEnabled)
  const setScreenWatchEnabled = useTorchStore((s) => s.setScreenWatchEnabled)
  const activityLog = useMemoryStore((s) => s.activityLog)

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
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#141414] flex-shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="t-page-title">Screen Watch</h1>
          {screenWatchEnabled && (
            <div className="flex items-center gap-2 px-3 py-1 border border-[#22c55e]/20 bg-[#22c55e]/5">
              <div className="w-1.5 h-1.5 bg-[#22c55e] pulse-dot" />
              <span className="t-mono-xs text-[#22c55e]">recording</span>
            </div>
          )}
        </div>
        <button
          onClick={() => setScreenWatchEnabled(!screenWatchEnabled)}
          className={`flex items-center gap-2 px-4 py-2 border transition-all duration-150 ${
            screenWatchEnabled
              ? 'border-[#22c55e]/30 text-[#22c55e] bg-[#22c55e]/5 hover:bg-[#22c55e]/10'
              : 'border-[#181818] text-[#555] hover:text-white hover:border-[#333]'
          }`}
        >
          {screenWatchEnabled ? <Eye size={13} /> : <EyeOff size={13} />}
          <span className="t-mono-xs">{screenWatchEnabled ? 'Stop' : 'Start watching'}</span>
        </button>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="space-y-0">
          {demoActivity.map((entry, i) => (
            <div key={entry.id} className="flex gap-5 group">
              {/* Time */}
              <div className="w-[52px] flex-shrink-0 pt-4">
                <span className="t-mono-xs text-[#333]">
                  {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Timeline line + dot */}
              <div className="flex flex-col items-center flex-shrink-0 pt-4">
                <div className={`w-2 h-2 border ${i === 0 ? 'bg-white border-white' : 'bg-[#111] border-[#222]'}`} />
                {i < demoActivity.length - 1 && (
                  <div className="w-px flex-1 bg-[#141414] mt-1" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-6 pt-3">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-[13px] text-white font-medium">{entry.app}</span>
                </div>
                <p className="text-[12px] text-[#666] leading-relaxed">{entry.description}</p>
              </div>

              {/* Screenshot placeholder */}
              <div className="w-28 h-16 bg-[#060606] border border-[#141414] flex items-center justify-center flex-shrink-0 mt-3 group-hover:border-[#222] transition-colors">
                <Monitor size={14} className="text-[#1c1c1c]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
