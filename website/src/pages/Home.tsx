import { useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import Demo from '../Demo'
import { Faq, Marquee, Numbers, StepLog, TeachOrDo, UseCases } from '../Sections'
import { DownloadButton, SectionHead, delay } from '../components'
import type { Go } from '../components'
import {
  Arrow,
  Calculator,
  Check,
  FileText,
  Globe,
  Hand,
  Lock,
  Play,
  Pointer,
  Scan,
  Shield,
  Stop,
  Wheel
} from '../icons'
import { CommandBar, Window } from '../os'

/* ----------------------------------------------------- scroll story */

const STORY = [
  {
    icon: <Pointer />,
    title: 'You ask',
    body: 'Type it the way you would say it. No commands to learn.'
  },
  {
    icon: <Scan />,
    title: 'It looks',
    body: 'A screenshot, plus the name and position of every button on screen.'
  },
  {
    icon: <Hand />,
    title: 'It acts',
    body: 'One move at a time: click, type, scroll. Your own mouse never moves.'
  },
  {
    icon: <Check />,
    title: 'It checks',
    body: 'It looks again to confirm the move worked, then ticks it off.'
  },
  {
    icon: <Lock />,
    title: 'It hands over',
    body: 'At payment or a final send, it stops and gives control back to you.'
  }
]

function Story(): JSX.Element {
  const [step, setStep] = useState(0)
  const refs = useRef<(HTMLElement | null)[]>([])
  useEffect(() => {
    // The beat nearest the middle of the screen is the one shown, worked
    // out from position so fast scrolls and jumps land on the right one.
    let frame = 0
    const update = (): void => {
      frame = 0
      const middle = window.innerHeight / 2
      let best = 0
      let bestDistance = Infinity
      refs.current.forEach((el, i) => {
        if (!el) return
        const box = el.getBoundingClientRect()
        const distance = Math.abs(box.top + box.height / 2 - middle)
        if (distance < bestDistance) {
          bestDistance = distance
          best = i
        }
      })
      setStep(best)
    }
    const onScroll = (): void => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div className="story">
      <SectionHead
        kicker="How a task runs"
        title={
          <>
            Five beats. <em>Every time.</em>
          </>
        }
      />
      <div className="story__grid">
        <div className="story__sticky">
          <div className="story__visual" data-step={step}>
            <div className="sv__ask">
              <span className="sv__ask-text">Play Doja by Central Cee on YouTube</span>
              <span className="sv__send">
                <Arrow size={14} />
              </span>
            </div>
            <div className="sv__screen">
              <div className="sv__bar">
                <i />
                <i />
                <i />
                <span>youtube.com</span>
              </div>
              <div className="sv__body">
                <span className="sv__search">Search</span>
                <span className="sv__result sv__result--a">
                  <b />
                  <span>
                    <i />
                    <i />
                  </span>
                </span>
                <span className="sv__result sv__result--b">
                  <b />
                  <span>
                    <i />
                    <i />
                  </span>
                </span>
                <span className="sv__tag sv__tag--1">Search box</span>
                <span className="sv__tag sv__tag--2">Video: Doja (Official)</span>
                <span className="sv__scanline" />
              </div>
              <span className="sv__cursor" />
              <span className="sv__ok">
                <Check size={13} /> Playing
              </span>
            </div>
            <div className="sv__turn">
              <strong>
                <Lock size={14} /> Your turn
              </strong>
              <span>Payment details are yours to enter.</span>
            </div>
            <div className="sv__steps">
              {STORY.map((s, i) => (
                <span key={s.title} className={i < step ? 'is-done' : i === step ? 'is-now' : ''} />
              ))}
            </div>
          </div>
        </div>
        <ol className="story__list">
          {STORY.map((s, i) => (
            <li
              key={s.title}
              ref={(el) => {
                refs.current[i] = el
              }}
              className={i === step ? 'is-active' : ''}
            >
              <span className="story__n">0{i + 1}</span>
              <span className="story__icon">{s.icon}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

/* ------------------------------------------------------ download band */

export function DownloadWindow({ go }: { go: Go }): JSX.Element {
  return (
    <Window title="get-torch.exe" icon={<Arrow size={13} />} tone="dark" className="getwin">
      <div className="get">
        <h2>
          Give it your next <em>boring task.</em>
        </h2>
        <p>Free for Windows 10 and 11. Bring your own DeepSeek or Claude key.</p>
        <div className="get__actions">
          <DownloadButton go={go} />
          <button
            type="button"
            className="btn btn--outline"
            onClick={() => window.dispatchEvent(new Event('torch:drive'))}
          >
            <Wheel size={16} /> Let TORCH drive
          </button>
        </div>
      </div>
    </Window>
  )
}

/* -------------------------------------------------------------- page */

export default function Home({ go }: { go: Go }): JSX.Element {
  return (
    <>
      <Window
        title="torch — new task"
        icon={<img src="icon.png" alt="" width="14" height="14" />}
        className="herowin"
      >
        <div className="hero">
          <span className="kicker reveal">AI agent · Windows 10 &amp; 11 · Free</span>
          <h1 className="reveal" style={delay(60)}>
            Say it.
            <br />
            <em>TORCH does it.</em>
          </h1>
          <p className="lead reveal" style={delay(120)}>
            It looks at your screen, clicks, types and checks its work until the job is done. In any
            app. With you in charge.
          </p>
          <div className="reveal" style={delay(180)}>
            <CommandBar />
          </div>
          <div className="hero__actions reveal" style={delay(240)}>
            <DownloadButton go={go} />
            <button
              type="button"
              className="btn btn--outline"
              onClick={() => window.dispatchEvent(new Event('torch:drive'))}
            >
              <Wheel size={16} /> Let TORCH drive this page
            </button>
          </div>
        </div>
      </Window>

      <Window title="desktop — live" icon={<Play size={13} />} tour="demo" className="demowin">
        <Demo />
      </Window>

      <Window title="numbers.txt" icon={<FileText size={13} />} className="numwin">
        <Numbers />
      </Window>

      <Window
        title="how-a-task-runs"
        icon={<Pointer size={13} />}
        tour="story"
        className="storywin"
      >
        <Story />
      </Window>

      <Window title="use-cases" icon={<Globe size={13} />}>
        <UseCases />
      </Window>

      <Window title="show-or-do" icon={<Hand size={13} />}>
        <TeachOrDo />
      </Window>

      <Window title="safety.sys" icon={<Shield size={13} />} tone="dark" tour="safety">
        <div className="safetyband">
          <div className="safetyband__copy">
            <span className="kicker reveal">Built to be trusted</span>
            <h2 className="reveal" style={delay(60)}>
              Powerful. <em>On a short leash.</em>
            </h2>
            <ul className="safetyband__list">
              {[
                [
                  <Shield key="s" size={16} />,
                  'Asks before sending, deleting, buying or running commands'
                ],
                [<Lock key="l" size={16} />, 'Stops at every payment form and hands it to you'],
                [<Stop key="t" size={16} />, 'One Stop button ends any task within two seconds']
              ].map(([icon, text], i) => (
                <li key={i} className="reveal" style={delay(120 + i * 60)}>
                  {icon}
                  {text}
                </li>
              ))}
            </ul>
            <button type="button" className="textlink reveal" onClick={() => go('/safety')}>
              Read the safety rules <Arrow size={15} />
            </button>
          </div>
          <div className="approval reveal" style={delay(120)}>
            <div className="approval__head">
              <Shield size={15} /> Approve this step?
            </div>
            <p className="approval__what">Send “Q3 report” to ada@company.example</p>
            <p className="approval__why">This sends an email from your account.</p>
            <div className="approval__actions">
              <span className="btn btn--ghost btn--sm">Reject</span>
              <span className="btn btn--blue btn--sm approval__yes" data-tour="approve">
                Approve
              </span>
            </div>
          </div>
        </div>
      </Window>

      <Window title="run.log" icon={<Calculator size={13} />}>
        <StepLog />
      </Window>

      <Window title="try-saying.txt" icon={<FileText size={13} />} className="marqwin">
        <Marquee />
      </Window>

      <Window title="faq.md" icon={<FileText size={13} />}>
        <Faq />
      </Window>

      <DownloadWindow go={go} />
    </>
  )
}
