import type { JSX } from 'react'
import { Arrow, Eye, Key, Lock, Monitor, Shield, Stop, Undo } from '../icons'
import { Kicker, Link, Reveal, SectionHead, Spotlight, Words } from '../ui'
import type { Go } from '../ui'
import { FinalCta } from './Home'

const RULES: [JSX.Element, string, string][] = [
  [
    <Shield key="1" />,
    'Asks before risky steps',
    'Sending, deleting, buying, downloading and running commands wait for your yes.'
  ],
  [
    <Lock key="2" />,
    'Payment stays with you',
    'At a card form or a final order button, it stops and hands over.'
  ],
  [<Stop key="3" />, 'Stop at any time', 'One button ends the task within two seconds.'],
  [
    <Eye key="4" />,
    'Screen access is opt-in',
    'TORCH cannot look at your screen until you switch it on.'
  ],
  [<Key key="5" />, 'Rules live in code', 'Approval is decided by the app, never by the AI.'],
  [
    <Undo key="6" />,
    'Undo for file changes',
    'Moved, deleted and zipped files and new folders can be put back.'
  ]
]

const NEVER = [
  'Type your card number',
  'Press the final Pay or Place order',
  'Solve a CAPTCHA for you',
  'Look at your screen without permission',
  'Close the app it is using, unless asked',
  'Decide its own approvals'
]

export default function Safety({ go }: { go: Go }): JSX.Element {
  return (
    <>
      <section className="pagehead">
        <Kicker>Safety</Kicker>
        <Words as="h1" text={'Powerful.\nOn a short leash.'} className="h1" />
        <Reveal delay={0.4}>
          <p className="pagehead__sub">
            An agent that can use your computer has to know where to stop. TORCH does.
          </p>
        </Reveal>
      </section>

      <section className="section section--tight">
        <div className="grid grid--3">
          {RULES.map(([icon, title, body], i) => (
            <Reveal key={title} delay={i * 0.05}>
              <Spotlight className="rule">
                <span className="rule__icon">{icon}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </Spotlight>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="section">
        <SectionHead kicker="Hard limits" title={'Things it will\nnever do.'} />
        <div className="never">
          {NEVER.map((item, i) => (
            <Reveal key={item} delay={i * 0.05}>
              <div className="never__item">
                <span className="never__x" aria-hidden="true" />
                {item}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="section section--tight">
        <Reveal>
          <Spotlight className="teaser">
            <span className="rule__icon">
              <Monitor />
            </span>
            <div>
              <h3>What leaves your computer</h3>
              <p>
                Only what your AI needs: the words of your request and, when screen access is on,
                screenshots. They go to the DeepSeek or Claude account whose key you added. Nothing
                comes to us.
              </p>
            </div>
            <Link to="/privacy" go={go} className="arrowlink">
              Privacy <Arrow size={15} />
            </Link>
          </Spotlight>
        </Reveal>
      </section>

      <FinalCta go={go} />
    </>
  )
}
