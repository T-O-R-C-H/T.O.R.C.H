import { useRef, useState } from 'react'
import type { JSX, ReactNode } from 'react'
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useTransform } from 'motion/react'
import Demo from '../Demo'
import {
  Arrow,
  Calculator,
  Cart,
  Check,
  Eye,
  FileText,
  Folder,
  Globe,
  Hand,
  Lock,
  Mail,
  Monitor,
  Play,
  Pointer,
  Scan,
  Shield,
  Stop
} from '../icons'
import {
  CountUp,
  DownloadButton,
  EASE,
  Kicker,
  Link,
  Marquee,
  Reveal,
  ScrollText,
  SectionHead,
  Spotlight,
  Words
} from '../ui'
import type { Go } from '../ui'

/* --------------------------------------------------------------- hero */

function Hero({ go }: { go: Go }): JSX.Element {
  return (
    <section className="hero">
      <div className="hero__bg" aria-hidden="true">
        <div className="hero__grid" />
        <div className="hero__glow" />
        <div className="hero__beam hero__beam--1" />
        <div className="hero__beam hero__beam--2" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
      >
        <Link to="/download" go={go} className="pill">
          <span className="pill__tag">New</span>
          TORCH 1.0 for Windows is here
          <Arrow size={14} />
        </Link>
      </motion.div>
      <Words
        as="h1"
        text={'The AI agent that\nuses your computer.'}
        className="h1 hero__title"
        delay={0.2}
      />
      <Reveal delay={0.7}>
        <p className="hero__sub">
          Tell TORCH what you want. It looks at the screen, clicks, types and checks its work until
          the job is done. In any app, with you in charge.
        </p>
      </Reveal>
      <Reveal delay={0.85} className="hero__cta">
        <DownloadButton />
        <Link to="/how" go={go} className="btn btn--ghost">
          See how it works
        </Link>
      </Reveal>
      <Reveal delay={1} className="hero__meta">
        <span>Free</span>
        <i />
        <span>Windows 10 &amp; 11</span>
        <i />
        <span>Your own DeepSeek or Claude key</span>
      </Reveal>
    </section>
  )
}

/** The live demo, tilted back in 3D, settling flat as you scroll to it. */
function ProductShot(): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'start 0.25'] })
  const rotateX = useTransform(scrollYProgress, [0, 1], [32, 0])
  const scale = useTransform(scrollYProgress, [0, 1], [0.86, 1])
  const y = useTransform(scrollYProgress, [0, 1], [80, 0])
  const glow = useTransform(scrollYProgress, [0, 1], [0.2, 1])
  return (
    <section className="shot" ref={ref}>
      <motion.div className="shot__glow" style={{ opacity: glow }} aria-hidden="true" />
      <motion.div className="shot__frame" style={{ rotateX, scale, y }}>
        <div className="shot__bar">
          <i />
          <i />
          <i />
          <span>TORCH · live</span>
        </div>
        <div className="shot__body">
          <Demo />
        </div>
      </motion.div>
    </section>
  )
}

/* ------------------------------------------------------------- logos */

function WorksIn(): JSX.Element {
  const apps: [JSX.Element, string][] = [
    [<Globe key="g" />, 'Chrome'],
    [<Globe key="e" />, 'Edge'],
    [<FileText key="w" />, 'Word'],
    [<FileText key="n" />, 'Notepad'],
    [<Calculator key="c" />, 'Calculator'],
    [<Folder key="f" />, 'File Explorer'],
    [<Mail key="m" />, 'Outlook'],
    [<Play key="y" />, 'YouTube'],
    [<Monitor key="s" />, 'Settings'],
    [<Cart key="s2" />, 'Online stores']
  ]
  return (
    <section className="works">
      <Reveal>
        <p className="works__label">Works in the apps you already use</p>
      </Reveal>
      <Marquee speed={36}>
        {apps.map(([icon, name]) => (
          <span key={name} className="works__item">
            {icon}
            {name}
          </span>
        ))}
      </Marquee>
    </section>
  )
}

/* ------------------------------------------------------------- bento */

