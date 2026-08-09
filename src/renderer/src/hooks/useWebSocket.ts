import { useEffect, useRef, useCallback } from 'react'
import { useTorchStore, type Message, type TerminalLine } from '../store/torchStore'
import { WS_URL } from '../config/api'
import { formatAgentContent } from '../utils/plainLanguage'
import { streamMessageContent } from '../utils/streamContent'

let sharedSocket: WebSocket | null = null
let sharedReconnectTimer: ReturnType<typeof setTimeout> | undefined
let sharedConsumerCount = 0
let sharedTaskOwnerSocket: WebSocket | null = null

function resetInterruptedTaskUi(): void {
  const store = useTorchStore.getState()
  if (store.agentStatus === 'idle') return

  const activeMessage = [...store.messages]
    .reverse()
    .find((message) =>
      message.steps?.some(
        (step) => step.status === 'active' || step.status === 'hitl_required'
      )
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
}

export function useWebSocket(): {
  sendCommand: (command: string) => void
  sendApproval: (
    messageId: string,
    stepId: string,
    action: 'approve' | 'edit' | 'cancel',
    editedData?: unknown
  ) => boolean
  reconnect: () => void
  sendStopCommand: () => void
  sendUndoCommand: (messageId: string) => void
  sendCompanionCommand: (command: string, screenshots: unknown[], audio?: unknown) => void
} {
  const wsRef = useRef<WebSocket | null>(null)
  const handleMessageRef = useRef<
    (data: Record<string, unknown>, sourceSocket: WebSocket | null) => void
  >(() => undefined)
  const { setWsConnected, setWsPhase, setHasConnectedOnce, addTerminalLine } = useTorchStore.getState()

  const connect = useCallback(function connectSocket(): void {
    // Skip WebSocket connection in demo mode
    if (useTorchStore.getState().demoMode) {
      return
    }
    if (sharedSocket && sharedSocket.readyState <= WebSocket.OPEN) {
      wsRef.current = sharedSocket
      return
    }
    try {
      setWsPhase('connecting')
      const ws = new WebSocket(WS_URL)
      sharedSocket = ws
      wsRef.current = ws

      ws.onopen = (): void => {
        setWsConnected(true)
        setWsPhase('connected')
        setHasConnectedOnce(true)
        addTerminalLine({
          id: crypto.randomUUID(),
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
          content: 'WebSocket connected to backend',
          type: 'success'
        })
      }

      ws.onclose = (): void => {
        if (sharedSocket === ws) sharedSocket = null
        if (sharedTaskOwnerSocket === ws) sharedTaskOwnerSocket = null
        resetInterruptedTaskUi()
        setWsConnected(false)
        setWsPhase('disconnected')
        window.torchAPI?.hideControlBorder()
        if (!useTorchStore.getState().demoMode && sharedConsumerCount > 0) {
          sharedReconnectTimer = setTimeout(connectSocket, 3000)
        }
      }

      ws.onerror = (): void => {
        resetInterruptedTaskUi()
        setWsConnected(false)
        setWsPhase('disconnected')
        window.torchAPI?.hideControlBorder()
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
      window.torchAPI?.hideControlBorder()
      if (!useTorchStore.getState().demoMode) {
        sharedReconnectTimer = setTimeout(connectSocket, 3000)
      }
    }
  }, [setWsConnected, setWsPhase, setHasConnectedOnce, addTerminalLine])

  const handleMessage = useCallback((data: Record<string, unknown>, sourceSocket: WebSocket | null): void => {
    const store = useTorchStore.getState()

    switch (data.type) {
      case 'agent_response': {
        const msg = data.message as Message
        if (data.stream === true) {
          store.addMessage({ ...msg, content: '', isStreaming: true })
        } else {
          const fullText = formatAgentContent(msg.content || '')
          store.addMessage({ ...msg, content: '', isStreaming: true })
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
          window.torchAPI?.hideControlBorder()
        }
        break
      }
      case 'vision_control_start': {
        window.torchAPI?.showControlBorder()
        break
      }
      case 'vision_control_end': {
        window.torchAPI?.hideControlBorder()
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
            ...(data.guidance as { type: 'point' | 'none'; x?: number; y?: number; label?: string }),
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
    }
  }, [])

  useEffect(() => {
    const isFirstConsumer = sharedConsumerCount === 0
    sharedConsumerCount += 1
    if (isFirstConsumer) {
      window.torchAPI?.onTaskEvent((_event, taskEvent) => handleMessage(taskEvent, null))
      window.torchAPI?.onTaskCommand((_event, command) => {
        if (
          command === 'stop_task' &&
          sharedTaskOwnerSocket === sharedSocket &&
          sharedSocket?.readyState === WebSocket.OPEN
        ) {
          sharedSocket.send(JSON.stringify({ type: 'stop_task' }))
        }
      })
    }
    connect()
    return (): void => {
      sharedConsumerCount = Math.max(0, sharedConsumerCount - 1)
      if (sharedConsumerCount === 0) {
        window.torchAPI?.removeTaskEvent()
        window.torchAPI?.removeTaskCommand()
        clearTimeout(sharedReconnectTimer)
        sharedSocket?.close()
        sharedSocket = null
      }
    }
  }, [connect])

  const sendCommand = useCallback((command: string): void => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const model = useTorchStore.getState().selectedModel
      wsRef.current.send(JSON.stringify({ type: 'command', content: command, model }))
      sharedTaskOwnerSocket = wsRef.current
    }
  }, [])

  useEffect(() => {
    handleMessageRef.current = handleMessage
  }, [handleMessage])

  const sendCompanionCommand = useCallback((command: string, screenshots: unknown[], audio?: unknown): void => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'companion_command', content: command, screenshots, audio }))
    }
  }, [])

  const sendApproval = useCallback(
    (
      messageId: string,
      stepId: string,
      action: 'approve' | 'edit' | 'cancel',
      editedData?: unknown
    ): boolean => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: 'hitl_response', messageId, stepId, action, editedData })
        )
        return true
      }
      return false
    },
    []
  )

  const sendStopCommand = useCallback((): void => {
    if (
      sharedTaskOwnerSocket === wsRef.current &&
      wsRef.current?.readyState === WebSocket.OPEN
    ) {
      wsRef.current.send(JSON.stringify({ type: 'stop_task' }))
      return
    }
    window.torchAPI?.publishTaskCommand('stop_task')
  }, [])

  const sendUndoCommand = useCallback((messageId: string): void => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'undo_task', messageId }))
    }
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
    sendUndoCommand
  }
}
