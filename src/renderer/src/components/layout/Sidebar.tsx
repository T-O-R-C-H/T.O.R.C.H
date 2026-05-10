import { NavLink } from 'react-router-dom'
import { useTorchStore } from '../../store/torchStore'

/* ─── INLINE SVG ICONS (stroke only, strokeWidth 1.8, no fill) ─── */

function IconCommand(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
    </svg>
  )
}

function IconTerminal(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  )
}

function IconMonitor(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2" y="3" width="20" height="14" rx="0" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}

function IconClock(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function IconBrain(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 2a6 6 0 0 0-6 6c0 2.2 1.2 4.2 3 5.2V20h6v-6.8c1.8-1 3-3 3-5.2a6 6 0 0 0-6-6z" />
      <line x1="10" y1="14" x2="10" y2="20" />
      <line x1="14" y1="14" x2="14" y2="20" />
      <line x1="10" y1="22" x2="14" y2="22" />
    </svg>
  )
}

function IconChart(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}

function IconList(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <polyline points="3 6 4 7 6 5" />
      <polyline points="3 12 4 13 6 11" />
      <polyline points="3 18 4 19 6 17" />
    </svg>
  )
}

function IconGlobe(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

function IconFolder(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M22 19V9a2 2 0 0 0-2-2h-8l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2z" />
    </svg>
  )
}

function IconMessage(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function IconBrowser(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2" y="3" width="20" height="18" rx="0" />
      <line x1="2" y1="9" x2="22" y2="9" />
      <line x1="9" y1="3" x2="9" y2="9" />
    </svg>
  )
}

function IconSettings(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

/* ─── TORCH LOGO SVG (32x32 viewBox per spec) ─── */
function TorchLogo(): JSX.Element {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="12" y="19" width="8" height="11" rx="0" fill="#ffffff" />
      <line x1="12" y1="22" x2="20" y2="22" stroke="#000" strokeWidth="0.8" />
      <line x1="12" y1="25" x2="20" y2="25" stroke="#000" strokeWidth="0.8" />
      <ellipse cx="16" cy="12" rx="4.5" ry="7" fill="#ffffff" className="torch-flame" />
      <ellipse cx="16" cy="11" rx="3" ry="5" fill="#000000" />
      <ellipse cx="16" cy="10" rx="1.5" ry="3" fill="#ffffff" />
      <path d="M16 4 L14.5 8 L16 7 L17.5 8 Z" fill="#ffffff" />
    </svg>
  )
}

/* ─── ICON MAP ─── */
const iconMap: Record<string, () => JSX.Element> = {
  command: IconCommand,
  terminal: IconTerminal,
  monitor: IconMonitor,
  clock: IconClock,
  brain: IconBrain,
  chart: IconChart,
  list: IconList,
  globe: IconGlobe,
  folder: IconFolder,
  message: IconMessage,
  browser: IconBrowser,
}

const workspaceItems = [
  { path: '/', icon: 'command', label: 'Command' },
  { path: '/terminal', icon: 'terminal', label: 'Terminal' },
  { path: '/screenwatch', icon: 'monitor', label: 'Screen watch' },
  { path: '/history', icon: 'clock', label: 'History' }
]

const intelligenceItems = [
  { path: '/memory', icon: 'brain', label: 'Memory' },
  { path: '/insights', icon: 'chart', label: 'Insights' },
  { path: '/tasks', icon: 'list', label: 'Tasks', hasBadge: true }
]

const toolItems = [
  { path: '/tools/search', icon: 'globe', label: 'Web search' },
  { path: '/tools/files', icon: 'folder', label: 'Files' },
  { path: '/tools/messaging', icon: 'message', label: 'Messaging' },
  { path: '/tools/browser', icon: 'browser', label: 'Browser' }
]

interface NavSectionProps {
  title: string
  items: { path: string; icon: string; label: string; hasBadge?: boolean }[]
}

function NavSection({ title, items }: NavSectionProps): JSX.Element {
  const activeTaskCount = useTorchStore((s) => s.activeTaskCount)

  return (
    <div className="mb-1">
      <div className="label px-4 py-2">{title}</div>
      <div className="flex flex-col">
        {items.map((item) => {
          const Icon = iconMap[item.icon]
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `nav-item flex items-center gap-3 px-4 py-[7px] text-[12px] cursor-pointer ${
                  isActive ? 'active' : ''
                }`
              }
            >
              {Icon && <Icon />}
              <span>{item.label}</span>
              {item.hasBadge && activeTaskCount > 0 && (
                <span className="badge ml-auto">{activeTaskCount}</span>
              )}
            </NavLink>
          )
        })}
      </div>
    </div>
  )
}

export function Sidebar(): JSX.Element {
  return (
    <div className="w-[210px] h-full flex flex-col bg-[#000] border-r border-[#1c1c1c] flex-shrink-0">
      {/* Logo area */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-[#1c1c1c] drag-region">
        <div className="no-drag">
          <TorchLogo />
        </div>
        <div className="no-drag">
          <div className="text-[16px] font-semibold tracking-[-0.5px]">TORCH</div>
          <div className="font-mono text-[9px] text-[#2a2a2a]">AI AGENT v1</div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-2">
        <NavSection title="WORKSPACE" items={workspaceItems} />
        <NavSection title="INTELLIGENCE" items={intelligenceItems} />
        <NavSection title="TOOLS" items={toolItems} />
      </div>

      {/* Footer */}
      <div className="border-t border-[#1c1c1c] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-[22px] h-[22px] bg-[#1c1c1c] flex items-center justify-center">
            <span className="text-[9px] text-[#666] font-mono">U</span>
          </div>
          <span className="text-[11px] text-[#666]">User</span>
        </div>
        <NavLink to="/settings" className="text-[#444] hover:text-[#888] transition-colors duration-120">
          <IconSettings />
        </NavLink>
      </div>
    </div>
  )
}
