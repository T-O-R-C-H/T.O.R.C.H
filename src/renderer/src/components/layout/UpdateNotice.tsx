import { useEffect, useState } from 'react'

/**
 * Tells the user a new version is downloaded and waiting.
 *
 * Deliberately passive: TORCH may be mid-task with the agent driving the
 * screen, so restarting is always the user's choice. Dismissing leaves the
 * update to apply the next time they quit.
 */
export function UpdateNotice(): JSX.Element | null {
  const [version, setVersion] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    window.torchAPI?.onUpdateReady?.((info) => setVersion(info?.version ?? ''))
  }, [])

  if (!version || dismissed) return null

  return (
    <div className="update-notice">
      <span className="update-notice__text">
        A new version of TORCH is ready{version ? ` (${version})` : ''}.
      </span>
      <button
        type="button"
        className="update-notice__action"
        onClick={() => window.torchAPI?.installUpdate?.()}
      >
        Restart now
      </button>
      <button
        type="button"
        className="update-notice__dismiss"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
      >
        Later
      </button>
    </div>
  )
}
