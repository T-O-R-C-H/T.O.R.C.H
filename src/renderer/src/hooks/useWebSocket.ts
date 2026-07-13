import { useEffect, useRef, useCallback } from 'react'
import { useTorchStore, type Message, type TerminalLine } from '../store/torchStore'
import { WS_URL } from '../config/api'
import { formatAgentContent } from '../utils/plainLanguage'
import { streamMessageContent } from '../utils/streamContent'

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
} {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<any>(undefined)
  const { setWsConnected, addTerminalLine } = useTorchStore.getState()

  const connect = useCallback(() => {
    // Skip WebSocket connection in demo mode
    if (useTorchStore.getState().demoMode) {
      return
    }
    try {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = (): void => {
        setWsConnected(true)
        addTerminalLine({
          id: crypto.randomUUID(),
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
          content: 'WebSocket connected to backend',
          type: 'success'
        })
      }

      ws.onclose = (): void => {
        setWsConnected(false)
        if (!useTorchStore.getState().demoMode) {
          reconnectTimer.current = setTimeout(connect, 3000)
        }
      }

      ws.onerror = (): void => {
        setWsConnected(false)
      }

      ws.onmessage = (event): void => {
        try {
          const data = JSON.parse(event.data)
          handleMessage(data)
        } catch {
          // ignore parse errors
        }
      }
    } catch {
      if (!useTorchStore.getState().demoMode) {
        reconnectTimer.current = setTimeout(connect, 3000)
      }
    }
  }, [])

  const handleMessage = useCallback((data: Record<string, unknown>): void => {
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
        if (!accepted) store.setAgentStatus('idle')
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
    connect()
    return (): void => {
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  const sendCommand = useCallback((command: string): void => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const model = useTorchStore.getState().selectedModel
      wsRef.current.send(JSON.stringify({ type: 'command', content: command, model }))
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
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop_task' }))
    }
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

  return { sendCommand, sendApproval, reconnect, sendStopCommand, sendUndoCommand }
}
