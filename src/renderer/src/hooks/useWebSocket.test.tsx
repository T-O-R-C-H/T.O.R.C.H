import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

/**
 * Reconnection behaviour of the shared socket.
 *
 * The hook keeps its socket in module-level state shared by every consumer,
 * which is what made it worth testing: a socket that had already been
 * replaced still ran its own `onclose`, and that handler cleared
 * `wsConnected`, killed the live socket's ping timer and failed the running
 * task's steps. The result was a healthy, open connection permanently
 * reported as offline — `onopen` had already fired, so nothing set it back.
 *
 * These tests drive the real hook against a fake WebSocket rather than
 * asserting on internals, so they still hold if the implementation changes.
 */

// Tells React that act() is legitimate here, rather than a stray call in
// production code.
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('../config/api', () => ({
  API_BASE: 'http://127.0.0.1:8000',
  WS_URL: 'ws://127.0.0.1:8000/ws',
  buildWsUrl: vi.fn(async () => 'ws://127.0.0.1:8000/ws?token=test'),
  torchFetch: vi.fn(async () => new Response('{}')),
  backendReady: vi.fn(async () => undefined)
}))

const sockets: FakeWebSocket[] = []

class FakeWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  readyState = FakeWebSocket.CONNECTING
  sent: string[] = []
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null

  constructor(readonly url: string) {
    sockets.push(this)
  }

  send(payload: string): void {
    this.sent.push(payload)
  }

  /** Mirrors the browser: close() is asynchronous, onclose runs later. */
  close(): void {
    if (this.readyState === FakeWebSocket.CLOSED) return
    this.readyState = FakeWebSocket.CLOSING
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.()
  }

  /** Deliver the close event the browser would fire after close(). */
  fireClose(): void {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.()
  }

  receive(data: unknown): void {
    this.onmessage?.({ data: JSON.stringify(data) })
  }
}

let useWebSocket: typeof import('./useWebSocket').useWebSocket
let reconnectDelayMs: typeof import('./useWebSocket').reconnectDelayMs
let isSocketStale: typeof import('./useWebSocket').isSocketStale
let resetState: typeof import('./useWebSocket').__resetSocketStateForTests
let PING_INTERVAL_MS: number
let RECONNECT_MAX_MS: number
let useTorchStore: typeof import('../store/torchStore').useTorchStore

let container: HTMLDivElement
let root: Root

function Probe(): null {
  useWebSocket()
  return null
}

