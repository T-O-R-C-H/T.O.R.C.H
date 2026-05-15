import { IconList as ListChecks, IconCheck as Check, IconLoader as Loader2, IconCircle as Circle } from '../components/icons'
import { useTorchStore } from '../store/torchStore'

export function Tasks(): JSX.Element {
  const messages = useTorchStore((s) => s.messages)

  const activeTasks = messages.filter((m) => m.steps && m.steps.some((s) => s.status !== 'done'))

  return (
    <div className="flex-1 flex flex-col h-full page-enter">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-[#141414] flex-shrink-0">
        <h1 className="t-page-title">Tasks</h1>
        <span className="t-mono-xs text-[#333] border border-[#181818] px-2.5 py-1">{activeTasks.length} active</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <ListChecks size={28} className="text-[#181818] mb-4" />
            <p className="text-[14px] text-[#444] font-medium">No active tasks</p>
            <p className="text-[12px] text-[#2a2a2a] mt-1.5 max-w-[280px] leading-relaxed">
              Tasks will appear here when TORCH is executing your commands
            </p>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            {activeTasks.map((task) => (
              <div key={task.id} className="border border-[#181818] bg-[#050505]">
                {/* Task header */}
                <div className="px-5 py-4 border-b border-[#141414]">
                  <p className="text-[13px] text-[#ccc] leading-relaxed">{task.content}</p>
                  <span className="t-mono-xs text-[#333] mt-2 block">
                    {new Date(task.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                  </span>
                </div>
                {/* Steps */}
                <div className="px-5 py-3">
                  {task.steps?.map((step) => (
                    <div key={step.id} className="flex items-center gap-3 py-2">
                      <div className="w-[14px] flex items-center justify-center">
                        {step.status === 'done' && <Check size={11} className="text-[#555]" />}
                        {step.status === 'active' && <Loader2 size={11} className="spinner text-white" />}
                        {step.status === 'pending' && <Circle size={11} className="text-[#1c1c1c]" />}
                      </div>
                      <span className={`text-[12px] ${
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
