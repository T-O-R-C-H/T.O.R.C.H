/**
 * Brief in-app notices.
 *
 * These replace `alert()`. A native alert in a frameless Electron window is a
 * grey system dialog titled with the page's address, which blocks the whole
 * app until it is dismissed - it looks like a crash, and it stopped a running
 * task's updates from rendering while it was open.
 *
 * `notify` can be called from anywhere, including outside React; the
 * `<Toaster />` in the main layout is the one listener.
 */

export type NoticeTone = 'info' | 'success' | 'error'

export interface Notice {
  id: string
  message: string
  tone: NoticeTone
  durationMs: number
}

type Listener = (notice: Notice) => void

const listeners = new Set<Listener>()
let counter = 0

export function notify(message: string, tone: NoticeTone = 'info'): void {
  const text = message.trim()
  if (!text) return
  counter += 1
  const notice: Notice = {
    id: `notice-${counter}`,
    message: text,
    tone,
    // Errors stay longer: they are the ones worth reading twice.
    durationMs: tone === 'error' ? 7000 : 4000
  }
  listeners.forEach((listener) => listener(notice))
}

export function onNotice(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
