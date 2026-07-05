import { useLocation } from 'react-router-dom'

import { useTorchStore } from '../../store/torchStore'



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

      <rect x="4" y="4" width="16" height="16" rx="1" />

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



function StatusPill({

  children,

  dotClass

}: {

  children: React.ReactNode

  dotClass?: string

}): JSX.Element {

  return (

    <div className="topbar-pill">

      {dotClass && <span className={`topbar-dot pulse-dot ${dotClass}`} />}

      {children}

    </div>

  )

}



export function Topbar(): JSX.Element {

  const location = useLocation()

  const agentStatus = useTorchStore((s) => s.agentStatus)

  const wsConnected = useTorchStore((s) => s.wsConnected)

  const demoMode = useTorchStore((s) => s.demoMode)



  const pageTitle = pageTitles[location.pathname] || 'TORCH'



  const agentLabel =

    agentStatus === 'idle' ? 'Ready'

    : agentStatus === 'listening' ? 'Listening'

    : agentStatus === 'processing' ? 'Thinking'

    : agentStatus === 'executing' ? 'Working'

    : agentStatus === 'speaking' ? 'Speaking'

    : agentStatus === 'awaiting_approval' ? 'Awaiting approval'

    : String(agentStatus)



  const isActive = agentStatus !== 'idle'

  const dotClass =

    agentStatus === 'awaiting_approval' ? 'topbar-dot--warn'

    : isActive ? 'topbar-dot--live'

    : undefined



  return (

    <div className="topbar drag-region">

      <div className="no-drag">

        <div className="topbar-title">{pageTitle}</div>

        <div className="topbar-sub">Desktop agent</div>

      </div>



      <div className="no-drag" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

        <StatusPill dotClass={dotClass}>{agentLabel}</StatusPill>

        <StatusPill>{demoMode ? 'Demo' : 'Private'}</StatusPill>

        <StatusPill dotClass={wsConnected ? 'topbar-dot--live' : 'topbar-dot--warn'}>

          {wsConnected ? 'Online' : 'Reconnecting'}

        </StatusPill>



        <div style={{ width: 1, height: 20, background: 'var(--color-torch-border)', margin: '0 4px' }} />



        <button type="button" className="win-btn" onClick={() => window.torchAPI?.minimizeWindow()}>

          <IconMinus />

        </button>

        <button type="button" className="win-btn" onClick={() => window.torchAPI?.maximizeWindow()}>

          <IconSquare />

        </button>

        <button type="button" className="win-btn win-btn--danger" onClick={() => window.torchAPI?.closeWindow()}>

          <IconX />

        </button>

      </div>

    </div>

  )

}