async function mount(): Promise<void> {
  // A fresh root each time: a remount is the scenario under test, and an
  // unmounted root cannot be rendered into again.
  root = createRoot(container)
  await act(async () => {
    root.render(<Probe />)
  })
  // Let the awaited token resolve inside openConnection.
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

async function unmount(): Promise<void> {
  await act(async () => {
    root.unmount()
  })
}

/** The socket the hook is currently using. */
function latest(): FakeWebSocket {
  return sockets[sockets.length - 1]
}

beforeEach(async () => {
  vi.stubGlobal('WebSocket', FakeWebSocket)
  vi.stubGlobal('crypto', { randomUUID: () => Math.random().toString(36).slice(2) })
  // The hook talks to the Electron bridge on mount and on every close. Only
  // the shape matters here, not what the main process would do with it.
  Object.defineProperty(window, 'torchAPI', {
    value: {
      onTaskEvent: vi.fn(),
      onTaskCommand: vi.fn(),
      removeTaskEvent: vi.fn(),
      removeTaskCommand: vi.fn(),
      publishTaskEvent: vi.fn(),
      completeVisionControl: vi.fn(),
      showGuidance: vi.fn(),
      hideGuidance: vi.fn()
    },
    configurable: true,
    writable: true
  })

  sockets.length = 0
  vi.resetModules()

  const hookModule = await import('./useWebSocket')
  useWebSocket = hookModule.useWebSocket
  reconnectDelayMs = hookModule.reconnectDelayMs
  isSocketStale = hookModule.isSocketStale
  resetState = hookModule.__resetSocketStateForTests
  PING_INTERVAL_MS = hookModule.PING_INTERVAL_MS
  RECONNECT_MAX_MS = hookModule.RECONNECT_MAX_MS
  useTorchStore = (await import('../store/torchStore')).useTorchStore

  resetState()
  useTorchStore.setState({ wsConnected: false, demoMode: false, agentStatus: 'idle' })

  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  resetState()
  vi.useRealTimers()
  container.remove()
  vi.unstubAllGlobals()
})

// ─── Backoff is bounded ───

describe('reconnectDelayMs', () => {
  it('grows with each consecutive failure', () => {
    expect(reconnectDelayMs(0)).toBeLessThan(reconnectDelayMs(1))
    expect(reconnectDelayMs(1)).toBeLessThan(reconnectDelayMs(2))
  })

  it('never exceeds the cap, however long the backend stays down', () => {
    expect(reconnectDelayMs(50)).toBe(RECONNECT_MAX_MS)
  })

  it('treats a negative attempt count as the first attempt', () => {
    expect(reconnectDelayMs(-3)).toBe(reconnectDelayMs(0))
  })
})

// ─── Liveness ───

describe('isSocketStale', () => {
  it('is false before any pong has been seen', () => {
    // A socket that has just opened has not had time to answer.
    expect(isSocketStale(0, Date.now())).toBe(false)
  })

  it('is false while replies keep arriving', () => {
    const now = Date.now()
    expect(isSocketStale(now - 1000, now)).toBe(false)
  })

  it('is true once replies stop for long enough', () => {
    const now = Date.now()
    expect(isSocketStale(now - 120_000, now)).toBe(true)
  })
})

// ─── The regression ───

describe('a replaced socket', () => {
  it('does not report the live connection as offline when it finally closes', async () => {
    await mount()
    const first = latest()
    await act(async () => first.open())
    expect(useTorchStore.getState().wsConnected).toBe(true)

    // Something replaces the socket - a reload, a wake-up, a manual
    // reconnect - and the new one comes up.
    await act(async () => {
      first.close()
    })
    await unmount()
    await mount()
    const second = latest()
    expect(second).not.toBe(first)
    await act(async () => second.open())
    expect(useTorchStore.getState().wsConnected).toBe(true)

    // Only now does the old socket's close event arrive.
    await act(async () => first.fireClose())

    expect(useTorchStore.getState().wsConnected).toBe(true)
  })

  it('does not fail the steps of a task running on the live socket', async () => {
    await mount()
    const first = latest()
    await act(async () => first.open())

    await act(async () => {
      first.close()
    })
    await unmount()
    await mount()
    await act(async () => latest().open())

    useTorchStore.setState({
      agentStatus: 'executing',
      messages: [
        {
          id: 'm1',
          role: 'torch',
          content: '',
          timestamp: Date.now(),
          steps: [
            {
              id: 's1',
              label: 'Looking for your file',
              status: 'active' as const,
              tool: 'find_file',
              args: {},
              requiresApproval: false
            }
          ]
        }
      ]
    })

    await act(async () => first.fireClose())

    const store = useTorchStore.getState()
    expect(store.agentStatus).toBe('executing')
    expect(store.messages[0].steps?.[0].status).toBe('active')
  })
})

// ─── Reconnecting after a real drop ───

describe('when the live socket drops', () => {
  it('marks the app disconnected', async () => {
    await mount()
    await act(async () => latest().open())
    await act(async () => latest().fireClose())

    expect(useTorchStore.getState().wsConnected).toBe(false)
  })

  it('opens exactly one replacement, not one per close handler', async () => {
    vi.useFakeTimers()
    await mount()
    await act(async () => latest().open())
    const opened = sockets.length

    await act(async () => latest().fireClose())
    await act(async () => {
      vi.advanceTimersByTime(RECONNECT_MAX_MS * 2)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(sockets.length).toBe(opened + 1)
  })

  it('comes back connected once the replacement opens', async () => {
    vi.useFakeTimers()
    await mount()
    await act(async () => latest().open())
    await act(async () => latest().fireClose())
    expect(useTorchStore.getState().wsConnected).toBe(false)

    await act(async () => {
      vi.advanceTimersByTime(RECONNECT_MAX_MS)
      await Promise.resolve()
      await Promise.resolve()
    })
    await act(async () => latest().open())

    expect(useTorchStore.getState().wsConnected).toBe(true)
  })

  it('does not reconnect in demo mode', async () => {
    vi.useFakeTimers()
    await mount()
    await act(async () => latest().open())
    const opened = sockets.length

    useTorchStore.setState({ demoMode: true })
    await act(async () => latest().fireClose())
    await act(async () => {
      vi.advanceTimersByTime(RECONNECT_MAX_MS * 2)
      await Promise.resolve()
    })

    expect(sockets.length).toBe(opened)
  })
})

// ─── A socket that lies about being open ───

describe('a socket that stops answering', () => {
  it('is closed so the reconnect path can run', async () => {
    vi.useFakeTimers()
    await mount()
    const socket = latest()
    await act(async () => socket.open())

    // No pong ever comes back - the shape of a slept laptop, where the
    // socket keeps reporting OPEN with nothing flowing.
    await act(async () => {
      vi.advanceTimersByTime(PING_INTERVAL_MS * 12)
      await Promise.resolve()
    })

    expect(socket.readyState).not.toBe(FakeWebSocket.OPEN)
  })

  it('is left alone while pongs keep arriving', async () => {
    vi.useFakeTimers()
    await mount()
    const socket = latest()
    await act(async () => socket.open())

    for (let i = 0; i < 12; i += 1) {
      await act(async () => {
        vi.advanceTimersByTime(PING_INTERVAL_MS)
        await Promise.resolve()
      })
      await act(async () => socket.receive({ type: 'pong', ts: Date.now() }))
    }

    expect(socket.readyState).toBe(FakeWebSocket.OPEN)
    expect(socket.sent.length).toBeGreaterThan(0)
  })
})
