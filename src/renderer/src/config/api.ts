import { getAuthToken } from './authToken'

/** Backend base URL — override with VITE_TORCH_API_URL in production builds if needed */
export const API_BASE = import.meta.env.VITE_TORCH_API_URL ?? 'http://127.0.0.1:8000'
export const WS_URL = API_BASE.replace(/^http/, 'ws') + '/ws'

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
      void api.getBackendPhase().then(settle).catch(() => resolve())
      setTimeout(resolve, 90000)
    })
  }
  return readyPromise
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
  const token = await getAuthToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(input, { ...init, headers })
}

/**
 * WebSocket URL carrying the session token.
 *
 * Browsers cannot set headers on a WebSocket handshake, so the token travels
 * as a query parameter; the backend checks it before accepting the connection.
 */
export async function buildWsUrl(): Promise<string> {
  await backendReady()
  const token = await getAuthToken()
  return token ? `${WS_URL}?token=${encodeURIComponent(token)}` : WS_URL
}
