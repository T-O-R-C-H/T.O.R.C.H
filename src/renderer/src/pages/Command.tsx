import { ChatArea } from '../components/chat/ChatArea'
import { CommandInput } from '../components/input/CommandInput'
import { MetricsBar } from '../components/layout/MetricsBar'
import { useTorchStore } from '../store/torchStore'
import { useMemoryStore } from '../store/memoryStore'
import { useWebSocket } from '../hooks/useWebSocket'
import { Sparkles, X, Wifi, WifiOff } from 'lucide-react'
import { useState } from 'react'

export function Command(): JSX.Element {
  const addMessage = useTorchStore((s) => s.addMessage)
  const wsConnected = useTorchStore((s) => s.wsConnected)
  const predictions = useMemoryStore((s) => s.predictions)
  const [showPrediction, setShowPrediction] = useState(true)
  const { sendCommand, sendApproval } = useWebSocket()

  const handleSend = (command: string): void => {
    // Add user message immediately
    addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: command,
      timestamp: Date.now()
    })

    if (wsConnected) {
      // Send through WebSocket to backend
      sendCommand(command)
    } else {
      // Offline fallback — show simulated response
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
    <div className="flex-1 flex flex-col h-full page-enter">
      <MetricsBar />

      {/* Connection status banner */}
      {!wsConnected && (
        <div className="mx-6 mt-2 flex items-center gap-2 px-4 py-2 border border-[#eab308]/30 bg-[#eab308]/5">
          <WifiOff size={12} className="text-[#eab308]" />
          <span className="mono-xs text-[#eab308]">
            Backend offline — run: cd backend && python main.py
          </span>
        </div>
      )}

      {/* Prediction card */}
      {showPrediction && predictions.length > 0 && (
        <div className="mx-6 mt-4 border border-[#1c1c1c] bg-[#060606]">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1c1c1c]">
            <div className="flex items-center gap-2">
              <Sparkles size={12} className="text-[#666]" />
              <span className="mono-xs text-[#666]">PREDICTED FOR TODAY</span>
            </div>
            <button onClick={() => setShowPrediction(false)} className="text-[#333] hover:text-[#666]">
              <X size={12} />
            </button>
          </div>
          <div className="px-4 py-3 flex gap-3">
            {predictions.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSend(p.action)}
                className="flex-1 px-3 py-2 border border-[#1c1c1c] hover:border-[#2a2a2a] transition-colors text-left"
              >
                <div className="text-[11px] text-[#aaa]">{p.label}</div>
                <div className="mono-xs text-[#333] mt-1">{Math.round(p.confidence * 100)}% confident</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <ChatArea
        onApprove={handleApprove}
        onEdit={handleEdit}
        onCancel={handleCancel}
      />
      <CommandInput onSend={handleSend} />
    </div>
  )
}
