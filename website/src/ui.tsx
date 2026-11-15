import { useEffect, useRef, useState } from 'react'
import type { JSX, MouseEvent, ReactNode } from 'react'
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform
} from 'motion/react'
import { Download, Github, Windows } from './icons'
import { DOWNLOAD_URL, GITHUB_URL } from './release'

export type Route = '/' | '/how' | '/safety' | '/download' | '/privacy' | '/404'
export type Go = (to: Route) => void

export const EASE = [0.22, 1, 0.36, 1] as const

export function Link({
  to,
  go,
  className,
  children,
  label
}: {
  to: Route
  go: Go
  className?: string
  children: ReactNode
  label?: string
}): JSX.Element {
  const onClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
    event.preventDefault()
    go(to)
  }
  return (
    <a href={`#${to}`} onClick={onClick} className={className} aria-label={label}>
      {children}
    </a>
  )
}

/* ------------------------------------------------------------ motion */

/** Fades and lifts its children in when they scroll into view. */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
  as = 'div'
}: {
  children: ReactNode
  delay?: number
  y?: number
  className?: string
  as?: 'div' | 'li' | 'section' | 'article'
}): JSX.Element {
  const Tag = motion[as]
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={{ duration: 0.9, ease: EASE, delay }}
    >
      {children}
    </Tag>
  )
}

/** A headline that arrives word by word, each one sharpening out of a blur. */
export function Words({
  text,
  className,
  delay = 0,
  as = 'h2'
}: {
  text: string
  className?: string
  delay?: number
  as?: 'h1' | 'h2'
}): JSX.Element {
  const Tag = motion[as]
  const lines = text.split('\n')
  let index = 0
  return (
    <Tag
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
    >
      {lines.map((line, l) => (
        <span key={l} className="words__line">
          {line.split(' ').map((word, w, all) => {
            const i = index++
            // A real space between words (and lines), so the heading reads
            // as words to screen readers and when copied, not one run-on.
            const gap = w < all.length - 1 || l < lines.length - 1 ? ' ' : ''
            return (
              <motion.span
                key={`${word}-${i}`}
                className="words__word"
                variants={{
                  hidden: { opacity: 0, y: '0.45em', filter: 'blur(12px)' },
                  show: {
                    opacity: 1,
                    y: 0,
                    filter: 'blur(0px)',
                    transition: { duration: 0.8, ease: EASE, delay: delay + i * 0.06 }
                  }
                }}
              >
                {word}
                {gap && <span className="words__gap">{gap}</span>}
              </motion.span>
            )
          })}
        </span>
      ))}
    </Tag>
  )
}

/** Text that lights up word by word as you scroll past it. */
export function ScrollText({ text }: { text: string }): JSX.Element {
  const ref = useRef<HTMLParagraphElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'end 0.45'] })
  const words = text.split(' ')
  return (
    <p ref={ref} className="scrolltext">
      {words.map((word, i) => {
        const start = i / words.length
        return (
          <ScrollWord
            key={i}
            word={word}
            progress={scrollYProgress}
            range={[start, start + 1 / words.length]}
          />
        )
      })}
    </p>
  )
}

function ScrollWord({
  word,
  progress,
  range
}: {
  word: string
  progress: ReturnType<typeof useScroll>['scrollYProgress']
  range: [number, number]
}): JSX.Element {
  const opacity = useTransform(progress, range, [0.16, 1])
  return <motion.span style={{ opacity }}>{word} </motion.span>
}

export function CountUp({ to, suffix = '' }: { to: number; suffix?: string }): JSX.Element {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!inView) return
    const controls = animate(0, to, {
      duration: 1.6,
      ease: EASE,
      onUpdate: (v) => setN(Math.round(v))
    })
    return () => controls.stop()
  }, [inView, to])
  return (
    <span ref={ref}>
      {n}
      {suffix}
    </span>
  )
}

