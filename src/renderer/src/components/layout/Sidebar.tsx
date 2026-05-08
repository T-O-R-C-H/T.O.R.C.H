import { NavLink, useLocation } from 'react-router-dom'
import {
  Terminal,
  Monitor,
  Clock,
  Brain,
  BarChart3,
  ListChecks,
  Globe,
  FolderOpen,
  MessageSquare,
  Globe2,
  Settings,
  Flame,
  Command
} from 'lucide-react'
import { useTorchStore } from '../../store/torchStore'

const workspaceItems = [
  { path: '/', icon: Command, label: 'Command' },
  { path: '/terminal', icon: Terminal, label: 'Terminal' },
  { path: '/screenwatch', icon: Monitor, label: 'Screen watch' },
  { path: '/history', icon: Clock, label: 'History' }
]

const intelligenceItems = [
  { path: '/memory', icon: Brain, label: 'Memory' },
  { path: '/insights', icon: BarChart3, label: 'Insights' },
  { path: '/tasks', icon: ListChecks, label: 'Tasks', hasBadge: true }
]

const toolItems = [
  { path: '/tools/search', icon: Globe, label: 'Web search' },
  { path: '/tools/files', icon: FolderOpen, label: 'Files' },
  { path: '/tools/messaging', icon: MessageSquare, label: 'Messaging' },
  { path: '/tools/browser', icon: Globe2, label: 'Browser' }
]

function TorchLogo(): JSX.Element {
  return (
    <svg width="28" height="38" viewBox="0 0 28 38" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Handle */}
      <rect x="10" y="20" width="8" height="16" rx="0" fill="#ffffff" opacity="0.9" />
      <rect x="11" y="21" width="6" height="14" rx="0" fill="#1c1c1c" />
      <rect x="12" y="22" width="4" height="12" rx="0" fill="#2a2a2a" />
      {/* Flame outer */}
      <ellipse cx="14" cy="12" rx="10" ry="13" fill="#ffffff" className="torch-flame" opacity="0.95" />
      {/* Flame inner dark */}
      <ellipse cx="14" cy="13" rx="6" ry="9" fill="#000000" />
      {/* Flame core bright */}
      <ellipse cx="14" cy="14" rx="3" ry="5" fill="#ffffff" opacity="0.95" />
      {/* Flame peak */}
      <ellipse cx="14" cy="8" rx="2" ry="3" fill="#ffffff" opacity="0.4" />
    </svg>
  )
}

interface NavSectionProps {
  title: string
  items: { path: string; icon: React.ElementType; label: string; hasBadge?: boolean }[]
}

function NavSection({ title, items }: NavSectionProps): JSX.Element {
  const activeTaskCount = useTorchStore((s) => s.activeTaskCount)

  return (
    <div className="mb-6">
      <div className="label px-4 mb-2">{title}</div>
      <div className="flex flex-col">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `nav-item flex items-center gap-3 px-4 py-2 text-[12px] cursor-pointer ${
                isActive ? 'active text-white' : 'text-[#666]'
              }`
            }
          >
            <item.icon size={14} strokeWidth={1.5} />
            <span>{item.label}</span>
            {item.hasBadge && activeTaskCount > 0 && (
              <span className="badge ml-auto">{activeTaskCount}</span>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  )
}

export function Sidebar(): JSX.Element {
  return (
    <div className="w-[210px] h-full flex flex-col bg-[#000] border-r border-[#1c1c1c] flex-shrink-0">
      {/* Logo area */}
      <div className="flex items-center gap-3 px-4 py-5 drag-region">
        <div className="no-drag">
          <TorchLogo />
        </div>
        <div className="no-drag">
          <div className="text-[13px] font-semibold tracking-[-0.5px]">TORCH</div>
          <div className="mono-xs text-[#444]">v1.0.0</div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-2">
        <NavSection title="WORKSPACE" items={workspaceItems} />
        <NavSection title="INTELLIGENCE" items={intelligenceItems} />
        <NavSection title="TOOLS" items={toolItems} />
      </div>

      {/* Footer */}
      <div className="border-t border-[#1c1c1c] p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#1c1c1c] flex items-center justify-center">
            <span className="text-[9px] text-[#666] font-mono">U</span>
          </div>
          <span className="text-[11px] text-[#666]">User</span>
        </div>
        <NavLink to="/settings" className="text-[#444] hover:text-[#888] transition-colors duration-120">
          <Settings size={14} strokeWidth={1.5} />
        </NavLink>
      </div>
    </div>
  )
}
