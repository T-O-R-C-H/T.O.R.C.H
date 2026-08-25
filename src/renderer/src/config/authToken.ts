/**
 * Session token for talking to the backend.
 *
 * Electron generates the token at launch and hands it to both the Python
 * process and this renderer. The first caller triggers the IPC round-trip and
 * every later caller awaits the same promise, so nothing needs to gate app
 * startup on fetching it.
 */
let cached: Promise<string> | null = null

export function getAuthToken(): Promise<string> {
  if (!cached) {
    cached = Promise.resolve(window.torchAPI?.getAuthToken?.() ?? '').catch(() => '')
  }
  return cached
}
