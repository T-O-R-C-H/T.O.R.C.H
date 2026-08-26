import { ChatArea } from '../components/chat/ChatArea'
import { ActivityOverlay } from '../components/chat/ActivityOverlay'
import { PromptInput } from '../components/input/PromptInput'
import { useTorchStore } from '../store/torchStore'
import { API_BASE, torchFetch } from '../config/api'
import { useWebSocket } from '../hooks/useWebSocket'
import { useEffect, useCallback } from 'react'
import { handleDemoCommand, handleDemoApproval, handleDemoCancel } from '../demo/demoAgent'
import { useNavigate, useLocation } from 'react-router-dom'

export function Command(): JSX.Element {
  const addMessage = useTorchStore((s) => s.addMessage)
  const wsConnected = useTorchStore((s) => s.wsConnected)
  const demoMode = useTorchStore((s) => s.demoMode)
  const showSettingsKeyBanner = useTorchStore((s) => s.showSettingsKeyBanner)
  const { sendCommand, sendApproval } = useWebSocket()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!demoMode) {
      torchFetch(`${API_BASE}/api/metrics`)
        .then((r) => r.json())
        .then((data) => useTorchStore.getState().setMetrics(data))
        .catch(() => {})
    }
  }, [wsConnected, demoMode])

  const handleSend = useCallback(
    (command: string): void => {
      const currentStatus = useTorchStore.getState().agentStatus
      if (
        currentStatus === 'processing' ||
        currentStatus === 'executing' ||
        currentStatus === 'awaiting_input' ||
        currentStatus === 'awaiting_approval'
      )
        return
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

      // sendCommand waits briefly for a cold-starting/reconnecting socket, so
      // a request is not discarded just because the first render was early.
      sendCommand(command)
    },
    [addMessage, demoMode, sendCommand]
  )

  useEffect(() => {
    if (location.state?.runCommand) {
      const commandToRun = location.state.runCommand as string
      navigate(location.pathname, { replace: true, state: {} })
      handleSend(commandToRun)
    }
  }, [location.state, location.pathname, navigate, handleSend])

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

  const handleEdit = (
    messageId: string,
    stepId: string,
    editedArgs: Record<string, string>
  ): void => {
    // Approve, but with the values the user corrected. The executor replaces
    // the step's arguments before running it.
    if (!wsConnected || !sendApproval(messageId, stepId, 'edit', editedArgs)) {
      useTorchStore.getState().updateStep(messageId, stepId, {
        status: 'failed',
        error: "TORCH isn't connected right now, so that action wasn't run."
      })
      useTorchStore.getState().setAgentStatus('idle')
      return
    }
    useTorchStore.getState().updateStep(messageId, stepId, {
      args: editedArgs,
      status: 'active'
    })
  }

  const handleCancel = (messageId: string, stepId: string): void => {
    if (demoMode) {
      handleDemoCancel(messageId, stepId)
      return
    }
    if (wsConnected) sendApproval(messageId, stepId, 'cancel')
    useTorchStore
      .getState()
      .updateStep(messageId, stepId, { status: 'failed', error: 'Cancelled by user' })
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
          <span className="cmd-banner__text">
            Demo mode — add API key in Settings for live tasks
          </span>
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

      <div className="cmd-main">
        <ChatArea
          onApprove={handleApprove}
          onEdit={handleEdit}
          onCancel={handleCancel}
          onSend={handleSend}
        />
        <PromptInput onSend={handleSend} />
      </div>
      <ActivityOverlay />
    </div>
  )
}
