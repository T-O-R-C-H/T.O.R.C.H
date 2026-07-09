import { ChatArea } from '../components/chat/ChatArea'
import { CommandInput } from '../components/input/CommandInput'
import { MetricsBar } from '../components/layout/MetricsBar'
import { useTorchStore } from '../store/torchStore'
import { API_BASE } from '../config/api'
import { useWebSocket } from '../hooks/useWebSocket'
import { useEffect, useCallback } from 'react'
import { handleDemoCommand, handleDemoApproval, handleDemoCancel } from '../demo/demoAgent'
import { useNavigate, useLocation } from 'react-router-dom'
import { formatAgentContent } from '../utils/plainLanguage'
import { streamMessageContent } from '../utils/streamContent'

export function Command(): JSX.Element {
  const addMessage = useTorchStore((s) => s.addMessage)
  const wsConnected = useTorchStore((s) => s.wsConnected)
  const demoMode = useTorchStore((s) => s.demoMode)
  const showSettingsKeyBanner = useTorchStore((s) => s.showSettingsKeyBanner)
  const pendingLaunchCommand = useTorchStore((s) => s.pendingLaunchCommand)
  const setPendingLaunchCommand = useTorchStore((s) => s.setPendingLaunchCommand)
  const { sendCommand, sendApproval } = useWebSocket()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!demoMode) {
      fetch(`${API_BASE}/api/metrics`)
        .then((r) => r.json())
        .then((data) => useTorchStore.getState().setMetrics(data))
        .catch(() => {})
    }
  }, [wsConnected, demoMode])

  const handleSend = useCallback((command: string): void => {
    const currentStatus = useTorchStore.getState().agentStatus
    if (currentStatus === 'processing' || currentStatus === 'executing') return
    addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: command,
      timestamp: Date.now()
    })
    useTorchStore.getState().setAgentStatus('processing')

    if (demoMode) {
      handleDemoCommand(command)
      return
    }

    if (wsConnected) {
      sendCommand(command)
    } else {
      useTorchStore.getState().setAgentStatus('processing')
      setTimeout(async () => {
        const messageId = crypto.randomUUID()
        const offlineText = formatAgentContent(
          "TORCH isn't connected right now. Make sure the app is running, then try your request again."
        )
        useTorchStore.getState().addMessage({
          id: messageId,
          role: 'torch',
          content: '',
          timestamp: Date.now(),
          isStreaming: true,
          steps: [
            {
              id: '1',
              label: 'Waiting for connection',
              tool: 'system',
              args: {},
              status: 'failed',
              requiresApproval: false,
              error: 'Backend offline'
            }
          ]
        })
        await streamMessageContent(messageId, offlineText)
        useTorchStore.getState().setAgentStatus('idle')
      }, 500)
    }
  }, [addMessage, demoMode, sendCommand, wsConnected])

  useEffect(() => {
    if (location.state?.runCommand) {
      const commandToRun = location.state.runCommand as string
      navigate(location.pathname, { replace: true, state: {} })
      handleSend(commandToRun)
    }
  }, [location.state, location.pathname, navigate, handleSend])

  useEffect(() => {
    if (pendingLaunchCommand) {
      const cmd = pendingLaunchCommand
      setPendingLaunchCommand(null)
      handleSend(cmd)
    }
  }, [pendingLaunchCommand, setPendingLaunchCommand, handleSend])

  const handleApprove = (messageId: string, stepId: string): void => {
    if (demoMode) {
      handleDemoApproval(messageId, stepId)
      return
    }
    if (!wsConnected || !sendApproval(messageId, stepId, 'approve')) {
      useTorchStore.getState().updateStep(messageId, stepId, {
        status: 'failed',
        error: 'Approval could not be sent because the backend is disconnected'
      })
      useTorchStore.getState().setAgentStatus('idle')
    }
  }

  const handleEdit = (messageId: string, stepId: string): void => {
    console.log('Edit step:', messageId, stepId)
  }

  const handleCancel = (messageId: string, stepId: string): void => {
    if (demoMode) {
      handleDemoCancel(messageId, stepId)
      return
    }
    if (wsConnected) sendApproval(messageId, stepId, 'cancel')
    useTorchStore.getState().updateStep(messageId, stepId, { status: 'failed', error: 'Cancelled by user' })
    useTorchStore.getState().setAgentStatus('idle')
  }

  const goToSettings = (): void => {
    useTorchStore.getState().setActiveSettingsTab('connections')
    navigate('/settings')
  }

  return (
    <div className="cmd-page page-enter">
      {demoMode && (
        <div className="cmd-banner">
          <span className="cmd-banner__text">Demo mode — add API key in Settings for live tasks</span>
          <button type="button" className="cmd-banner__btn" onClick={goToSettings}>
            Settings
          </button>
        </div>
      )}

      {!demoMode && showSettingsKeyBanner && (
        <div className="cmd-banner">
          <span className="cmd-banner__text">Add your Gemini API key in Settings to start</span>
          <button type="button" className="cmd-banner__btn" onClick={goToSettings}>
            Open Settings
          </button>
        </div>
      )}

      <MetricsBar />

      <div className="cmd-main">
        <ChatArea
          onApprove={handleApprove}
          onEdit={handleEdit}
          onCancel={handleCancel}
          onSend={handleSend}
        />
        <CommandInput onSend={handleSend} />
      </div>
    </div>
  )
}
