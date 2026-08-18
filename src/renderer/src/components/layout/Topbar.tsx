import { useLocation } from 'react-router-dom'

function IconMinus(): JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function IconSquare(): JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="4" y="4" width="16" height="16" rx="1" />
    </svg>
  )
}

function IconX(): JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

const pageTitles: Record<string, string> = {
  '/': 'Command Center',
  '/chat': 'Command Center',
  '/today': 'Today',
  '/terminal': 'Terminal',
  '/screenwatch': 'Screen Watch',
  '/history': 'History',
  '/memory': 'Memory',
  '/insights': 'Insights',
  '/tasks': 'Tasks',
  '/settings': 'Settings',
  '/skills': 'Skills',
  '/tools/clipboard': 'Clipboard',
  '/tools/search': 'Web Search',
  '/tools/files': 'Files',
  '/tools/messaging': 'Messaging',
  '/tools/browser': 'Browser'
}

export function Topbar(): JSX.Element {
  const location = useLocation()
  const pageTitle = pageTitles[location.pathname] || 'TORCH'

  return (
    <div className="topbar drag-region">
      <div className="no-drag">
        <div key={location.pathname} className="topbar-title topbar-title--enter">
          {pageTitle}
        </div>
        <div className="topbar-sub">Desktop agent</div>
      </div>

      <div className="no-drag topbar-controls">
        <button type="button" className="win-btn" onClick={() => window.torchAPI?.minimizeWindow()}>
          <IconMinus />
        </button>
        <button type="button" className="win-btn" onClick={() => window.torchAPI?.maximizeWindow()}>
          <IconSquare />
        </button>
        <button
          type="button"
          className="win-btn win-btn--danger"
          onClick={() => window.torchAPI?.closeWindow()}
        >
          <IconX />
        </button>
      </div>
    </div>
  )
}
