import { getAuthToken } from './authToken'

/** Backend base URL — override with VITE_TORCH_API_URL in production builds if needed */
export const API_BASE = import.meta.env.VITE_TORCH_API_URL ?? 'http://127.0.0.1:8000'
export const WS_URL = API_BASE.replace(/^http/, 'ws') + '/ws'

/**
 * fetch() with the backend session token attached.
 *
 * Every REST call must go through this — the backend rejects unauthenticated
 * requests, so a plain fetch() silently 401s. Takes the same arguments as
 * fetch() so call sites only swap the function name.
 */
export async function torchFetch(input: string, init: RequestInit = {}): Promise<Response> {
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
  const token = await getAuthToken()
  return token ? `${WS_URL}?token=${encodeURIComponent(token)}` : WS_URL
}
