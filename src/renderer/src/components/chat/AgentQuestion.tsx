import { useState } from 'react'
import styles from '../aicss/ApprovalCard.module.css'
import qStyles from './AgentQuestion.module.css'

interface AgentQuestionProps {
  question: string
  onSubmit: (answer: string) => void
}

const QuestionIcon = (): JSX.Element => (
  <svg
    className={styles.iconSvg}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
  </svg>
)

const CornerDownLeftIcon = (): JSX.Element => (
  <svg
    className={styles.btnSubmitIcon}
    viewBox="0 0 24 24"
    width="12"
    height="12"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m9 10-5 5 5 5" />
    <path d="M20 4v7a4 4 0 0 1-4 4H4" />
  </svg>
)

export function AgentQuestion({ question, onSubmit }: AgentQuestionProps): JSX.Element {
  const [answer, setAnswer] = useState('')
  const [sent, setSent] = useState(false)

  const submit = (): void => {
    if (sent || !answer.trim()) return
    setSent(true)
    onSubmit(answer.trim())
  }

  return (
    <div className={styles.card} data-variant="question">
      <div className={styles.head}>
        <span className={`${styles.icon} ${qStyles.iconQuestion}`}>
          <QuestionIcon />
        </span>
        <div className={styles.headText}>
          <div className={styles.title}>A question for you</div>
        </div>
      </div>

      <div className={styles.body}>{question}</div>

      {sent ? (
        <div className={qStyles.sent}>Got it — continuing with “{answer}”…</div>
      ) : (
        <div className={qStyles.inputRow}>
          <input
            className={qStyles.input}
            autoFocus
            value={answer}
            placeholder="Type your answer…"
            onChange={(event) => setAnswer(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit()
            }}
          />
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={submit}
            disabled={!answer.trim()}
          >
            Answer
            <CornerDownLeftIcon />
          </button>
        </div>
      )}
    </div>
  )
}
