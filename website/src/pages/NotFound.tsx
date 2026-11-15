import type { JSX } from 'react'
import { Link } from '../components'
import type { Go } from '../components'
import { Arrow, Stop } from '../icons'
import { Window } from '../os'

export default function NotFound({ go }: { go: Go }): JSX.Element {
  return (
    <Window title="error — not found" icon={<Stop size={13} />} go={go}>
      <section className="notfound">
        <span className="notfound__code">404</span>
        <h1>
          Nothing here.
          <br />
          <em>Not even TORCH.</em>
        </h1>
        <p className="lead">The page you asked for does not exist.</p>
        <Link to="/" go={go} className="btn btn--ink">
          Back home <Arrow size={16} />
        </Link>
      </section>
    </Window>
  )
}
