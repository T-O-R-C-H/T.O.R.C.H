import { ChatArea } from '../components/chat/ChatArea'
import { CommandInput } from '../components/input/CommandInput'
import { MetricsBar } from '../components/layout/MetricsBar'
import { useTorchStore } from '../store/torchStore'
import { useMemoryStore } from '../store/memoryStore'
import { useWebSocket } from '../hooks/useWebSocket'
import { useState, useEffect } from 'react'

function IconSparkles(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" />
    </svg>
  )
}

function IconX(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function IconWifiOff(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
      <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  )
}

export function Command(): JSX.Element {
  const addMessage = useTorchStore((s) => s.addMessage)
  const wsConnected = useTorchStore((s) => s.wsConnected)
  const predictions = useMemoryStore((s) => s.predictions)
  const [showPrediction, setShowPrediction] = useState(true)
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
    <div className="flex-1 flex flex-col h-full page-enter">
      <MetricsBar />

      {/* Connection status banner */}
      {!wsConnected && (
        <div className="mx-5 mt-2 flex items-center gap-2 px-4 py-2 border border-[#333]">
          <span className="text-[#555]"><IconWifiOff /></span>
          <span className="mono-xs text-[#555]">
            Backend offline — run: cd backend && python main.py
          </span>
        </div>
      )}

      {/* Prediction card */}
      {showPrediction && predictions.length > 0 && (
        <div className="mx-5 mt-4 border border-[#1c1c1c] bg-[#060606]">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1c1c1c]">
            <div className="flex items-center gap-2">
              <span className="text-[#666]"><IconSparkles /></span>
              <span className="mono-xs text-[#666]">PREDICTED FOR TODAY</span>
            </div>
            <button onClick={() => setShowPrediction(false)} className="text-[#333] hover:text-[#666]">
              <IconX />
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
