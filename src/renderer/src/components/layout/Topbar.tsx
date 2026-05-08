import { Minus, Square, X, Wifi, WifiOff, Mic, MicOff } from 'lucide-react'
import { useTorchStore } from '../../store/torchStore'
import { useLocation } from 'react-router-dom'

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
    agentStatus === 'executing' ? '#22c55e' :
    agentStatus === 'awaiting_approval' ? '#eab308' : '#ffffff'

  const statusLabel = agentStatus === 'idle' ? 'idle' :
    agentStatus === 'listening' ? 'listening' :
    agentStatus === 'processing' ? 'processing' :
    agentStatus === 'executing' ? 'executing' :
    agentStatus === 'speaking' ? 'speaking' :
    agentStatus === 'awaiting_approval' ? 'awaiting approval' : agentStatus

  return (
    <div className="h-[52px] flex items-center justify-between border-b border-[#1c1c1c] px-6 bg-[#000] drag-region flex-shrink-0">
      {/* Left: Page title */}
      <div className="heading-md no-drag">{pageTitle}</div>

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
          {wsConnected ? (
            <Wifi size={10} className="text-[#22c55e]" />
          ) : (
            <WifiOff size={10} className="text-[#ef4444]" />
          )}
          <span className="mono-xs text-[#666]">
            {wsConnected ? 'connected' : 'offline'}
          </span>
        </div>

        {/* Voice status */}
        <div className="flex items-center gap-2 px-3 py-1.5 border border-[#1c1c1c]">
          {inputMode === 'voice' || inputMode === 'heytorch' ? (
            <Mic size={10} className="text-white" />
          ) : (
            <MicOff size={10} className="text-[#444]" />
          )}
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
          <Minus size={12} />
        </button>
        <button
          onClick={() => window.torchAPI?.maximizeWindow()}
          className="p-1.5 text-[#444] hover:text-white transition-colors duration-120"
        >
          <Square size={10} />
        </button>
        <button
          onClick={() => window.torchAPI?.closeWindow()}
          className="p-1.5 text-[#444] hover:text-[#ef4444] transition-colors duration-120"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  )
}
