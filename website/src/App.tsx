import { useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'

const GITHUB_URL = 'https://github.com/T-O-R-C-H/T.O.R.C.H'

const scenarios = [
  {
    context: 'Google Chrome',
    title: 'Canva',
    command: 'Open Chrome and take me to Canva login',
    steps: ['Opened Chrome', 'Selected your profile', 'Canva login is ready']
  },
  {
    context: 'File Explorer',
    title: 'Downloads',
    command: 'Find the latest invoice in Downloads',
    steps: ['Opened Downloads', 'Sorted by date modified', 'Found invoice-july.pdf']
  },
  {
    context: 'Desktop',
    title: 'Research',
    command: 'Search the web for local-first AI tools',
    steps: ['Opened Chrome', 'Searched the web', 'Collected the top results']
  }
]

const capabilities = [
  {
    number: '01',
    title: 'Moves through your apps',
    description:
      'TORCH can open applications, navigate websites, move the cursor, type, click, and keep going across multi-step work.'
  },
  {
    number: '02',
    title: 'Understands what is on screen',
    description:
      'Screen-aware vision gives TORCH the context to work through unfamiliar interfaces instead of relying on fixed scripts alone.'
  },
  {
    number: '03',
    title: 'Shows the work as it happens',
    description:
      'The compact overlay narrates the current action, completed steps, and anything that needs your answer.'
  },
  {
    number: '04',
    title: 'Pauses when judgment matters',
    description:
      'Sensitive actions stay behind clear approval. When TORCH is unsure, it asks a useful question instead of silently guessing.'
  }
]

const workflow = [
  {
    number: '01',
    verb: 'Ask',
    title: 'Say what you want done.',
    body: 'Use normal language. No command syntax, no workflow builder.'
  },
  {
    number: '02',
    verb: 'Watch',
    title: 'See the plan become action.',
    body: 'TORCH moves through the task visibly and narrates each step.'
  },
  {
    number: '03',
    verb: 'Confirm',
    title: 'Stay in control of the important parts.',
    body: 'Answer questions and approve sensitive actions only when needed.'
  }
]

function Wordmark({ inverse = false }: { inverse?: boolean }): JSX.Element {
  return (
    <img
      className={inverse ? 'wordmark wordmark--inverse' : 'wordmark'}
      src="/logo.png"
      alt="TORCH"
    />
  )
}

function ArrowIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 10h11M11 5l5 5-5 5" />
    </svg>
  )
}

function StatusMark(): JSX.Element {
  return (
    <svg className="status-mark" viewBox="0 0 44 44" aria-hidden="true">
      <circle cx="22" cy="22" r="15" />
      <circle className="status-mark__node status-mark__node--active" cx="22" cy="7" r="2.8" />
      <circle className="status-mark__node" cx="36.3" cy="17.4" r="2.8" />
      <circle className="status-mark__node" cx="30.8" cy="34.1" r="2.8" />
      <circle className="status-mark__node" cx="13.2" cy="34.1" r="2.8" />
      <circle className="status-mark__node" cx="7.7" cy="17.4" r="2.8" />
    </svg>
  )
}

function Header(): JSX.Element {
  return (
    <header className="header">
      <a className="header__brand" href="#top" aria-label="TORCH home">
        <Wordmark />
      </a>
      <nav className="header__nav" aria-label="Main navigation">
        <a href="#product">Product</a>
        <a href="#capabilities">Capabilities</a>
        <a href="#safety">Control</a>
      </nav>
      <a className="button button--small button--ink" href={GITHUB_URL} target="_blank" rel="noreferrer">
        Get TORCH
        <ArrowIcon />
      </a>
    </header>
  )
}

