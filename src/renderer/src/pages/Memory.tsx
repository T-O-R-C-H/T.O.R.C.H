import { IconBrain as Brain, IconCommand as Command, IconUser as User, IconFolder as FolderOpen, IconChart as BarChart3 } from '../components/icons'
import { useMemoryStore } from '../store/memoryStore'

export function Memory(): JSX.Element {
  const habits = useMemoryStore((s) => s.habits)
  const frequentCommands = useMemoryStore((s) => s.frequentCommands)
  const frequentContacts = useMemoryStore((s) => s.frequentContacts)
  const frequentFiles = useMemoryStore((s) => s.frequentFiles)

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
    <div className="flex-1 flex flex-col h-full page-enter">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-[#141414] flex-shrink-0">
        <h1 className="t-page-title">Memory</h1>
        <span className="t-mono-xs text-[#333] border border-[#181818] px-2.5 py-1">habit learning</span>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-px bg-[#0e0e0e]">
          {/* Frequent commands */}
          <div className="bg-[#000] p-6">
            <div className="flex items-center gap-2.5 mb-5">
              <Command size={13} className="text-[#555]" />
              <span className="t-label">FREQUENT COMMANDS</span>
            </div>
            <div className="space-y-4">
              {demoCommands.map((cmd, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[13px] text-[#bbb]">{cmd.command}</span>
                    <span className="t-mono-xs text-[#444]">{cmd.count}</span>
                  </div>
                  <div className="w-full h-[3px] bg-[#0e0e0e]">
                    <div
                      className="h-full bg-white transition-all duration-700"
                      style={{ width: `${(cmd.count / maxCount) * 100}%`, opacity: 0.15 + (cmd.count / maxCount) * 0.85 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Frequent contacts */}
          <div className="bg-[#000] p-6">
            <div className="flex items-center gap-2.5 mb-5">
              <User size={13} className="text-[#555]" />
              <span className="t-label">FREQUENT CONTACTS</span>
            </div>
            <div className="space-y-0">
              {demoContacts.map((contact, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-[#0e0e0e] last:border-b-0">
                  <span className="text-[13px] text-[#bbb] font-mono">{contact.name}</span>
                  <span className="t-mono-xs text-[#444]">{contact.count} interactions</span>
                </div>
              ))}
            </div>
          </div>

          {/* Frequent files */}
          <div className="bg-[#000] p-6">
            <div className="flex items-center gap-2.5 mb-5">
              <FolderOpen size={13} className="text-[#555]" />
              <span className="t-label">FREQUENT FILES</span>
            </div>
            <div className="space-y-0">
              {demoFiles.map((file, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-[#0e0e0e] last:border-b-0">
                  <span className="text-[12px] text-[#777] font-mono truncate max-w-[70%]">{file.path}</span>
                  <span className="t-mono-xs text-[#444]">{file.count}×</span>
                </div>
              ))}
            </div>
          </div>

          {/* Daily patterns */}
          <div className="bg-[#000] p-6">
            <div className="flex items-center gap-2.5 mb-5">
              <BarChart3 size={13} className="text-[#555]" />
              <span className="t-label">DAILY PATTERNS</span>
            </div>
            <div className="space-y-0">
              {demoHabits.map((habit) => (
                <div key={habit.id} className="flex items-center justify-between py-3 border-b border-[#0e0e0e] last:border-b-0">
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] text-[#bbb]">{habit.action}</span>
                    <span className="t-mono-xs text-[#333] border border-[#181818] px-1.5 py-0.5">@ {habit.timeOfDay}</span>
                  </div>
                  <span className="t-mono-xs text-[#444]">{habit.frequency}×/week</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
