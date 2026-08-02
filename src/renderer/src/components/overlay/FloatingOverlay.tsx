import { useCallback, useEffect, useRef, useState } from 'react'
import { CmdArrowUp } from '../icons/cleanIcons'
import { TorchCatRive } from '../ui/TorchCatRive'
import { useWebSocket } from '../../hooks/useWebSocket'
import { useTorchStore } from '../../store/torchStore'
import { Mic, MicOff } from 'lucide-react'

interface DesktopContext {
  windowTitle: string
  appName: string
  clipboardText: string
  focusLabel?: string
}

type CompanionMode = 'guide' | 'act'

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
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const microphoneStreamRef = useRef<MediaStream | null>(null)
  const { sendCommand, sendCompanionCommand } = useWebSocket()
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

  const refreshContext = useCallback(async (): Promise<void> => {
    const nextContext = await window.torchAPI?.getDesktopContext()
    if (nextContext) setContext(nextContext)
  }, [])

  useEffect(() => {
    void refreshContext()
    const handleActivate = (): void => {
      void refreshContext()
      inputRef.current?.focus()
    }
    window.torchAPI?.onOverlayActivate(handleActivate)
    return () => {
      window.torchAPI?.removeOverlayActivate()
    }
  }, [refreshContext])

  useEffect(() => {
    if (overlayStatus === 'speaking') setLocalBusy(false)
  }, [overlayStatus])

  useEffect(() => {
    if (!overlayReply || overlayStatus !== 'speaking' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(overlayReply)
    utterance.rate = 1.04
    utterance.pitch = 0.98
    window.speechSynthesis.speak(utterance)
    return () => window.speechSynthesis.cancel()
  }, [overlayReply, overlayStatus])

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
            useTorchStore.getState().setOverlayReply("I couldn't capture that voice request. Try again.")
          }
        }
        reader.readAsDataURL(blob)
      }
      recorder.start(250)
      setIsListening(true)
      useTorchStore.getState().setOverlayStatus('listening')
    } catch {
      useTorchStore.getState().setOverlayReply('I could not hear you. Check microphone access and try again.')
      setIsListening(false)
      useTorchStore.getState().setOverlayStatus('idle')
    }
  }, [isBusy, sendCompanionCommand])

  useEffect(() => {
    return () => microphoneStreamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  const handleSend = useCallback(async (): Promise<void> => {
    const command = input.trim()
    if (!command || isBusy || !wsConnected) return
    setInput('')

    if (mode === 'act') {
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
      useTorchStore.getState().setOverlayReply("I couldn't capture the desktop. Try once more.")
    }
  }, [context, input, isBusy, mode, sendCommand, sendCompanionCommand, wsConnected])

  return (
    <div className="floating-overlay floating-overlay--companion">
      <header className="companion-head overlay-drag">
        <div className="companion-identity">
          <span className="companion-identity__pulse" />
          <div>
            <strong>TORCH</strong>
            <span>{context.appName}</span>
          </div>
        </div>
        <div className="companion-head__actions overlay-no-drag">
          <button onClick={() => window.torchAPI?.openMainWindow()} title="Open TORCH">↗</button>
          <button onClick={() => window.torchAPI?.hideOverlay()} title="Hide">×</button>
        </div>
      </header>

      <main className="companion-body overlay-no-drag">
        <div className={`companion-avatar ${isBusy ? 'companion-avatar--thinking' : ''}`}>
          <TorchCatRive height={116} />
        </div>
        {!wsConnected ? (
          <p className="companion-response companion-response--muted">Waking up the companion…</p>
        ) : overlayReply ? (
          <p className="companion-response">{overlayReply}</p>
        ) : isBusy ? (
          <div className="companion-thinking">
            <span /> <span /> <span />
            <em>Looking at your screen</em>
          </div>
        ) : (
          <p className="companion-response companion-response--muted">
            I can see what you see. Ask where something is, how it works, or tell me to handle it.
          </p>
        )}
      </main>

      <div className="companion-mode overlay-no-drag" role="tablist" aria-label="Companion mode">
        <button className={mode === 'guide' ? 'is-active' : ''} onClick={() => setMode('guide')}>
          Guide me
        </button>
        <button className={mode === 'act' ? 'is-active' : ''} onClick={() => setMode('act')}>
          Do it
        </button>
      </div>

      <div className={`companion-input overlay-no-drag ${isListening ? 'companion-input--listening' : ''}`}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={mode === 'guide' ? 'What am I looking at?' : 'Tell TORCH what to do…'}
          rows={2}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void handleSend()
            }
          }}
        />
        <button
          type="button"
          className="companion-input__mic"
          disabled={isBusy}
          onClick={() => void listenForVoice()}
          aria-label={isListening ? 'Listening' : 'Speak to TORCH'}
          title={isListening ? 'Listening…' : 'Speak'}
        >
          {isListening ? <MicOff size={15} /> : <Mic size={15} />}
        </button>
        <button
          type="button"
          className="companion-input__send"
          disabled={!input.trim() || isBusy || !wsConnected}
          onClick={() => void handleSend()}
          aria-label="Send"
        >
          <CmdArrowUp size={16} />
        </button>
      </div>
    </div>
  )
}
