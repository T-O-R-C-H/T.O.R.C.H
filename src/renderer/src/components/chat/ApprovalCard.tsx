import { IconShield } from '../icons'

interface ApprovalCardProps {
  summary: string
  onApprove: () => void
  onEdit: () => void
  onCancel: () => void
}

export function ApprovalCard({ summary, onApprove, onEdit, onCancel }: ApprovalCardProps): JSX.Element {
  return (
    <div className="mt-3 border border-[#1c1c1c]" style={{ padding: '10px 12px' }}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[#555]"><IconShield size={12} /></span>
        <span className="mono-xs text-[#2a2a2a] tracking-[0.12em]">
          AWAITING APPROVAL — IRREVERSIBLE ACTION
        </span>
      </div>

      {/* Body */}
      <p className="text-[11px] text-[#aaa] leading-relaxed mb-3">{summary}</p>

      {/* Actions — NO border-radius on buttons */}
      <div className="flex items-center gap-2">
        <button onClick={onApprove} className="btn-primary text-[10px] px-4 py-1.5">
          Approve
        </button>
        <button onClick={onEdit} className="btn-secondary text-[10px] px-4 py-1.5">
          Edit
        </button>
        <button onClick={onCancel} className="btn-secondary text-[10px] px-4 py-1.5">
          Cancel
        </button>
      </div>
    </div>
  )
}
