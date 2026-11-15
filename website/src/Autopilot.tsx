import { useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import type { Go, Route } from './components'
import { Check, Lock, Stop } from './icons'

/*
 * "Let TORCH drive": TORCH gives the visitor a tour of this page the way it
 * works on a PC. The blue glow runs round the browser window, its own cursor
 * moves and clicks, its to-do list ticks along, and it ends by handing the
 * one step that is the visitor's to make (Download) back to them.
 *
 * Any wheel, touch, key or click from the visitor stops it at once: the
 * visitor is always in charge, exactly as with the real app.
 */

const TODOS = [
  'Show you a live task',
  'Walk you through a run',
  'Show the safety rules',
  'Hand you the download'
]

type Cursor = { x: number; y: number; show: boolean; tag: string }

class Stopped extends Error {}

export default function Autopilot({
  route,
  go,
  onChange
}: {
  route: Route
  go: Go
  onChange: (on: boolean) => void
}): JSX.Element {
  const [phase, setPhase] = useState<'off' | 'working' | 'handoff'>('off')
  const [current, setCurrent] = useState(0)
  const [cursor, setCursor] = useState<Cursor>({
    x: window.innerWidth / 2,
    y: window.innerHeight * 0.7,
    show: false,
    tag: ''
  })
  const [clicks, setClicks] = useState(0)
  const run = useRef(0)
  const routeRef = useRef(route)
  routeRef.current = route
  // Held in a ref so a re-render (which makes a new go) never restarts or
  // cancels a tour that is under way.
  const goRef = useRef(go)
  goRef.current = go

  useEffect(() => onChange(phase === 'working'), [phase, onChange])

  useEffect(() => {
    const stop = (): void => {
      run.current += 1
      setPhase('off')
      setCursor((c) => ({ ...c, show: false }))
    }

    const start = async (): Promise<void> => {
      const id = ++run.current
      const alive = (): void => {
        if (run.current !== id) throw new Stopped()
      }
      const wait = (ms: number): Promise<void> =>
        new Promise((resolve, reject) =>
          window.setTimeout(() => (run.current === id ? resolve() : reject(new Stopped())), ms)
        )
      const el = (sel: string): HTMLElement | null => document.querySelector<HTMLElement>(sel)
      const scrollTo = async (
        sel: string,
        block: ScrollLogicalPosition = 'center'
      ): Promise<void> => {
        el(sel)?.scrollIntoView({ behavior: 'smooth', block })
        await wait(1000)
      }
      const moveTo = async (sel: string, tag: string): Promise<HTMLElement | null> => {
        const target = el(sel)
        if (!target) return null
        const box = target.getBoundingClientRect()
        alive()
        setCursor({
          x: box.left + box.width * 0.55,
          y: box.top + box.height * 0.55,
          show: true,
          tag
        })
        await wait(700)
        return target
      }
      const click = async (sel: string): Promise<void> => {
        const target = await moveTo(sel, 'Clicking')
        alive()
        setClicks((n) => n + 1)
        await wait(180)
        target?.click()
        await wait(300)
      }

      try {
        setPhase('working')
        setCurrent(0)
        if (routeRef.current !== '/') {
          goRef.current('/')
          await wait(1100)
        }
        // 1. a live task in the demo window
        await scrollTo('[data-tour="demo"]', 'start')
        await click('[data-tour="tab-calc"]')
        setCursor((c) => ({ ...c, tag: 'Watching' }))
        await wait(5200)

        // 2. the five beats, scrolled through
        setCurrent(1)
        await scrollTo('[data-tour="story"]', 'start')
        setCursor({
          x: window.innerWidth * 0.72,
          y: window.innerHeight * 0.5,
          show: true,
          tag: 'Scrolling'
        })
        for (let i = 0; i < 5; i++) {
          window.scrollBy({ top: window.innerHeight * 0.36, behavior: 'smooth' })
          await wait(1100)
        }

        // 3. the safety rules, with the approval it would ask for
        setCurrent(2)
        await scrollTo('[data-tour="safety"]')
        await moveTo('[data-tour="approve"]', 'Pointing')
        await wait(2200)

        // 4. the download is the visitor's to click, never TORCH's
        setCurrent(3)
        await moveTo('[data-tour="tb-download"]', 'Pointing')
        await wait(500)
        setPhase('handoff')
      } catch (error) {
        if (!(error instanceof Stopped)) throw error
      }
    }

    const onDrive = (): void => void start()
    window.addEventListener('torch:drive', onDrive)
    window.addEventListener('torch:stop', stop)
    return () => {
      window.removeEventListener('torch:drive', onDrive)
      window.removeEventListener('torch:stop', stop)
      run.current += 1
    }
  }, [])

  // The visitor takes over by touching anything.
  useEffect(() => {
    if (phase !== 'working') return
    const takeOver = (e: Event): void => {
      if ((e.target as HTMLElement | null)?.closest?.('.pilot')) return
      window.dispatchEvent(new Event('torch:stop'))
    }
    const events = ['wheel', 'touchstart', 'keydown', 'mousedown'] as const
    events.forEach((name) => window.addEventListener(name, takeOver, { passive: true }))
    return () => events.forEach((name) => window.removeEventListener(name, takeOver))
  }, [phase])

  if (phase === 'off') return <></>

  return (
    <>
      <div className={`pilot-glow ${phase === 'working' ? 'is-on' : ''}`} aria-hidden="true" />
      <div
        className={`pilot-cursor ${cursor.show && phase === 'working' ? 'is-on' : ''}`}
        style={{ left: cursor.x, top: cursor.y }}
        aria-hidden="true"
      >
        {clicks > 0 && (
          <span className="pilot-cursor__blink" key={clicks}>
            <i />
            <i />
          </span>
        )}
        <svg viewBox="0 0 28 32" key={`a${clicks}`}>
          <path d="M2.5 2.2 L24.5 15.4 L14.2 17.4 L20.2 28.6 L15.4 31 L9.6 19.8 L2.5 26.6 Z" />
        </svg>
        <span className="pilot-cursor__tag">TORCH · {cursor.tag}</span>
      </div>
      <aside className="pilot" aria-live="polite">
        <div className="pilot__head">
          <span className={`pilot__dot pilot__dot--${phase}`} />
          <strong>{phase === 'handoff' ? 'Your turn' : 'TORCH is showing you around'}</strong>
        </div>
        {phase === 'handoff' ? (
          <div className="pilot__turn">
            <p>
              <Lock size={13} /> Download is one click away, and it&rsquo;s yours to click. TORCH
              never installs anything for you.
            </p>
            <button
              type="button"
              className="pilot__btn"
              onClick={() => {
                setPhase('off')
                go('/download')
              }}
            >
              Go to Download
            </button>
          </div>
        ) : (
          <p className="pilot__hint">Scroll, click or press any key to take back control.</p>
        )}
        <div className="pilot__todos">
          <div className="pilot__todos-head">
            <span>To-dos</span>
            <span>
              {phase === 'handoff' ? TODOS.length - 1 : current} of {TODOS.length}
            </span>
          </div>
          {TODOS.map((todo, i) => {
            const state =
              i < current
                ? 'done'
                : i === current && phase === 'working'
                  ? 'now'
                  : phase === 'handoff' && i === TODOS.length - 1
                    ? 'turn'
                    : 'next'
            return (
              <div key={todo} className={`pilot__todo is-${state}`}>
                <span>{state === 'done' ? <Check size={10} /> : null}</span>
                {todo}
              </div>
            )
          })}
        </div>
        <button
          type="button"
          className="pilot__stop"
          onClick={() => window.dispatchEvent(new Event('torch:stop'))}
        >
          <Stop size={12} /> {phase === 'handoff' ? 'Close' : 'Stop'}
        </button>
      </aside>
    </>
  )
}
