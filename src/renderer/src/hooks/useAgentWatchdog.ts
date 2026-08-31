import { useEffect } from 'react'
import { useTorchStore } from '../store/torchStore'

const TIMEOUT_MS = 45000
const OFFLINE_STOP_MS = 20000

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
