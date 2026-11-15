import type { JSX } from 'react'
import { SectionHead, delay } from '../components'
import type { Go } from '../components'
import { Arrow, Eye, Key, Lock, Monitor, Shield, Stop, Undo } from '../icons'
import { Window } from '../os'
import { DownloadWindow } from './Home'

const RULES = [
  {
    icon: <Shield />,
    title: 'Asks before risky steps',
    body: 'Sending, deleting, buying, downloading and running commands wait for your yes.'
  },
  {
    icon: <Lock />,
    title: 'Payment stays with you',
    body: 'At a card form or a final order button, it stops and hands over.'
  },
  {
    icon: <Stop />,
    title: 'Stop at any time',
    body: 'One button ends the task within two seconds.'
  },
  {
    icon: <Eye />,
    title: 'Screen access is opt-in',
    body: 'TORCH cannot look at your screen until you switch it on.'
  },
  {
    icon: <Key />,
    title: 'Rules live in code',
    body: 'Approval is decided by the app, never by the AI.'
  },
  {
    icon: <Undo />,
    title: 'Undo for file changes',
    body: 'Moved, deleted and zipped files and new folders can be put back.'
  }
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
      <Window title="safety.sys" icon={<Shield size={13} />} go={go}>
        <div className="pagehead">
          <span className="kicker reveal">Safety</span>
          <h1 className="reveal" style={delay(60)}>
            Powerful. <em>On a short leash.</em>
          </h1>
          <p className="lead reveal" style={delay(120)}>
            An agent that can use your computer has to know where to stop. TORCH does.
          </p>
        </div>
        <div className="cards cards--3">
          {RULES.map((rule, i) => (
            <article key={rule.title} className="card card--stack reveal" style={delay(i * 50)}>
              <span className="card__icon">{rule.icon}</span>
              <h3>{rule.title}</h3>
              <p>{rule.body}</p>
            </article>
          ))}
        </div>
      </Window>

      <Window title="hard-limits" icon={<Lock size={13} />} tone="dark" go={go}>
        <SectionHead
          kicker="Hard limits"
          title={
            <>
              Things it will <em>never do.</em>
            </>
          }
        />
        <div className="never">
          {NEVER.map((item, i) => (
            <span key={item} className="never__item reveal" style={delay(i * 50)}>
              <span className="never__x" aria-hidden="true" />
              {item}
            </span>
          ))}
        </div>
      </Window>

      <Window title="what-leaves-your-pc" icon={<Monitor size={13} />} go={go}>
        <div className="privacy-teaser">
          <span className="card__icon">
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
          <button type="button" className="textlink" onClick={() => go('/privacy')}>
            Privacy <Arrow size={15} />
          </button>
        </div>
      </Window>

      <DownloadWindow go={go} />
    </>
  )
}
