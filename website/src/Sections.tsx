import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, JSX, ReactNode, RefObject } from 'react'
import { Calculator, Cart, Check, FileText, Hand, Play, Pointer, Sparkle } from './icons'

const d = (ms: number): CSSProperties => ({ '--d': `${ms}ms` }) as CSSProperties

/** True once the element has scrolled into view. */
function useSeen<T extends Element>(): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && setSeen(true), {
      threshold: 0.3
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return [ref, seen]
}

function SectionHead({
  kicker,
  title,
  sub
}: {
  kicker: string
  title: ReactNode
  sub?: string
}): JSX.Element {
  return (
    <div className="shead">
      <span className="eyebrow reveal">{kicker}</span>
      <h2 className="reveal" style={d(60)}>
        {title}
      </h2>
      {sub && (
        <p className="shead__sub reveal" style={d(120)}>
          {sub}
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------ numbers */

function CountUp({
  to,
  run,
  suffix = ''
}: {
  to: number
  run: boolean
  suffix?: string
}): JSX.Element {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!run) return
    let frame = 0
    const start = performance.now()
    const tick = (now: number): void => {
      const t = Math.min(1, (now - start) / 1400)
      setN(Math.round(to * (1 - Math.pow(1 - t, 4))))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [run, to])
  return (
    <>
      {n}
      {suffix}
    </>
  )
}

export function Numbers(): JSX.Element {
  const [ref, seen] = useSeen<HTMLDivElement>()
  const items = [
    { to: 16, suffix: '', label: 'steps to find and play a song, ad skipped' },
    { to: 60, suffix: '', label: 'looks it can take on one task' },
    { to: 2, suffix: 's', label: 'to stop, whenever you press Stop' },
    { to: 0, suffix: '', label: 'card numbers it will ever type' }
  ]
  return (
    <section className="numbers" ref={ref}>
      {items.map((item, i) => (
        <div key={item.label} className="numbers__item reveal" style={d(i * 70)}>
          <strong>
            <CountUp to={item.to} run={seen} suffix={item.suffix} />
          </strong>
          <span>{item.label}</span>
        </div>
      ))}
    </section>
  )
}

/* ---------------------------------------------------------- use cases */

export function UseCases(): JSX.Element {
  return (
    <section className="section">
      <SectionHead
        kicker="What people use it for"
        title={
          <>
            The boring parts of a computer,
            <br />
            <em>handled.</em>
          </>
        }
      />
      <div className="bento">
        <article className="tile tile--wide reveal">
          <div className="tile__art art-shop">
            <span className="art-shop__card">
              <i />
              <b>$1,099</b>
            </span>
            <span className="art-shop__card">
              <i />
              <b>$899</b>
            </span>
            <span className="art-shop__card is-pick">
              <i />
              <b>$700</b>
            </span>
            <span className="art-cursor" />
          </div>
          <div className="tile__text">
            <span className="tile__icon">
              <Cart size={18} />
            </span>
            <h3>Shop to checkout</h3>
            <p>Compares prices, fills the cart, stops at payment.</p>
          </div>
        </article>
        <article className="tile reveal" style={d(60)}>
          <div className="tile__art art-play">
            <span className="art-play__bars">
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
          </div>
          <div className="tile__text">
            <span className="tile__icon">
              <Play size={18} />
            </span>
            <h3>Play anything</h3>
            <p>Finds the right video and skips the ad.</p>
          </div>
        </article>
        <article className="tile reveal" style={d(120)}>
          <div className="tile__art art-form">
            <span>
              <i style={d(0)} />
            </span>
            <span>
              <i style={d(500)} />
            </span>
            <span>
              <i style={d(1000)} />
            </span>
          </div>
          <div className="tile__text">
            <span className="tile__icon">
              <FileText size={18} />
            </span>
            <h3>Fill in forms</h3>
            <p>Field by field, then hands you the submit.</p>
          </div>
        </article>
        <article className="tile reveal" style={d(60)}>
          <div className="tile__art art-calc">
            <span className="art-calc__n">3,072</span>
          </div>
          <div className="tile__text">
            <span className="tile__icon">
              <Calculator size={18} />
            </span>
            <h3>Do the maths</h3>
            <p>Uses the real Calculator, so you can check it.</p>
          </div>
        </article>
        <article className="tile reveal" style={d(180)}>
          <div className="tile__art art-teach">
            <span className="art-teach__btn">Import</span>
            <span className="art-teach__ptr" />
            <span className="art-teach__bubble">Click Import, then pick your clip.</span>
          </div>
          <div className="tile__text">
            <span className="tile__icon">
              <Pointer size={18} />
            </span>
            <h3>Learn any app</h3>
            <p>Ask how, and it points at the real button on your screen.</p>
          </div>
        </article>
      </div>
    </section>
  )
}

/* ------------------------------------------------------ show me / do */

export function TeachOrDo(): JSX.Element {
  const [mode, setMode] = useState<'show' | 'do'>('show')
  useEffect(() => {
    const t = window.setInterval(() => setMode((m) => (m === 'show' ? 'do' : 'show')), 4200)
    return () => window.clearInterval(t)
  }, [mode])
  return (
    <section className="section">
      <SectionHead
        kicker="Two ways to work"
        title={
          <>
            Show me, <em>or do it for me.</em>
          </>
        }
        sub="Ask how and TORCH teaches you on your own screen. Say do it and it takes over."
      />
      <div className="duo reveal">
        <div className="duo__switch" data-mode={mode}>
          <button
            type="button"
            className={mode === 'show' ? 'is-on' : ''}
            onClick={() => setMode('show')}
          >
            <Sparkle size={15} /> Show me
          </button>
          <button
            type="button"
            className={mode === 'do' ? 'is-on' : ''}
            onClick={() => setMode('do')}
          >
            <Hand size={15} /> Do it for me
          </button>
          <span className="duo__thumb" />
        </div>
        <div className="duo__screen" data-mode={mode} key={mode}>
          <div className="duo__app">
            <div className="duo__bar">
              <i />
              <i />
              <i />
            </div>
            <div className="duo__body">
              <div className="duo__side">
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className="duo__canvas">
                <span className="duo__import">Import</span>
                <span className="duo__drop">Drop your clips here</span>
                {mode === 'do' && <span className="duo__clip">holiday.mp4</span>}
              </div>
            </div>
          </div>
          <span className="duo__cursor" />
          {mode === 'show' && (
            <span className="duo__bubble">
              Click <b>Import</b> at the top left, then choose your video.
            </span>
          )}
          {mode === 'do' && (
            <span className="duo__done">
              <Check size={13} /> Imported holiday.mp4
            </span>
          )}
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------- step log */

const LOG = [
  ['00:00', 'Focus the address bar'],
  ['00:09', 'Wait for YouTube to load'],
  ['00:15', 'Click the search box'],
  ['00:26', 'Type “Doja by Central Cee”'],
  ['00:33', 'Press Enter'],
  ['00:54', 'Open the official music video'],
  ['01:14', 'An ad started, wait it out'],
  ['01:21', 'Skip the ad'],
  ['01:41', 'Song is playing. Done.']
]

export function StepLog(): JSX.Element {
  const [ref, seen] = useSeen<HTMLDivElement>()
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (!seen) return
    if (shown >= LOG.length) {
      const t = window.setTimeout(() => setShown(0), 3200)
      return () => window.clearTimeout(t)
    }
    const t = window.setTimeout(() => setShown((n) => n + 1), shown === 0 ? 300 : 620)
    return () => window.clearTimeout(t)
  }, [seen, shown])

  return (
    <section className="section logsec">
      <div className="logsec__copy">
        <span className="eyebrow reveal">A real run</span>
        <h2 className="reveal" style={d(60)}>
          Every step,
          <br />
          <em>out in the open.</em>
        </h2>
        <p className="reveal" style={d(120)}>
          One sentence: “Open Chrome, go to YouTube and play Doja by Central Cee.” This is what
          TORCH did, step by step, in its own words.
        </p>
      </div>
      <div className="log reveal" style={d(120)} ref={ref}>
        <div className="log__head">
          <span className={`log__dot ${shown >= LOG.length ? 'is-done' : ''}`} />
          <span>{shown >= LOG.length ? 'Done in 16 steps' : 'Working'}</span>
          <span className="log__count">
            {Math.min(shown, LOG.length)} / {LOG.length}
          </span>
        </div>
        <ol>
          {LOG.map(([time, text], i) => (
            <li
              key={text}
              className={
                i < shown ? (i === shown - 1 && shown < LOG.length ? 'is-now' : 'is-done') : ''
              }
            >
              <span className="log__time">{time}</span>
              <span className="log__mark">
                {i < shown - 1 || shown >= LOG.length ? <Check size={11} /> : null}
              </span>
              <span className="log__text">{text}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------ marquee */

const PROMPTS_A = [
  'Play Doja by Central Cee on YouTube',
  'Find the cheapest laptop and check out',
  'Work out 128 × 24',
  'Write a poem about Lagos and save it',
  'Open my CV from Documents',
  'Search the web for flights to Accra'
]
const PROMPTS_B = [
  'How do I add a transition in CapCut?',
  'Rename these files by date',
  'Fill in this form with my details',
  'Turn on dark mode',
  'Open Calculator and add these up',
  'Show me where the export button is'
]

export function Marquee(): JSX.Element {
  return (
    <section className="marquee" aria-label="Things you can ask">
      {[PROMPTS_A, PROMPTS_B].map((row, r) => (
        <div key={r} className={`marquee__row ${r ? 'is-reverse' : ''}`}>
          <div className="marquee__track">
            {[...row, ...row].map((p, i) => (
              <span key={i} className="chip">
                “{p}”
              </span>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

/* ------------------------------------------------------------ compare */

export function Compare(): JSX.Element {
  const rows = [
    ['Tells you the steps', 'Does the steps'],
    ['You copy, paste and click', 'It clicks, types and checks'],
    ['Stops at text', 'Stops at payment, for you'],
    ['Lives in a tab', 'Works across your whole PC']
  ]
  return (
    <section className="section">
      <SectionHead
        kicker="The difference"
        title={
          <>
            A chatbot talks.
            <br />
            <em>TORCH works.</em>
          </>
        }
      />
      <div className="compare reveal">
        <div className="compare__col">
          <span className="compare__head">A chatbot</span>
          {rows.map(([a]) => (
            <span key={a} className="compare__cell is-muted">
              {a}
            </span>
          ))}
        </div>
        <div className="compare__col is-torch">
          <span className="compare__head">TORCH</span>
          {rows.map(([, b], i) => (
            <span key={b} className="compare__cell reveal" style={d(i * 80)}>
              <Check size={14} /> {b}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- faq */

const FAQS = [
  [
    'Does it work in any app?',
    'If you can see it on screen, TORCH can use it: browsers, Office, editors, settings, Calculator, File Explorer.'
  ],
  [
    'Will it spend my money?',
    'No. Buying needs your approval, and at the payment form it stops and hands over to you. It never types card details.'
  ],
  [
    'What does it send online?',
    'Only screenshots, and only to the AI service whose key you added. Screen access stays off until you turn it on.'
  ],
  [
    'Which AI does it use?',
    'Your own DeepSeek or Claude key. If one is unavailable, it switches to the other.'
  ],
  ['Can I stop it?', 'Any time. The Stop button ends the task within two seconds.']
]

export function Faq(): JSX.Element {
  const [open, setOpen] = useState(0)
  return (
    <section className="section faqsec">
      <SectionHead
        kicker="Questions"
        title={
          <>
            Good to <em>know.</em>
          </>
        }
      />
      <div className="faq">
        {FAQS.map(([q, a], i) => (
          <div
            key={q}
            className={`faq__item reveal ${open === i ? 'is-open' : ''}`}
            style={d(i * 50)}
          >
            <button
              type="button"
              onClick={() => setOpen(open === i ? -1 : i)}
              aria-expanded={open === i}
            >
              {q}
              <span className="faq__plus" aria-hidden="true" />
            </button>
            <div className="faq__a">
              <p>{a}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
