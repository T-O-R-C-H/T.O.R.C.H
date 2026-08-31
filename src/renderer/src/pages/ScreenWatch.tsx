import { IconMonitor as Monitor, IconEye as Eye, IconEyeOff as EyeOff } from '../components/icons'
import { useTorchStore } from '../store/torchStore'
import { useMemoryStore } from '../store/memoryStore'

export function ScreenWatch(): JSX.Element {
  const screenWatchEnabled = useTorchStore((s) => s.screenWatchEnabled)
  const setScreenWatchEnabled = useTorchStore((s) => s.setScreenWatchEnabled)
  const activityLog = useMemoryStore((s) => s.activityLog)

  return (
    <div className="page-shell page-enter">
      <div className="page-shell__body">
        <div className="page-toolbar">
          {screenWatchEnabled && (
            <div
              className="pill-count flex items-center gap-2"
              style={{
                color: 'var(--color-torch-success)',
                borderColor: '#bbf7d0',
                background: '#f0fdf4'
              }}
            >
              <span className="topbar-dot topbar-dot--live pulse-dot" />
              recording
            </div>
          )}
          <button
            type="button"
            onClick={() => setScreenWatchEnabled(!screenWatchEnabled)}
            className={screenWatchEnabled ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: 11, padding: '6px 12px', marginLeft: 'auto' }}
          >
            {screenWatchEnabled ? <Eye size={13} /> : <EyeOff size={13} />}
            <span className="t-mono-xs">{screenWatchEnabled ? 'Stop' : 'Start watching'}</span>
          </button>
        </div>
        {activityLog.length === 0 ? (
          /* Nothing recorded is its own state. This page used to fall back to
             a hardcoded reel of invented activity, so it always looked like it
             was working - and one of those invented entries named a model. */
          <div className="insight-empty">
            <p className="insight-empty__title">No screen activity recorded yet</p>
            <p className="insight-empty__desc">
              Screen Watch will log what you&rsquo;re working on when enabled.
            </p>
          </div>
        ) : (
          <div className="space-y-0">
            {activityLog.map((entry, i) => (
              <div key={entry.id} className="flex gap-5 group">
                <div className="w-[52px] flex-shrink-0 pt-4">
                  <span className="t-mono-xs">
                    {new Date(entry.timestamp).toLocaleTimeString('en-US', {
                      hour12: false,
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>

                <div className="flex flex-col items-center flex-shrink-0 pt-4">
                  <div
                    className="w-2 h-2 rounded-full border"
                    style={{
                      background:
                        i === 0 ? 'var(--color-torch-text)' : 'var(--color-torch-surface)',
                      borderColor: i === 0 ? 'var(--color-torch-text)' : 'var(--color-torch-border)'
                    }}
                  />
                  {i < activityLog.length - 1 && (
                    <div
                      className="w-px flex-1 mt-1"
                      style={{ background: 'var(--color-torch-border-subtle)' }}
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0 pb-6 pt-3">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-[13px] font-medium text-[var(--color-torch-text)]">
                      {entry.app}
                    </span>
                  </div>
                  <p className="text-[12px] text-[var(--color-torch-text-secondary)] leading-relaxed">
                    {entry.description}
                  </p>
                </div>

                <div className="w-28 h-16 card flex items-center justify-center flex-shrink-0 mt-3 p-0">
                  <Monitor size={14} className="text-[var(--color-torch-text-ghost)]" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
