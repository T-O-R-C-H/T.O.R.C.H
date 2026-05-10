import { IconBrain as Brain, IconCommand as Command, IconUser as User, IconFolder as FolderOpen, IconChart as BarChart3 } from '../components/icons'
import { useMemoryStore } from '../store/memoryStore'

export function Memory(): JSX.Element {
  const habits = useMemoryStore((s) => s.habits)
  const frequentCommands = useMemoryStore((s) => s.frequentCommands)
  const frequentContacts = useMemoryStore((s) => s.frequentContacts)
  const frequentFiles = useMemoryStore((s) => s.frequentFiles)

  // Demo data
  const demoCommands = frequentCommands.length > 0 ? frequentCommands : [
    { command: 'Send email', count: 34 },
    { command: 'Find file', count: 28 },
    { command: 'Search web', count: 22 },
    { command: 'Read PDF', count: 15 },
    { command: 'Post social', count: 11 }
  ]

  const demoContacts = frequentContacts.length > 0 ? frequentContacts : [
    { name: 'john@company.com', count: 12 },
    { name: 'sarah@team.io', count: 8 },
    { name: 'dev@startup.com', count: 6 }
  ]

  const demoFiles = frequentFiles.length > 0 ? frequentFiles : [
    { path: '/Documents/Reports/Q4-Report.pdf', count: 8 },
    { path: '/Projects/TORCH/README.md', count: 6 },
    { path: '/Downloads/dataset.csv', count: 4 }
  ]

  const demoHabits = habits.length > 0 ? habits : [
    { id: '1', action: 'Check email inbox', frequency: 5, lastOccurrence: Date.now(), timeOfDay: '09:00', category: 'email' },
    { id: '2', action: 'Review daily reports', frequency: 4, lastOccurrence: Date.now(), timeOfDay: '09:30', category: 'files' },
    { id: '3', action: 'Post team update', frequency: 3, lastOccurrence: Date.now(), timeOfDay: '17:00', category: 'social' },
  ]

  const maxCount = Math.max(...demoCommands.map((c) => c.count))

  return (
    <div className="flex-1 flex flex-col h-full page-enter overflow-y-auto">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#1c1c1c] flex-shrink-0">
        <Brain size={14} className="text-[#666]" />
        <span className="label">HABIT LEARNING</span>
      </div>

      <div className="grid grid-cols-2 gap-px bg-[#0d0d0d] flex-1">
        {/* Most used commands */}
        <div className="bg-[#000] p-6">
          <div className="flex items-center gap-2 mb-4">
            <Command size={12} className="text-[#444]" />
            <span className="label">FREQUENT COMMANDS</span>
          </div>
          <div className="space-y-3">
            {demoCommands.map((cmd, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-[#aaa]">{cmd.command}</span>
                  <span className="mono-xs text-[#333]">{cmd.count}</span>
                </div>
                <div className="w-full h-1 bg-[#0d0d0d]">
                  <div
                    className="h-full bg-white transition-all duration-500"
                    style={{ width: `${(cmd.count / maxCount) * 100}%`, opacity: 0.3 + (cmd.count / maxCount) * 0.7 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Frequent contacts */}
        <div className="bg-[#000] p-6">
          <div className="flex items-center gap-2 mb-4">
            <User size={12} className="text-[#444]" />
            <span className="label">FREQUENT CONTACTS</span>
          </div>
          <div className="space-y-2">
            {demoContacts.map((contact, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-[#0d0d0d]">
                <span className="text-[11px] text-[#aaa] font-mono">{contact.name}</span>
                <span className="mono-xs text-[#333]">{contact.count} interactions</span>
              </div>
            ))}
          </div>
        </div>

        {/* Frequent files */}
        <div className="bg-[#000] p-6">
          <div className="flex items-center gap-2 mb-4">
            <FolderOpen size={12} className="text-[#444]" />
            <span className="label">FREQUENT FILES</span>
          </div>
          <div className="space-y-2">
            {demoFiles.map((file, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-[#0d0d0d]">
                <span className="text-[11px] text-[#666] font-mono truncate max-w-[70%]">{file.path}</span>
                <span className="mono-xs text-[#333]">{file.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Daily patterns */}
        <div className="bg-[#000] p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={12} className="text-[#444]" />
            <span className="label">DAILY PATTERNS</span>
          </div>
          <div className="space-y-2">
            {demoHabits.map((habit) => (
              <div key={habit.id} className="flex items-center justify-between py-2 border-b border-[#0d0d0d]">
                <div>
                  <span className="text-[11px] text-[#aaa]">{habit.action}</span>
                  <span className="mono-xs text-[#333] ml-2">@ {habit.timeOfDay}</span>
                </div>
                <span className="mono-xs text-[#333]">{habit.frequency}x/week</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
