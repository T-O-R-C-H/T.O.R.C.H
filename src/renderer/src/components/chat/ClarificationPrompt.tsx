import { useState } from 'react'
import { useWebSocket } from '../../hooks/useWebSocket'
import { useTorchStore } from '../../store/torchStore'

export function ClarificationPrompt(): JSX.Element | null {
  const clarification = useTorchStore((state) => state.clarificationRequest)
  const { sendClarification } = useWebSocket()
  const [showOtherInput, setShowOtherInput] = useState(false)
  const [otherAnswer, setOtherAnswer] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [sendError, setSendError] = useState('')

  const [prevId, setPrevId] = useState<string | null>(null)
  const currentId = clarification?.taskId ?? null
  if (currentId !== prevId) {
    setPrevId(currentId)
    setShowOtherInput(false)
    setOtherAnswer('')
    setSubmitted(false)
    setSendError('')
  }

  if (!clarification) return null

  const answer = (response: string): void => {
    if (submitted || !response.trim()) return
    if (sendClarification(clarification.taskId, response.trim())) {
      setSubmitted(true)
      setSendError('')
    } else {
      setSendError('Could not send that choice from this window. Return to the window where the task started and try again.')
    }
  }

  return (
    <section className="narration-question overlay-no-drag" aria-live="polite">
      <p>{clarification.question}</p>
      <div className="narration-question__options">
        {clarification.options.map((option, index) => (
          <button
            key={option}
            type="button"
            disabled={submitted}
            onClick={() => answer(option)}
          >
            <span>{String.fromCharCode(65 + index)}.</span> {option}
          </button>
        ))}
        <button
          type="button"
          disabled={submitted}
          onClick={() => setShowOtherInput(true)}
        >
          <span>{String.fromCharCode(65 + clarification.options.length)}.</span> Other…
        </button>
      </div>
      {showOtherInput && !submitted && (
        <div className="narration-question__other">
          <input
            autoFocus
            value={otherAnswer}
            placeholder="Type your answer"
            onChange={(event) => setOtherAnswer(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') answer(otherAnswer)
            }}
          />
          <button type="button" onClick={() => answer(otherAnswer)}>
            Send
          </button>
        </div>
      )}
      {submitted && <div className="narration-question__sent">Choice sent. Continuing…</div>}
      {sendError && <div className="narration-question__error">{sendError}</div>}
    </section>
  )
}
