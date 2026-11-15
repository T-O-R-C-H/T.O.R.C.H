import { useState } from 'react'
import type { JSX } from 'react'
import { delay } from '../components'
import { Bolt, Check, Clock, Eye, Github, Key, Monitor, Terminal, Windows } from '../icons'
import { GITHUB_URL, RELEASES_URL, useRelease } from '../release'
import { Window } from '../os'

const SOURCE = `git clone ${GITHUB_URL}.git
cd T.O.R.C.H && npm ci
cd backend && python -m venv venv
venv\\Scripts\\pip install -r requirements.txt
cd .. && npm run dev`

export default function DownloadPage(): JSX.Element {
  const release = useRelease()
  const [copied, setCopied] = useState(false)
  const copy = (): void => {
    void navigator.clipboard?.writeText(SOURCE).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    })
  }

  return (
    <>
      <Window title="get-torch.exe" icon={<Windows size={13} />}>
        <section className="pagehead">
          <span className="kicker reveal">Download</span>
          <h1 className="reveal" style={delay(60)}>
            TORCH
            <br />
            <em>for Windows.</em>
          </h1>
          <p className="lead reveal" style={delay(120)}>
            Free. Windows 10 and 11. Works with your own DeepSeek or Claude key.
          </p>
        </section>

        <section className="dl reveal" style={delay(160)}>
          <div className="dl__card">
            <span className="dl__os">
              <Windows size={30} />
            </span>
            <div className="dl__meta">
              <strong>TORCH for Windows</strong>
              {release.state === 'ready' && (
                <span>
                  Version {release.version} · {release.sizeMb} MB · {release.date}
                </span>
              )}
              {release.state === 'loading' && <span>Checking for the latest version…</span>}
              {release.state === 'none' && <span>The first public build is being prepared.</span>}
            </div>
            {release.state === 'ready' ? (
              <a className="btn btn--ink" href={release.url} download>
                <Windows size={15} /> Download
              </a>
            ) : (
              <a className="btn btn--ink" href={RELEASES_URL} target="_blank" rel="noreferrer">
                <Github size={15} />{' '}
                {release.state === 'loading' ? 'Releases' : 'Watch for release'}
              </a>
            )}
          </div>
          {release.state === 'ready' && (
            <a className="dl__notes" href={release.notesUrl} target="_blank" rel="noreferrer">
              What&rsquo;s new in {release.version}
            </a>
          )}
        </section>
      </Window>

      <Window title="install-in-3-steps" icon={<Bolt size={13} />}>
        <div className="steps3">
          {[
            [
              <Bolt key="1" />,
              'Run the installer',
              'Windows may say it protected your PC, because the installer is new and not yet signed. Click More info, then Run anyway.'
            ],
            [
              <Key key="2" />,
              'Add your AI key',
              'Open Settings, then Connections, and paste a DeepSeek or Claude key. It is stored encrypted on your PC.'
            ],
            [
              <Eye key="3" />,
              'Let it see',
              'Turn on “Look at my screen” so TORCH can work in your apps. You can turn it off any time.'
            ]
          ].map(([icon, title, body], i) => (
            <article key={String(title)} className="step reveal" style={delay(i * 70)}>
              <span className="step__n">{i + 1}</span>
              <span className="card__icon">{icon}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </Window>

      <Window title="requirements" icon={<Terminal size={13} />}>
        <section className="dlsrc">
          <div className="dlsrc__side reveal">
            <h3>You will need</h3>
            <ul className="needs">
              <li>
                <Monitor size={16} /> Windows 10 or 11, 64-bit
              </li>
              <li>
                <Clock size={16} /> An internet connection while it works
              </li>
              <li>
                <Key size={16} /> A DeepSeek or Claude API key
              </li>
            </ul>
            <p className="dlsrc__note">
              <Check size={14} /> No account with us. No telemetry.
            </p>
          </div>
          <div className="terminal reveal" style={delay(80)}>
            <div className="terminal__bar">
              <Terminal size={14} />
              <span>Prefer to build it yourself</span>
              <button type="button" onClick={copy} className="terminal__copy">
                {copied ? (
                  <>
                    <Check size={13} /> Copied
                  </>
                ) : (
                  'Copy'
                )}
              </button>
            </div>
            <pre>
              {SOURCE.split('\n').map((line) => (
                <span key={line}>
                  <i>&gt;</i> {line}
                  {'\n'}
                </span>
              ))}
            </pre>
          </div>
        </section>
      </Window>
    </>
  )
}
