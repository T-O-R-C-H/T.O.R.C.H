import { useTorchStore } from '../../store/torchStore'
import { useLocation } from 'react-router-dom'

/* ─── INLINE SVG ICONS ─── */

function IconWifi(): JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  )
}

function IconWifiOff(): JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
      <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  )
}

function IconMic(): JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

function IconMicOff(): JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .67-.08 1.32-.22 1.94" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

function IconMinus(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function IconSquare(): JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="0" />
    </svg>
  )
}

function IconX(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

const pageTitles: Record<string, string> = {
  '/': 'Command Center',
  '/terminal': 'Terminal',
  '/screenwatch': 'Screen Watch',
  '/history': 'History',
  '/memory': 'Memory',
  '/insights': 'Insights',
  '/tasks': 'Tasks',
  '/settings': 'Settings',
  '/tools/search': 'Web Search',
  '/tools/files': 'Files',
  '/tools/messaging': 'Messaging',
  '/tools/browser': 'Browser'
}

export function Topbar(): JSX.Element {
  const location = useLocation()
  const agentStatus = useTorchStore((s) => s.agentStatus)
  const wsConnected = useTorchStore((s) => s.wsConnected)
  const inputMode = useTorchStore((s) => s.inputMode)

  const pageTitle = pageTitles[location.pathname] || 'TORCH'

  const statusColor = agentStatus === 'idle' ? '#444' :
    agentStatus === 'executing' ? '#ffffff' :
    agentStatus === 'awaiting_approval' ? '#ffffff' : '#ffffff'

  const statusLabel = agentStatus === 'idle' ? 'idle' :
    agentStatus === 'listening' ? 'listening' :
    agentStatus === 'processing' ? 'processing' :
    agentStatus === 'executing' ? 'executing' :
    agentStatus === 'speaking' ? 'speaking' :
    agentStatus === 'awaiting_approval' ? 'awaiting approval' : agentStatus

  return (
    <div className="h-[52px] flex items-center justify-between border-b border-[#1c1c1c] px-5 bg-[#000] drag-region flex-shrink-0">
      {/* Left: Page title */}
      <div className="no-drag">
        <div className="text-[13px] font-medium">{pageTitle}</div>
        <div className="font-mono text-[10px] text-[#2a2a2a]">say "hey torch" anytime</div>
      </div>

      {/* Right: Status pills + window controls */}
      <div className="flex items-center gap-3 no-drag">
        {/* Agent status pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 border border-[#1c1c1c]">
          <div
            className="w-1.5 h-1.5"
            style={{ backgroundColor: statusColor }}
          />
          <span className="mono-xs text-[#666]">agent: {statusLabel}</span>
        </div>

        {/* Connection status */}
        <div className="flex items-center gap-2 px-3 py-1.5 border border-[#1c1c1c]">
          <span className={wsConnected ? 'text-white' : 'text-[#444]'}>
            {wsConnected ? <IconWifi /> : <IconWifiOff />}
          </span>
          <span className="mono-xs text-[#666]">
            {wsConnected ? 'connected' : 'offline'}
          </span>
        </div>

        {/* Voice status */}
        <div className="flex items-center gap-2 px-3 py-1.5 border border-[#1c1c1c]">
          <span className={inputMode === 'voice' || inputMode === 'heytorch' ? 'text-white' : 'text-[#444]'}>
            {inputMode === 'voice' || inputMode === 'heytorch' ? <IconMic /> : <IconMicOff />}
          </span>
          <span className="mono-xs text-[#666]">
            {inputMode === 'voice' ? 'voice' : inputMode === 'heytorch' ? 'hey torch' : 'type'}
          </span>
        </div>

        {/* Separator */}
        <div className="w-px h-4 bg-[#1c1c1c] mx-1" />

        {/* Window controls */}
        <button
          onClick={() => window.torchAPI?.minimizeWindow()}
          className="p-1.5 text-[#444] hover:text-white transition-colors duration-120"
        >
          <IconMinus />
        </button>
        <button
          onClick={() => window.torchAPI?.maximizeWindow()}
          className="p-1.5 text-[#444] hover:text-white transition-colors duration-120"
        >
          <IconSquare />
        </button>
        <button
          onClick={() => window.torchAPI?.closeWindow()}
          className="p-1.5 text-[#444] hover:text-[#555] transition-colors duration-120"
        >
          <IconX />
        </button>
      </div>
    </div>
  )
}
