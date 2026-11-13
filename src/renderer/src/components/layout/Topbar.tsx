import { useTorchStore } from '../../store/torchStore'
import { TorchLogo } from '../ui/TorchLogo'

/**
 * The custom title bar.
 *
 * The window is frameless and the native menu is removed, so this is the only
 * thing giving the window a drag handle and its controls. The bar itself is
 * draggable; the buttons opt out, or they could not be clicked.
 *
 * It carries the brand on the left and, beside the window controls, the one
 * status indicator in the app.
 */
function IconMinus(): JSX.Element {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      <line x1="1" y1="6" x2="11" y2="6" />
    </svg>
  )
}

function IconSquare(): JSX.Element {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      <rect x="1.5" y="1.5" width="9" height="9" />
    </svg>
  )
}

function IconX(): JSX.Element {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      <line x1="1.5" y1="1.5" x2="10.5" y2="10.5" />
      <line x1="10.5" y1="1.5" x2="1.5" y2="10.5" />
    </svg>
  )
}

type StatusTone = 'ready' | 'working' | 'waiting' | 'connecting' | 'demo'

interface AppStatus {
  tone: StatusTone
  label: string
}

/**
 * What TORCH is doing, in one word and one dot.
 *
 * This is the only place connection and activity are reported. They used to
 * be split - a coloured dot on the sidebar's Chat row, a word under the
 * command box - and the two could disagree. Wording follows the language
 * rules: "Connecting…" on a cold start, "Reconnecting…" after a drop, never
 * "offline" and never red, because neither is something the user did wrong.
 */
function useAppStatus(): AppStatus {
  const agentStatus = useTorchStore((s) => s.agentStatus)
  const wsConnected = useTorchStore((s) => s.wsConnected)
  const hasConnectedOnce = useTorchStore((s) => s.hasConnectedOnce)
  const demoMode = useTorchStore((s) => s.demoMode)

  if (!demoMode && !wsConnected) {
    return { tone: 'connecting', label: hasConnectedOnce ? 'Reconnecting…' : 'Connecting…' }
  }
  if (agentStatus === 'awaiting_approval') return { tone: 'waiting', label: 'Needs your OK' }
  if (agentStatus === 'awaiting_input') return { tone: 'waiting', label: 'Needs an answer' }
  if (agentStatus === 'listening') return { tone: 'working', label: 'Listening' }
  if (agentStatus !== 'idle') return { tone: 'working', label: 'Working' }
  if (demoMode) return { tone: 'demo', label: 'Demo' }
  return { tone: 'ready', label: 'Ready' }
}

export function Topbar(): JSX.Element {
  const status = useAppStatus()

  return (
    <div className="topbar drag-region">
      <div className="topbar-brand">
        <TorchLogo width={62} />
      </div>

      <div className="topbar-status" data-tone={status.tone} role="status" aria-live="polite">
        <span className="topbar-status__dot" aria-hidden="true" />
        <span>{status.label}</span>
      </div>

      <div className="no-drag topbar-controls">
        <button
          type="button"
          className="win-btn"
          onClick={() => window.torchAPI?.minimizeWindow()}
          aria-label="Minimize"
        >
          <IconMinus />
        </button>
        <button
          type="button"
          className="win-btn"
          onClick={() => window.torchAPI?.maximizeWindow()}
          aria-label="Maximize"
        >
          <IconSquare />
        </button>
        <button
          type="button"
          className="win-btn win-btn--danger"
          onClick={() => window.torchAPI?.closeWindow()}
          aria-label="Close"
        >
          <IconX />
        </button>
      </div>
    </div>
  )
}
