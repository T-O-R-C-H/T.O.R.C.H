import { useEffect, useState } from 'react'
import type { CSSProperties, JSX } from 'react'
import { Compare } from '../Sections'
import { SectionHead, delay } from '../components'
import type { Go } from '../components'
import { Check, Eye, FileText, Key, Layers, Monitor, Pointer, Scan, Sparkle, Undo } from '../icons'
import { Window } from '../os'
import { DownloadWindow } from './Home'

const LOOP = [
  { icon: <Scan />, title: 'Look', body: 'Takes a picture of the screen.' },
  { icon: <Eye />, title: 'Understand', body: 'Reads every button and field by name.' },
  { icon: <Pointer />, title: 'Act', body: 'Clicks, types or scrolls. One move.' },
  { icon: <Check />, title: 'Check', body: 'Looks again to confirm it worked.' }
]

export default function How({ go }: { go: Go }): JSX.Element {
  const [active, setActive] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setActive((a) => (a + 1) % LOOP.length), 1700)
    return () => window.clearInterval(t)
  }, [])

  return (
    <>
      <Window title="how-it-works" icon={<Pointer size={13} />} go={go}>
        <div className="pagehead">
          <span className="kicker reveal">How it works</span>
          <h1 className="reveal" style={delay(60)}>
            One loop. <em>Until it&rsquo;s done.</em>
          </h1>
          <p className="lead reveal" style={delay(120)}>
            No scripts and no recordings. TORCH works it out from the screen, one step at a time.
          </p>
        </div>
        <div className="loop">
          <div className="loop__ring" style={{ '--a': active } as CSSProperties}>
            <svg viewBox="0 0 200 200" aria-hidden="true">
              <circle cx="100" cy="100" r="84" className="loop__track" />
              <circle cx="100" cy="100" r="84" className="loop__arc" />
            </svg>
            <span className="loop__orbit">
              <i />
            </span>
            <div className="loop__center">
              <Sparkle size={22} />
              <span>Repeat</span>
            </div>
          </div>
          <ol className="loop__steps">
            {LOOP.map((step, i) => (
              <li
                key={step.title}
                className={i === active ? 'is-active' : ''}
                onMouseEnter={() => setActive(i)}
              >
                <span className="loop__n">0{i + 1}</span>
                <span className="loop__icon">{step.icon}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Window>

      <Window title="under-the-hood" icon={<Layers size={13} />} go={go}>
        <SectionHead
          kicker="Under the hood"
          title={
            <>
              Small parts. <em>Sharp edges.</em>
            </>
          }
        />
        <div className="cards cards--2">
          {[
            [
              <Key key="k" />,
              'Your own AI key',
              'DeepSeek or Claude. If one is down, it switches to the other.'
            ],
            [
              <Scan key="s" />,
              'Windows accessibility',
              'Exact positions of every button, not guesses from a picture.'
            ],
            [
              <Layers key="l" />,
              'Its own to-do list',
              'Plans, ticks off and re-plans as the screen changes.'
            ],
            [
              <Monitor key="m" />,
              'Runs on your PC',
              'The app and its tools stay local. Only screenshots go to your AI.'
            ]
          ].map(([icon, title, body], i) => (
            <article key={String(title)} className="card reveal" style={delay(i * 60)}>
              <span className="card__icon">{icon}</span>
              <div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            </article>
          ))}
        </div>
      </Window>

      <Window title="when-things-go-wrong" icon={<FileText size={13} />} go={go}>
        <SectionHead
          kicker="When things go wrong"
          title={
            <>
              It notices. <em>Then it adapts.</em>
            </>
          }
        />
        <div className="cards cards--4">
          {[
            ['A pop-up gets in the way', 'It closes it, or waits out an ad, and carries on.'],
            ['A click does not land', 'It sees nothing changed and tries a real mouse click.'],
            ['It repeats itself', 'It catches the loop and picks a different way in.'],
            ['It truly gets stuck', 'It stops and tells you which step, and why.']
          ].map(([title, body], i) => (
            <article key={title} className="card card--stack reveal" style={delay(i * 60)}>
              <span className="card__n">0{i + 1}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </Window>

      <Window title="show-and-do" icon={<Sparkle size={13} />} go={go}>
        <SectionHead
          kicker="Show and do"
          title={
            <>
              Teaching is a feature, <em>not an afterthought.</em>
            </>
          }
          sub="Ask “how do I…” and TORCH points at the real button on your screen with a short tip. Say “do it for me” and it takes that step itself."
        />
        <div className="cards cards--3">
          {[
            [
              <Sparkle key="a" />,
              'Points, never guesses',
              'The pointer lands on the control Windows names, not a spot in a picture.'
            ],
            [
              <Pointer key="b" />,
              'One step at a time',
              'You follow along in the real app, at your own pace.'
            ],
            [
              <Undo key="c" />,
              'Hand it over any time',
              '“Do it for me” picks up exactly where the lesson stopped.'
            ]
          ].map(([icon, title, body], i) => (
            <article key={String(title)} className="card card--stack reveal" style={delay(i * 60)}>
              <span className="card__icon">{icon}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </Window>

      <Window title="chatbot-vs-torch" icon={<FileText size={13} />} go={go}>
        <Compare />
      </Window>

      <DownloadWindow go={go} />
    </>
  )
}
