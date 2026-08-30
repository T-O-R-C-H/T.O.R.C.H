import { NavLink, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useTorchStore, type Skill } from '../../store/torchStore'
import { API_BASE, torchFetch } from '../../config/api'
import { TorchLogo } from '../ui/TorchLogo'
import { runShortcut } from '../../utils/runShortcut'
import {
  IconMessage,
  IconCalendar,
  IconClock,
  IconInbox,
  IconAdd,
  IconClipboard,
  IconMonitor,
  IconChart,
  IconSettings,
  IconSparkles
} from '../icons'

const iconMap: Record<string, React.ComponentType<{ size?: number }>> = {
  chat: IconMessage,
  today: IconCalendar,
  history: IconClock,
  inbox: IconInbox,
  clipboard: IconClipboard,
  monitor: IconMonitor,
  chart: IconChart,
  skills: IconSparkles
}

interface NavItem {
  path: string
  icon?: string
  label: string
  badge?: number | string
  indicator?: 'green' | 'yellow' | 'red' | 'gray' | 'hollow'
  isAction?: boolean
}

/*
 * Nav indicators and badges are driven by real state or they are not shown.
 * Chat's dot was hardcoded green and Today's was too, so both claimed a
 * healthy connection even while the socket was down; Follow-ups carried a
 * literal badge of 2 that counted nothing at all.
 *
 * Follow-ups and Files are gone from the nav. The Follow-ups page describes
 * a feature that does not exist, and the Files page's Find button has no
 * handler. Their routes are left in place so any existing link still
 * resolves, but the sidebar no longer advertises them as places to go.
 */
const mainItems: NavItem[] = [
  { path: '/', icon: 'chat', label: 'Chat' },
  { path: '/today', icon: 'today', label: 'Today' },
  { path: '/history', icon: 'history', label: 'History' },
  { path: '/skills', icon: 'skills', label: 'Skills' }
]

const workItems: NavItem[] = [{ path: '/inbox', icon: 'inbox', label: 'Inbox' }]

const activityItems: NavItem[] = [
  { path: '/tools/clipboard', icon: 'clipboard', label: 'Clipboard' },
  { path: '/screenwatch', icon: 'monitor', label: 'Screen Watch' },
  { path: '/insights', icon: 'chart', label: 'Insights' }
]

function Indicator({ type }: { type: NavItem['indicator'] }): JSX.Element | null {
  if (!type) return null
  return <span className={`sidebar-indicator sidebar-indicator--${type}`} aria-hidden="true" />
}

