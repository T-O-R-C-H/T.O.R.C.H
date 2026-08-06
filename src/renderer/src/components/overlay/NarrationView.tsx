import { useTorchStore } from '../../store/torchStore'
import { TorchMark } from '../TorchMark'

export function NarrationView({ onStop }: { onStop: () => void }): JSX.Element {
  const messages = useTorchStore((state) => state.messages)
  const agentStatus = useTorchStore((state) => state.agentStatus)
  const latestMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'torch' && message.steps?.length)
  const steps = agentStatus === 'processing' ? [] : (latestMessage?.steps ?? [])
  const currentStep = steps.find((step) => step.status === 'active')

  return (
    <div className="narration-view">
      <header className="narration-header overlay-drag">
        <div className="narration-brand">
          <TorchMark size={24} animate />
          <span>TORCH WORKING</span>
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

      {currentStep && <div className="narration-current">{currentStep.label}</div>}
    </div>
  )
}
