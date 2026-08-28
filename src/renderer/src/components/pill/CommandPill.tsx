import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useTorchStore } from '../../store/torchStore'
import { useWebSocket } from '../../hooks/useWebSocket'
import { TorchLogo } from '../ui/TorchLogo'

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

  const busy = agentStatus !== 'idle'

  useEffect(() => {
    // Focus whenever the main process brings the pill up, so the user can type
    // immediately after the shortcut.
    window.torchAPI?.onPillActivate?.(() => inputRef.current?.focus())
  }, [])

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

      <input
        ref={inputRef}
        className="pill__input no-drag"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={busy ? 'Working…' : wsConnected ? 'What do you need?' : 'Reconnecting…'}
        disabled={busy}
        spellCheck={false}
      />

      <span
        className={`pill__dot ${busy ? 'pill__dot--busy' : wsConnected ? 'pill__dot--ready' : ''}`}
        aria-hidden="true"
      />
    </div>
  )
}
