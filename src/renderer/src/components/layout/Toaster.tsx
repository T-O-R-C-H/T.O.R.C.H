import { useEffect, useState } from 'react'
import { onNotice, type Notice } from '../../utils/notify'

/**
 * Renders the notices raised with `notify()`.
 *
 * Mounted once in the main layout. Newest at the bottom, each dismissible,
 * each removing itself after its lifetime.
 */
export function Toaster(): JSX.Element {
  const [notices, setNotices] = useState<Notice[]>([])

  useEffect(() => {
    const timers = new Map<string, number>()
    const dismiss = (id: string): void => {
      setNotices((current) => current.filter((notice) => notice.id !== id))
      window.clearTimeout(timers.get(id))
      timers.delete(id)
    }
    const stop = onNotice((notice) => {
      // The same message twice in a row replaces itself instead of stacking.
      setNotices((current) => [
        ...current.filter((existing) => existing.message !== notice.message).slice(-2),
        notice
      ])
      timers.set(
        notice.id,
        window.setTimeout(() => dismiss(notice.id), notice.durationMs)
      )
    })
    return () => {
      stop()
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [])

  return (
    <div className="toaster" aria-live="polite">
      {notices.map((notice) => (
        <div key={notice.id} className="toast" data-tone={notice.tone} role="status">
          <span className="toast__dot" aria-hidden="true" />
          <span className="toast__text">{notice.message}</span>
          <button
            type="button"
            className="toast__close"
            aria-label="Dismiss"
            onClick={() =>
              setNotices((current) => current.filter((existing) => existing.id !== notice.id))
            }
          >
            <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
              <path
                d="m2 2 8 8m0-8-8 8"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
