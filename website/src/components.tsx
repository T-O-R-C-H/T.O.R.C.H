import { useEffect, useState } from 'react'
import type { CSSProperties, JSX, MouseEvent, ReactNode } from 'react'
import { Download as DownloadIcon, Github, Windows } from './icons'
import { GITHUB_URL, useRelease } from './release'

export type Route = '/' | '/how' | '/safety' | '/download' | '/privacy' | '/404'
export type Go = (to: Route) => void

export const delay = (ms: number): CSSProperties => ({ '--d': `${ms}ms` }) as CSSProperties

export function Link({
  to,
  go,
  className,
  children,
  label,
  tour
}: {
  to: Route
  go: Go
  className?: string
  children: ReactNode
  label?: string
  tour?: string
}): JSX.Element {
  const onClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
    event.preventDefault()
    go(to)
  }
  return (
    <a href={`#${to}`} onClick={onClick} className={className} aria-label={label} data-tour={tour}>
      {children}
    </a>
  )
}

export function Wordmark({ className = '' }: { className?: string }): JSX.Element {
  return (
    <img
      className={`wordmark ${className}`}
      src="wordmark.png"
      alt="TORCH"
      width="425"
      height="93"
    />
  )
}

/**
 * "Download for Windows". Goes straight to the installer when a release
 * exists; otherwise to the Download page, which explains where things stand.
 */
export function DownloadButton({
  go,
  size = 'lg',
  tone = 'ink'
}: {
  go: Go
  size?: 'sm' | 'lg'
  tone?: 'ink' | 'light'
}): JSX.Element {
  const release = useRelease()
  const cls = `btn btn--${tone} ${size === 'sm' ? 'btn--sm' : ''}`
  const label = size === 'sm' ? 'Download' : 'Download for Windows'
  if (release.state === 'ready') {
    return (
      <a className={cls} href={release.url} download>
        <Windows size={size === 'sm' ? 13 : 15} /> {label}
      </a>
    )
  }
  return (
    <Link to="/download" go={go} className={cls}>
      {size === 'sm' ? <DownloadIcon size={15} /> : <Windows size={15} />} {label}
    </Link>
  )
}

export function Nav({ route, go }: { route: Route; go: Go }): JSX.Element {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = (): void => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  const links: [Route, string][] = [
    ['/', 'Product'],
    ['/how', 'How it works'],
    ['/safety', 'Safety']
  ]
  return (
    <header className={`nav ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="nav__pill">
        <Link to="/" go={go} className="nav__brand" label="TORCH home">
          <Wordmark />
        </Link>
        <nav className="nav__links" aria-label="Main">
          {links.map(([to, label]) => (
            <Link key={to} to={to} go={go} className={route === to ? 'is-active' : ''}>
              {label}
            </Link>
          ))}
        </nav>
        <DownloadButton go={go} size="sm" />
      </div>
    </header>
  )
}

export function SectionHead({
  kicker,
  title,
  sub,
  align = 'center'
}: {
  kicker: string
  title: ReactNode
  sub?: ReactNode
  align?: 'center' | 'left'
}): JSX.Element {
  return (
    <div className={`shead shead--${align}`}>
      <span className="kicker reveal">{kicker}</span>
      <h2 className="reveal" style={delay(60)}>
        {title}
      </h2>
      {sub && (
        <p className="shead__sub reveal" style={delay(120)}>
          {sub}
        </p>
      )}
    </div>
  )
}

export function Footer({ go }: { go: Go }): JSX.Element {
  return (
    <footer className="footer">
      <div className="footer__top">
        <div className="footer__brand">
          <Wordmark />
          <p>The AI agent that uses your computer for you.</p>
        </div>
        <div className="footer__cols">
          <div>
            <span>Product</span>
            <Link to="/" go={go}>
              Overview
            </Link>
            <Link to="/how" go={go}>
              How it works
            </Link>
            <Link to="/safety" go={go}>
              Safety
            </Link>
            <Link to="/download" go={go}>
              Download
            </Link>
          </div>
          <div>
            <span>Project</span>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a href={`${GITHUB_URL}/releases`} target="_blank" rel="noreferrer">
              Releases
            </a>
            <a href={`${GITHUB_URL}/issues`} target="_blank" rel="noreferrer">
              Report a problem
            </a>
          </div>
          <div>
            <span>Legal</span>
            <Link to="/privacy" go={go}>
              Privacy
            </Link>
            <a href={`${GITHUB_URL}/blob/main/SECURITY.md`} target="_blank" rel="noreferrer">
              Security
            </a>
          </div>
        </div>
      </div>
      <div className="footer__bottom">
        <span>© 2026 TORCH. Built in Ilorin, Nigeria.</span>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="footer__gh"
          aria-label="TORCH on GitHub"
        >
          <Github size={18} />
        </a>
      </div>
    </footer>
  )
}