function Bento(): JSX.Element {
  return (
    <section className="section">
      <SectionHead
        kicker="What it does"
        title={'The boring parts of a\ncomputer, handled.'}
        sub="Anything you can do with a mouse and keyboard, TORCH can do for you. A few favourites:"
      />
      <div className="bento">
        <Reveal className="bento__a">
          <Spotlight className="tile">
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
            <TileText
              icon={<Cart size={18} />}
              title="Shop to checkout"
              body="Compares prices, fills the cart, then stops at payment for you."
            />
          </Spotlight>
        </Reveal>
        <Reveal className="bento__b" delay={0.08}>
          <Spotlight className="tile">
            <div className="tile__art art-play">
              <span className="art-play__bars">
                <i />
                <i />
                <i />
                <i />
                <i />
              </span>
            </div>
            <TileText
              icon={<Play size={18} />}
              title="Play anything"
              body="Finds the right video and skips the ad."
            />
          </Spotlight>
        </Reveal>
        <Reveal className="bento__c" delay={0.04}>
          <Spotlight className="tile">
            <div className="tile__art art-form">
              <span>
                <i style={{ animationDelay: '0ms' }} />
              </span>
              <span>
                <i style={{ animationDelay: '500ms' }} />
              </span>
              <span>
                <i style={{ animationDelay: '1000ms' }} />
              </span>
            </div>
            <TileText
              icon={<FileText size={18} />}
              title="Fill in forms"
              body="Field by field, then hands you the submit."
            />
          </Spotlight>
        </Reveal>
        <Reveal className="bento__d" delay={0.12}>
          <Spotlight className="tile">
            <div className="tile__art art-calc">
              <span className="art-calc__n">3,072</span>
            </div>
            <TileText
              icon={<Calculator size={18} />}
              title="Do the maths"
              body="In the real Calculator, so you can check it."
            />
          </Spotlight>
        </Reveal>
        <Reveal className="bento__e" delay={0.16}>
          <Spotlight className="tile">
            <div className="tile__art art-teach">
              <span className="art-teach__btn">Import</span>
              <span className="art-teach__ptr" />
              <span className="art-teach__bubble">Click Import, then pick your clip.</span>
            </div>
            <TileText
              icon={<Pointer size={18} />}
              title="Learn any app"
              body="Ask how, and it points at the real button on your screen."
            />
          </Spotlight>
        </Reveal>
      </div>
    </section>
  )
}

function TileText({
  icon,
  title,
  body
}: {
  icon: JSX.Element
  title: string
  body: string
}): JSX.Element {
  return (
    <div className="tile__text">
      <span className="tile__icon">{icon}</span>
      <div>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
    </div>
  )
}

/* ------------------------------------------------ pinned: how it runs */

const BEATS = [
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

function Pinned(): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const [step, setStep] = useState(0)
  useMotionValueEvent(scrollYProgress, 'change', (v) =>
    setStep(Math.min(BEATS.length - 1, Math.floor(v * BEATS.length)))
  )
  const bar = useTransform(scrollYProgress, [0, 1], ['0%', '100%'])

  return (
    <section className="pinned" ref={ref}>
      <div className="pinned__sticky">
        <div className="pinned__copy">
          <Kicker>How a task runs</Kicker>
          <h2 className="h2">
            Five beats.
            <br />
            <span className="dim">Every single time.</span>
          </h2>
          <div className="pinned__beats">
            {BEATS.map((b, i) => (
              <div
                key={b.title}
                className={`beat ${i === step ? 'is-on' : ''} ${i < step ? 'is-past' : ''}`}
              >
                <span className="beat__icon">{b.icon}</span>
                <div>
                  <strong>{b.title}</strong>
                  <AnimatePresence initial={false}>
                    {i === step && (
                      <motion.p
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.45, ease: EASE }}
                      >
                        {b.body}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
          <div className="pinned__track">
            <motion.span style={{ width: bar }} />
          </div>
        </div>
        <div className="pinned__visual">
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
          </div>
        </div>
      </div>
    </section>
  )
}

/* --------------------------------------------------------- statement */

function Statement(): JSX.Element {
  return (
    <section className="statement">
      <ScrollText text="TORCH does not tell you how. It looks at your screen, moves through your apps and finishes the job, then hands back the parts that should always be yours." />
    </section>
  )
}

/* ------------------------------------------------------------- stats */

function Stats(): JSX.Element {
  const items: [number, string, string][] = [
    [16, '', 'steps to find and play a song, ad skipped'],
    [60, '', 'looks it can take on one task'],
    [2, 's', 'to stop, whenever you press Stop'],
    [0, '', 'card numbers it will ever type']
  ]
  return (
    <section className="stats">
      {items.map(([n, suffix, label], i) => (
        <Reveal key={label} className="stats__item" delay={i * 0.08}>
          <strong>
            <CountUp to={n} suffix={suffix} />
          </strong>
          <span>{label}</span>
        </Reveal>
      ))}
    </section>
  )
}

/* ---------------------------------------------------------- real run */

const LOG: [string, string][] = [
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

function RealRun(): JSX.Element {
  return (
    <section className="section run">
      <div className="run__copy">
        <Kicker>A real run</Kicker>
        <Words text={'Every step,\nout in the open.'} className="h2" />
        <Reveal delay={0.15}>
          <p className="shead__sub">
            One sentence: “Open Chrome, go to YouTube and play Doja by Central Cee.” This is what
            TORCH did, in its own words. 16 steps, ad skipped.
          </p>
        </Reveal>
      </div>
      <Reveal delay={0.1}>
        <div className="term">
          <div className="term__bar">
            <i />
            <i />
            <i />
            <span>torch · run.log</span>
          </div>
          <motion.ol
            className="term__lines"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '0px 0px -15% 0px' }}
            transition={{ staggerChildren: 0.28 }}
          >
            {LOG.map(([t, text], i) => (
              <motion.li
                key={text}
                variants={{
                  hidden: { opacity: 0, x: -12 },
                  show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: EASE } }
                }}
                className={i === LOG.length - 1 ? 'is-last' : ''}
              >
                <span className="term__t">{t}</span>
                <span className="term__ok">
                  <Check size={11} />
                </span>
                {text}
              </motion.li>
            ))}
          </motion.ol>
        </div>
      </Reveal>
    </section>
  )
}

