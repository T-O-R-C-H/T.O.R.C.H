import { useState } from 'react'
import { useTorchStore } from '../../store/torchStore'
import { useLocation } from 'react-router-dom'

/* ═══════════════════════════════════════════════════════════════
   TORCH TOP HEADER — AI Operating System Control Panel
   56px · #000 · cinematic · monochrome status pills
   ═══════════════════════════════════════════════════════════════ */

/* ─── Window control icons ─── */
function IconMinus(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function IconSquare(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="4" width="16" height="16" rx="0" />
    </svg>
  )
}

function IconX(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

/* ─── Page title map ─── */
const pageTitles: Record<string, string> = {
  '/': 'COMMAND CENTER',
  '/terminal': 'TERMINAL',
  '/screenwatch': 'SCREEN WATCH',
  '/history': 'HISTORY',
  '/memory': 'MEMORY',
  '/insights': 'INSIGHTS',
  '/tasks': 'TASKS',
  '/settings': 'SETTINGS',
  '/tools/search': 'WEB SEARCH',
  '/tools/files': 'FILES',
  '/tools/messaging': 'MESSAGING',
  '/tools/browser': 'BROWSER'
}

/* ─── Status pill component ─── */
function StatusPill({ children, dot }: { children: React.ReactNode; dot?: boolean }): JSX.Element {
  return (
    <div style={{
      height: '28px',
      padding: '0 10px',
      border: '1px solid #1a1a1a',
      background: '#050505',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '10px',
      fontWeight: 500,
      color: '#777',
      letterSpacing: '0.12em',
      textTransform: 'uppercase' as const,
    }}>
      {dot && (
        <div style={{
          width: '5px',
          height: '5px',
          background: '#fff',
          animation: 'pulse-dot 1.5s ease-in-out infinite',
          flexShrink: 0,
        }} />
      )}
      {children}
    </div>
  )
}

/* ─── Window control button ─── */
function WindowButton({ onClick, children, danger }: { onClick?: () => void; children: React.ReactNode; danger?: boolean }): JSX.Element {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '40px',
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hovered ? '#111' : 'transparent',
        border: 'none',
        color: hovered ? (danger ? '#ef4444' : '#fff') : '#333',
        cursor: 'pointer',
        transition: 'all 120ms ease',
      }}
    >
      {children}
    </button>
  )
}

export function Topbar(): JSX.Element {
  const location = useLocation()
  const agentStatus = useTorchStore((s) => s.agentStatus)
  const wsConnected = useTorchStore((s) => s.wsConnected)

  const pageTitle = pageTitles[location.pathname] || 'TORCH'

  const agentLabel = agentStatus === 'idle' ? 'IDLE' :
    agentStatus === 'listening' ? 'LISTENING' :
    agentStatus === 'processing' ? 'THINKING' :
    agentStatus === 'executing' ? 'ACTIVE' :
    agentStatus === 'speaking' ? 'SPEAKING' :
    agentStatus === 'awaiting_approval' ? 'AWAITING' : (agentStatus as string).toUpperCase()

  const isActive = agentStatus !== 'idle'

  return (
    <div
      className="drag-region"
      style={{
        height: '56px',
        background: '#000000',
        borderBottom: '1px solid #121212',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        flexShrink: 0,
      }}
    >
      {/* ─── LEFT: Page title + subtitle ─── */}
      <div className="no-drag" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: '17px',
          fontWeight: 600,
          color: '#ffffff',
          letterSpacing: '-0.03em',
          lineHeight: 1,
        }}>
          {pageTitle}
        </div>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '9px',
          fontWeight: 500,
          color: '#555',
          letterSpacing: '0.18em',
          textTransform: 'uppercase' as const,
          marginTop: '4px',
        }}>
          TORCH AI OPERATOR
        </div>
      </div>

      {/* ─── RIGHT: Status pills + window controls ─── */}
      <div className="no-drag" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Status pills */}
        <StatusPill dot={isActive}>
          AGENT: {agentLabel}
        </StatusPill>

        <StatusPill>
          LOCAL MODE
        </StatusPill>

        <StatusPill dot={wsConnected}>
          {wsConnected ? 'CONNECTED' : 'OFFLINE'}
        </StatusPill>

        {/* Separator */}
        <div style={{ width: '1px', height: '20px', background: '#1a1a1a', margin: '0 8px' }} />

        {/* Window controls — 40px hit area */}
        <WindowButton onClick={() => window.torchAPI?.minimizeWindow()}>
          <IconMinus />
        </WindowButton>
        <WindowButton onClick={() => window.torchAPI?.maximizeWindow()}>
          <IconSquare />
        </WindowButton>
        <WindowButton onClick={() => window.torchAPI?.closeWindow()} danger>
          <IconX />
        </WindowButton>
      </div>
    </div>
  )
}
