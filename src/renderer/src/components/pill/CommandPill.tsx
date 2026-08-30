import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useTorchStore } from '../../store/torchStore'
import { useWebSocket } from '../../hooks/useWebSocket'
import { TorchLogo } from '../ui/TorchLogo'
import { IconMic } from '../icons'
import { Waveform } from '../input/Waveform'
import { useAudioCapture } from '../../hooks/useAudioCapture'
import { useVoiceModel } from '../../hooks/useVoiceModel'
import { API_BASE, torchFetch } from '../../config/api'

/**
 * The always-available command input, shown when the main window is away.
 *
 * It is deliberately small and does one thing: take a command and hand it to
 * the same pipeline the Command Center uses. Progress is not shown here — the
 * task panel does that — so the pill never grows into a second chat window.
 */
export function CommandPill(): JSX.Element {
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const agentStatus = useTorchStore((s) => s.agentStatus)
  const wsConnected = useTorchStore((s) => s.wsConnected)
  const { sendCommand } = useWebSocket()

  const audio = useAudioCapture()
  const voiceModel = useVoiceModel()
  const [transcribing, setTranscribing] = useState(false)

  const busy = agentStatus !== 'idle'
  const recording = audio.state === 'recording'

  /** Stop recording, transcribe, and put the words in the box. */
  const finishRecording = async (): Promise<void> => {
    const wav = await audio.stop()
    if (!wav) return
    setTranscribing(true)
    try {
      const response = await torchFetch(`${API_BASE}/api/voice/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'audio/wav' },
        body: wav
      })
      const data = await response.json()
      if (!response.ok) return
      const transcript = (data.transcript || '').trim()
      if (transcript) {
        setText((current) => (current ? `${current} ${transcript}` : transcript))
        inputRef.current?.focus()
      }
    } catch {
      // The pill has no room for an error; the command box reports properly.
    } finally {
      setTranscribing(false)
    }
  }

  /*
   * The global shortcut stands in for a wake word, so when the pill is raised
   * by it TORCH starts listening straight away. Raised any other way - the
   * main window being minimised, for instance - it just takes focus, because
   * opening a window is not a request to be recorded.
   */
  useEffect(() => {
    window.torchAPI?.onPillActivate?.((payload) => {
      inputRef.current?.focus()
      if (payload?.voice && voiceModel.ready && audio.state === 'idle') {
        void audio.start()
      }
    })
  }, [voiceModel.ready, audio])

  useEffect(() => {
    window.torchAPI?.setPillFocused?.(focused)
  }, [focused])

  const submit = (): void => {
    const command = text.trim()
    if (!command || busy) return
    useTorchStore.getState().addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: command,
      timestamp: Date.now()
    })
    useTorchStore.getState().setAgentStatus('processing')
    sendCommand(command)
    setText('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
    if (e.key === 'Escape') {
      window.torchAPI?.hidePill?.()
    }
  }

  return (
    <div className={`pill ${focused ? 'pill--focused' : ''}`}>
      <button
        type="button"
        className="pill__mark no-drag"
        onClick={() => window.torchAPI?.openMainWindow?.()}
        aria-label="Open TORCH"
        title="Open TORCH"
      >
        <TorchLogo width={20} />
      </button>

      {recording ? (
        /* While listening, the level meter replaces the text box: it is the
           only thing worth showing, and it proves TORCH is really hearing. */
        <Waveform levels={audio.levels} />
      ) : (
        <input
          ref={inputRef}
          className="pill__input no-drag"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={
            transcribing
              ? 'Writing that down…'
              : busy
                ? 'Working…'
                : wsConnected
                  ? 'What do you need?'
                  : 'Reconnecting…'
          }
          disabled={busy}
          spellCheck={false}
        />
      )}

      {voiceModel.micVisible && (
        <button
          type="button"
          className={`pill__mic no-drag ${recording ? 'pill__mic--live' : ''}`}
          onClick={() => (recording ? void finishRecording() : void audio.start())}
          disabled={busy || transcribing || !voiceModel.ready}
          aria-label={recording ? 'Stop listening' : 'Speak a command'}
          aria-pressed={recording}
          title={recording ? 'Stop listening' : 'Speak a command'}
        >
          <IconMic size={13} />
        </button>
      )}

      <span
        className={`pill__dot ${busy ? 'pill__dot--busy' : wsConnected ? 'pill__dot--ready' : ''}`}
        aria-hidden="true"
      />
    </div>
  )
}
