import { useCallback, useEffect, useRef, useState } from 'react'
import { API_BASE, torchFetch } from '../config/api'

/**
 * Whether voice typing is available, and the consent gate in front of it.
 *
 * The speech model is a separate ~148 MB download. It is never fetched
 * implicitly — faster-whisper would do that on first use — so the first time
 * the user reaches for the microphone they are asked, plainly, and can say
 * no. Saying no hides the microphone rather than leaving a button that
 * re-asks on every click.
 */

const DECLINED_KEY = 'torch_voice_model_declined'
const POLL_INTERVAL_MS = 500

export type ModelState = 'idle' | 'downloading' | 'ready' | 'error'

export interface VoiceModel {
  /** Show the microphone at all. */
  micVisible: boolean
  /** Clicking the microphone should ask before recording. */
  needsConsent: boolean
  ready: boolean
  downloadState: ModelState
  /** 0..1 while downloading. */
  progress: number
  /** Human-readable size for the prompt, e.g. "148 MB". */
  sizeLabel: string
  error: string | null
  accept: () => Promise<void>
  decline: () => void
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return 'a small'
  return `${Math.round(bytes / 1_000_000)} MB`
}

interface Capabilities {
  engine_installed?: boolean
  model_ready?: boolean
  download_bytes?: number
  state?: ModelState
  downloaded_bytes?: number
  total_bytes?: number
  error?: string | null
}

export function useVoiceModel(): VoiceModel {
  const [engineInstalled, setEngineInstalled] = useState(false)
  const [ready, setReady] = useState(false)
  const [sizeBytes, setSizeBytes] = useState(0)
  const [downloadState, setDownloadState] = useState<ModelState>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [declined, setDeclined] = useState(() => localStorage.getItem(DECLINED_KEY) === 'true')

  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  const applyStatus = useCallback((data: Capabilities): void => {
    setEngineInstalled(Boolean(data.engine_installed))
    setReady(Boolean(data.model_ready))
    if (data.download_bytes) setSizeBytes(data.download_bytes)
    if (data.state) setDownloadState(data.state)
    setError(data.error ?? null)
    const total = data.total_bytes || data.download_bytes || 0
    if (total > 0 && typeof data.downloaded_bytes === 'number') {
      setProgress(Math.max(0, Math.min(1, data.downloaded_bytes / total)))
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    torchFetch(`${API_BASE}/api/voice/capabilities`)
      .then((r) => r.json())
      .then((data: Capabilities) => {
        if (!cancelled) applyStatus(data)
      })
      .catch(() => {
        if (!cancelled) setEngineInstalled(false)
      })
    return (): void => {
      cancelled = true
      clearInterval(pollRef.current)
    }
  }, [applyStatus])

  const accept = useCallback(async (): Promise<void> => {
    setError(null)
    setDownloadState('downloading')
    setProgress(0)
    try {
      const response = await torchFetch(`${API_BASE}/api/voice/model`, { method: 'POST' })
      const data = (await response.json()) as Capabilities
      if (!response.ok) throw new Error('download-failed')
      applyStatus(data)
    } catch {
      setDownloadState('error')
      setError("TORCH couldn't start the download. Check your connection and try again.")
      return
    }

    // Poll rather than stream: the download is a background thread on the
    // backend and a dropped connection must not cancel it.
    clearInterval(pollRef.current)
    pollRef.current = setInterval(() => {
      void torchFetch(`${API_BASE}/api/voice/model`)
        .then((r) => r.json())
        .then((data: Capabilities) => {
          applyStatus(data)
          if (data.state === 'ready' || data.state === 'error') {
            clearInterval(pollRef.current)
          }
        })
        .catch(() => undefined)
    }, POLL_INTERVAL_MS)
  }, [applyStatus])

  const decline = useCallback((): void => {
    localStorage.setItem(DECLINED_KEY, 'true')
    setDeclined(true)
  }, [])

  return {
    // Hidden entirely when the user has said no, or when the engine is not
    // in this build at all.
    micVisible: engineInstalled && !declined,
    needsConsent: engineInstalled && !ready && !declined,
    ready,
    downloadState,
    progress,
    sizeLabel: formatBytes(sizeBytes),
    error,
    accept,
    decline
  }
}
