import { ChatArea } from '../components/chat/ChatArea'
import { CommandInput } from '../components/input/CommandInput'
import { MetricsBar } from '../components/layout/MetricsBar'
import { useTorchStore } from '../store/torchStore'
import { useWebSocket } from '../hooks/useWebSocket'
import { useEffect } from 'react'

export function Command(): JSX.Element {
  const addMessage = useTorchStore((s) => s.addMessage)
  const wsConnected = useTorchStore((s) => s.wsConnected)
  const { sendCommand, sendApproval } = useWebSocket()

  useEffect(() => {
    fetch('http://localhost:8000/api/metrics')
      .then((r) => r.json())
      .then((data) => useTorchStore.getState().setMetrics(data))
      .catch(() => {}) // silently fail if backend is offline
  }, [wsConnected])

  const handleSend = (command: string): void => {
    addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: command,
      timestamp: Date.now()
    })

    if (wsConnected) {
      sendCommand(command)
    } else {
      useTorchStore.getState().setAgentStatus('processing')
      setTimeout(() => {
        addMessage({
          id: crypto.randomUUID(),
          role: 'torch',
          content: `Backend not connected. Please start the Python server:\n\`cd backend && python main.py\`\n\nYour command: "${command}"`,
          timestamp: Date.now(),
          steps: [
            { id: '1', label: 'Waiting for backend connection', tool: 'system', args: {}, status: 'failed', requiresApproval: false, error: 'Backend offline' }
          ]
        })
        useTorchStore.getState().setAgentStatus('idle')
      }, 500)
    }
  }

  const handleApprove = (messageId: string, stepId: string): void => {
    if (wsConnected) {
      sendApproval(messageId, stepId, 'approve')
    }
    useTorchStore.getState().updateStep(messageId, stepId, { status: 'done' })
  }

  const handleEdit = (messageId: string, stepId: string): void => {
    console.log('Edit step:', messageId, stepId)
  }

  const handleCancel = (messageId: string, stepId: string): void => {
    if (wsConnected) {
      sendApproval(messageId, stepId, 'cancel')
    }
    useTorchStore.getState().updateStep(messageId, stepId, { status: 'failed', error: 'Cancelled by user' })
    useTorchStore.getState().setAgentStatus('idle')
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#000] relative overflow-hidden page-enter">
      <MetricsBar />

      {/* Main Command Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
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
