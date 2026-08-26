import { describe, it, expect, beforeEach } from 'vitest'
import { useTorchStore, type Message } from './torchStore'

/**
 * The store is what the chat renders from, so step updates arriving out of a
 * task's happy path (a failure, a stop, a late message) have to land on the
 * right message without disturbing anything else.
 */

const initialState = useTorchStore.getState()

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    role: 'torch',
    content: 'Working on it',
    timestamp: 0,
    steps: [
      { id: 'step-1', tool: 'find_file', label: 'Looking for your file', status: 'active' },
      { id: 'step-2', tool: 'send_email', label: 'Sending your email', status: 'pending' }
    ],
    ...overrides
  } as Message
}

beforeEach(() => {
  useTorchStore.setState(initialState, true)
})

describe('messages', () => {
  it('appends messages in order', () => {
    const { addMessage } = useTorchStore.getState()
    addMessage(message({ id: 'a' }))
    addMessage(message({ id: 'b' }))

    expect(useTorchStore.getState().messages.map((m) => m.id)).toEqual(['a', 'b'])
  })

  it('appends streamed content to the right message', () => {
    const { addMessage, appendMessageContent } = useTorchStore.getState()
    addMessage(message({ id: 'a', content: 'Hello' }))
    addMessage(message({ id: 'b', content: 'Other' }))

    appendMessageContent('a', ' there')

    const messages = useTorchStore.getState().messages
    expect(messages.find((m) => m.id === 'a')?.content).toBe('Hello there')
    expect(messages.find((m) => m.id === 'b')?.content).toBe('Other')
  })

  it('ignores content for an unknown message', () => {
    const { addMessage, appendMessageContent } = useTorchStore.getState()
    addMessage(message({ id: 'a', content: 'Hello' }))

    appendMessageContent('missing', 'ignored')

    expect(useTorchStore.getState().messages[0].content).toBe('Hello')
  })

  it('clears messages', () => {
    const { addMessage, clearMessages } = useTorchStore.getState()
    addMessage(message())
    clearMessages()

    expect(useTorchStore.getState().messages).toEqual([])
  })
})

describe('step updates', () => {
  it('updates only the targeted step', () => {
    const { addMessage, updateStep } = useTorchStore.getState()
    addMessage(message())

    updateStep('msg-1', 'step-1', { status: 'done' })

    const steps = useTorchStore.getState().messages[0].steps!
    expect(steps[0].status).toBe('done')
    expect(steps[1].status).toBe('pending')
  })

  it('records a failure with its plain-language reason', () => {
    const { addMessage, updateStep } = useTorchStore.getState()
    addMessage(message())

    updateStep('msg-1', 'step-1', {
      status: 'failed',
      error: "I couldn't find that file."
    })

    const step = useTorchStore.getState().messages[0].steps![0]
    expect(step.status).toBe('failed')
    expect(step.error).toBe("I couldn't find that file.")
  })

  it('leaves other messages untouched', () => {
    const { addMessage, updateStep } = useTorchStore.getState()
    addMessage(message({ id: 'msg-1' }))
    addMessage(message({ id: 'msg-2' }))

    updateStep('msg-1', 'step-1', { status: 'done' })

    expect(useTorchStore.getState().messages[1].steps![0].status).toBe('active')
  })

  it('ignores updates for an unknown step', () => {
    const { addMessage, updateStep } = useTorchStore.getState()
    addMessage(message())

    expect(() => updateStep('msg-1', 'missing-step', { status: 'done' })).not.toThrow()
    expect(useTorchStore.getState().messages[0].steps).toHaveLength(2)
  })
})

describe('connection state', () => {
  it('tracks connect and disconnect', () => {
    const { setWsConnected, setWsPhase } = useTorchStore.getState()

    setWsConnected(true)
    setWsPhase('connected')
    expect(useTorchStore.getState().wsConnected).toBe(true)

    setWsConnected(false)
    setWsPhase('disconnected')
    expect(useTorchStore.getState().wsConnected).toBe(false)
    expect(useTorchStore.getState().wsPhase).toBe('disconnected')
  })

  it('remembers that a connection was once established', () => {
    // Drives "Connecting..." vs "Reconnecting..." in the UI.
    expect(useTorchStore.getState().hasConnectedOnce).toBe(false)

    useTorchStore.getState().setHasConnectedOnce(true)
    expect(useTorchStore.getState().hasConnectedOnce).toBe(true)
  })
})

describe('metrics', () => {
  it('merges partial updates', () => {
    const { setMetrics } = useTorchStore.getState()
    const before = useTorchStore.getState().metrics.successRate

    setMetrics({ tasksCompleted: 5 })

    const metrics = useTorchStore.getState().metrics
    expect(metrics.tasksCompleted).toBe(5)
    expect(metrics.successRate).toBe(before)
  })

  it('starts new users at zero', () => {
    expect(useTorchStore.getState().metrics.tasksCompleted).toBe(0)
  })
})

describe('task outcomes', () => {
  it('keeps the correlated terminal result for onboarding to inspect', () => {
    useTorchStore.getState().setLastTaskOutcome({
      requestId: 'first-task-1',
      status: 'completed',
      summary: 'Contents of your home folder'
    })

    expect(useTorchStore.getState().lastTaskOutcome).toEqual({
      requestId: 'first-task-1',
      status: 'completed',
      summary: 'Contents of your home folder'
    })
  })

  it('does not persist onboarding completion until explicitly finalized', () => {
    useTorchStore.getState().setLastTaskOutcome({
      requestId: 'first-task-2',
      status: 'completed',
      summary: 'Done'
    })

    expect(useTorchStore.getState().onboardingComplete).toBe(false)
    expect(localStorage.getItem('torch_onboarding_complete')).not.toBe('true')

    useTorchStore.getState().setOnboardingComplete(true)
    expect(localStorage.getItem('torch_onboarding_complete')).toBe('true')
  })
})
