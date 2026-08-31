import { TorchMark } from '../ui/TorchMark'

/**
 * The companion's title bar.
 *
 * The screen indicator reports what is actually happening. Screenshot capture
 * is not built yet (it is step 2 of the spec's order), so this reads "Screen
 * context off" rather than the spec's "watching your screen" — claiming to
 * watch a screen nothing is looking at is the exact class of thing the
 * honesty pass removed from the rest of the app. When capture lands, the
 * `watching` prop turns this into the live state.
 */
export function CompanionHeader({
  busy,
  watching,
  onToggleWatching,
  onClose
}: {
  busy: boolean
  watching: boolean
  onToggleWatching: () => void
  onClose: () => void
}): JSX.Element {
  return (
    <header className="companion__head drag-region">
      <TorchMark size={16} active={busy} />
      <span className="companion__title">TORCH</span>

      <button
        type="button"
        className={`companion__watch no-drag ${watching ? 'companion__watch--on' : ''}`}
        onClick={onToggleWatching}
        aria-pressed={watching}
        title={
          watching
            ? 'TORCH sends what is on screen with each message'
            : 'Screen context is not available yet'
        }
      >
        <span className="companion__watch-dot" aria-hidden="true" />
        {watching ? 'Watching your screen' : 'Screen context off'}
      </button>

      <button
        type="button"
        className="companion__close no-drag"
        onClick={onClose}
        aria-label="Close companion"
        title="Close"
      >
        ✕
      </button>
    </header>
  )
}
