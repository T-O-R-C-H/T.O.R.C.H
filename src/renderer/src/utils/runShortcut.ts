import { API_BASE } from '../config/api'

export interface ShortcutRunResult {
  status: string
  command: string
}

const inFlightShortcutIds = new Set<string>()
const SHORTCUT_TIMEOUT_MS = 30_000

export async function runShortcut(shortcutId: string): Promise<ShortcutRunResult> {
  if (inFlightShortcutIds.has(shortcutId)) {
    throw new Error('This shortcut is already running')
  }

  inFlightShortcutIds.add(shortcutId)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), SHORTCUT_TIMEOUT_MS)
  try {
    const response = await fetch(`${API_BASE}/api/skills/${shortcutId}/run`, {
      method: 'POST',
      signal: controller.signal
    })
    if (!response.ok) throw new Error(`Failed to run shortcut (${response.status})`)

    let raw = ''
    if (response.body) {
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        raw += decoder.decode(value, { stream: true })
      }
      raw += decoder.decode()
    } else {
      raw = await response.text()
    }

    let data: Partial<ShortcutRunResult>
    try {
      data = JSON.parse(raw) as Partial<ShortcutRunResult>
    } catch {
      throw new Error('The shortcut returned an invalid response')
    }
    if (data.status !== 'success' || typeof data.command !== 'string' || !data.command.trim()) {
      throw new Error('The shortcut did not return a valid command')
    }
    return data as ShortcutRunResult
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('The shortcut request timed out')
    }
    throw error
  } finally {
    clearTimeout(timeout)
    inFlightShortcutIds.delete(shortcutId)
  }
}
