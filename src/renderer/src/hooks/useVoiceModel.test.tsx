import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

/**
 * The consent gate in front of the speech model.
 *
 * The model is a separate ~148 MB download and faster-whisper would fetch it
 * on first use. Nothing here may start that without an explicit yes, and a no
 * has to stick — a prompt that reappears on every click is not a choice.
 */
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const fetchMock = vi.fn()

vi.mock('../config/api', () => ({
  API_BASE: 'http://127.0.0.1:8000',
  torchFetch: (...args: unknown[]) => fetchMock(...args)
}))

let useVoiceModel: typeof import('./useVoiceModel').useVoiceModel
let formatBytes: typeof import('./useVoiceModel').formatBytes
let container: HTMLDivElement
let root: Root
/* Named ...Ref so the immutability rule recognises the holder pattern: a
   component may not reassign an outer binding, but may write through one. */
const hookRef: { current: ReturnType<typeof import('./useVoiceModel').useVoiceModel> | null } = {
  current: null
}
const latest = (): NonNullable<typeof hookRef.current> => hookRef.current!

function json(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as unknown as Response
}

function Probe(): null {
  // Capturing the hook's return value is the point of this component. The
  // immutability rule is aimed at production components writing to shared
  // state, which is not what a test probe is doing.
  // eslint-disable-next-line react-hooks/immutability
  hookRef.current = useVoiceModel()
  return null
}

async function mount(): Promise<void> {
  root = createRoot(container)
  await act(async () => {
    root.render(<Probe />)
  })
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

beforeEach(async () => {
  vi.resetModules()
  fetchMock.mockReset()
  localStorage.clear()
  const mod = await import('./useVoiceModel')
  useVoiceModel = mod.useVoiceModel
  formatBytes = mod.formatBytes
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(async () => {
  await act(async () => root?.unmount())
  container.remove()
  vi.useRealTimers()
})

describe('formatBytes', () => {
  it('quotes megabytes the user can compare against the real download', () => {
    expect(formatBytes(148_000_000)).toBe('148 MB')
  })

  it('degrades to a word rather than showing a nonsense size', () => {
    expect(formatBytes(0)).toBe('a small')
  })
})

describe('useVoiceModel', () => {
  it('hides the microphone when the engine is not in this build', async () => {
    fetchMock.mockResolvedValue(json({ engine_installed: false, model_ready: false }))
    await mount()

    expect(latest().micVisible).toBe(false)
    expect(latest().needsConsent).toBe(false)
  })

  it('offers the microphone and asks first when the model is missing', async () => {
    fetchMock.mockResolvedValue(
      json({ engine_installed: true, model_ready: false, download_bytes: 148_000_000 })
    )
    await mount()

    expect(latest().micVisible).toBe(true)
    expect(latest().needsConsent).toBe(true)
    expect(latest().sizeLabel).toBe('148 MB')
  })

  it('stops asking once the model is on disk', async () => {
    fetchMock.mockResolvedValue(json({ engine_installed: true, model_ready: true }))
    await mount()

    expect(latest().micVisible).toBe(true)
    expect(latest().needsConsent).toBe(false)
    expect(latest().ready).toBe(true)
  })

  it('downloads nothing while it is only reporting status', async () => {
    fetchMock.mockResolvedValue(json({ engine_installed: true, model_ready: false }))
    await mount()

    // The status read is a GET; nothing has been asked to start.
    const posts = fetchMock.mock.calls.filter(
      (call) => (call[1] as { method?: string } | undefined)?.method === 'POST'
    )
    expect(posts).toHaveLength(0)
  })

  it('starts the download only when accept is called', async () => {
    fetchMock.mockResolvedValue(
      json({ engine_installed: true, model_ready: false, download_bytes: 148_000_000 })
    )
    await mount()

    fetchMock.mockResolvedValue(json({ state: 'downloading', downloaded_bytes: 0 }))
    await act(async () => {
      await latest().accept()
    })

    const posts = fetchMock.mock.calls.filter(
      (call) => (call[1] as { method?: string } | undefined)?.method === 'POST'
    )
    expect(posts).toHaveLength(1)
    expect(String(posts[0][0])).toContain('/api/voice/model')
  })

  it('hides the microphone for good once declined', async () => {
    fetchMock.mockResolvedValue(json({ engine_installed: true, model_ready: false }))
    await mount()

    await act(async () => {
      latest().decline()
    })

    expect(latest().micVisible).toBe(false)
    expect(latest().needsConsent).toBe(false)
  })

  it('remembers a decline across restarts', async () => {
    fetchMock.mockResolvedValue(json({ engine_installed: true, model_ready: false }))
    await mount()
    await act(async () => latest().decline())

    // A fresh mount, as if the app had been reopened.
    await act(async () => root.unmount())
    await mount()

    expect(latest().micVisible).toBe(false)
  })

  it('reports progress the indicator can render', async () => {
    fetchMock.mockResolvedValue(
      json({ engine_installed: true, model_ready: false, download_bytes: 148_000_000 })
    )
    await mount()

    fetchMock.mockResolvedValue(
      json({ state: 'downloading', downloaded_bytes: 37_000_000, total_bytes: 148_000_000 })
    )
    await act(async () => {
      await latest().accept()
    })

    expect(latest().downloadState).toBe('downloading')
    expect(latest().progress).toBeCloseTo(0.25, 2)
  })

  it('surfaces a failed download in plain language', async () => {
    fetchMock.mockResolvedValue(json({ engine_installed: true, model_ready: false }))
    await mount()

    fetchMock.mockRejectedValue(new Error('offline'))
    await act(async () => {
      await latest().accept()
    })

    expect(latest().downloadState).toBe('error')
    expect(latest().error).toBeTruthy()
    expect(latest().error).not.toContain('offline')
  })
})
