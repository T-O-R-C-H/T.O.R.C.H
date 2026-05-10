import { IconLoader, IconCheck, IconAlertTriangle, IconCircle } from '../icons'
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
            step.status === 'done' ? 'step-done' :
            step.status === 'pending' ? 'step-pending' : 'step-active'
          }`}
        >
          {/* Status icon */}
          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
            {step.status === 'pending' && (
              <span className="text-[#2a2a2a]"><IconCircle size={10} /></span>
            )}
            {step.status === 'active' && (
              <span className="text-white"><IconLoader size={12} /></span>
            )}
            {step.status === 'done' && (
              <span className="text-[#444]"><IconCheck size={12} /></span>
            )}
            {step.status === 'failed' && (
              <span className="text-[#555]"><IconAlertTriangle size={12} /></span>
            )}
            {step.status === 'hitl_required' && (
              <span className="text-[#555]"><IconAlertTriangle size={12} /></span>
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
              <div className="mono-xs text-[#555] mt-0.5 pl-6">{step.error}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
