import { useCallback, useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { flushSync } from 'react-dom'
import Autopilot from './Autopilot'
import { Link, Wordmark } from './components'
import { DesktopFooter, Taskbar } from './os'
import { Github } from './icons'
import { GITHUB_URL } from './release'
import type { Route } from './components'
import DownloadPage from './pages/DownloadPage'
import Home from './pages/Home'
import How from './pages/How'
import NotFound from './pages/NotFound'
import Privacy from './pages/Privacy'
import Safety from './pages/Safety'

const ROUTES: Route[] = ['/', '/how', '/safety', '/download', '/privacy']

const TITLES: Record<Route, string> = {
  '/': 'TORCH: the AI agent that uses your computer',
  '/how': 'How it works · TORCH',
  '/safety': 'Safety · TORCH',
  '/download': 'Download TORCH for Windows',
  '/privacy': 'Privacy · TORCH',
  '/404': 'Not found · TORCH'
}

function readRoute(): Route {
  const raw = window.location.hash.replace(/^#/, '')
  if (raw === '' || raw === '/') return '/'
  return (ROUTES as string[]).includes(raw) ? (raw as Route) : '/404'
}

/** Hash routing, with a cross-fade between pages where the browser can. */
function useRouter(): [Route, (to: Route) => void] {
  const [route, setRoute] = useState<Route>(readRoute)

  useEffect(() => {
    const onHash = (): void => {
      const next = readRoute()
      const swap = (): void => {
        flushSync(() => setRoute(next))
        window.scrollTo(0, 0)
      }
      const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
      if (doc.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
        doc.startViewTransition(swap)
      else swap()
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    document.title = TITLES[route]
  }, [route])

  const routeRef = useRef(route)
  routeRef.current = route
  const go = useCallback((to: Route): void => {
    if (to === routeRef.current) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    // Changing the hash fires hashchange, which runs the transition, so the
    // back and forward buttons animate exactly like clicks do.
    window.location.hash = to
  }, [])

  return [route, go]
}

/** Fade elements up as they scroll into view. */
function useReveal(key: string): void {
  useEffect(() => {
    const items = document.querySelectorAll<HTMLElement>('.reveal:not(.is-in)')
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in')
            io.unobserve(entry.target)
          }
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.1 }
    )
    items.forEach((item) => io.observe(item))
    return () => io.disconnect()
  }, [key])
}

export default function App(): JSX.Element {
  const [route, go] = useRouter()
  const [driving, setDriving] = useState(false)
  const onDriving = useCallback((on: boolean) => setDriving(on), [])
  useReveal(route)

  return (
    <div className={`desk ${driving ? 'is-driving' : ''}`}>
      <a
        className="skip"
        href="#/"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('main')?.focus()
        }}
      >
        Skip to content
      </a>
      <header className="deskbar">
        <Link to="/" go={go} className="deskbar__brand" label="TORCH home">
          <Wordmark />
        </Link>
        <span className="deskbar__status">
          <i /> {driving ? 'TORCH is driving' : 'Ready'}
        </span>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="deskbar__gh"
          aria-label="TORCH on GitHub"
        >
          <Github size={18} />
        </a>
      </header>
      <main id="main" className="page" key={route} tabIndex={-1}>
        {route === '/' && <Home go={go} />}
        {route === '/how' && <How go={go} />}
        {route === '/safety' && <Safety go={go} />}
        {route === '/download' && <DownloadPage />}
        {route === '/privacy' && <Privacy />}
        {route === '/404' && <NotFound go={go} />}
      </main>
      <DesktopFooter go={go} />
      <Taskbar route={route} go={go} driving={driving} />
      <Autopilot route={route} go={go} onChange={onDriving} />
    </div>
  )
}