function ProductDemo(): JSX.Element {
  const [scenario, setScenario] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setScenario((current) => (current + 1) % scenarios.length)
    }, 5200)
    return () => window.clearInterval(timer)
  }, [])

  const item = scenarios[scenario]

  return (
    <div className="product-demo" aria-label="Animated TORCH product preview">
      <div className="product-demo__topline">
        <span>TORCH / LIVE DESKTOP</span>
        <span className="product-demo__online"><i /> Connected</span>
      </div>

      <div className="desktop-surface" key={item.command}>
        <div className="desktop-window">
          <div className="desktop-window__bar">
            <span className="window-dot" />
            <span className="window-dot" />
            <span>{item.context}</span>
            <span className="desktop-window__controls">— &nbsp; □ &nbsp; ×</span>
          </div>
          <div className="desktop-window__body">
            <div className="browser-rail">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="browser-content">
              <div className="browser-content__label">ACTIVE WINDOW</div>
              <h3>{item.title}</h3>
              <div className="browser-content__line browser-content__line--long" />
              <div className="browser-content__line" />
              <div className="browser-content__line browser-content__line--short" />
              <div className="browser-content__action">READY</div>
            </div>
          </div>
        </div>

        <div className="agent-overlay">
          <div className="agent-overlay__header">
            <Wordmark inverse />
            <span><i /> WORKING</span>
            <button type="button" aria-label="Stop preview">■ STOP</button>
          </div>
          <p className="agent-overlay__command">“{item.command}”</p>
          <div className="agent-overlay__steps">
            {item.steps.map((step, index) => (
              <div
                className={`agent-step ${index === item.steps.length - 1 ? 'agent-step--active' : ''}`}
                key={step}
              >
                <span>{index === item.steps.length - 1 ? '●' : '✓'}</span>
                <p>{step}</p>
                <em>{index === item.steps.length - 1 ? 'NOW' : 'DONE'}</em>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="product-demo__footer">
        <span>ONE COMMAND. EVERY STEP VISIBLE.</span>
        <div className="scenario-dots" aria-label="Preview scenarios">
          {scenarios.map((entry, index) => (
            <button
              className={index === scenario ? 'is-active' : ''}
              key={entry.command}
              onClick={() => setScenario(index)}
              type="button"
              aria-label={`Show preview ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function Hero(): JSX.Element {
  return (
    <section className="hero" id="top">
      <div className="hero__copy">
        <div className="eyebrow"><span /> AI DESKTOP AGENT FOR WINDOWS</div>
        <h1>
          Tell TORCH.
          <span>Consider it done.</span>
        </h1>
        <p>
          An AI desktop agent that can see your screen, move through apps, and finish multi-step
          work—while showing you every action.
        </p>
        <div className="hero__actions">
          <a className="button button--ink" href={GITHUB_URL} target="_blank" rel="noreferrer">
            Get TORCH for Windows
            <ArrowIcon />
          </a>
          <a className="button button--quiet" href="#product">
            See how it works
          </a>
        </div>
        <div className="hero__meta">
          <span>01 / VISIBLE ACTIONS</span>
          <span>02 / APPROVAL FIRST</span>
          <span>03 / LOCAL SCREEN VISION</span>
        </div>
      </div>
      <ProductDemo />
    </section>
  )
}

function ProductFilm(): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)

  const playFilm = (): void => {
    const playback = videoRef.current?.play()
    if (!playback) return
    void playback.then(() => setPlaying(true)).catch(() => setPlaying(false))
  }

  return (
    <section className="product-section section" id="product">
      <div className="section-label">
        <span>01</span>
        <span>THE PRODUCT</span>
      </div>
      <div className="product-section__intro reveal">
        <h2>Not another chat window.<br />A working layer for your desktop.</h2>
        <p>
          TORCH stays close to the work. Ask once, then follow the task through the compact overlay
          without losing the app you are already using.
        </p>
      </div>
      <div className="film-frame reveal">
        <div className="film-frame__bar">
          <span>TORCH / PRODUCT PREVIEW</span>
          <span>00:17</span>
        </div>
        <div className="film-frame__media">
          <video
            ref={videoRef}
            src="/torch-preview.mp4"
            controls
            muted
            loop
            playsInline
            preload="metadata"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            aria-label="TORCH product preview"
          />
          {!playing && (
            <button className="film-cover" type="button" onClick={playFilm} aria-label="Play TORCH product film">
              <span className="film-cover__index">PRODUCT FILM / 00:17</span>
              <div className="film-cover__copy">
                <h3>Watch one command<br />become a finished task.</h3>
                <span className="film-cover__play">PLAY <i>▶</i></span>
              </div>
              <span className="film-cover__note">CLICK TO PLAY WITH SOUND CONTROLS</span>
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

function Capabilities(): JSX.Element {
  return (
    <section className="capabilities section" id="capabilities">
      <div className="section-label">
        <span>02</span>
        <span>WHAT TORCH DOES</span>
      </div>
      <div className="capabilities__heading reveal">
        <h2>From intent<br />to action.</h2>
        <p>One system for the repetitive, the visual, and the work that crosses between apps.</p>
      </div>
      <div className="capability-list">
        {capabilities.map((item) => (
          <article className="capability reveal" key={item.number}>
            <span className="capability__number">{item.number}</span>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            <span className="capability__arrow">↗</span>
          </article>
        ))}
      </div>
    </section>
  )
}

function Workflow(): JSX.Element {
  return (
    <section className="workflow section">
      <div className="section-label">
        <span>03</span>
        <span>HOW IT WORKS</span>
      </div>
      <div className="workflow__headline reveal">
        <h2>Ask. Watch. Done.</h2>
        <p>The shortest path between saying it and finishing it.</p>
      </div>
      <div className="workflow__grid">
        {workflow.map((item) => (
          <article className="workflow-step reveal" key={item.number}>
            <span>{item.number}</span>
            <div className="workflow-step__node" />
            <small>{item.verb}</small>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function Safety(): JSX.Element {
  return (
    <section className="safety" id="safety">
      <div className="safety__inner">
        <div className="section-label section-label--dark">
          <span>04</span>
          <span>DESIGNED FOR CONTROL</span>
        </div>
        <div className="safety__statement reveal">
          <StatusMark />
          <h2>Autonomous<br />does not mean invisible.</h2>
          <p>
            TORCH makes control legible: live narration, visible cursor movement, clear approvals,
            and a stop button that is always within reach.
          </p>
        </div>
        <div className="safety__grid">
          <article className="reveal">
            <span>01</span>
            <h3>Every step is narrated</h3>
            <p>Know what TORCH is doing now, what it finished, and what comes next.</p>
          </article>
          <article className="reveal">
            <span>02</span>
            <h3>Sensitive actions pause</h3>
            <p>Approvals keep consequential actions from happening without your confirmation.</p>
          </article>
          <article className="reveal">
            <span>03</span>
            <h3>Uncertainty becomes a question</h3>
            <p>When multiple profiles or choices appear, TORCH asks instead of pretending.</p>
          </article>
        </div>
      </div>
    </section>
  )
}

function ModelNote(): JSX.Element {
  return (
    <section className="model-note section">
      <div className="section-label">
        <span>05</span>
        <span>THE INTELLIGENCE</span>
      </div>
      <div className="model-note__content reveal">
        <h2>Fast planning.<br />Private visual context.</h2>
        <div>
          <p>
            Gemini 2.5 Flash understands requests and builds the plan. Qwen2.5-VL can interpret the
            screen locally through Ollama when a task needs visual control.
          </p>
          <div className="model-note__tags">
            <span>GEMINI 2.5 FLASH / PLANNING</span>
            <span>QWEN2.5-VL / SCREEN VISION</span>
          </div>
        </div>
      </div>
    </section>
  )
}

function FAQ(): JSX.Element {
  return (
    <section className="faq section">
      <div className="section-label">
        <span>06</span>
        <span>COMMON QUESTIONS</span>
      </div>
      <div className="faq__layout">
        <h2 className="reveal">A few things<br />worth knowing.</h2>
        <div className="faq__items">
          <details className="reveal">
            <summary>What can TORCH control?<span>+</span></summary>
            <p>Websites, desktop applications, files, keyboard input, and multi-step workflows that move between them.</p>
          </details>
          <details className="reveal">
            <summary>Will it act without asking me?<span>+</span></summary>
            <p>Routine actions can run directly. Sensitive or consequential actions pause for explicit approval.</p>
          </details>
          <details className="reveal">
            <summary>Does screen vision run locally?<span>+</span></summary>
            <p>Yes. TORCH uses Qwen2.5-VL through Ollama for local screen interpretation when visual control is needed.</p>
          </details>
          <details className="reveal">
            <summary>Which operating system is supported?<span>+</span></summary>
            <p>TORCH is currently built for Windows, with the desktop architecture designed to expand over time.</p>
          </details>
        </div>
      </div>
    </section>
  )
}

function FinalCTA(): JSX.Element {
  return (
    <section className="final-cta">
      <div className="final-cta__line"><span /></div>
      <Wordmark />
      <h2>Say it once.<br />Move on.</h2>
      <p>Your desktop is ready for a better way to work.</p>
      <a className="button button--ink" href={GITHUB_URL} target="_blank" rel="noreferrer">
        Get TORCH
        <ArrowIcon />
      </a>
    </section>
  )
}

function Footer(): JSX.Element {
  return (
    <footer className="footer">
      <Wordmark />
      <p>AI that works where you work.</p>
      <div className="footer__links">
        <a href="#product">Product</a>
        <a href="#capabilities">Capabilities</a>
        <a href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub</a>
      </div>
      <span>© 2026 TORCH</span>
    </footer>
  )
}

export default function App(): JSX.Element {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <ProductFilm />
        <Capabilities />
        <Workflow />
        <Safety />
        <ModelNote />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  )
}
