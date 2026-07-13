import { useEffect, useRef, useState } from 'react'
import type { AgentStatus } from '../../store/torchStore'
import { useTorchStore } from '../../store/torchStore'

const SLOW_THRESHOLD_MS = 8000
const TIMEOUT_MS = 28000
const OFFLINE_STOP_MS = 20000

function statusLabel(
  status: AgentStatus,
  slow: boolean,
  offline: boolean,
  timedOut: boolean,
  reconnected: boolean
): string {
  if (timedOut) return 'Stopping, this took too long…'
  if (offline) return 'Reconnecting…'
  if (reconnected) return 'Waiting for response…'
  if (slow) return 'Taking longer than expected…'
  switch (status) {
    case 'processing':
      return 'Waiting for response…'
    case 'executing':
      return 'Planning next move…'
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
}

export function AgentActivity({ status, startedAt, onTimeout }: AgentActivityProps): JSX.Element {
  const [slow, setSlow] = useState(false)
  const [browserOffline, setBrowserOffline] = useState(!navigator.onLine)
  const [timedOut, setTimedOut] = useState(false)
  const [reconnected, setReconnected] = useState(false)
  const wsConnected = useTorchStore((s) => s.wsConnected)
  const demoMode = useTorchStore((s) => s.demoMode)
  const firedRef = useRef(false)
  const wasOfflineRef = useRef(false)

  const showOffline = browserOffline || (!demoMode && !wsConnected)

  useEffect(() => {
    setSlow(false)
    setTimedOut(false)
    setReconnected(false)
    firedRef.current = false
    wasOfflineRef.current = showOffline

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
      return () => clearTimeout(offlineTimer)
    }

    const slowTimer = setTimeout(() => setSlow(true), Math.max(SLOW_THRESHOLD_MS - elapsed, 0))
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
      clearTimeout(slowTimer)
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

  return (
    <div className={`chat-turn__activity ${timedOut ? 'chat-turn__activity--warn' : ''}`}>
      {!timedOut && (
        <span className="chat-turn__activity-dots">
          <span className="typing-square" />
          <span className="typing-square" />
          <span className="typing-square" />
        </span>
      )}
      <span className="chat-turn__activity-label">
        {statusLabel(status, slow, showOffline, timedOut, reconnected)}
      </span>
    </div>
  )
}

export function useAgentWatchdog(
  active: boolean,
  startedAt: number | undefined,
  onTimeout: () => void
): void {
  useEffect(() => {
    if (!active || !startedAt) return

    const wsConnected = useTorchStore.getState().wsConnected
    const demoMode = useTorchStore.getState().demoMode
    const offline = !navigator.onLine || (!demoMode && !wsConnected)
    const limit = offline ? OFFLINE_STOP_MS : TIMEOUT_MS
    const elapsed = Date.now() - startedAt
    const timer = setTimeout(onTimeout, Math.max(limit - elapsed, 0))
    return () => clearTimeout(timer)
  }, [active, startedAt, onTimeout])
}
