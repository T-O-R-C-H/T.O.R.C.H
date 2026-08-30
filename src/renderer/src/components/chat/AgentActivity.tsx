import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { AgentStatus } from '../../store/torchStore'
import { useTorchStore } from '../../store/torchStore'
import { TorchMark } from '../ui/TorchMark'

const SLOW_THRESHOLD_MS = 8000
const VERY_SLOW_THRESHOLD_MS = 15000
const TIMEOUT_MS = 45000
const OFFLINE_STOP_MS = 20000

function statusLabel(
  status: AgentStatus,
  slow: boolean,
  offline: boolean,
  timedOut: boolean,
  reconnected: boolean,
  wsPhase: 'disconnected' | 'connecting' | 'connected',
  hasConnectedOnce: boolean
): string {
  if (timedOut) return 'Stopping, this took too long…'

  if (!hasConnectedOnce && (offline || wsPhase === 'connecting')) {
    return 'Connecting to TORCH…'
  }

  if (offline) return 'Reconnecting…'
  if (reconnected) return 'Waiting for response…'
  if (slow) return 'Still working — this may take a moment…'
  switch (status) {
    case 'processing':
      return 'Waiting for response…'
    case 'executing':
      return 'Planning next move…'
    case 'awaiting_input':
      return 'Waiting for your choice…'
    case 'awaiting_approval':
      return 'Waiting for your approval…'
    case 'listening':
      return 'Listening…'
    case 'speaking':
      return 'Speaking…'
    default:
      return 'Working…'
  }
}

interface AgentActivityProps {
  status: AgentStatus
  startedAt?: number
  onTimeout?: () => void
  onStop?: () => void
}

export function AgentActivity({
  status,
  startedAt,
  onTimeout,
  onStop
}: AgentActivityProps): JSX.Element {
  const [slow, setSlow] = useState(false)
  const [verySlow, setVerySlow] = useState(false)
  const [browserOffline, setBrowserOffline] = useState(!navigator.onLine)
  const [timedOut, setTimedOut] = useState(false)
  const [reconnected, setReconnected] = useState(false)

  const wsConnected = useTorchStore((s) => s.wsConnected)
  const wsPhase = useTorchStore((s) => s.wsPhase)
  const hasConnectedOnce = useTorchStore((s) => s.hasConnectedOnce)
  const demoMode = useTorchStore((s) => s.demoMode)

  const firedRef = useRef(false)
  const wasOfflineRef = useRef(false)

  const showOffline = browserOffline || (!demoMode && !wsConnected)

  useEffect(() => {
    const resetTimer = window.setTimeout(() => {
      setSlow(false)
      setVerySlow(false)
      setTimedOut(false)
      setReconnected(false)
      firedRef.current = false
      wasOfflineRef.current = showOffline
    }, 0)

    const elapsed = startedAt ? Date.now() - startedAt : 0

    if (showOffline) {
      const offlineTimer = setTimeout(
        () => {
          if (!firedRef.current) {
            firedRef.current = true
            setTimedOut(true)
            onTimeout?.()
          }
        },
        Math.max(OFFLINE_STOP_MS - elapsed, 0)
      )
      return () => {
        clearTimeout(offlineTimer)
        clearTimeout(resetTimer)
      }
    }

    // While the user is choosing (approval / an answer), never time out.
    if (status === 'awaiting_approval' || status === 'awaiting_input') {
      return () => clearTimeout(resetTimer)
    }

    const slowTimer = setTimeout(() => setSlow(true), Math.max(SLOW_THRESHOLD_MS - elapsed, 0))
    const verySlowTimer = setTimeout(
      () => setVerySlow(true),
      Math.max(VERY_SLOW_THRESHOLD_MS - elapsed, 0)
    )
    const timeoutTimer = setTimeout(
      () => {
        if (!firedRef.current) {
          firedRef.current = true
          setTimedOut(true)
          onTimeout?.()
        }
      },
      Math.max(TIMEOUT_MS - elapsed, 0)
    )

    return () => {
      clearTimeout(resetTimer)
      clearTimeout(slowTimer)
      clearTimeout(verySlowTimer)
      clearTimeout(timeoutTimer)
    }
  }, [status, startedAt, onTimeout, showOffline])

  useEffect(() => {
    const sync = (): void => setBrowserOffline(!navigator.onLine)
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    sync()
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])

  useEffect(() => {
    if (wasOfflineRef.current && !showOffline) {
      setReconnected(true)
      setTimedOut(false)
      firedRef.current = false
      const clearReconnect = setTimeout(() => setReconnected(false), 4000)
      return () => clearTimeout(clearReconnect)
    }
    wasOfflineRef.current = showOffline
    return undefined
  }, [showOffline])

  const label = statusLabel(
    status,
    slow,
    showOffline,
    timedOut,
    reconnected,
    wsPhase,
    hasConnectedOnce
  )

  const activityClasses = [
    'chat-turn__activity',
    timedOut ? 'chat-turn__activity--warn' : '',
    slow && !timedOut ? 'chat-turn__activity--slow' : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="flex flex-col gap-2">
      <div className={activityClasses}>
        {!timedOut && (
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={`${status}-${slow}-${showOffline}-${timedOut}-${reconnected}`}
              className="chat-turn__activity-label"
              initial={{ opacity: 0, y: 4, filter: 'blur(3px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -3, filter: 'blur(2px)' }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="chat-turn__activity-pill">
                {/* The cycling mark is the app's "work is happening" signal.
                    The label carries which kind of work, so the mark does not
                    need a per-status variant of its own. */}
                <TorchMark size={18} active />
                <span className="chat-turn__activity-text">{label}</span>
              </span>
            </motion.span>
          </AnimatePresence>
        )}
      </div>

      {verySlow && !timedOut && onStop && (
        <div className="flex items-center gap-3 text-xs pl-8 text-[var(--color-torch-text-secondary)]">
          <span>You can stop the task if needed.</span>
          <button
            type="button"
            onClick={onStop}
            className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold border border-[var(--color-torch-border)] hover:bg-[rgba(255,255,255,0.05)] transition-colors"
            style={{ color: 'var(--color-torch-error, #ef4444)' }}
          >
            Stop task
          </button>
        </div>
      )}
    </div>
  )
}
