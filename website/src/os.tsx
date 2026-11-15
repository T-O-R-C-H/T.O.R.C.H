import { useEffect, useRef, useState } from 'react'
import type { FormEvent, JSX, ReactNode } from 'react'
import { DownloadButton, Link } from './components'
import type { Go, Route } from './components'
import {
  Arrow,
  Download,
  FileText,
  Github,
  Home as HomeIcon,
  Lock,
  Pointer,
  Shield,
  Sparkle,
  Wheel
} from './icons'
import { GITHUB_URL } from './release'
import type { SceneId } from './Demo'

/* ------------------------------------------------------------ window */

/**
 * Every section of the site is an app window on TORCH's desktop. The
 * title-bar buttons work: close sends you back to the desktop's home,
 * minimise folds the window down to its title bar.
 */
export function Window({
  title,
  icon,
  children,
  go,
  tone = 'light',
  className = '',
  tour
}: {
  title: string
  icon?: JSX.Element
  children: ReactNode
  go?: Go
  tone?: 'light' | 'dark'
  className?: string
  tour?: string
}): JSX.Element {
  const [min, setMin] = useState(false)
  return (
    <section
      className={`oswin oswin--${tone} reveal ${min ? 'is-min' : ''} ${className}`}
      data-tour={tour}
    >
      <div className="oswin__bar">
        <span className="oswin__icon">{icon ?? <Sparkle size={13} />}</span>
        <span className="oswin__title">{title}</span>
        <span className="oswin__ctrls">
          <button
            type="button"
            aria-label={min ? 'Restore window' : 'Minimise window'}
            onClick={() => setMin(!min)}
          >
            <svg viewBox="0 0 10 10">
              <path d="M1 5h8" />
            </svg>
          </button>
          <button type="button" aria-label="Maximise window" tabIndex={-1} aria-hidden="true">
            <svg viewBox="0 0 10 10">
              <rect x="1.5" y="1.5" width="7" height="7" />
            </svg>
          </button>
          <button
            type="button"
            className="oswin__close"
            aria-label="Close window"
            onClick={() => (go ? go('/') : setMin(true))}
          >
            <svg viewBox="0 0 10 10">
              <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" />
            </svg>
          </button>
        </span>
      </div>
      <div className="oswin__body">{children}</div>
    </section>
  )
}

/* ------------------------------------------------------- command bar */

const SUGGESTIONS = [
  'Find the cheapest laptop and check out',
  'Work out 128 × 24',
  'Write a poem about Lagos and save it'
]

function sceneFor(text: string): SceneId {
  const t = text.toLowerCase()
  if (/\d\s*[x×*+\-/÷]\s*\d|calc|math|work out|add up|sum|percent/.test(t)) return 'calc'
  if (/buy|shop|cheap|cart|order|price|laptop|checkout|store|amazon|jumia/.test(t)) return 'shop'
  return 'notes'
}

/** Type a request; the demo window acts it out with the closest task. */
export function CommandBar(): JSX.Element {
  const [value, setValue] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const run = (text: string): void => {
    const prompt = text.trim()
    if (!prompt) {
      input.current?.focus()
      return
    }
    window.dispatchEvent(
      new CustomEvent('torch:try', { detail: { scene: sceneFor(prompt), prompt } })
    )
    document
      .querySelector('[data-tour="demo"]')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setValue('')
  }
  const onSubmit = (event: FormEvent): void => {
    event.preventDefault()
    run(value)
  }
  return (
    <div className="cmd">
      <form className="cmd__bar" onSubmit={onSubmit}>
        <span className="cmd__prompt">›</span>
        <input
          ref={input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Tell TORCH what to do…"
          aria-label="Tell TORCH what to do"
          maxLength={90}
        />
        <kbd className="cmd__kbd">Enter</kbd>
        <button type="submit" className="cmd__go" aria-label="Run">
          <Arrow size={16} />
        </button>
      </form>
      <div className="cmd__chips">
        <span>Try</span>
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" onClick={() => run(s)}>
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ----------------------------------------------------------- taskbar */

function Clock(): JSX.Element {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 15000)
    return () => window.clearInterval(t)
  }, [])
  return (
    <span className="tb__clock">
      <b>{now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</b>
      <small>{now.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</small>
    </span>
  )
}

const APPS: { to: Route; label: string; icon: JSX.Element }[] = [
  { to: '/', label: 'Overview', icon: <HomeIcon size={17} /> },
  { to: '/how', label: 'How it works', icon: <Pointer size={17} /> },
  { to: '/safety', label: 'Safety', icon: <Shield size={17} /> },
  { to: '/download', label: 'Download', icon: <Download size={17} /> }
]

export function Taskbar({
  route,
  go,
  driving
}: {
  route: Route
  go: Go
  driving: boolean
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const menu = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (!menu.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => setOpen(false), [route])

  return (
    <div className="tb" ref={menu}>
      {open && (
        <div className="start" role="menu">
          <div className="start__head">
            <img src="icon.png" alt="" width="36" height="36" />
            <div>
              <strong>TORCH</strong>
              <span>The AI agent that uses your computer</span>
            </div>
          </div>
          <div className="start__grid">
            {APPS.map((app) => (
              <Link key={app.to} to={app.to} go={go} className="start__app">
                <span>{app.icon}</span>
                {app.label}
              </Link>
            ))}
            <Link to="/privacy" go={go} className="start__app">
              <span>
                <Lock size={17} />
              </span>
              Privacy
            </Link>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="start__app">
              <span>
                <Github size={17} />
              </span>
              GitHub
            </a>
          </div>
          <div className="start__foot">
            <DownloadButton go={go} />
          </div>
        </div>
      )}
      <nav className="tb__bar" aria-label="Main">
        <button
          type="button"
          className={`tb__start ${open ? 'is-open' : ''}`}
          onClick={() => setOpen(!open)}
          aria-label="Start menu"
          aria-expanded={open}
        >
          <img src="icon.png" alt="" width="26" height="26" />
        </button>
        <span className="tb__sep" />
        {APPS.map((app) => (
          <Link
            key={app.to}
            to={app.to}
            go={go}
            className={`tb__app ${route === app.to ? 'is-active' : ''}`}
            label={app.label}
            tour={app.to === '/download' ? 'tb-download' : undefined}
          >
            {app.icon}
            <span className="tb__label">{app.label}</span>
          </Link>
        ))}
        <span className="tb__sep" />
        <button
          type="button"
          className={`tb__drive ${driving ? 'is-on' : ''}`}
          onClick={() => window.dispatchEvent(new Event(driving ? 'torch:stop' : 'torch:drive'))}
        >
          <Wheel size={15} />
          <span>{driving ? 'Stop' : 'Let TORCH drive'}</span>
        </button>
        <Clock />
      </nav>
    </div>
  )
}

export function DesktopFooter({ go }: { go: Go }): JSX.Element {
  return (
    <footer className="dfoot">
      <span>© 2026 TORCH · Built in Ilorin, Nigeria</span>
      <nav>
        <Link to="/privacy" go={go}>
          Privacy
        </Link>
        <a href={GITHUB_URL} target="_blank" rel="noreferrer">
          GitHub
        </a>
        <a href={`${GITHUB_URL}/blob/main/SECURITY.md`} target="_blank" rel="noreferrer">
          Security
        </a>
        <a href={`${GITHUB_URL}/issues`} target="_blank" rel="noreferrer">
          Report a problem
        </a>
      </nav>
    </footer>
  )
}

export { FileText }
