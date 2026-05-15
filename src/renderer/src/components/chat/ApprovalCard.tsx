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
    <div className="mt-4 border border-[#1c1c1c] bg-[#060606]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#141414]">
        <span className="text-[#555]"><IconShield size={12} /></span>
        <span className="t-mono-xs text-[#444] tracking-[0.12em]">
          AWAITING APPROVAL
        </span>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        <p className="text-[12px] text-[#999] leading-relaxed">{summary}</p>
      </div>

      {/* Warning */}
      {warning && (
        <div className="px-4 py-2 border-t border-[#eab308]/15 bg-[#eab308]/3">
          <p className="t-mono-xs text-[#eab308]">⚠ {warning}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-[#141414]">
        <button onClick={onApprove} className="btn-primary text-[10px] px-5 py-2">
          Approve
        </button>
        <button onClick={onEdit} className="btn-secondary text-[10px] px-4 py-2">
          Edit
        </button>
        <button onClick={onCancel} className="btn-secondary text-[10px] px-4 py-2">
          Cancel
        </button>
      </div>
    </div>
  )
}
