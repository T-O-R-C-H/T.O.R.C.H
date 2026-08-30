import { useEffect, useRef, useCallback } from 'react'
import { useTorchStore, type Message, type TerminalLine } from '../store/torchStore'
import { buildWsUrl } from '../config/api'
import { formatAgentContent } from '../utils/plainLanguage'
import { streamMessageContent } from '../utils/streamContent'

let sharedSocket: WebSocket | null = null
let sharedReconnectTimer: ReturnType<typeof setTimeout> | undefined
let sharedPingInterval: ReturnType<typeof setInterval> | undefined
let sharedConsumerCount = 0
let sharedTaskOwnerSocket: WebSocket | null = null

/*
 * Opening a socket needs an await (the session token), which leaves a window
 * where two callers both see no socket and both open one. This marks that
 * window so the second caller stands down instead.
 */
let sharedConnecting = false

/*
 * Consecutive failed attempts, for backoff. Reset the moment a socket opens,
 * so a blip costs one short wait rather than putting the app into a long
 * retry interval it never climbs out of.
 */
let sharedReconnectAttempts = 0

/*
 * When the last pong came back. A slept laptop or a dropped route leaves the
 * socket reporting OPEN with nothing flowing in either direction, so
 * readyState alone cannot tell a live connection from a dead one — only the
 * absence of replies can.
 */
let sharedLastPongAt = 0

export const RECONNECT_BASE_MS = 1000
export const RECONNECT_MAX_MS = 30000
export const PING_INTERVAL_MS = 10000
/** Three missed pings. Long enough to ride out a slow reply, short enough to notice a sleep. */
export const PONG_TIMEOUT_MS = 35000

/** True when pings have gone unanswered long enough to call the socket dead. */
export function isSocketStale(lastPongAt: number, now: number): boolean {
  return lastPongAt > 0 && now - lastPongAt > PONG_TIMEOUT_MS
}

export function recordPong(at: number = Date.now()): void {
  sharedLastPongAt = at
}

/** Exponential backoff, capped, so a backend that is down is not hammered. */
export function reconnectDelayMs(attempt: number): number {
  return Math.min(RECONNECT_BASE_MS * 2 ** Math.max(0, attempt), RECONNECT_MAX_MS)
}

/**
 * Whether this socket is still the one the app is using.
 *
 * A closing socket fires `onclose` asynchronously, so by the time it runs a
 * replacement may already be open. Without this guard the dead socket's
 * handler set wsConnected to false, cleared the live socket's ping interval
 * and failed the running task's steps — leaving a healthy connection
 * permanently reported as offline, because `onopen` had already fired and
 * nothing set it true again.
 */
function isCurrent(ws: WebSocket): boolean {
  return sharedSocket === ws
}

/** Reset all shared connection state. Exported for tests. */
export function __resetSocketStateForTests(): void {
  clearTimeout(sharedReconnectTimer)
  clearInterval(sharedPingInterval)
  sharedSocket = null
  sharedTaskOwnerSocket = null
  sharedReconnectTimer = undefined
  sharedPingInterval = undefined
  sharedConsumerCount = 0
  sharedConnecting = false
  sharedReconnectAttempts = 0
}

/**
 * The live socket, or null if there isn't one right now.
 *
 * Every send goes through this rather than a component's own ref: a reconnect
 * replaces sharedSocket, and hook instances that didn't run that reconnect
 * would otherwise keep sending into the closed socket they captured.
 */
function openSocket(): WebSocket | null {
  return sharedSocket?.readyState === WebSocket.OPEN ? sharedSocket : null
}

/** Wait for the socket to come up, for cold starts where the backend is still booting. */
async function awaitOpenSocket(timeoutMs = 20000): Promise<WebSocket | null> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const socket = openSocket()
    if (socket) return socket
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  return openSocket()
}

