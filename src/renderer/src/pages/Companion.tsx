import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useTorchStore } from '../store/torchStore'
import { useWebSocket } from '../hooks/useWebSocket'
import { CompanionHeader } from '../components/companion/CompanionHeader'
import { CompanionChat } from '../components/companion/CompanionChat'

/**
 * The overlay companion panel.
 *
 * Feature 1 of the companion spec: the window, the route, and a working chat.
 * It talks to the backend over the same pipeline the Command Center uses, but
 * from its own window and therefore its own socket — the spec is explicit
 * that the two are separate connections rather than a shared one.
 *
 * Not built yet, deliberately, because the spec's implementation order puts
 * them after this: sending a screenshot with each message, multimodal
 * planning, highlight parsing, and the pointer overlay.
 */
export function Companion(): JSX.Element {
  const [text, setText] = useState('')
  const [visible, setVisible] = useState(true)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const messages = useTorchStore((s) => s.messages)
  const agentStatus = useTorchStore((s) => s.agentStatus)
  const wsConnected = useTorchStore((s) => s.wsConnected)
  const { sendCommand } = useWebSocket()

  const busy = agentStatus !== 'idle'

  // The window slides the panel rather than resizing itself: moving a
  // transparent always-on-top window every frame flickers on Windows.
  useEffect(() => {
    window.torchAPI?.onCompanionAnimateIn?.(() => {
      setVisible(true)
      window.setTimeout(() => inputRef.current?.focus(), 60)
    })
    window.torchAPI?.onCompanionAnimateOut?.(() => setVisible(false))
  }, [])

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

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      window.torchAPI?.hideCompanion?.()
    }
  }

  return (
    <div className={`companion ${visible ? 'companion--in' : 'companion--out'}`}>
      <CompanionHeader
        busy={busy}
        /* Screen capture arrives in step 2 of the spec; until then this
           cannot honestly report that anything is being watched. */
        watching={false}
        onToggleWatching={() => undefined}
        onClose={() => window.torchAPI?.hideCompanion?.()}
      />

      <CompanionChat messages={messages} />

      <div className="companion__input">
        <textarea
          ref={inputRef}
          className="companion__field no-drag"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={busy ? 'Working…' : wsConnected ? 'Ask or tell TORCH…' : 'Reconnecting…'}
          rows={1}
          disabled={busy}
          spellCheck={false}
        />
        <button
          type="button"
          className="companion__send no-drag"
          onClick={submit}
          disabled={!text.trim() || busy}
          aria-label="Send"
          title="Send"
        >
          ↑
        </button>
      </div>
    </div>
  )
}
