import { ShieldAlert } from 'lucide-react'

interface ApprovalCardProps {
  summary: string
  onApprove: () => void
  onEdit: () => void
  onCancel: () => void
}

export function ApprovalCard({ summary, onApprove, onEdit, onCancel }: ApprovalCardProps): JSX.Element {
  return (
    <div className="mt-3 border border-[#2a2a2a] bg-[#060606]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#1c1c1c] bg-[#0d0d0d]">
        <ShieldAlert size={12} className="text-[#eab308]" />
        <span className="mono-xs text-[#eab308] tracking-[0.12em]">
          AWAITING APPROVAL — IRREVERSIBLE ACTION
        </span>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        <p className="text-[11px] text-[#aaa] leading-relaxed">{summary}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-[#1c1c1c]">
        <button onClick={onApprove} className="btn-primary text-[10px] px-4 py-1.5">
          Approve & execute
        </button>
        <button onClick={onEdit} className="btn-secondary text-[10px] px-4 py-1.5">
          Edit
        </button>
        <button onClick={onCancel} className="btn-danger text-[10px] px-4 py-1.5">
          Cancel
        </button>
      </div>
    </div>
  )
}
