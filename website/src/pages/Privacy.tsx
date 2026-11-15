import type { JSX } from 'react'
import { delay } from '../components'
import { Lock } from '../icons'
import { Window } from '../os'

/*
 * Written from the code, not from intent. If TORCH's behaviour changes,
 * this page has to change with it: it is a promise to the people using it.
 */
export default function Privacy(): JSX.Element {
  return (
    <Window title="privacy.md" icon={<Lock size={13} />}>
      <article className="legal">
        <header className="legal__head">
          <span className="kicker reveal">Privacy</span>
          <h1 className="reveal" style={delay(60)}>
            What TORCH does
            <br />
            <em>with your data.</em>
          </h1>
          <p className="legal__date reveal" style={delay(100)}>
            Last updated 15 November 2026
          </p>
        </header>

        <div className="legal__summary reveal" style={delay(140)}>
          <strong>The short version.</strong> TORCH runs on your computer. We do not run a server,
          and we collect nothing. The only things that leave your PC go to the AI service whose key
          you added, and only what it needs to do your task.
        </div>

        <section>
          <h2>Your requests</h2>
          <p>
            To work out what to do, TORCH sends the text of your request, and its own notes on the
            task so far, to the AI service you chose in Settings: DeepSeek or Anthropic (Claude). If
            you have added keys for both, the second is used only when the first is unavailable.
          </p>
        </section>

        <section>
          <h2>Screenshots</h2>
          <p>
            Looking at the screen is <strong>off until you turn it on</strong> (Settings, “Look at
            my screen”). When it is on and a task needs it, TORCH takes screenshots and sends them
            to the same AI service so it can see what to do next. TORCH&rsquo;s own windows are
            hidden from those screenshots.
          </p>
          <p>
            Screenshots are held in memory for the step that needs them. TORCH does not save them to
            disk or keep a record of them. While TORCH is controlling your screen, a blue glow runs
            around its edges.
          </p>
        </section>

        <section>
          <h2>Your voice</h2>
          <p>
            Speech is turned into text on your own computer by a speech model that TORCH downloads
            once. Recordings are not uploaded and not kept. There is no wake word and nothing
            listens in the background.
          </p>
        </section>

        <section>
          <h2>Keys, passwords and clipboard</h2>
          <p>
            AI keys, your email app password and TORCH&rsquo;s clipboard history are stored only on
            your computer, encrypted with Windows&rsquo; own protection for your account. Each key
            is sent only to the service it belongs to.
          </p>
        </section>

        <section>
          <h2>Email and files</h2>
          <p>
            If you connect email, TORCH talks directly to your email provider. Files are read and
            changed on your computer. Sending, deleting, downloading and running commands always
            wait for your approval first.
          </p>
        </section>

        <section>
          <h2>The AI services</h2>
          <p>What those services do with what they receive is set by their own policies:</p>
          <ul>
            <li>
              DeepSeek:{' '}
              <a href="https://www.deepseek.com" target="_blank" rel="noreferrer">
                deepseek.com
              </a>
            </li>
            <li>
              Anthropic (Claude):{' '}
              <a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noreferrer">
                anthropic.com/legal/privacy
              </a>
            </li>
          </ul>
        </section>

        <section>
          <h2>This website</h2>
          <p>
            This site sets no cookies and runs no analytics. To show the latest version on the
            Download page, your browser asks GitHub for it directly. Fonts are loaded from Google
            Fonts.
          </p>
        </section>

        <section>
          <h2>Questions</h2>
          <p>
            Open an issue on{' '}
            <a
              href="https://github.com/T-O-R-C-H/T.O.R.C.H/issues"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            . The code is public, so every statement on this page can be checked.
          </p>
        </section>
      </article>
    </Window>
  )
}