/* ------------------------------------------------------------ safety */

function SafetyBlock({ go }: { go: Go }): JSX.Element {
  const rules: [JSX.Element, string, string][] = [
    [
      <Shield key="a" size={18} />,
      'Asks first',
      'Sending, deleting, buying and running commands wait for your yes.'
    ],
    [
      <Lock key="b" size={18} />,
      'Payment is yours',
      'At a card form or final order button, it hands over.'
    ],
    [<Stop key="c" size={18} />, 'Stop any time', 'One button ends the task within two seconds.'],
    [
      <Eye key="d" size={18} />,
      'Opt-in screen',
      'It cannot look at your screen until you switch it on.'
    ]
  ]
  return (
    <section className="section safety">
      <div className="safety__copy">
        <SectionHead kicker="Safety" title={'Powerful.\nOn a short leash.'} />
        <div className="safety__grid">
          {rules.map(([icon, title, body], i) => (
            <Reveal key={title} delay={i * 0.06}>
              <Spotlight className="rule">
                <span className="rule__icon">{icon}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </Spotlight>
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.2}>
          <Link to="/safety" go={go} className="arrowlink">
            Read the safety rules <Arrow size={15} />
          </Link>
        </Reveal>
      </div>
      <Reveal delay={0.15} className="safety__card">
        <motion.div
          className="approval"
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="approval__head">
            <Shield size={15} /> Approve this step?
          </div>
          <p className="approval__what">Send “Q3 report” to ada@company.example</p>
          <p className="approval__why">This sends an email from your account.</p>
          <div className="approval__actions">
            <span className="btn btn--ghost btn--sm">Reject</span>
            <span className="btn btn--white btn--sm approval__yes">Approve</span>
          </div>
        </motion.div>
      </Reveal>
    </section>
  )
}

/* --------------------------------------------------------------- faq */

const FAQS: [string, string][] = [
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
    'Only what your AI needs: your request and, when screen access is on, screenshots, sent to the DeepSeek or Claude account whose key you added. Nothing comes to us.'
  ],
  [
    'Which AI does it use?',
    'Your own DeepSeek or Claude key. If one is unavailable, it switches to the other.'
  ],
  [
    'Why does Windows warn me when I install it?',
    'TORCH is new and its installer is not yet code-signed, so Windows shows “Windows protected your PC”. Click More info, then Run anyway.'
  ]
]

export function Faq(): JSX.Element {
  const [open, setOpen] = useState(0)
  return (
    <section className="section">
      <SectionHead kicker="FAQ" title="Good to know." />
      <div className="faq">
        {FAQS.map(([q, a], i) => (
          <Reveal key={q} delay={i * 0.05}>
            <div className={`faq__item ${open === i ? 'is-open' : ''}`}>
              <button
                type="button"
                onClick={() => setOpen(open === i ? -1 : i)}
                aria-expanded={open === i}
              >
                {q}
                <motion.span
                  className="faq__plus"
                  animate={{ rotate: open === i ? 45 : 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  aria-hidden="true"
                >
                  +
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.4, ease: EASE }}
                    className="faq__a"
                  >
                    <p>{a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

/* --------------------------------------------------------------- cta */

export function FinalCta({ go, children }: { go: Go; children?: ReactNode }): JSX.Element {
  return (
    <section className="cta">
      <div className="cta__ring" aria-hidden="true" />
      <div className="cta__ring cta__ring--2" aria-hidden="true" />
      <Reveal>
        <img className="cta__icon" src="icon.png" alt="" width="72" height="72" />
      </Reveal>
      <Words text={'Give it your next\nboring task.'} className="h2 cta__title" />
      <Reveal delay={0.2}>
        <p className="cta__sub">
          {children ?? 'Free for Windows 10 and 11. Bring your own DeepSeek or Claude key.'}
        </p>
      </Reveal>
      <Reveal delay={0.3} className="hero__cta">
        <DownloadButton />
        <Link to="/how" go={go} className="btn btn--ghost">
          How it works
        </Link>
      </Reveal>
    </section>
  )
}

/* -------------------------------------------------------------- page */

export default function Home({ go }: { go: Go }): JSX.Element {
  return (
    <>
      <Hero go={go} />
      <ProductShot />
      <WorksIn />
      <Bento />
      <Pinned />
      <Statement />
      <Stats />
      <RealRun />
      <SafetyBlock go={go} />
      <Faq />
      <FinalCta go={go} />
    </>
  )
}
