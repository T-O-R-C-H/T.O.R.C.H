import { useTorchStore } from '../../store/torchStore'
import { useWebSocket } from '../../hooks/useWebSocket'
import { ClarificationPrompt } from '../chat/ClarificationPrompt'
import { TorchLogo } from '../ui/TorchLogo'

export function NarrationView({ onStop }: { onStop: () => void }): JSX.Element {
  const { sendApproval } = useWebSocket()
  const messages = useTorchStore((state) => state.messages)
  const agentStatus = useTorchStore((state) => state.agentStatus)
  const clarification = useTorchStore((state) => state.clarificationRequest)
  const latestMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'torch' && message.steps?.length)
  const steps = agentStatus === 'processing' ? [] : (latestMessage?.steps ?? [])
  const currentStep = steps.find((step) => step.status === 'active')
  const approvalStep = steps.find((step) => step.status === 'hitl_required')

  return (
    <div className="narration-view">
      <header className="narration-header overlay-drag">
        <div className="narration-brand">
          <TorchLogo tone="light" width={72} animate />
          <span>WORKING</span>
        </div>
        <button className="overlay-no-drag" onClick={onStop}>
          {'\u25A0'} STOP
        </button>
      </header>

      <div className="narration-steps">
        {steps.map((step) => (
          <div key={step.id} className={`narration-step narration-step--${step.status}`}>
            <span className="narration-step__status">
              {step.status === 'done'
                ? '\u2713'
                : step.status === 'failed'
                  ? '\u00d7'
                  : step.status === 'active'
                    ? '\u25cf'
                    : '\u25a1'}
            </span>
            <span>{step.label}</span>
          </div>
        ))}
        {steps.length === 0 && (
          <div className="narration-empty">
            {agentStatus === 'processing' ? 'Planning your task...' : 'Starting...'}
          </div>
        )}
      </div>

      {approvalStep && latestMessage && (
        <div className="narration-approval-card overlay-no-drag">
          <div className="narration-approval-card__title">⚠️ User Approval Required</div>
          <div className="narration-approval-card__label">{approvalStep.label}</div>
          <div className="narration-approval-card__actions">
            <button
              type="button"
              className="btn-approve"
              onClick={() => sendApproval(latestMessage.id, approvalStep.id, 'approve')}
            >
              ✓ Approve
            </button>
            <button
              type="button"
              className="btn-reject"
              onClick={() => sendApproval(latestMessage.id, approvalStep.id, 'cancel')}
            >
              ✕ Deny
            </button>
          </div>
        </div>
      )}

      <ClarificationPrompt />

      {currentStep && !clarification && <div className="narration-current">{currentStep.label}</div>}
    </div>
  )
}
