import { useEffect, useState } from 'react'
import { API_BASE, torchFetch } from '../../config/api'
import { useTorchStore } from '../../store/torchStore'
import { useVoiceModel, formatBytes } from '../../hooks/useVoiceModel'

/**
 * Everything voice, in one place.
 *
 * Both halves are opt-in and both involve a download, so they belong
 * together: someone who turned voice typing down during onboarding has no
 * other way back, and someone who wants TORCH to talk needs to know that the
 * better voice costs a download while the built-in one does not.
 */

interface TtsStatus {
  piper_installed?: boolean
  piper_ready?: boolean
  download_bytes?: number
  state?: 'idle' | 'downloading' | 'ready' | 'error'
  downloaded_bytes?: number
  total_bytes?: number
  error?: string | null
}

function Toggle({
  checked,
  onChange,
  label
}: {
  checked: boolean
  onChange: () => void
  label: string
}): JSX.Element {
  return (
    <button
      type="button"
      // The stylesheet keys the on-state off aria-pressed, matching every
      // other toggle in the app; aria-checked left it looking permanently off.
      aria-pressed={checked}
      aria-label={label}
      onClick={onChange}
      className="toggle-track"
    >
      <div className="toggle-knob" />
    </button>
  )
}

function Row({
  label,
  description,
  children
}: {
  label: string
  description?: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <div className="text-[12px] text-[var(--color-torch-text)]">{label}</div>
        {description && (
          <div className="text-[11px] leading-relaxed text-[var(--color-torch-text-tertiary)] mt-0.5">
            {description}
          </div>
        )}
      </div>
      <div className="flex-none">{children}</div>
    </div>
  )
}

export function VoiceSection(): JSX.Element {
  const speakResponses = useTorchStore((s) => s.speakResponses)
  const setSpeakResponses = useTorchStore((s) => s.setSpeakResponses)
  const voiceTyping = useVoiceModel()

  const [tts, setTts] = useState<TtsStatus>({})
  const [ttsBusy, setTtsBusy] = useState(false)

  const loadTts = (): void => {
    void torchFetch(`${API_BASE}/api/voice/tts`)
      .then((r) => r.json())
      .then(setTts)
      .catch(() => setTts({}))
  }

  useEffect(loadTts, [])

  // Poll only while something is actually downloading.
  useEffect(() => {
    if (tts.state !== 'downloading') return undefined
    const timer = setInterval(loadTts, 500)
    return (): void => clearInterval(timer)
  }, [tts.state])

  const downloadNaturalVoice = async (): Promise<void> => {
    setTtsBusy(true)
    try {
      const response = await torchFetch(`${API_BASE}/api/voice/tts/model`, { method: 'POST' })
      setTts(await response.json())
    } catch {
      setTts((current) => ({ ...current, state: 'error', error: "That didn't start. Try again." }))
    } finally {
      setTtsBusy(false)
    }
  }

  const ttsProgress =
    tts.total_bytes && tts.downloaded_bytes
      ? Math.round((tts.downloaded_bytes / tts.total_bytes) * 100)
      : 0

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-4">
        <span className="t-label">VOICE</span>
      </div>
      <p className="text-[11px] text-[var(--color-torch-text-secondary)] mb-3 leading-relaxed">
        Speech is processed on your computer. Nothing you say and nothing TORCH says is uploaded.
      </p>

      <Row
        label="Speak responses aloud"
        description="TORCH reads out the one-line summary at the end of a task. It never reads step lists."
      >
        <Toggle
          checked={speakResponses}
          onChange={() => setSpeakResponses(!speakResponses)}
          label="Speak responses aloud"
        />
      </Row>

      {speakResponses && (
        <Row
          label="Natural voice"
          description={
            tts.piper_ready
              ? 'Using the natural voice.'
              : `Optional ${formatBytes(tts.download_bytes ?? 0)} download. Without it TORCH uses your computer's built-in voice.`
          }
        >
          {tts.piper_ready ? (
            <span className="text-[11px] font-mono text-[var(--color-torch-text-tertiary)]">
              Installed
            </span>
          ) : tts.state === 'downloading' ? (
            <span className="text-[11px] font-mono text-[var(--color-torch-text-tertiary)]">
              {ttsProgress}%
            </span>
          ) : (
            <button
              type="button"
              onClick={() => void downloadNaturalVoice()}
              disabled={ttsBusy || !tts.piper_installed}
              className="text-[11px] px-2.5 py-1 border border-[var(--color-torch-border)] bg-white"
            >
              Download
            </button>
          )}
        </Row>
      )}

      <Row
        label="Voice typing"
        description={
          voiceTyping.ready
            ? 'The microphone is available in the command box.'
            : voiceTyping.micVisible
              ? `Needs a ${voiceTyping.sizeLabel} speech model before it can write down what you say.`
              : 'Turned off. Turn this back on to use the microphone.'
        }
      >
        {voiceTyping.ready ? (
          <span className="text-[11px] font-mono text-[var(--color-torch-text-tertiary)]">
            Ready
          </span>
        ) : voiceTyping.downloadState === 'downloading' ? (
          <span className="text-[11px] font-mono text-[var(--color-torch-text-tertiary)]">
            {Math.round(voiceTyping.progress * 100)}%
          </span>
        ) : voiceTyping.micVisible ? (
          <button
            type="button"
            onClick={() => void voiceTyping.accept()}
            className="text-[11px] px-2.5 py-1 border border-[var(--color-torch-border)] bg-white"
          >
            Download
          </button>
        ) : (
          /* The way back for anyone who said no during onboarding. Without
             this the microphone is gone for good. */
          <button
            type="button"
            onClick={voiceTyping.reset}
            className="text-[11px] px-2.5 py-1 border border-[var(--color-torch-border)] bg-white"
          >
            Turn on
          </button>
        )}
      </Row>

      {(voiceTyping.error || tts.error) && (
        <p className="text-[11px] text-[var(--color-torch-text-tertiary)] mt-1">
          {voiceTyping.error || tts.error}
        </p>
      )}
    </div>
  )
}
