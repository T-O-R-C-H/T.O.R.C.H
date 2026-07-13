import {
  IconCommand as Command,
  IconUser as User,
  IconFolder as FolderOpen,
  IconChart as BarChart3
} from '../components/icons'
import { useMemoryStore } from '../store/memoryStore'

export function Memory(): JSX.Element {
  const habits = useMemoryStore((s) => s.habits)
  const frequentCommands = useMemoryStore((s) => s.frequentCommands)
  const frequentContacts = useMemoryStore((s) => s.frequentContacts)
  const frequentFiles = useMemoryStore((s) => s.frequentFiles)

  const demoCommands =
    frequentCommands.length > 0
      ? frequentCommands
      : [
          { command: 'Send email', count: 34 },
          { command: 'Find file', count: 28 },
          { command: 'Search web', count: 22 },
          { command: 'Read PDF', count: 15 },
          { command: 'Post social', count: 11 }
        ]

  const demoContacts =
    frequentContacts.length > 0
      ? frequentContacts
      : [
          { name: 'john@company.com', count: 12 },
          { name: 'sarah@team.io', count: 8 },
          { name: 'dev@startup.com', count: 6 }
        ]

  const demoFiles =
    frequentFiles.length > 0
      ? frequentFiles
      : [
          { path: '/Documents/Reports/Q4-Report.pdf', count: 8 },
          { path: '/Projects/TORCH/README.md', count: 6 },
          { path: '/Downloads/dataset.csv', count: 4 }
        ]

  const demoHabits =
    habits.length > 0
      ? habits
      : [
          {
            id: '1',
            action: 'Check email inbox',
            frequency: 5,
            lastOccurrence: Date.now(),
            timeOfDay: '09:00',
            category: 'email'
          },
          {
            id: '2',
            action: 'Review daily reports',
            frequency: 4,
            lastOccurrence: Date.now(),
            timeOfDay: '09:30',
            category: 'files'
          },
          {
            id: '3',
            action: 'Post team update',
            frequency: 3,
            lastOccurrence: Date.now(),
            timeOfDay: '17:00',
            category: 'social'
          }
        ]

  const maxCount = Math.max(...demoCommands.map((c) => c.count))

  return (
    <div className="page-shell page-enter">
      <div className="page-shell__body p-0">
        <div className="stat-grid grid-cols-2">
          <div className="stat-cell">
            <div className="flex items-center gap-2.5 mb-5">
              <Command size={13} className="text-[var(--color-torch-text-tertiary)]" />
              <span className="t-label">Frequent commands</span>
            </div>
            <div className="space-y-4">
              {demoCommands.map((cmd, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[13px] text-[var(--color-torch-text)]">
                      {cmd.command}
                    </span>
                    <span className="t-mono-xs">{cmd.count}</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-bar__fill"
                      style={{
                        width: `${(cmd.count / maxCount) * 100}%`,
                        opacity: 0.25 + (cmd.count / maxCount) * 0.75
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="stat-cell">
            <div className="flex items-center gap-2.5 mb-5">
              <User size={13} className="text-[var(--color-torch-text-tertiary)]" />
              <span className="t-label">Frequent contacts</span>
            </div>
            <div>
              {demoContacts.map((contact, i) => (
                <div key={i} className="setting-row" style={{ padding: '12px 0' }}>
                  <span className="text-[13px] font-mono text-[var(--color-torch-text)]">
                    {contact.name}
                  </span>
                  <span className="t-mono-xs">{contact.count} interactions</span>
                </div>
              ))}
            </div>
          </div>

          <div className="stat-cell">
            <div className="flex items-center gap-2.5 mb-5">
              <FolderOpen size={13} className="text-[var(--color-torch-text-tertiary)]" />
              <span className="t-label">Frequent files</span>
            </div>
            <div>
              {demoFiles.map((file, i) => (
                <div key={i} className="setting-row" style={{ padding: '12px 0' }}>
                  <span className="text-[12px] font-mono truncate max-w-[70%] text-[var(--color-torch-text-secondary)]">
                    {file.path}
                  </span>
                  <span className="t-mono-xs">{file.count}×</span>
                </div>
              ))}
            </div>
          </div>

          <div className="stat-cell">
            <div className="flex items-center gap-2.5 mb-5">
              <BarChart3 size={13} className="text-[var(--color-torch-text-tertiary)]" />
              <span className="t-label">Daily patterns</span>
            </div>
            <div>
              {demoHabits.map((habit) => (
                <div key={habit.id} className="setting-row" style={{ padding: '12px 0' }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[13px] text-[var(--color-torch-text)]">
                      {habit.action}
                    </span>
                    <span className="pill-count">@ {habit.timeOfDay}</span>
                  </div>
                  <span className="t-mono-xs">{habit.frequency}×/week</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
