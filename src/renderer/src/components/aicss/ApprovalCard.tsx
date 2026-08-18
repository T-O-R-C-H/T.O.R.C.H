import { useRef, useState } from 'react'
import styles from './ApprovalCard.module.css'

interface ApprovalCardProps {
  summary: string
  warning?: string
  command?: string
  title?: string
  approveLabel?: string
  rejectLabel?: string
  onApprove: () => void
  onEdit: () => void
  onCancel: () => void
}

const TerminalIcon = (): JSX.Element => (
  <svg className={styles.iconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m4 17 6-6-6-6" />
    <path d="M12 19h8" />
  </svg>
)

const CornerDownLeftIcon = (): JSX.Element => (
  <svg className={styles.btnSubmitIcon} viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m9 10-5 5 5 5" />
    <path d="M20 4v7a4 4 0 0 1-4 4H4" />
  </svg>
)

export function ApprovalCard({
  summary,
  warning,
  command,
  title = 'Run this action?',
  approveLabel = 'Approve',
  rejectLabel = 'Edit',
  onApprove,
  onEdit,
  onCancel
}: ApprovalCardProps): JSX.Element {
  const approvalSent = useRef(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleApprove = (): void => {
    if (approvalSent.current) return
    approvalSent.current = true
    setIsSubmitting(true)
    onApprove()
  }

  return (
    <div className={styles.card} data-variant="command">
      <div className={styles.head}>
        <span className={styles.icon} data-variant="command">
          <TerminalIcon />
        </span>
        <div className={styles.headText}>
          <div className={styles.title}>{title}</div>
        </div>
      </div>

      {command ? (
        <div className={styles.cmdBlock}>
          <div className={styles.cwd}>TORCH</div>
          <pre className={styles.cmd}>{command}</pre>
        </div>
      ) : (
        <div className={styles.body}>{summary}</div>
      )}

      {warning && <div className={styles.warn}>{warning}</div>}

      <div className={styles.actions}>
        <div className={styles.actionBtns}>
          <button type="button" className={styles.btnGhost} onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </button>
          <button type="button" className={styles.btnGhost} onClick={onEdit} disabled={isSubmitting}>
            {rejectLabel}
          </button>
          <button type="button" className={styles.btnPrimary} onClick={handleApprove} disabled={isSubmitting}>
            {isSubmitting ? 'Approving…' : approveLabel}
            <CornerDownLeftIcon />
          </button>
        </div>
      </div>
    </div>
  )
}