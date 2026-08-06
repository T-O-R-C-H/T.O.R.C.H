import { useCallback, useEffect, useRef, useState } from 'react'
import { CmdArrowUp } from '../icons/cleanIcons'
import { TorchMark } from '../TorchMark'
import { NarrationView } from './NarrationView'
import { useWebSocket } from '../../hooks/useWebSocket'
import { useTorchStore } from '../../store/torchStore'
import { Mic, MicOff, ArrowUpRight, X } from 'lucide-react'
import { speakWithNaturalVoice, stopSpeaking } from '../../utils/voicePlayback'

interface DesktopContext {
  windowTitle: string
  appName: string
  clipboardText: string
  focusLabel?: string
}

type CompanionMode = 'guide' | 'act'

const QUICK_ACTIONS = [
  { label: "What's on my screen?", mode: 'guide' as const },
  { label: 'Read my clipboard', mode: 'guide' as const },
  { label: 'Summarize this', mode: 'guide' as const }
]

export function FloatingOverlay(): JSX.Element {
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<CompanionMode>('guide')
  const [context, setContext] = useState<DesktopContext>({
    windowTitle: '',
    appName: 'Desktop',
    clipboardText: ''
  })
  const [localBusy, setLocalBusy] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [displayedReply, setDisplayedReply] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const microphoneStreamRef = useRef<MediaStream | null>(null)
  const replyContainerRef = useRef<HTMLDivElement>(null)
  const typewriterRef = useRef<number | undefined>(undefined)
  const { sendCommand, sendCompanionCommand, sendStopCommand } = useWebSocket()
  const wsConnected = useTorchStore((state) => state.wsConnected)
  const agentStatus = useTorchStore((state) => state.agentStatus)
  const overlayStatus = useTorchStore((state) => state.overlayStatus)
  const overlayReply = useTorchStore((state) => state.overlayReply)

  const isBusy =
    localBusy ||
    overlayStatus === 'processing' ||
    agentStatus === 'processing' ||
    agentStatus === 'executing' ||
    agentStatus === 'awaiting_approval'

  // ── Live clock ──
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
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

  // ── Desktop context ──
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
    if (overlayStatus !== 'speaking') return
    const timer = window.setTimeout(() => setLocalBusy(false), 0)
    return () => window.clearTimeout(timer)
  }, [overlayStatus])

  // ── Typewriter effect for reply ──
  useEffect(() => {
    const resetTimer = window.setTimeout(() => {
      if (overlayReply && (overlayStatus === 'speaking' || overlayStatus === 'idle')) {
        setDisplayedReply('')
        let charIndex = 0
        typewriterRef.current = window.setInterval(() => {
          if (charIndex < overlayReply.length) {
            setDisplayedReply(overlayReply.slice(0, charIndex + 1))
            charIndex++
          } else {
            window.clearInterval(typewriterRef.current)
          }
        }, 20)
      } else if (!overlayReply) {
        setDisplayedReply('')
      }
    }, 0)
    return () => {
      window.clearTimeout(resetTimer)
      window.clearInterval(typewriterRef.current)
    }
  }, [overlayReply, overlayStatus])

  // ── Auto-scroll reply container ──
  useEffect(() => {
    if (replyContainerRef.current) {
      replyContainerRef.current.scrollTop = replyContainerRef.current.scrollHeight
    }
  }, [displayedReply])

  // ── Voice playback ──
  useEffect(() => {
    if (!overlayReply || overlayStatus !== 'speaking') return
    void speakWithNaturalVoice(overlayReply)
    return stopSpeaking
  }, [overlayReply, overlayStatus])

  // ── Voice recording ──
  const listenForVoice = useCallback(async (): Promise<void> => {
    if (isBusy) return
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      })
      microphoneStreamRef.current = stream
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      const chunks: Blob[] = []
      recorderRef.current = recorder
      recorder.ondataavailable = (event): void => {
        if (event.data.size > 0) chunks.push(event.data)
      }
      recorder.onstop = (): void => {
        setIsListening(false)
        microphoneStreamRef.current?.getTracks().forEach((track) => track.stop())
        microphoneStreamRef.current = null
        recorderRef.current = null
        const blob = new Blob(chunks, { type: recorder.mimeType })
        const reader = new FileReader()
        reader.onloadend = async (): Promise<void> => {
          setLocalBusy(true)
          useTorchStore.getState().setOverlayReply('')
          useTorchStore.getState().setOverlayStatus('processing')
          try {
            const screenshots = await window.torchAPI.captureScreens()
            sendCompanionCommand('Answer the spoken request in the attached audio.', screenshots, {
              dataUrl: String(reader.result),
              mimeType: blob.type
            })
          } catch {
            setLocalBusy(false)
            useTorchStore.getState().setOverlayStatus('idle')
            useTorchStore
              .getState()
              .setOverlayReply("I couldn't capture that voice request. Try again.")
          }
        }
        reader.readAsDataURL(blob)
      }
      recorder.start(250)
      setIsListening(true)
      useTorchStore.getState().setOverlayStatus('listening')
    } catch {
      useTorchStore
        .getState()
        .setOverlayReply('I could not hear you. Check microphone access and try again.')
      setIsListening(false)
      useTorchStore.getState().setOverlayStatus('idle')
    }
  }, [isBusy, sendCompanionCommand])

  useEffect(() => {
    return () => microphoneStreamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  // ── Send message ──
  const handleSend = useCallback(async (): Promise<void> => {
    const command = input.trim()
    if (!command || isBusy || !wsConnected) return
    setInput('')

    if (mode === 'act') {
      stopSpeaking()
      setDisplayedReply('')
      useTorchStore.getState().setOverlayReply('')
      useTorchStore.getState().setOverlayStatus('idle')
      useTorchStore.getState().setAgentStatus('processing')
      sendCommand(`${command}\n\nActive desktop: ${context.appName} — ${context.windowTitle}`)
      return
    }

    setLocalBusy(true)
    useTorchStore.getState().setOverlayReply('')
    useTorchStore.getState().setOverlayStatus('processing')
    window.torchAPI?.hideGuidance()
    try {
      const screenshots = await window.torchAPI.captureScreens()
      sendCompanionCommand(command, screenshots)
    } catch {
      setLocalBusy(false)
      useTorchStore.getState().setOverlayStatus('idle')
      useTorchStore
        .getState()
        .setOverlayReply("I couldn't capture the desktop. Try once more.")
    }
  }, [context, input, isBusy, mode, sendCommand, sendCompanionCommand, wsConnected])

  // ── Quick action handler ──
  const handleQuickAction = useCallback(
    (action: (typeof QUICK_ACTIONS)[number]): void => {
      if (isBusy || !wsConnected) return
      setMode(action.mode)
      setInput('')
      setLocalBusy(true)
      useTorchStore.getState().setOverlayReply('')
      useTorchStore.getState().setOverlayStatus('processing')
      window.torchAPI?.hideGuidance()
      void (async (): Promise<void> => {
        try {
          const screenshots = await window.torchAPI.captureScreens()
          sendCompanionCommand(action.label, screenshots)
        } catch {
          setLocalBusy(false)
          useTorchStore.getState().setOverlayStatus('idle')
          useTorchStore
            .getState()
            .setOverlayReply("I couldn't capture the desktop. Try once more.")
        }
      })()
    },
    [isBusy, wsConnected, sendCompanionCommand]
  )

  const connectionStatus = wsConnected ? 'connected' : 'disconnected'

  if (agentStatus !== 'idle') {
    return (
      <div className="floating-overlay floating-overlay--companion">
        <NarrationView
          onStop={() => {
            sendStopCommand()
          }}
        />
      </div>
    )
  }

  return (
    <div className="floating-overlay floating-overlay--companion">
      {/* ── Header ── */}
      <header className="fo-header overlay-drag">
        <div className="fo-header__brand">
          <span className={`fo-status-dot fo-status-dot--${connectionStatus}`} />
          <strong className="fo-header__title">TORCH</strong>
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

      {/* ── Context Bar ── */}
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

      {/* ── Body ── */}
      <main className="fo-body overlay-no-drag">
        {/* Avatar */}
        <div className={`fo-avatar ${isBusy ? 'fo-avatar--thinking' : ''}`}>
          <TorchMark size={48} activeNode={0} animate={isBusy} />
        </div>

        {/* Response / Status Area */}
        <div className="fo-response-area" ref={replyContainerRef}>
          {!wsConnected ? (
            <p className="fo-response fo-response--muted">
              <span className="fo-response__connecting-dots">
                <span />
                <span />
                <span />
              </span>
              Waking up…
            </p>
          ) : displayedReply ? (
            <p
              className={`fo-response fo-response--active ${
                displayedReply.length < (overlayReply?.length || 0)
                  ? 'fo-response--typing'
                  : ''
              }`}
            >
              {displayedReply}
            </p>
          ) : isBusy ? (
            <div className="fo-thinking">
              <div className="fo-thinking__dots">
                <span />
                <span />
                <span />
              </div>
              <span className="fo-thinking__label">Looking at your screen…</span>
            </div>
          ) : (
            <p className="fo-response fo-response--muted">
              I can see what you see. Ask anything or tell me to act.
            </p>
          )}
        </div>

        {/* Quick Action Chips */}
        {!isBusy && wsConnected && !displayedReply && (
          <div className="fo-chips">
            {QUICK_ACTIONS.map((action) => (
              <button key={action.label} onClick={() => handleQuickAction(action)}>
                {action.label}
              </button>
            ))}
          </div>
        )}
      </main>

      {/* ── Mode Tabs ── */}
      <div className="fo-mode overlay-no-drag" role="tablist" aria-label="Companion mode">
        <div className="fo-mode__track">
          <div
            className={`fo-mode__indicator ${mode === 'act' ? 'fo-mode__indicator--right' : ''}`}
          />
          <button
            className={`fo-mode__tab ${mode === 'guide' ? 'fo-mode__tab--active' : ''}`}
            onClick={() => setMode('guide')}
          >
            Guide me
          </button>
          <button
            className={`fo-mode__tab ${mode === 'act' ? 'fo-mode__tab--active' : ''}`}
            onClick={() => setMode('act')}
          >
            Take control
          </button>
        </div>
      </div>

      {/* ── Input ── */}
      <div className={`fo-input overlay-no-drag ${isListening ? 'fo-input--listening' : ''}`}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={mode === 'guide' ? 'What am I looking at?' : 'Tell TORCH what to do…'}
          rows={1}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void handleSend()
            }
          }}
        />
        <button
          type="button"
          className="fo-input__mic"
          disabled={isBusy}
          onClick={() => void listenForVoice()}
          aria-label={isListening ? 'Listening' : 'Speak to TORCH'}
          title={isListening ? 'Listening…' : 'Speak'}
        >
          {isListening ? <MicOff size={15} /> : <Mic size={15} />}
        </button>
        <button
          type="button"
          className="fo-input__send"
          disabled={!input.trim() || isBusy || !wsConnected}
          onClick={() => void handleSend()}
          aria-label="Send"
        >
          <CmdArrowUp size={15} />
        </button>
      </div>
    </div>
  )
}
