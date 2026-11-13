import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import styles from './PromptInput.module.css'
import { useTorchStore } from '../../store/torchStore'
import { useWebSocket } from '../../hooks/useWebSocket'
import { API_BASE, torchFetch } from '../../config/api'
import { FALLBACK_MODELS } from '../../config/models'
import { useAudioCapture } from '../../hooks/useAudioCapture'
import { useVoiceModel } from '../../hooks/useVoiceModel'
import { Waveform } from './Waveform'
import { IconMic } from '../icons'

interface PromptInputProps {
  onSend: (command: string) => void
  onEnhance?: (prompt: string, signal?: AbortSignal) => Promise<string>
}

/**
 * Rewrite the prompt using the configured model.
 *
 * The result replaces what the user typed, so this must never fall back to
 * generic text: if the rewrite fails, the original has to survive.
 */
async function enhanceViaBackend(prompt: string, signal?: AbortSignal): Promise<string> {
  const response = await torchFetch(`${API_BASE}/api/prompt/enhance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: prompt }),
    signal
  })
  if (!response.ok) throw new Error('enhance-failed')
  const data = (await response.json()) as { text?: string }
  const improved = (data.text || '').trim()
  if (!improved) throw new Error('enhance-empty')
  return improved
}

type Phase = 'idle' | 'enhancing' | 'enhanced'

const MIN_FIELD_HEIGHT = 22
const MAX_FIELD_HEIGHT = 200

interface IconProps {
  size?: number
  className?: string
  children: React.ReactNode
  strokeWidth?: number
}

function Glyph({ size = 14, className, children, strokeWidth = 2 }: IconProps): JSX.Element {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

const ArrowUpIcon = (): JSX.Element => (
  <Glyph size={15} strokeWidth={2.2}>
    <path d="m5 12 7-7 7 7" />
    <path d="M12 19V5" />
  </Glyph>
)

const LoaderIcon = (): JSX.Element => (
  <Glyph size={13} className={styles.spinner}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </Glyph>
)

const CheckIcon = (): JSX.Element => (
  <Glyph size={13} strokeWidth={2.2}>
    <path d="M20 6 9 17l-5-5" />
  </Glyph>
)

const ChevronIcon = (): JSX.Element => (
  <Glyph size={10} strokeWidth={2.4} className={styles.chevron}>
    <path d="m6 9 6 6 6-6" />
  </Glyph>
)

/** The speed/depth picker. Deliberately not a vendor mark. */
const GaugeIcon = (): JSX.Element => (
  <Glyph size={13} strokeWidth={1.8}>
    <path d="m12 14 4-4" />
    <path d="M3.34 19a10 10 0 1 1 17.32 0" />
  </Glyph>
)

const WandIcon = (): JSX.Element => (
  <Glyph size={12} strokeWidth={1.8}>
    <path d="m3 21 12-12" />
    <path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M12.2 6.2 11 5" />
  </Glyph>
)

const StopIcon = (): JSX.Element => (
  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
    <rect width="10" height="10" rx="2" fill="currentColor" />
  </svg>
)

export function PromptInput({
  onSend,
  onEnhance = enhanceViaBackend
}: PromptInputProps): JSX.Element {
  const [text, setText] = useState('')
  const [justSent, setJustSent] = useState(false)

  const voiceModel = useVoiceModel()
  const [transcribing, setTranscribing] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  /*
   * Shown when the user reaches for the microphone before the speech model
   * has been downloaded. Asking here rather than at startup means nobody is
   * interrupted about a feature they never tried to use.
   */
  const [askingToDownload, setAskingToDownload] = useState(false)

  /** Stop, transcribe, and put the words in the box. */
  const finishRecording = async (stop: () => Promise<Blob | null>): Promise<void> => {
    const wav = await stop()
    if (!wav) return
    setTranscribing(true)
    try {
      const response = await torchFetch(`${API_BASE}/api/voice/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'audio/wav' },
        body: wav
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'transcribe-failed')
      const transcript = (data.transcript || '').trim()
      if (!transcript) {
        setVoiceError("TORCH didn't catch that. Try again.")
        return
      }
      // Append rather than replace: the user may have typed part of it.
      setText((current) => (current ? `${current} ${transcript}` : transcript))
      // Focus is not taken here on purpose: this callback is handed to the
      // capture hook, and touching the textarea ref from inside it makes the
      // ref unwritable everywhere else, including the height reset on send.
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : "That didn't work. Try again.")
    } finally {
      setTranscribing(false)
    }
  }

  /*
   * Recording ends itself when the user stops talking. Requiring a second
   * press left TORCH listening at someone who had already finished.
   */
  const audio = useAudioCapture(finishRecording)

  const handleMicClick = async (): Promise<void> => {
    setVoiceError(null)
    // Never start a download without asking, and never record audio we have
    // no way to transcribe.
    if (voiceModel.needsConsent) {
      setAskingToDownload(true)
      return
    }
    // The button still stops early for anyone who does not want to wait for
    // the pause to be recognised.
    if (audio.state === 'recording') {
      await finishRecording(audio.stop)
      return
    }
    await audio.start()
  }
  const [models, setModels] = useState(FALLBACK_MODELS)
  const [phase, setPhase] = useState<Phase>('idle')
  const [enhanceError, setEnhanceError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const agentStatus = useTorchStore((s) => s.agentStatus)
  const wsConnected = useTorchStore((s) => s.wsConnected)
  const hasConnectedOnce = useTorchStore((s) => s.hasConnectedOnce)
  const demoMode = useTorchStore((s) => s.demoMode)
  const selectedModel = useTorchStore((s) => s.selectedModel)
  const setSelectedModel = useTorchStore((s) => s.setSelectedModel)
  const { sendStopCommand } = useWebSocket()

  useEffect(() => {
    if (demoMode) return
    torchFetch(`${API_BASE}/api/models`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.models) && data.models.length > 0) {
          setModels(data.models)
        }
      })
      .catch(() => {})
  }, [demoMode, wsConnected])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  // A menu that only closes from its own button traps the pointer.
  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: MouseEvent): void => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const isProcessing =
    agentStatus === 'processing' ||
    agentStatus === 'executing' ||
    agentStatus === 'awaiting_input' ||
    agentStatus === 'awaiting_approval'

  const hasText = text.trim().length > 0
  const enhancing = phase === 'enhancing'
  const sendActive = hasText && !isProcessing && !enhancing

  const handleSend = (): void => {
    const trimmed = text.trim()
    if (!trimmed || enhancing) return
    onSend(trimmed)
    setJustSent(true)
    setText('')
    setPhase('idle')
    if (inputRef.current) inputRef.current.style.height = `${MIN_FIELD_HEIGHT}px`
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setText(e.target.value)
    e.target.style.height = `${MIN_FIELD_HEIGHT}px`
    e.target.style.height = `${Math.min(e.target.scrollHeight, MAX_FIELD_HEIGHT)}px`
  }

  const handleEnhance = async (): Promise<void> => {
    if (!hasText || enhancing) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setPhase('enhancing')
    setEnhanceError(null)
    try {
      const improved = await onEnhance(text, controller.signal)
      setText(improved)
      setPhase('enhanced')
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        // The user's text is deliberately left untouched.
        setPhase('idle')
        setEnhanceError("Couldn't improve that just now — your text is unchanged.")
      }
    }
  }

  const stopTask = (): void => {
    if (demoMode) useTorchStore.getState().setAgentStatus('idle')
    else sendStopCommand()
  }

  /*
   * The picker shows what a choice does ("Automatic", "Faster"), never which
   * vendor or model is behind it. It used to draw the vendor's logo and fall
   * back to the raw model id, which told the user exactly the thing the
   * labels were written to keep out.
   */
  const selectedLabel = models.find((m) => m.id === selectedModel)?.label ?? 'Automatic'

  const connectionNote = demoMode
    ? 'Demo mode'
    : wsConnected
      ? null
      : hasConnectedOnce
        ? 'Reconnecting…'
        : 'Connecting…'

  const statusNote = transcribing
    ? 'Writing down what you said…'
    : (voiceError ?? audio.error ?? enhanceError ?? connectionNote)

  const improveIcon = enhancing ? (
    <LoaderIcon />
  ) : phase === 'enhanced' ? (
    <CheckIcon />
  ) : (
    <WandIcon />
  )
  const improveText = enhancing ? 'Improving…' : phase === 'enhanced' ? 'Improved' : 'Improve'

  return (
    <div className={styles.wrap}>
      <div
        className={styles.frame + (justSent ? ' ' + styles.justSent : '')}
        data-enhancing={enhancing ? '' : undefined}
        data-busy={isProcessing ? '' : undefined}
        onAnimationEnd={() => setJustSent(false)}
        onClick={(e) => {
          // Clicking the card's padding should land in the text box.
          if (e.target === e.currentTarget) inputRef.current?.focus()
        }}
      >
        <textarea
          ref={inputRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={isProcessing ? 'TORCH is working…' : 'Tell TORCH what to do…'}
          disabled={isProcessing}
          className={styles.field + (enhancing ? ' ' + styles.enhancing : '')}
          rows={1}
          aria-label="Command"
        />

        {askingToDownload && voiceModel.downloadState !== 'downloading' && !voiceModel.ready && (
          <div className={styles.voicePrompt}>
            <p className={styles.voicePromptText}>
              TORCH needs a small voice model ({voiceModel.sizeLabel}) to transcribe your speech.
              Download now?
            </p>
            <p className={styles.voicePromptNote}>
              It runs on your computer — your voice is never uploaded.
            </p>
            {voiceModel.error && <p className={styles.voicePromptNote}>{voiceModel.error}</p>}
            <div className={styles.voicePromptActions}>
              <button
                type="button"
                className={styles.voiceYes}
                onClick={() => void voiceModel.accept()}
              >
                Yes, download
              </button>
              <button
                type="button"
                className={styles.voiceNo}
                onClick={() => {
                  // Hides the microphone rather than re-asking on every click.
                  voiceModel.decline()
                  setAskingToDownload(false)
                }}
              >
                No thanks
              </button>
            </div>
          </div>
        )}

        {voiceModel.downloadState === 'downloading' && (
          <div className={styles.voiceRow}>
            <div className={styles.voiceProgress}>
              <div
                className={styles.voiceProgressFill}
                style={{ width: `${Math.round(voiceModel.progress * 100)}%` }}
              />
            </div>
            <span className={styles.metaItem}>
              Downloading the voice model… {Math.round(voiceModel.progress * 100)}%
            </span>
          </div>
        )}

        {audio.state === 'recording' && (
          <div className={styles.voiceRow}>
            <Waveform levels={audio.levels} />
            <span className={styles.metaItem}>Listening — press the mic again when done</span>
          </div>
        )}

        <div className={styles.row}>
          <div className={styles.left} ref={menuRef}>
            <button
              type="button"
              className={styles.modelBtn}
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label={`Speed and depth: ${selectedLabel}`}
            >
              <GaugeIcon />
              <span>{selectedLabel}</span>
              <ChevronIcon />
            </button>

            {menuOpen && (
              <div className={styles.menu} role="menu">
                <div className={styles.menuTitle}>How TORCH should think</div>
                {models.map((m) => {
                  const active = m.id === selectedModel
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      className={styles.menuItem + (active ? ' ' + styles.menuItemActive : '')}
                      onClick={() => {
                        setSelectedModel(m.id)
                        setMenuOpen(false)
                      }}
                    >
                      <span className={styles.menuName}>{m.label}</span>
                      {active && <CheckIcon />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className={styles.right}>
            {hasText && !isProcessing && (
              <button
                type="button"
                className={styles.pill + (enhancing ? ' ' + styles.pillBusy : '')}
                onClick={() => void handleEnhance()}
                disabled={enhancing}
                title="Rewrite this so TORCH understands it better"
              >
                {improveIcon}
                <span>{improveText}</span>
              </button>
            )}
            {voiceModel.micVisible && (
              <button
                type="button"
                onClick={() => void handleMicClick()}
                disabled={isProcessing || transcribing}
                className={
                  styles.iconBtn + (audio.state === 'recording' ? ' ' + styles.micActive : '')
                }
                aria-label={audio.state === 'recording' ? 'Stop recording' : 'Speak a command'}
                aria-pressed={audio.state === 'recording'}
                title={audio.state === 'recording' ? 'Stop recording' : 'Speak a command'}
              >
                <IconMic size={15} />
              </button>
            )}
            {isProcessing ? (
              /* While a task runs the send button becomes Stop, in the same
                 place, so the way out is always where the way in was. */
              <button
                type="button"
                onClick={stopTask}
                className={styles.send + ' ' + styles.stop}
                aria-label="Stop task"
                title="Stop task"
              >
                <StopIcon />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!sendActive}
                className={styles.send + (sendActive ? ' ' + styles.sendActive : '')}
                aria-label="Send command"
              >
                {enhancing ? <LoaderIcon /> : <ArrowUpIcon />}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className={styles.meta}>
        {/* Only states worth interrupting for. "Ready" is the normal case and
            says nothing the user needs. */}
        <span className={styles.metaItem} role="status">
          {statusNote ?? ''}
        </span>
        <span className={styles.metaItem + ' ' + styles.metaHint}>
          <kbd className={styles.kbd}>Enter</kbd> to send
          <span className={styles.metaSep}>·</span>
          <kbd className={styles.kbd}>Shift</kbd>
          <kbd className={styles.kbd}>Enter</kbd> for a new line
        </span>
      </div>
    </div>
  )
}
