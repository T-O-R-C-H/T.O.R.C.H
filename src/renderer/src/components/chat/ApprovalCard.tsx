import { IconShield } from '../icons'

interface ApprovalCardProps {
  summary: string
  warning?: string
  onApprove: () => void
  onEdit: () => void
  onCancel: () => void
}

export function ApprovalCard({ summary, warning, onApprove, onEdit, onCancel }: ApprovalCardProps): JSX.Element {
  return (
    <div className="approval-card">
      <div className="approval-card__head">
        <IconShield size={14} />
        Awaiting action approval
      </div>

      <div className="approval-card__body">{summary}</div>

      {warning && (
        <div className="approval-card__warn">⚠ {warning}</div>
      )}

      <div className="approval-card__actions">
        <button type="button" className="btn-primary" onClick={onApprove}>
          Approve
        </button>
        <button type="button" className="btn-secondary" onClick={onEdit}>
          Edit
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
