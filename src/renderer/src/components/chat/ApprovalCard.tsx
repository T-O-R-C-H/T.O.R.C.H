import { useState } from 'react'
import { IconShield } from '../icons'

interface ApprovalCardProps {
  summary: string
  warning?: string
  onApprove: () => void
  onEdit: () => void
  onCancel: () => void
}

export function ApprovalCard({ summary, warning, onApprove, onEdit, onCancel }: ApprovalCardProps): JSX.Element {
  const [hoverApprove, setHoverApprove] = useState(false)
  const [hoverEdit, setHoverEdit] = useState(false)
  const [hoverCancel, setHoverCancel] = useState(false)

  return (
    <div style={{
      marginTop: '16px',
      border: '1px solid rgba(245, 158, 11, 0.2)',
      background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.03) 0%, rgba(0, 0, 0, 0.4) 100%)',
      borderRadius: '12px',
      boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.4), 0 0 16px 1px rgba(245, 158, 11, 0.02)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 16px',
        borderBottom: '1px solid rgba(245, 158, 11, 0.1)',
        background: 'rgba(245, 158, 11, 0.02)',
      }}>
        <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center' }}>
          <IconShield size={14} />
        </span>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '10px',
          fontWeight: 600,
          color: '#f59e0b',
          letterSpacing: '0.12em',
        }}>
          AWAITING ACTION APPROVAL
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: '14px 16px' }}>
        <p style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: '13px',
          color: '#e2e8f0',
          lineHeight: '1.5',
        }}>
          {summary}
        </p>
      </div>

      {/* Warning */}
      {warning && (
        <div style={{
          padding: '10px 16px',
          borderTop: '1px solid rgba(239, 68, 68, 0.2)',
          background: 'rgba(239, 68, 68, 0.04)',
        }}>
          <p style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '11.5px',
            color: '#f87171',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            ⚠ {warning}
          </p>
        </div>
      )}

      {/* Actions */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 16px',
        borderTop: '1px solid rgba(255, 255, 255, 0.04)',
        background: 'rgba(0, 0, 0, 0.2)',
      }}>
        <button
          onClick={onApprove}
          onMouseEnter={() => setHoverApprove(true)}
          onMouseLeave={() => setHoverApprove(false)}
          style={{
            background: hoverApprove ? '#059669' : '#10b981',
            color: '#ffffff',
            fontFamily: "'Inter', sans-serif",
            fontSize: '12px',
            fontWeight: 600,
            padding: '8px 16px',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 200ms ease',
            boxShadow: hoverApprove ? '0 0 12px rgba(16, 185, 129, 0.4)' : 'none',
          }}
        >
          Approve Action
        </button>
        <button
          onClick={onEdit}
          onMouseEnter={() => setHoverEdit(true)}
          onMouseLeave={() => setHoverEdit(false)}
          style={{
            background: hoverEdit ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
            color: '#e2e8f0',
            fontFamily: "'Inter', sans-serif",
            fontSize: '12px',
            fontWeight: 500,
            padding: '8px 14px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 200ms ease',
          }}
        >
          Edit
        </button>
        <button
          onClick={onCancel}
          onMouseEnter={() => setHoverCancel(true)}
          onMouseLeave={() => setHoverCancel(false)}
          style={{
            background: hoverCancel ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.03)',
            color: hoverCancel ? '#f87171' : '#94a3b8',
            fontFamily: "'Inter', sans-serif",
            fontSize: '12px',
            fontWeight: 500,
            padding: '8px 14px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 200ms ease',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
