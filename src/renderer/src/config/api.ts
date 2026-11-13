import { getAuthToken } from './authToken'

const BACKEND_HOST = '127.0.0.1'
const DEFAULT_PORT = 8000

/**
 * Prefix for backend URLs, as written at call sites.
 *
 * Call sites build `${API_BASE}/api/...` synchronously, but the real port is
 * only known at runtime: the main process picks a free one at launch and it
 * can change if the backend restarts. So this constant is a stable prefix,
 * and `torchFetch` swaps it for the live address at the moment of the call.
 * A URL built from API_BASE and passed to anything other than `torchFetch`
 * would miss both that and the session token - there is no supported way to
 * do that.
 */
export const API_BASE =
  import.meta.env.VITE_TORCH_API_URL ?? `http://${BACKEND_HOST}:${DEFAULT_PORT}`

/**
 * Resolves once the backend is accepting requests.
 *
 * The renderer is up long before Python finishes starting, so calls made in
 * that window used to fail with ERR_CONNECTION_REFUSED. Waiting here means a
 * cold start is slower rather than broken.
 */
let readyPromise: Promise<void> | null = null

function backendReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = new Promise<void>((resolve) => {
      const api = window.torchAPI
      if (!api?.getBackendPhase) {
        resolve()
        return
      }
      // Resolve on whichever comes first: the current phase already being
      // ready, a later phase event, or the timeout backstop.
      const settle = (phase: string): void => {
        if (phase === 'ready' || phase === 'failed') resolve()
      }
      api.onBackendPhase?.(settle)
      void api
        .getBackendPhase()
        .then(settle)
        .catch(() => resolve())
      setTimeout(resolve, 90000)
    })
  }
  return readyPromise
}

/**
 * Where the backend actually is right now.
 *
 * Asked fresh each time rather than cached: it is one cheap IPC round-trip,
 * and a cached port would go stale the first time the backend restarted onto
 * a different one.
 */
async function liveBase(): Promise<string> {
  if (import.meta.env.VITE_TORCH_API_URL) return API_BASE
  try {
    const port = await window.torchAPI?.getBackendPort?.()
    if (typeof port === 'number' && port > 0) return `http://${BACKEND_HOST}:${port}`
  } catch {
    // Outside Electron (tests, a browser preview) there is no bridge.
  }
  return API_BASE
}

/** Point a URL written against API_BASE at the live backend. */
export function rebase(url: string, base: string): string {
  return url.startsWith(API_BASE) ? base + url.slice(API_BASE.length) : url
}

/**
 * fetch() with the backend session token attached.
 *
 * Every REST call must go through this — the backend rejects unauthenticated
 * requests, so a plain fetch() silently 401s. Takes the same arguments as
 * fetch() so call sites only swap the function name.
 */
export async function torchFetch(input: string, init: RequestInit = {}): Promise<Response> {
  await backendReady()
  const [token, base] = await Promise.all([getAuthToken(), liveBase()])
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(rebase(input, base), { ...init, headers })
}

/**
 * WebSocket URL carrying the session token.
 *
 * Browsers cannot set headers on a WebSocket handshake, so the token travels
 * as a query parameter; the backend checks it before accepting the connection.
 */
export async function buildWsUrl(): Promise<string> {
  await backendReady()
  const [token, base] = await Promise.all([getAuthToken(), liveBase()])
  const wsUrl = base.replace(/^http/, 'ws') + '/ws'
  return token ? `${wsUrl}?token=${encodeURIComponent(token)}` : wsUrl
}
