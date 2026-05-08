import { ListChecks, Check, Loader2, Circle } from 'lucide-react'
import { useTorchStore } from '../store/torchStore'

export function Tasks(): JSX.Element {
  const messages = useTorchStore((s) => s.messages)

  // Extract active tasks from messages that have steps
  const activeTasks = messages.filter((m) => m.steps && m.steps.some((s) => s.status !== 'done'))

  return (
    <div className="flex-1 flex flex-col h-full page-enter">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#1c1c1c] flex-shrink-0">
        <ListChecks size={14} className="text-[#666]" />
        <span className="label">ACTIVE TASKS</span>
        <span className="badge">{activeTasks.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <ListChecks size={24} className="text-[#1c1c1c] mb-3" />
            <p className="text-[12px] text-[#333]">No active tasks</p>
            <p className="text-[10px] text-[#222] mt-1">Tasks will appear here when TORCH is executing commands</p>
          </div>
        ) : (
          <div className="px-6 py-4 space-y-3">
            {activeTasks.map((task) => (
              <div key={task.id} className="border border-[#1c1c1c] bg-[#060606]">
                <div className="px-4 py-3 border-b border-[#1c1c1c]">
                  <p className="text-[12px] text-[#ccc]">{task.content}</p>
                  <span className="mono-xs text-[#333] mt-1">
                    {new Date(task.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                  </span>
                </div>
                <div className="px-4 py-2">
                  {task.steps?.map((step, i) => (
                    <div key={step.id} className="flex items-center gap-2 py-1">
                      {step.status === 'done' && <Check size={10} className="text-[#555]" />}
                      {step.status === 'active' && <Loader2 size={10} className="spinner text-white" />}
                      {step.status === 'pending' && <Circle size={10} className="text-[#1c1c1c]" />}
                      <span className={`text-[11px] ${
                        step.status === 'done' ? 'text-[#555]' :
                        step.status === 'active' ? 'text-white' : 'text-[#333]'
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
