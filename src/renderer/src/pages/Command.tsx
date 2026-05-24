import { ChatArea } from '../components/chat/ChatArea'
import { CommandInput } from '../components/input/CommandInput'
import { MetricsBar } from '../components/layout/MetricsBar'
import { useTorchStore } from '../store/torchStore'
import { useWebSocket } from '../hooks/useWebSocket'
import { useEffect } from 'react'
import { handleDemoCommand, handleDemoApproval, handleDemoCancel } from '../demo/demoAgent'
import { useNavigate } from 'react-router-dom'

export function Command(): JSX.Element {
  const addMessage = useTorchStore((s) => s.addMessage)
  const wsConnected = useTorchStore((s) => s.wsConnected)
  const demoMode = useTorchStore((s) => s.demoMode)
  const showSettingsKeyBanner = useTorchStore((s) => s.showSettingsKeyBanner)
  const { sendCommand, sendApproval } = useWebSocket()
  const navigate = useNavigate()

  useEffect(() => {
    if (!demoMode) {
      fetch('http://localhost:8000/api/metrics')
        .then((r) => r.json())
        .then((data) => useTorchStore.getState().setMetrics(data))
        .catch(() => {}) // silently fail if backend is offline
    }
  }, [wsConnected, demoMode])

  const handleSend = (command: string): void => {
    addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: command,
      timestamp: Date.now()
    })

    if (demoMode) {
      // Route to demo agent
      handleDemoCommand(command)
      return
    }

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
    if (demoMode) {
      handleDemoApproval(messageId, stepId)
      return
    }
    if (wsConnected) {
      sendApproval(messageId, stepId, 'approve')
    }
    useTorchStore.getState().updateStep(messageId, stepId, { status: 'done' })
  }

  const handleEdit = (messageId: string, stepId: string): void => {
    console.log('Edit step:', messageId, stepId)
  }

  const handleCancel = (messageId: string, stepId: string): void => {
    if (demoMode) {
      handleDemoCancel(messageId, stepId)
      return
    }
    if (wsConnected) {
      sendApproval(messageId, stepId, 'cancel')
    }
    useTorchStore.getState().updateStep(messageId, stepId, { status: 'failed', error: 'Cancelled by user' })
    useTorchStore.getState().setAgentStatus('idle')
  }

  const goToSettings = (): void => {
    useTorchStore.getState().setActiveSettingsTab('connections')
    navigate('/settings')
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#000] relative overflow-hidden page-enter">
      {/* Demo Mode Banner */}
      {demoMode && (
        <div style={{
          background: '#0a0a0a',
          borderBottom: '1px solid #1a1a1a',
          padding: '8px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <div style={{
              width: '6px',
              height: '6px',
              background: '#eab308',
              flexShrink: 0,
            }} />
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '10px',
              fontWeight: 500,
              color: '#888',
              letterSpacing: '0.08em',
              textTransform: 'uppercase' as const,
            }}>
              Demo mode — Add your API key in Settings to run real tasks
            </span>
          </div>
          <button
            onClick={goToSettings}
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '10px',
              fontWeight: 500,
              color: '#fff',
              background: '#1a1a1a',
              border: '1px solid #2a2a2a',
              padding: '4px 14px',
              cursor: 'pointer',
              letterSpacing: '0.06em',
              textTransform: 'uppercase' as const,
              transition: 'all 150ms ease',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#222' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#1a1a1a' }}
          >
            Set up TORCH
          </button>
        </div>
      )}

      {/* Settings Key Warning Banner — non-demo */}
      {!demoMode && showSettingsKeyBanner && (
        <div style={{
          background: '#0a0a0a',
          borderBottom: '1px solid #1a1a1a',
          padding: '8px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <div style={{
              width: '6px',
              height: '6px',
              background: '#ef4444',
              flexShrink: 0,
            }} />
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '10px',
              fontWeight: 500,
              color: '#888',
              letterSpacing: '0.08em',
              textTransform: 'uppercase' as const,
            }}>
              Add your Gemini API key in Settings to start using TORCH
            </span>
          </div>
          <button
            onClick={goToSettings}
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '10px',
              fontWeight: 500,
              color: '#fff',
              background: '#1a1a1a',
              border: '1px solid #2a2a2a',
              padding: '4px 14px',
              cursor: 'pointer',
              letterSpacing: '0.06em',
              textTransform: 'uppercase' as const,
              transition: 'all 150ms ease',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#222' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#1a1a1a' }}
          >
            Open Settings
          </button>
        </div>
      )}

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
