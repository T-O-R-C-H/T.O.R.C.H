import { useEffect, useRef } from 'react'
import type { Message } from '../../store/torchStore'

/**
 * The companion's message list.
 *
 * Deliberately thinner than the Command Center's feed: this panel is 340px
 * wide and sits over someone's work, so it shows what was said and how a task
 * is going, and leaves approvals, undo and reporting to the main window.
 */
function StepLine({ label, status }: { label: string; status: string }): JSX.Element {
  const mark = status === 'done' ? '✓' : status === 'failed' ? '✕' : '◉'
  return (
    <div className={`companion-step companion-step--${status}`}>
      <span className="companion-step__mark" aria-hidden="true">
        {mark}
      </span>
      <span>{label}</span>
    </div>
  )
}

export function CompanionChat({ messages }: { messages: Message[] }): JSX.Element {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="companion__body companion__body--empty">
        <p className="companion-empty__title">Ask about what you&rsquo;re looking at</p>
        <p className="companion-empty__desc">
          The companion stays on top of whatever app you&rsquo;re in, so you can ask without
          switching away.
        </p>
      </div>
    )
  }

  return (
    <div className="companion__body">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`companion-msg companion-msg--${message.role === 'user' ? 'user' : 'torch'}`}
        >
          {message.content && <p className="companion-msg__text">{message.content}</p>}
          {(message.steps?.length ?? 0) > 0 && (
            <div className="companion-msg__steps">
              {message.steps?.map((step) => (
                <StepLine key={step.id} label={step.label || step.tool} status={step.status} />
              ))}
            </div>
          )}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  )
}
