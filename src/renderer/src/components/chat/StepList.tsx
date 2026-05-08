import { Loader2, Check, AlertTriangle } from 'lucide-react'
import type { Step } from '../../store/torchStore'

interface StepListProps {
  steps: Step[]
}

export function StepList({ steps }: StepListProps): JSX.Element {
  return (
    <div className="mt-3 space-y-1">
      {steps.map((step, index) => (
        <div
          key={step.id}
          className={`flex items-start gap-2 py-1 ${
            step.status === 'done' ? 'step-done' : 'step-active'
          }`}
        >
          {/* Status icon */}
          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
            {step.status === 'pending' && (
              <div className="w-1.5 h-1.5 bg-[#333]" />
            )}
            {step.status === 'active' && (
              <Loader2 size={12} className="spinner text-white" />
            )}
            {step.status === 'done' && (
              <Check size={12} className="text-[#555]" />
            )}
            {step.status === 'failed' && (
              <AlertTriangle size={12} className="text-[#ef4444]" />
            )}
            {step.status === 'hitl_required' && (
              <AlertTriangle size={12} className="text-[#eab308]" />
            )}
          </div>

          {/* Step content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="mono-xs text-[#333]">{String(index + 1).padStart(2, '0')}</span>
              <span className="text-[11px]">{step.label}</span>
            </div>
            {step.result && step.status === 'done' && (
              <div className="mono-xs text-[#333] mt-0.5 pl-6 truncate">{step.result}</div>
            )}
            {step.error && (
              <div className="mono-xs text-[#ef4444] mt-0.5 pl-6">{step.error}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
