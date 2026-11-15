import { useState } from 'react'
import type { JSX } from 'react'
import { motion } from 'motion/react'
import { Bolt, Check, Clock, Eye, Key, Monitor, Terminal, Windows } from '../icons'
import { DOWNLOAD_URL, GITHUB_URL, INSTALLER_NAME, useRelease } from '../release'
import { DownloadButton, EASE, Kicker, Reveal, Spotlight, Words } from '../ui'

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
      <section className="pagehead">
        <Kicker>Download</Kicker>
        <Words as="h1" text={'TORCH\nfor Windows.'} className="h1" />
        <Reveal delay={0.4}>
          <p className="pagehead__sub">
            Free. Windows 10 and 11. Works with your own DeepSeek or Claude key.
          </p>
        </Reveal>
      </section>

      <section className="section section--tight">
        <Reveal>
          <motion.div
            className="dl"
            initial={{ scale: 0.96 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease: EASE }}
          >
            <div className="dl__glow" aria-hidden="true" />
            <span className="dl__os">
              <Windows size={34} />
            </span>
            <div className="dl__meta">
              <strong>TORCH for Windows</strong>
              <span>
                {release.state === 'ready'
                  ? `Version ${release.version} · ${release.sizeMb} MB · ${release.date}`
                  : `${INSTALLER_NAME} · Windows 10 & 11, 64-bit`}
              </span>
            </div>
            <DownloadButton label="Download" />
          </motion.div>
        </Reveal>
        <Reveal delay={0.15}>
          <p className="dl__note">
            Downloading starts right away. Not working?{' '}
            <a href={DOWNLOAD_URL}>Use this direct link</a> or browse{' '}
            <a href={`${GITHUB_URL}/releases`} target="_blank" rel="noreferrer">
              all releases
            </a>
            .
          </p>
        </Reveal>
      </section>

      <section className="section">
        <div className="grid grid--3">
          {(
            [
              [
                <Bolt key="1" />,
                '1  Run the installer',
                'Windows may say it protected your PC, because the installer is new and not yet signed. Click More info, then Run anyway.'
              ],
              [
                <Key key="2" />,
                '2  Add your AI key',
                'Open Settings, then Connections, and paste a DeepSeek or Claude key. It is stored encrypted on your PC.'
              ],
              [
                <Eye key="3" />,
                '3  Let it see',
                'Turn on “Look at my screen” so TORCH can work in your apps. You can turn it off any time.'
              ]
            ] as [JSX.Element, string, string][]
          ).map(([icon, title, body], i) => (
            <Reveal key={title} delay={i * 0.08}>
              <Spotlight className="rule">
                <span className="rule__icon">{icon}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </Spotlight>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="section dlsrc">
        <Reveal>
          <Spotlight className="rule">
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
            <p className="needs__ok">
              <Check size={14} /> No account with us. No telemetry.
            </p>
          </Spotlight>
        </Reveal>
        <Reveal delay={0.08}>
          <div className="term">
            <div className="term__bar">
              <i />
              <i />
              <i />
              <span>Prefer to build it yourself</span>
              <button type="button" onClick={copy} className="term__copy">
                {copied ? (
                  <>
                    <Check size={13} /> Copied
                  </>
                ) : (
                  <>
                    <Terminal size={13} /> Copy
                  </>
                )}
              </button>
            </div>
            <pre className="term__pre">
              {SOURCE.split('\n').map((line) => (
                <span key={line}>
                  <i>$</i> {line}
                  {'\n'}
                </span>
              ))}
            </pre>
          </div>
        </Reveal>
      </section>
    </>
  )
}
