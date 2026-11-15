import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { motion } from 'motion/react'
import { Check, Eye, Key, Layers, Monitor, Pointer, Scan, Sparkle, Undo } from '../icons'
import { EASE, Kicker, Reveal, SectionHead, Spotlight, Words } from '../ui'
import type { Go } from '../ui'
import { FinalCta } from './Home'

const LOOP = [
  { icon: <Scan />, title: 'Look', body: 'Takes a picture of the screen.' },
  { icon: <Eye />, title: 'Understand', body: 'Reads every button and field by name.' },
  { icon: <Pointer />, title: 'Act', body: 'Clicks, types or scrolls. One move.' },
  { icon: <Check />, title: 'Check', body: 'Looks again to confirm it worked.' }
]

function Loop(): JSX.Element {
  const [active, setActive] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setActive((a) => (a + 1) % LOOP.length), 1700)
    return () => window.clearInterval(t)
  }, [])
  return (
    <div className="loop">
      <div className="loop__ring">
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r="84" className="loop__track" />
          <motion.circle
            cx="100"
            cy="100"
            r="84"
            className="loop__arc"
            animate={{ pathLength: (active + 1) / LOOP.length }}
            transition={{ duration: 0.9, ease: EASE }}
          />
        </svg>
        <motion.span
          className="loop__orbit"
          animate={{ rotate: (active + 1) * 90 }}
          transition={{ duration: 0.9, ease: EASE }}
        >
          <i />
        </motion.span>
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
            {i === active && (
              <motion.span
                layoutId="loop-hl"
                className="loop__hl"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
            )}
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
  )
}

function Grid({
  items,
  cols
}: {
  items: [JSX.Element | string, string, string][]
  cols: 2 | 3 | 4
}): JSX.Element {
  return (
    <div className={`grid grid--${cols}`}>
      {items.map(([icon, title, body], i) => (
        <Reveal key={title} delay={i * 0.06}>
          <Spotlight className="rule">
            <span className="rule__icon">{icon}</span>
            <h3>{title}</h3>
            <p>{body}</p>
          </Spotlight>
        </Reveal>
      ))}
    </div>
  )
}

export default function How({ go }: { go: Go }): JSX.Element {
  return (
    <>
      <section className="pagehead">
        <Kicker>How it works</Kicker>
        <Words as="h1" text={'One loop.\nUntil it’s done.'} className="h1" />
        <Reveal delay={0.4}>
          <p className="pagehead__sub">
            No scripts and no recordings. TORCH works it out from the screen, one step at a time.
          </p>
        </Reveal>
      </section>

      <section className="section section--tight">
        <Reveal>
          <Loop />
        </Reveal>
      </section>

      <section className="section">
        <SectionHead kicker="Under the hood" title={'Small parts.\nSharp edges.'} />
        <Grid
          cols={2}
          items={[
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
          ]}
        />
      </section>

      <section className="section">
        <SectionHead kicker="When things go wrong" title={'It notices.\nThen it adapts.'} />
        <Grid
          cols={4}
          items={[
            ['01', 'A pop-up gets in the way', 'It closes it, or waits out an ad, and carries on.'],
            [
              '02',
              'A click does not land',
              'It sees nothing changed and tries a real mouse click.'
            ],
            ['03', 'It repeats itself', 'It catches the loop and picks a different way in.'],
            ['04', 'It truly gets stuck', 'It stops and tells you which step, and why.']
          ]}
        />
      </section>

      <section className="section">
        <SectionHead
          kicker="Show and do"
          title={'Teaching is a feature,\nnot an afterthought.'}
          sub="Ask “how do I…” and TORCH points at the real button on your screen with a short tip. Say “do it for me” and it takes that step itself."
        />
        <Grid
          cols={3}
          items={[
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
          ]}
        />
      </section>

      <FinalCta go={go} />
    </>
  )
}
