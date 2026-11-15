import type { JSX } from 'react'
import { Arrow } from '../icons'
import { Link, Reveal, Words } from '../ui'
import type { Go } from '../ui'

export default function NotFound({ go }: { go: Go }): JSX.Element {
  return (
    <section className="notfound">
      <Reveal>
        <span className="notfound__code">404</span>
      </Reveal>
      <Words as="h1" text={'Nothing here.\nNot even TORCH.'} className="h1" />
      <Reveal delay={0.4}>
        <p className="pagehead__sub">The page you asked for does not exist.</p>
      </Reveal>
      <Reveal delay={0.5}>
        <Link to="/" go={go} className="btn btn--white">
          Back home <Arrow size={16} />
        </Link>
      </Reveal>
    </section>
  )
}
