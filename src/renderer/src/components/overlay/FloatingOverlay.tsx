import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUpRight, X } from 'lucide-react'
import { CmdArrowUp } from '../icons/cleanIcons'
import { TorchLogo } from '../ui/TorchLogo'
import { NarrationView } from './NarrationView'
import { useWebSocket } from '../../hooks/useWebSocket'
import { useTorchStore } from '../../store/torchStore'

interface DesktopContext {
  windowTitle: string
  appName: string
  clipboardText: string
  focusLabel?: string
}

const ORDINARY_TASK_TIMEOUT_MS = 60_000

export function FloatingOverlay(): JSX.Element {
  const [input, setInput] = useState('')
  const [context, setContext] = useState<DesktopContext>({
    windowTitle: '',
    appName: 'Desktop',
    clipboardText: ''
  })
  const [currentTime, setCurrentTime] = useState(new Date())
  const [taskStartedAt, setTaskStartedAt] = useState<number | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { sendCommand, sendStopCommand } = useWebSocket()
  const wsConnected = useTorchStore((state) => state.wsConnected)
  const agentStatus = useTorchStore((state) => state.agentStatus)
  const messages = useTorchStore((state) => state.messages)

  const isBusy =
    agentStatus === 'processing' ||
    agentStatus === 'executing' ||
    agentStatus === 'awaiting_input' ||
    agentStatus === 'awaiting_approval'
  const latestSteps =
    [...messages].reverse().find((message) => message.role === 'torch' && message.steps?.length)
      ?.steps ?? []
  const visionControlActive = latestSteps.some(
    (step) =>
      step.tool === 'vision_control' &&
      (step.status === 'active' || step.status === 'pending' || step.status === 'hitl_required')
  )

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const timeString = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })

  const dayString = currentTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })

  const refreshContext = useCallback(async (): Promise<void> => {
    const nextContext = await window.torchAPI?.getDesktopContext()
    if (nextContext) setContext(nextContext)
  }, [])

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refreshContext(), 0)
    const handleActivate = (): void => {
      void refreshContext()
      inputRef.current?.focus()
    }
    window.torchAPI?.onOverlayActivate(handleActivate)
    return () => {
      window.clearTimeout(initialRefresh)
      window.torchAPI?.removeOverlayActivate()
    }
  }, [refreshContext])

  useEffect(() => {
    if (agentStatus === 'idle') setTaskStartedAt(null)
  }, [agentStatus])

  useEffect(() => {
    const height =
      agentStatus === 'idle' ? 180 : agentStatus === 'awaiting_input' ? 620 : 480
    window.torchAPI?.setOverlaySize(360, height)
  }, [agentStatus])

  const stopTask = useCallback(
    (timedOut = false): void => {
      sendStopCommand()
      setTaskStartedAt(null)
      const store = useTorchStore.getState()
      store.setAgentStatus('idle')
      store.setClarificationRequest(null)
      window.torchAPI?.hideControlBorder()
      if (timedOut) {
        store.addMessage({
          id: crypto.randomUUID(),
          role: 'torch',
          content: 'That task stopped responding, so I ended it. Please try it again.',
          timestamp: Date.now(),
          steps: []
        })
      }
    },
    [sendStopCommand]
  )

  // Vision control has its own 25-step/45-minute safety limits. Ordinary tools
  // should never leave the compact overlay in a working state indefinitely.
  useEffect(() => {
    if (!isBusy || !taskStartedAt || visionControlActive) return
    const remaining = ORDINARY_TASK_TIMEOUT_MS - (Date.now() - taskStartedAt)
    const timer = window.setTimeout(() => stopTask(true), Math.max(remaining, 0))
    return () => window.clearTimeout(timer)
  }, [isBusy, stopTask, taskStartedAt, visionControlActive])

  const handleSend = useCallback((): void => {
    const command = input.trim()
    if (!command || isBusy || !wsConnected) return

    const startedAt = Date.now()
    setInput('')
    setTaskStartedAt(startedAt)
    const store = useTorchStore.getState()
    store.addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: command,
      timestamp: startedAt
    })
    store.setAgentStatus('processing')
    sendCommand(`${command}\n\nActive desktop: ${context.appName} — ${context.windowTitle}`)
  }, [context, input, isBusy, sendCommand, wsConnected])

  const connectionStatus = wsConnected ? 'connected' : 'disconnected'

  if (agentStatus !== 'idle') {
    return (
      <div className="floating-overlay floating-overlay--companion">
        <NarrationView onStop={() => stopTask(false)} />
      </div>
    )
  }

  return (
    <div className="floating-overlay floating-overlay--companion">
      <header className="fo-header overlay-drag">
        <div className="fo-header__brand">
          <span className={`fo-status-dot fo-status-dot--${connectionStatus}`} />
          <TorchLogo className="fo-header__logo" tone="light" width={68} />
        </div>
        <div className="fo-header__clock">
          <span className="fo-clock__time">{timeString}</span>
          <span className="fo-clock__date">{dayString}</span>
        </div>
        <div className="fo-header__actions overlay-no-drag">
          <button
            onClick={() => window.torchAPI?.openMainWindow()}
            title="Open TORCH"
            className="fo-action-btn"
          >
            <ArrowUpRight size={14} />
          </button>
          <button
            onClick={() => window.torchAPI?.hideOverlay()}
            title="Hide"
            className="fo-action-btn fo-action-btn--close"
          >
            <X size={14} />
          </button>
        </div>
      </header>

      <div className="fo-context">
        <span className="fo-context__icon">◉</span>
        <span className="fo-context__app">{context.appName}</span>
        {context.windowTitle && (
          <>
            <span className="fo-context__sep">·</span>
            <span className="fo-context__title">{context.windowTitle}</span>
          </>
        )}
      </div>

      <div className="fo-input overlay-no-drag">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Tell TORCH what to do…"
          rows={1}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              handleSend()
            }
          }}
        />
        <button
          type="button"
          className="fo-input__send"
          disabled={!input.trim() || isBusy || !wsConnected}
          onClick={handleSend}
          aria-label="Send"
        >
          <CmdArrowUp size={15} />
        </button>
      </div>
    </div>
  )
}
