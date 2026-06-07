import { NavLink, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useTorchStore, type Skill } from '../../store/torchStore'
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
  IconSettings,
  IconSparkles
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
  skills: IconSparkles,
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
  { path: '/history', icon: 'history', label: 'History' },
  { path: '/skills', icon: 'skills', label: 'Skills' }
]

const workItems: NavItem[] = [
  { path: '/inbox', icon: 'inbox', label: 'Inbox', badge: 3 },
  { path: '/tools/files', icon: 'files', label: 'Files' },
  { path: '/follow-ups', icon: 'followups', label: 'Follow-ups', badge: 2 }
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
  const skills = useTorchStore((s) => s.skills)
  const fetchSkills = useTorchStore((s) => s.fetchSkills)
  const demoMode = useTorchStore((s) => s.demoMode)
  const navigate = useNavigate()

  const [showAddForm, setShowAddForm] = useState(false)
  const [shortcutName, setShortcutName] = useState('')
  const [shortcutCommand, setShortcutCommand] = useState('')

  useEffect(() => {
    fetchSkills()
  }, [demoMode])

  const handleShortcutClick = async (shortcut: Skill | { name: string; command: string }): Promise<void> => {
    if ('id' in shortcut && !shortcut.id.startsWith('demo') && !demoMode) {
      try {
        const response = await fetch(`http://localhost:8000/api/skills/${shortcut.id}/run`, {
          method: 'POST'
        })
        if (response.ok) {
          await fetchSkills()
        }
      } catch (err) {
        console.error('Error running shortcut:', err)
      }
    }
    navigate('/chat', { state: { runCommand: shortcut.command } })
  }

  const handleSaveShortcut = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!shortcutName.trim() || !shortcutCommand.trim()) {
      alert('Name and command cannot be empty')
      return
    }

    if (demoMode) {
      const newSkill: Skill = {
        id: `demo-${Date.now()}`,
        name: shortcutName.trim(),
        command: shortcutCommand.trim(),
        created_at: new Date().toISOString(),
        run_count: 0
      }
      useTorchStore.setState({ skills: [newSkill, ...skills] })
      setShortcutName('')
      setShortcutCommand('')
      setShowAddForm(false)
      return
    }

    try {
      const response = await fetch('http://localhost:8000/api/skills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: shortcutName.trim(),
          command: shortcutCommand.trim()
        })
      })
      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.detail || 'Failed to create skill')
      }
      await fetchSkills()
      setShortcutName('')
      setShortcutCommand('')
      setShowAddForm(false)
    } catch (err: any) {
      alert(err.message || 'Error saving shortcut')
    }
  }

  const hasSkills = skills.length > 0
  const displayedShortcuts = hasSkills
    ? skills.slice(0, 5)
    : [
        { name: 'Check my emails', command: 'Check my emails' },
        { name: 'Post an update', command: 'Post an update' },
        { name: 'Find a file', command: 'Find a file' }
      ]

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
        
        {/* SHORTCUTS */}
        <div style={{ marginBottom: '16px' }}>
          <div className="sidebar-section-label">SHORTCUTS</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {displayedShortcuts.map((shortcut) => (
              <button
                key={'id' in shortcut ? shortcut.id : shortcut.name}
                onClick={(): Promise<void> => handleShortcutClick(shortcut)}
                className="sidebar-nav-item"
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer'
                }}
              >
                <span>{shortcut.name}</span>
                <span style={{ fontSize: '8px', color: '#555' }}>▶</span>
              </button>
            ))}

            {/* See all (only if more than 5 skills) */}
            {skills.length > 5 && (
              <NavLink
                to="/skills"
                className="sidebar-nav-item"
                style={{ color: '#888' }}
              >
                <IconSparkles />
                <span>See all</span>
              </NavLink>
            )}

            {/* Add shortcut button */}
            <button
              onClick={(): void => setShowAddForm(!showAddForm)}
              className="sidebar-nav-item"
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                color: '#888',
                cursor: 'pointer'
              }}
            >
              <IconAdd />
              <span>Add shortcut</span>
            </button>

            {/* Add shortcut inline form */}
            {showAddForm && (
              <form onSubmit={handleSaveShortcut} style={{ padding: '8px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Shortcut Name"
                  value={shortcutName}
                  onChange={(e): void => setShortcutName(e.target.value)}
                  style={{
                    background: '#0a0a0a',
                    border: '1px solid #1a1a1a',
                    color: '#fff',
                    fontSize: '11px',
                    padding: '6px 10px',
                    width: '100%'
                  }}
                />
                <input
                  type="text"
                  placeholder="Command"
                  value={shortcutCommand}
                  onChange={(e): void => setShortcutCommand(e.target.value)}
                  style={{
                    background: '#0a0a0a',
                    border: '1px solid #1a1a1a',
                    color: '#fff',
                    fontSize: '11px',
                    padding: '6px 10px',
                    width: '100%'
                  }}
                />
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: '4px 10px', fontSize: '10px', justifyContent: 'center' }}
                >
                  Save
                </button>
              </form>
            )}
          </div>
        </div>

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