function resetInterruptedTaskUi(): void {
  const store = useTorchStore.getState()
  if (store.agentStatus === 'idle') return

  const activeMessage = [...store.messages]
    .reverse()
    .find((message) =>
      message.steps?.some((step) => step.status === 'active' || step.status === 'hitl_required')
    )
  activeMessage?.steps
    ?.filter((step) => step.status === 'active' || step.status === 'hitl_required')
    .forEach((step) =>
      store.updateStep(activeMessage.id, step.id, {
        status: 'failed',
        error: 'Connection to the TORCH backend was interrupted.'
      })
    )
  store.setAgentStatus('idle')
  store.setOverlayStatus('idle')
  store.setClarificationRequest(null)
}

export function useWebSocket(): {
  sendCommand: (command: string, requestId?: string) => void
  sendApproval: (
    messageId: string,
    stepId: string,
    action: 'approve' | 'edit' | 'cancel',
    editedData?: unknown
  ) => boolean
  reconnect: () => void
  sendStopCommand: () => void
  sendClarification: (taskId: string, response: string) => boolean
  sendUndoCommand: (messageId: string) => void
  sendCompanionCommand: (command: string, screenshots: unknown[], audio?: unknown) => void
} {
  const wsRef = useRef<WebSocket | null>(null)
  const handleMessageRef = useRef<
    (data: Record<string, unknown>, sourceSocket: WebSocket | null) => void
  >(() => undefined)
  const { setWsConnected, setWsPhase, setHasConnectedOnce, addTerminalLine } =
    useTorchStore.getState()

  const connect = useCallback(
    function connectSocket(): void {
      // Skip WebSocket connection in demo mode
      if (useTorchStore.getState().demoMode) {
        return
      }
      if (sharedSocket && sharedSocket.readyState <= WebSocket.OPEN) {
        wsRef.current = sharedSocket
        return
      }
      // A connection attempt is already in flight and awaiting its token.
      if (sharedConnecting) return
      void openConnection()

      /**
       * Queue another attempt.
       *
       * Always clears the pending timer first: the old code assigned over
       * `sharedReconnectTimer` without clearing it, so two closes in quick
       * succession left an orphaned timer that opened a second socket
       * nobody was tracking.
       */
      function scheduleReconnect(): void {
        if (useTorchStore.getState().demoMode || sharedConsumerCount === 0) return
        clearTimeout(sharedReconnectTimer)
        const delay = reconnectDelayMs(sharedReconnectAttempts)
        sharedReconnectAttempts += 1
        sharedReconnectTimer = setTimeout(connectSocket, delay)
      }

      async function openConnection(): Promise<void> {
        sharedConnecting = true
        try {
          setWsPhase('connecting')
          // The backend rejects the handshake without a session token.
          const url = await buildWsUrl()
          // Another consumer may have opened the socket while the token resolved.
          if (sharedSocket && sharedSocket.readyState <= WebSocket.OPEN) {
            wsRef.current = sharedSocket
            return
          }
          const ws = new WebSocket(url)
          sharedSocket = ws
          wsRef.current = ws

          ws.onopen = (): void => {
            if (!isCurrent(ws)) return
            sharedReconnectAttempts = 0
            clearTimeout(sharedReconnectTimer)
            setWsConnected(true)
            setWsPhase('connected')
            setHasConnectedOnce(true)
            addTerminalLine({
              id: crypto.randomUUID(),
              timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
              content: 'WebSocket connected to backend',
              type: 'success'
            })
            // Ping for latency, and use the replies as a liveness check.
            sharedLastPongAt = Date.now()
            clearInterval(sharedPingInterval)
            sharedPingInterval = setInterval(() => {
              if (ws.readyState !== WebSocket.OPEN) return
              if (isSocketStale(sharedLastPongAt, Date.now())) {
                // Nothing has come back for several pings. The socket still
                // claims to be open, which it will keep doing after a sleep
                // or a dropped route, so close it and let the normal
                // reconnect path run.
                ws.close()
                return
              }
              ws.send(JSON.stringify({ type: 'ping', ts: Date.now() }))
            }, PING_INTERVAL_MS)
          }

          ws.onclose = (): void => {
            if (sharedTaskOwnerSocket === ws) sharedTaskOwnerSocket = null
            // A socket that has already been replaced must not touch shared
            // state: the connection the app is actually using is not this one.
            if (!isCurrent(ws)) return
            sharedSocket = null
            clearInterval(sharedPingInterval)
            useTorchStore.getState().setWsLatencyMs(null)
            resetInterruptedTaskUi()
            setWsConnected(false)
            setWsPhase('disconnected')
            window.torchAPI?.completeVisionControl()
            scheduleReconnect()
          }

          ws.onerror = (): void => {
            if (!isCurrent(ws)) return
            resetInterruptedTaskUi()
            setWsConnected(false)
            setWsPhase('disconnected')
            window.torchAPI?.completeVisionControl()
            // No reconnect here: an error on a live socket is followed by
            // close, and scheduling from both would double the attempts.
          }

          ws.onmessage = (event): void => {
            try {
              const data = JSON.parse(event.data)
              handleMessageRef.current(data, ws)
              window.torchAPI?.publishTaskEvent(data)
            } catch {
              // ignore parse errors
            }
          }
        } catch {
          resetInterruptedTaskUi()
          setWsPhase('disconnected')
          window.torchAPI?.completeVisionControl()
          scheduleReconnect()
        } finally {
          sharedConnecting = false
        }
      }
    },
    [setWsConnected, setWsPhase, setHasConnectedOnce, addTerminalLine]
  )

  const handleMessage = useCallback(
    (data: Record<string, unknown>, sourceSocket: WebSocket | null): void => {
      const store = useTorchStore.getState()

      switch (data.type) {
        case 'agent_response': {
          const msg = data.message as Message
          if (data.stream === true) {
            store.addMessage({ ...msg, content: '', isStreaming: true, isNew: true })
          } else {
            const fullText = formatAgentContent(msg.content || '')
            store.addMessage({ ...msg, content: '', isStreaming: true, isNew: true })
            void streamMessageContent(msg.id, fullText)
          }
          break
        }
        case 'content_delta': {
          const { messageId, delta } = data as { messageId: string; delta: string }
          store.appendMessageContent(messageId, delta as string)
          break
        }
        case 'content_done': {
          const { messageId } = data as { messageId: string }
          store.updateMessage(messageId, { isStreaming: false })
          break
        }
        case 'step_update': {
          const { messageId, stepId, ...updates } = data as Record<string, unknown>
          store.updateStep(messageId as string, stepId as string, updates)
          break
        }
        case 'status': {
          store.setAgentStatus(data.status as typeof store.agentStatus)
          if (data.status === 'idle') {
            if (sourceSocket && sharedTaskOwnerSocket === sourceSocket) {
              sharedTaskOwnerSocket = null
            }
            window.torchAPI?.completeVisionControl()
            store.setClarificationRequest(null)
          }
          break
        }
        // UI Automation drives the same mouse and keyboard, so it raises the
        // same border. The user should not have to know which engine is used.
        case 'vision_control_start':
        case 'uia_control_start': {
          window.torchAPI?.showControlBorder()
          break
        }
        case 'vision_control_end':
        case 'uia_control_end': {
          window.torchAPI?.completeVisionControl()
          break
        }
        case 'vision_capture_start': {
          window.torchAPI?.suspendOverlayForVisionCapture()
          break
        }
        case 'vision_capture_end': {
          window.torchAPI?.restoreOverlayAfterVisionCapture()
          break
        }
        case 'hitl_request': {
          store.setAgentStatus('awaiting_approval')
          break
        }
        case 'approval_result': {
          const { messageId, stepId, accepted, error } = data as {
            messageId: string
            stepId: string
            accepted: boolean
            error?: string
          }
          store.updateStep(
            messageId,
            stepId,
            accepted
              ? { status: 'active' }
              : { status: 'failed', error: error || 'Approval was not accepted' }
          )
          if (!accepted) {
            if (sourceSocket && sharedTaskOwnerSocket === sourceSocket) {
              sharedTaskOwnerSocket = null
            }
            store.setAgentStatus('idle')
          }
          break
        }
        case 'clarification_request': {
          const { taskId, question, options } = data as {
            taskId: string
            question: string
            options: string[]
          }
          store.setClarificationRequest({ taskId, question, options })
          store.setAgentStatus('awaiting_input')
          break
        }
        case 'clarification_result': {
          const { accepted, error } = data as { accepted: boolean; error?: string }
          if (accepted) {
            store.setClarificationRequest(null)
            store.setAgentStatus('executing')
          } else if (error) {
            store.addTerminalLine({
              id: crypto.randomUUID(),
              timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
              content: error,
              type: 'warning'
            })
          }
          break
        }
        case 'terminal': {
          store.addTerminalLine(data.line as TerminalLine)
          break
        }
        case 'overlay': {
          if (data.status)
            store.setOverlayStatus(data.status as 'idle' | 'listening' | 'processing' | 'speaking')
          if (data.reply) store.setOverlayReply(data.reply as string)
          if (data.guidance) {
            const guidance = {
              ...(data.guidance as {
                type: 'point' | 'none'
                x?: number
                y?: number
                label?: string
              }),
              transcript: data.reply as string | undefined
            }
            if (guidance.type === 'point') window.torchAPI?.showGuidance(guidance)
            else window.torchAPI?.hideGuidance()
          }
          break
        }
        case 'metrics': {
          store.setMetrics(data.metrics as Record<string, number>)
          break
        }
        case 'task_outcome': {
          const outcome = data as unknown as {
            requestId: string
            status: 'completed' | 'failed' | 'cancelled'
            summary: string
          }
          store.setLastTaskOutcome(outcome)
          break
        }
        case 'task_completed_metadata': {
          const { messageId, reversible } = data as { messageId: string; reversible: boolean }
          store.updateMessage(messageId, { reversible, undoState: 'available' })
          break
        }
        case 'undo_result': {
          const { messageId, status, reversed, failed } = data as {
            messageId: string
            status: string
            reversed: string[]
            failed: string[]
          }
          const resultText =
            status === 'success'
              ? `Undone successfully: ${reversed.join(', ')}`
              : `Partial undo: ${reversed.join(', ')}. Could not reverse: ${failed.join(', ')}`
          store.updateMessage(messageId, {
            undoState: 'undone',
            undoResult: resultText
          })
          break
        }
        case 'pong': {
          // Any reply proves the socket is alive, whether or not it carried a
          // usable timestamp.
          recordPong()
          const sent = data.ts as number
          if (sent) {
            useTorchStore.getState().setWsLatencyMs(Date.now() - sent)
          }
          break
        }
      }
    },
    []
  )

  useEffect(() => {
    const isFirstConsumer = sharedConsumerCount === 0
    sharedConsumerCount += 1
    if (isFirstConsumer) {
      window.torchAPI?.onTaskEvent((_event, taskEvent) => handleMessage(taskEvent, null))
      window.torchAPI?.onTaskCommand((_event, command) => {
        if (
          command.type === 'stop_task' &&
          sharedTaskOwnerSocket === sharedSocket &&
          sharedSocket?.readyState === WebSocket.OPEN
        ) {
          sharedSocket.send(JSON.stringify({ type: 'stop_task' }))
        } else if (
          command.type === 'clarification_response' &&
          sharedTaskOwnerSocket === sharedSocket &&
          sharedSocket?.readyState === WebSocket.OPEN
        ) {
          sharedSocket.send(JSON.stringify(command))
        }
      })
    }
    connect()

    /*
     * Come back promptly after the machine wakes or the network returns.
     *
     * Waiting out the backoff is the wrong behaviour here: the user is
     * looking at the window, and the reason for the delay (do not hammer a
     * backend that is down) does not apply when the environment just told us
     * conditions changed. A stale socket is closed first so the reconnect
     * path runs rather than trusting a readyState that survived the sleep.
     */
    const wakeUp = (): void => {
      if (useTorchStore.getState().demoMode) return
      if (sharedSocket && isSocketStale(sharedLastPongAt, Date.now())) {
        sharedSocket.close()
        return
      }
      if (sharedSocket && sharedSocket.readyState <= WebSocket.OPEN) return
      sharedReconnectAttempts = 0
      clearTimeout(sharedReconnectTimer)
      connect()
    }
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') wakeUp()
    }
    window.addEventListener('online', wakeUp)
    window.addEventListener('focus', wakeUp)
    document.addEventListener('visibilitychange', onVisible)

    return (): void => {
      window.removeEventListener('online', wakeUp)
      window.removeEventListener('focus', wakeUp)
      document.removeEventListener('visibilitychange', onVisible)
      sharedConsumerCount = Math.max(0, sharedConsumerCount - 1)
      if (sharedConsumerCount === 0) {
        window.torchAPI?.removeTaskEvent()
        window.torchAPI?.removeTaskCommand()
        clearTimeout(sharedReconnectTimer)
        const closing = sharedSocket
        // Drop our claim before closing: the close fires later, and by then
        // this socket must already read as stale so its handler stands down.
        sharedSocket = null
        closing?.close()
      }
    }
  }, [connect])

  const sendCommand = useCallback(
    (command: string, requestId: string = crypto.randomUUID()): void => {
      const model = useTorchStore.getState().selectedModel
      const payload = JSON.stringify({ type: 'command', content: command, model, requestId })

      const socket = openSocket()
      if (socket) {
        socket.send(payload)
        sharedTaskOwnerSocket = socket
        return
      }

      // The caller has already shown the command and set the agent to work, so
      // dropping it here would leave the UI spinning until the watchdog fires.
      // Wait for the connection instead, and say something if it never arrives.
      void (async () => {
        const reconnected = await awaitOpenSocket()
        if (reconnected) {
          reconnected.send(payload)
          sharedTaskOwnerSocket = reconnected
          return
        }
        const store = useTorchStore.getState()
        store.addMessage({
          id: crypto.randomUUID(),
          role: 'torch',
          content:
            "I couldn't reach TORCH just then. It may still be starting up — try that again in a moment.",
          timestamp: Date.now(),
          steps: []
        })
        store.setLastTaskOutcome({
          requestId,
          status: 'failed',
          summary: "I couldn't reach TORCH. Check the connection and try again."
        })
        store.setAgentStatus('idle')
      })()
    },
    []
  )

  useEffect(() => {
    handleMessageRef.current = handleMessage
  }, [handleMessage])

  const sendCompanionCommand = useCallback(
    (command: string, screenshots: unknown[], audio?: unknown): void => {
      openSocket()?.send(
        JSON.stringify({ type: 'companion_command', content: command, screenshots, audio })
      )
    },
    []
  )

  const sendApproval = useCallback(
    (
      messageId: string,
      stepId: string,
      action: 'approve' | 'edit' | 'cancel',
      editedData?: unknown
    ): boolean => {
      const socket = openSocket()
      if (!socket) return false
      socket.send(JSON.stringify({ type: 'hitl_response', messageId, stepId, action, editedData }))
      return true
    },
    []
  )

  const sendStopCommand = useCallback((): void => {
    // Only the window that started the task can stop it directly; others relay
    // the request through the main process.
    const socket = openSocket()
    if (socket && sharedTaskOwnerSocket === socket) {
      socket.send(JSON.stringify({ type: 'stop_task' }))
      return
    }
    window.torchAPI?.publishTaskCommand({ type: 'stop_task' })
  }, [])

  const sendClarification = useCallback((taskId: string, response: string): boolean => {
    const socket = openSocket()
    if (socket && sharedTaskOwnerSocket === socket) {
      socket.send(JSON.stringify({ type: 'clarification_response', taskId, response }))
      return true
    }
    if (window.torchAPI) {
      window.torchAPI.publishTaskCommand({ type: 'clarification_response', taskId, response })
      return true
    }
    return false
  }, [])

  const sendUndoCommand = useCallback((messageId: string): void => {
    openSocket()?.send(JSON.stringify({ type: 'undo_task', messageId }))
  }, [])

  const reconnect = useCallback((): void => {
    wsRef.current?.close()
    connect()
  }, [connect])

  return {
    sendCommand,
    sendCompanionCommand,
    sendApproval,
    reconnect,
    sendStopCommand,
    sendClarification,
    sendUndoCommand
  }
}