/** A card whose border and surface light up around the pointer. */
export function Spotlight({
  children,
  className = ''
}: {
  children: ReactNode
  className?: string
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const onMove = (e: MouseEvent<HTMLDivElement>): void => {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    ref.current?.style.setProperty('--mx', `${e.clientX - box.left}px`)
    ref.current?.style.setProperty('--my', `${e.clientY - box.top}px`)
  }
  return (
    <div ref={ref} className={`spot ${className}`} onMouseMove={onMove}>
      {children}
    </div>
  )
}

/** Leans toward the pointer a little, the way Framer's buttons do. */
export function Magnetic({ children }: { children: ReactNode }): JSX.Element {
  const ref = useRef<HTMLSpanElement>(null)
  const x = useSpring(useMotionValue(0), { stiffness: 260, damping: 18 })
  const y = useSpring(useMotionValue(0), { stiffness: 260, damping: 18 })
  return (
    <motion.span
      ref={ref}
      className="magnetic"
      style={{ x, y }}
      onMouseMove={(e) => {
        const box = ref.current?.getBoundingClientRect()
        if (!box) return
        x.set((e.clientX - box.left - box.width / 2) * 0.22)
        y.set((e.clientY - box.top - box.height / 2) * 0.3)
      }}
      onMouseLeave={() => {
        x.set(0)
        y.set(0)
      }}
    >
      {children}
    </motion.span>
  )
}

export function Marquee({
  children,
  reverse = false,
  speed = 40
}: {
  children: ReactNode
  reverse?: boolean
  speed?: number
}): JSX.Element {
  return (
    <div className="marquee">
      <div
        className={`marquee__track ${reverse ? 'is-reverse' : ''}`}
        style={{ animationDuration: `${speed}s` }}
      >
        <div className="marquee__group">{children}</div>
        <div className="marquee__group" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- buttons */

/** The real thing: clicking it downloads the newest TORCH installer. */
export function DownloadButton({
  size = 'lg',
  label
}: {
  size?: 'sm' | 'lg'
  label?: string
}): JSX.Element {
  return (
    <Magnetic>
      <a
        className={`btn btn--white ${size === 'sm' ? 'btn--sm' : ''}`}
        href={DOWNLOAD_URL}
        download
      >
        {size === 'sm' ? <Download size={15} /> : <Windows size={15} />}
        {label ?? (size === 'sm' ? 'Download' : 'Download for Windows')}
      </a>
    </Magnetic>
  )
}

export function Kicker({ children }: { children: ReactNode }): JSX.Element {
  return (
    <Reveal className="kicker" y={10}>
      <span className="kicker__dot" />
      {children}
    </Reveal>
  )
}

export function SectionHead({
  kicker,
  title,
  sub
}: {
  kicker: string
  title: string
  sub?: string
}): JSX.Element {
  return (
    <div className="shead">
      <Kicker>{kicker}</Kicker>
      <Words text={title} className="h2" />
      {sub && (
        <Reveal delay={0.15}>
          <p className="shead__sub">{sub}</p>
        </Reveal>
      )}
    </div>
  )
}

/* -------------------------------------------------------- nav, footer */

export function Nav({ route, go }: { route: Route; go: Go }): JSX.Element {
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => scrollY.on('change', (v) => setScrolled(v > 24)), [scrollY])
  const links: [Route, string][] = [
    ['/', 'Product'],
    ['/how', 'How it works'],
    ['/safety', 'Safety'],
    ['/download', 'Download']
  ]
  return (
    <motion.header
      className={`nav ${scrolled ? 'is-scrolled' : ''}`}
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: EASE }}
    >
      <div className="nav__inner">
        <Link to="/" go={go} className="nav__brand" label="TORCH home">
          <img src="icon.png" alt="" width="26" height="26" />
          <span>TORCH</span>
        </Link>
        <nav className="nav__links" aria-label="Main">
          {links.map(([to, label]) => (
            <Link key={to} to={to} go={go} className={route === to ? 'is-active' : ''}>
              {route === to && (
                <motion.span
                  layoutId="nav-pill"
                  className="nav__pill"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <span className="nav__text">{label}</span>
            </Link>
          ))}
        </nav>
        <div className="nav__right">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="nav__gh"
            aria-label="TORCH on GitHub"
          >
            <Github size={18} />
          </a>
          <DownloadButton size="sm" />
        </div>
      </div>
    </motion.header>
  )
}

export function Footer({ go }: { go: Go }): JSX.Element {
  return (
    <footer className="footer">
      <div className="footer__grid">
        <div className="footer__brand">
          <div className="footer__logo">
            <img src="icon.png" alt="" width="28" height="28" />
            <span>TORCH</span>
          </div>
          <p>The AI agent that uses your computer for you.</p>
          <span className="footer__status">
            <i /> All systems normal
          </span>
        </div>
        <div className="footer__col">
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
        <div className="footer__col">
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
        <div className="footer__col">
          <span>Legal</span>
          <Link to="/privacy" go={go}>
            Privacy
          </Link>
          <a href={`${GITHUB_URL}/blob/main/SECURITY.md`} target="_blank" rel="noreferrer">
            Security
          </a>
        </div>
      </div>
      <div className="footer__big" aria-hidden="true">
        TORCH
      </div>
      <div className="footer__bottom">
        <span>© 2026 TORCH. Built in Ilorin, Nigeria.</span>
        <span>Windows 10 &amp; 11</span>
      </div>
    </footer>
  )
}
