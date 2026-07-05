import { IconList as ListChecks, IconCheck as Check, IconLoader as Loader2, IconCircle as Circle } from '../components/icons'
import { useTorchStore } from '../store/torchStore'

export function Tasks(): JSX.Element {
  const messages = useTorchStore((s) => s.messages)
  const activeTasks = messages.filter((m) => m.steps && m.steps.some((s) => s.status !== 'done'))

  return (
    <div className="page-shell page-enter">
      <div className="page-list">
        {activeTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <ListChecks size={28} className="text-[var(--color-torch-border)] mb-4" />
            <p className="text-[14px] font-medium text-[var(--color-torch-text-secondary)]">No active tasks</p>
            <p className="text-[12px] text-[var(--color-torch-text-tertiary)] mt-1.5 max-w-[280px] leading-relaxed">
              Tasks will appear here when TORCH is executing your commands
            </p>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {activeTasks.map((task) => (
              <div key={task.id} className="card p-0 overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--color-torch-border-subtle)]">
                  <p className="text-[13px] text-[var(--color-torch-text)] leading-relaxed">{task.content}</p>
                  <span className="t-mono-xs mt-2 block">
                    {new Date(task.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                  </span>
                </div>
                <div className="px-5 py-3">
                  {task.steps?.map((step) => (
                    <div key={step.id} className="flex items-center gap-3 py-2">
                      <div className="w-[14px] flex items-center justify-center">
                        {step.status === 'done' && <Check size={11} className="text-[var(--color-torch-success)]" />}
                        {step.status === 'active' && <Loader2 size={11} className="spinner" />}
                        {step.status === 'pending' && <Circle size={11} className="text-[var(--color-torch-text-ghost)]" />}
                      </div>
                      <span className={`text-[12px] ${
                        step.status === 'done' ? 'text-[var(--color-torch-text-secondary)]'
                        : step.status === 'active' ? 'text-[var(--color-torch-text)]'
                        : 'text-[var(--color-torch-text-tertiary)]'
                      }`}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