function NavList({ items, title }: { items: NavItem[]; title?: string }): JSX.Element {
  return (
    <div className="sidebar-nav-group">
      {title && <div className="sidebar-section-label">{title}</div>}
      {items.map((item) => {
        const Icon = item.icon ? iconMap[item.icon] : null
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar-nav-item ${isActive && !item.isAction ? 'active' : ''} ${item.isAction ? 'sidebar-nav-item--muted' : ''}`
            }
          >
            {Icon && <Icon />}
            <span>{item.label}</span>
            {item.badge !== undefined && <span className="sidebar-badge">{item.badge}</span>}
            {item.indicator && <Indicator type={item.indicator} />}
          </NavLink>
        )
      })}
    </div>
  )
}

export function Sidebar(): JSX.Element {
  const skills = useTorchStore((s) => s.skills)
  const fetchSkills = useTorchStore((s) => s.fetchSkills)
  const demoMode = useTorchStore((s) => s.demoMode)
  const wsConnected = useTorchStore((s) => s.wsConnected)
  const inboxUnread = useTorchStore((s) => s.inboxUnread)
  const screenWatchEnabled = useTorchStore((s) => s.screenWatchEnabled)
  const navigate = useNavigate()

  const [showAddForm, setShowAddForm] = useState(false)
  const [shortcutName, setShortcutName] = useState('')
  const [shortcutCommand, setShortcutCommand] = useState('')
  const [runningShortcutIdsState, setRunningShortcutIdsState] = useState<Set<string>>(
    () => new Set()
  )
  const runningShortcutIds = useRef(new Set<string>())

  const [clipboardCount, setClipboardCount] = useState(0)
  /*
   * This used to read "Pro account" / "Free account", which invented a
   * subscription TORCH does not have - it was only ever reporting whether an
   * AI key was configured. It now says what it actually knows.
   */
  const [aiReady, setAiReady] = useState(false)

  useEffect(() => {
    const loadClipboardCount = async (): Promise<void> => {
      const entries = await window.torchAPI?.getClipboardEntries?.()
      if (entries) setClipboardCount(entries.length)
    }
    void loadClipboardCount()
    const timer = setInterval(() => {
      void loadClipboardCount()
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (demoMode) {
      queueMicrotask(() => setAiReady(false))
      return
    }
    let cancelled = false
    torchFetch(`${API_BASE}/api/settings`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setAiReady(
            Boolean(
              data.gemini_configured ||
              data.openai_configured ||
              data.anthropic_configured ||
              data.deepseek_configured
            )
          )
        }
      })
      .catch(() => {
        if (!cancelled) setAiReady(false)
      })
    return (): void => {
      cancelled = true
    }
  }, [demoMode, wsConnected])

  useEffect(() => {
    fetchSkills()
  }, [demoMode, fetchSkills])

  const handleShortcutClick = async (
    shortcut: Skill | { name: string; command: string }
  ): Promise<void> => {
    const shortcutId = 'id' in shortcut ? shortcut.id : shortcut.name
    if (runningShortcutIds.current.has(shortcutId)) return
    runningShortcutIds.current.add(shortcutId)
    setRunningShortcutIdsState((current) => new Set(current).add(shortcutId))
    if ('id' in shortcut && !shortcut.id.startsWith('demo') && !demoMode) {
      try {
        const result = await runShortcut(shortcut.id)
        await fetchSkills()
        navigate('/chat', { state: { runCommand: result.command } })
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : 'Error running shortcut')
      } finally {
        runningShortcutIds.current.delete(shortcutId)
        setRunningShortcutIdsState((current) => {
          const next = new Set(current)
          next.delete(shortcutId)
          return next
        })
      }
      return
    }
    navigate('/chat', { state: { runCommand: shortcut.command } })
    runningShortcutIds.current.delete(shortcutId)
    setRunningShortcutIdsState((current) => {
      const next = new Set(current)
      next.delete(shortcutId)
      return next
    })
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
      const response = await torchFetch(`${API_BASE}/api/skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error saving shortcut')
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

  const userName = localStorage.getItem('torch_user_name') || 'User'

  return (
    <aside className="sidebar">
      <div className="sidebar-header drag-region">
        <div className="no-drag">
          <TorchLogo width={88} />
        </div>
      </div>

      <div className="sidebar-body">
        <NavList
          items={mainItems.map((item) =>
            /* The only dot that means anything: whether TORCH can be reached. */
            item.path === '/' ? { ...item, indicator: wsConnected ? 'green' : 'red' } : item
          )}
        />
        <NavList
          title="Work"
          items={workItems.map((item) =>
            item.path === '/inbox' && inboxUnread > 0 ? { ...item, badge: inboxUnread } : item
          )}
        />

        <div className="sidebar-nav-group">
          <div className="sidebar-section-label">Shortcuts</div>
          {displayedShortcuts.map((shortcut) => (
            <button
              key={'id' in shortcut ? shortcut.id : shortcut.name}
              type="button"
              onClick={() => void handleShortcutClick(shortcut)}
              disabled={runningShortcutIdsState.has('id' in shortcut ? shortcut.id : shortcut.name)}
              aria-busy={runningShortcutIdsState.has(
                'id' in shortcut ? shortcut.id : shortcut.name
              )}
              className="sidebar-nav-item sidebar-nav-item--shortcut"
            >
              <span>
                {runningShortcutIdsState.has('id' in shortcut ? shortcut.id : shortcut.name)
                  ? `${shortcut.name}…`
                  : shortcut.name}
              </span>
              <span className="sidebar-play">▶</span>
            </button>
          ))}

          {skills.length > 5 && (
            <NavLink to="/skills" className="sidebar-nav-item sidebar-nav-item--muted">
              <IconSparkles />
              <span>See all</span>
            </NavLink>
          )}

          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="sidebar-nav-item sidebar-nav-item--muted"
          >
            <IconAdd />
            <span>Add shortcut</span>
          </button>

          {showAddForm && (
            <form onSubmit={handleSaveShortcut} className="sidebar-shortcut-form">
              <input
                type="text"
                placeholder="Shortcut name"
                value={shortcutName}
                onChange={(e) => setShortcutName(e.target.value)}
              />
              <input
                type="text"
                placeholder="Command"
                value={shortcutCommand}
                onChange={(e) => setShortcutCommand(e.target.value)}
              />
              <button
                type="submit"
                className="btn-primary"
                style={{ fontSize: 11, padding: '5px 10px' }}
              >
                Save
              </button>
            </form>
          )}
        </div>

        <NavList
          title="Activity"
          items={activityItems.map((item) => {
            if (item.path === '/tools/clipboard' && clipboardCount > 0) {
              return { ...item, badge: clipboardCount }
            }
            /* Shown only while it is genuinely watching, so an unlit row
               means watching is off rather than meaning nothing. */
            if (item.path === '/screenwatch' && screenWatchEnabled) {
              return { ...item, indicator: 'green' as const }
            }
            return item
          })}
        />
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-footer__row">
          <div className="sidebar-user">
            <div className="sidebar-user__avatar">{userName.charAt(0).toUpperCase()}</div>
            <div className="sidebar-user__meta">
              <span className="sidebar-user__name">{userName}</span>
              <span
                className={`sidebar-user__tier sidebar-user__tier--${aiReady ? 'ready' : 'setup'}`}
              >
                {aiReady ? 'Ready' : 'Needs setup'}
              </span>
            </div>
          </div>
          <NavLink to="/settings" className="sidebar-settings-btn" aria-label="Settings">
            <IconSettings />
          </NavLink>
        </div>
      </div>
    </aside>
  )
}
