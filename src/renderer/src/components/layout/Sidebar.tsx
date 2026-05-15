import { NavLink } from 'react-router-dom'
import { useTorchStore } from '../../store/torchStore'
import { TorchLogo } from '../ui/TorchLogo'

/* ═══════════════════════════════════════════════════════════════
   TORCH SIDEBAR — v2 Redesign
   260px · #000 · sharp · desktop-native density
   ═══════════════════════════════════════════════════════════════ */

import { 
  IconMessage, 
  IconCalendar, 
  IconClock, 
  IconInbox, 
  IconFolder, 
  IconFile, 
  IconPlay, 
  IconAdd, 
  IconClipboard, 
  IconMonitor, 
  IconChart, 
  IconTerminal, 
  IconSettings 
} from '../icons'

/* ═══════════════════════════════════════════════════════════════
   TORCH SIDEBAR — v2 Redesign
   260px · #000 · sharp · desktop-native density
   ═══════════════════════════════════════════════════════════════ */

/* ─── ICON MAP ─── */
const iconMap: Record<string, React.ComponentType<{ size?: number }>> = {
  chat: IconMessage,
  today: IconCalendar,
  history: IconClock,
  inbox: IconInbox,
  files: IconFolder,
  followups: IconFile,
  shortcut: IconPlay,
  plus: IconAdd,
  clipboard: IconClipboard,
  monitor: IconMonitor,
  chart: IconChart,
  terminal: IconTerminal,
}

interface NavItem {
  path: string
  icon?: string
  label: string
  badge?: number | string
  indicator?: 'green' | 'yellow' | 'red' | 'gray' | 'hollow'
  isAction?: boolean
}

const mainItems: NavItem[] = [
  { path: '/', icon: 'chat', label: 'Chat', indicator: 'green' },
  { path: '/today', icon: 'today', label: 'Today', indicator: 'green' },
  { path: '/history', icon: 'history', label: 'History' }
]

const workItems: NavItem[] = [
  { path: '/inbox', icon: 'inbox', label: 'Inbox', badge: 3 },
  { path: '/tools/files', icon: 'files', label: 'Files' },
  { path: '/follow-ups', icon: 'followups', label: 'Follow-ups', badge: 2 }
]

const shortcutItems: NavItem[] = [
  { path: '/action/check-emails', icon: 'shortcut', label: 'Check my emails', indicator: 'green' },
  { path: '/action/post-update', icon: 'shortcut', label: 'Post an update', indicator: 'yellow' },
  { path: '/action/find-file', icon: 'shortcut', label: 'Find a file', indicator: 'green' },
  { path: '/action/add', icon: 'plus', label: 'Add shortcut', isAction: true }
]

const activityItems: NavItem[] = [
  { path: '/tools/clipboard', icon: 'clipboard', label: 'Clipboard', badge: 12 },
  { path: '/screenwatch', icon: 'monitor', label: 'Screen Watch', indicator: 'hollow' },
  { path: '/insights', icon: 'chart', label: 'Insights' }
]

/* ─── COMPONENTS ─── */
function Indicator({ type }: { type: NavItem['indicator'] }) {
  if (!type) return null
  const colors = {
    green: '#22c55e',
    yellow: '#eab308',
    red: '#ef4444',
    gray: '#555555',
    hollow: 'transparent'
  }
  const isHollow = type === 'hollow'
  return (
    <div style={{
      width: '6px',
      height: '6px',
      borderRadius: '50%',
      background: isHollow ? 'transparent' : colors[type],
      border: isHollow ? '1px solid #555' : 'none',
      marginLeft: 'auto'
    }} />
  )
}

function NavList({ items, title }: { items: NavItem[], title?: string }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      {title && <div className="sidebar-section-label">{title}</div>}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map((item) => {
          const Icon = item.icon ? iconMap[item.icon] : null
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `sidebar-nav-item ${isActive && !item.isAction ? 'active' : ''}`
              }
              style={{
                color: item.isAction ? '#888' : undefined
              }}
            >
              {Icon && <Icon />}
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span style={{
                  marginLeft: 'auto',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '9px',
                  fontWeight: 500,
                  color: '#7a7a7a',
                }}>{item.badge}</span>
              )}
              {item.indicator && <Indicator type={item.indicator} />}
            </NavLink>
          )
        })}
      </div>
    </div>
  )
}

export function Sidebar(): JSX.Element {
  return (
    <div style={{
      width: '260px',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#000000',
      borderRight: '1px solid #161616',
      flexShrink: 0,
    }}>

      {/* ─── LOGO AREA ─── */}
      <div
        className="drag-region"
        style={{
          height: '76px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          padding: '0 24px',
          borderBottom: '1px solid #121212',
          flexShrink: 0,
        }}
      >
        <div className="no-drag" style={{ paddingTop: '2px' }}>
          <TorchLogo size={32} />
        </div>
        <div className="no-drag">
          <div style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: '15px',
            fontWeight: 600,
            color: '#ffffff',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
          }}>
            TORCH
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '9px',
              fontWeight: 500,
              color: '#555555',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}>
              AI OPERATING SYSTEM
            </div>
          </div>
        </div>
      </div>

      {/* ─── NAVIGATION ─── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        paddingTop: '16px',
        paddingBottom: '16px',
      }}>
        <NavList items={mainItems} />
        <NavList title="WORK" items={workItems} />
        <NavList title="SHORTCUTS" items={shortcutItems} />
        <NavList title="ACTIVITY" items={activityItems} />
      </div>

      {/* ─── FOOTER ─── */}
      <div style={{
        borderTop: '1px solid #121212',
        background: '#050505',
        padding: '12px 0',
        flexShrink: 0,
      }}>
        <NavLink to="/terminal" className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}>
          <IconTerminal />
          <span>Terminal</span>
        </NavLink>
        
        <div style={{ padding: '0 20px', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* User info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              background: '#111111',
              border: '1px solid #1d1d1d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', fontWeight: 600, color: '#666' }}>U</span>
            </div>
            <div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', fontWeight: 500, color: '#f5f5f5', lineHeight: 1 }}>User</div>
            </div>
          </div>

          <NavLink
            to="/settings"
            style={{
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#444',
              background: 'transparent',
              border: '1px solid transparent',
              transition: 'all 120ms ease',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement
              el.style.background = '#0d0d0d'
              el.style.borderColor = '#1d1d1d'
              el.style.color = '#ffffff'
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement
              el.style.background = 'transparent'
              el.style.borderColor = 'transparent'
              el.style.color = '#444'
            }}
          >
            <IconSettings />
          </NavLink>
        </div>
      </div>
    </div>
  )
}
