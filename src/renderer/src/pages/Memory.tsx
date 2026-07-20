import { useEffect, useState } from 'react'
import {
  IconCommand as Command,
  IconUser as User,
  IconFolder as FolderOpen,
  IconChart as BarChart3
} from '../components/icons'
import { useMemoryStore } from '../store/memoryStore'
import { useTorchStore } from '../store/torchStore'
import { API_BASE } from '../config/api'

const demoCommands = [
  { command: 'Send email', count: 34 },
  { command: 'Find file', count: 28 },
  { command: 'Search web', count: 22 },
  { command: 'Read PDF', count: 15 },
  { command: 'Post social', count: 11 }
]

const demoContacts = [
  { name: 'john@company.com', count: 12 },
  { name: 'sarah@team.io', count: 8 },
  { name: 'dev@startup.com', count: 6 }
]

const demoFiles = [
  { path: '/Documents/Reports/Q4-Report.pdf', count: 8 },
  { path: '/Projects/TORCH/README.md', count: 6 },
  { path: '/Downloads/dataset.csv', count: 4 }
]

const demoHabits = [
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

export function Memory(): JSX.Element {
  const habits = useMemoryStore((s) => s.habits)
  const frequentCommands = useMemoryStore((s) => s.frequentCommands)
  const frequentContacts = useMemoryStore((s) => s.frequentContacts)
  const frequentFiles = useMemoryStore((s) => s.frequentFiles)

  const setHabits = useMemoryStore((s) => s.setHabits)
  const setFrequentCommands = useMemoryStore((s) => s.setFrequentCommands)
  const setFrequentContacts = useMemoryStore((s) => s.setFrequentContacts)
  const setFrequentFiles = useMemoryStore((s) => s.setFrequentFiles)

  const demoMode = useTorchStore((s) => s.demoMode)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (demoMode) {
      return
    }

    let active = true
    const fetchMemory = async (): Promise<void> => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${API_BASE}/api/memory`)
        if (!res.ok) throw new Error('Failed to fetch memory data')
        const data = await res.json()
        if (active) {
          setFrequentCommands(data.frequent_commands || [])
          setFrequentContacts(data.frequent_contacts || [])
          setFrequentFiles(data.frequent_files || [])
          setHabits(data.habits || [])
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Error loading memory')
      } finally {
        if (active) setLoading(false)
      }
    }

    void fetchMemory()
    return () => {
      active = false
    }
  }, [demoMode, setFrequentCommands, setFrequentContacts, setFrequentFiles, setHabits])

  const commandsToDisplay = demoMode ? demoCommands : frequentCommands
  const contactsToDisplay = demoMode ? demoContacts : frequentContacts
  const filesToDisplay = demoMode ? demoFiles : frequentFiles
  const habitsToDisplay = demoMode ? demoHabits : habits

  const maxCount = commandsToDisplay.length > 0 ? Math.max(...commandsToDisplay.map((c) => c.count)) : 1

  return (
    <div className="page-shell page-enter">
      <div className="page-shell__body p-0">
        {loading ? (
          <div className="flex items-center justify-center p-12 text-sm text-[var(--color-torch-text-secondary)]">
            Loading memory data...
          </div>
        ) : error ? (
          <div className="flex items-center justify-center p-12 text-sm text-[var(--color-torch-error)]">
            {error}
          </div>
        ) : (
          <div className="stat-grid grid-cols-2">
            <div className="stat-cell">
              <div className="flex items-center gap-2.5 mb-5">
                <Command size={13} className="text-[var(--color-torch-text-tertiary)]" />
                <span className="t-label">Frequent commands</span>
              </div>
              <div className="space-y-4">
                {commandsToDisplay.length === 0 ? (
                  <div className="text-[12px] text-[var(--color-torch-text-tertiary)] py-2">
                    No frequent commands recorded yet
                  </div>
                ) : (
                  commandsToDisplay.map((cmd, i) => (
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
                  ))
                )}
              </div>
            </div>

            <div className="stat-cell">
              <div className="flex items-center gap-2.5 mb-5">
                <User size={13} className="text-[var(--color-torch-text-tertiary)]" />
                <span className="t-label">Frequent contacts</span>
              </div>
              <div>
                {contactsToDisplay.length === 0 ? (
                  <div className="text-[12px] text-[var(--color-torch-text-tertiary)] py-2">
                    No frequent contacts recorded yet
                  </div>
                ) : (
                  contactsToDisplay.map((contact, i) => (
                    <div key={i} className="setting-row" style={{ padding: '12px 0' }}>
                      <span className="text-[13px] font-mono text-[var(--color-torch-text)]">
                        {contact.name}
                      </span>
                      <span className="t-mono-xs">{contact.count} interactions</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="stat-cell">
              <div className="flex items-center gap-2.5 mb-5">
                <FolderOpen size={13} className="text-[var(--color-torch-text-tertiary)]" />
                <span className="t-label">Frequent files</span>
              </div>
              <div>
                {filesToDisplay.length === 0 ? (
                  <div className="text-[12px] text-[var(--color-torch-text-tertiary)] py-2">
                    No frequent files recorded yet
                  </div>
                ) : (
                  filesToDisplay.map((file, i) => (
                    <div key={i} className="setting-row" style={{ padding: '12px 0' }}>
                      <span className="text-[12px] font-mono truncate max-w-[70%] text-[var(--color-torch-text-secondary)]">
                        {file.path}
                      </span>
                      <span className="t-mono-xs">{file.count}×</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="stat-cell">
              <div className="flex items-center gap-2.5 mb-5">
                <BarChart3 size={13} className="text-[var(--color-torch-text-tertiary)]" />
                <span className="t-label">Daily patterns</span>
              </div>
              <div>
                {habitsToDisplay.length === 0 ? (
                  <div className="text-[12px] text-[var(--color-torch-text-tertiary)] py-2">
                    No daily patterns detected yet
                  </div>
                ) : (
                  habitsToDisplay.map((habit) => (
                    <div key={habit.id} className="setting-row" style={{ padding: '12px 0' }}>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-[13px] text-[var(--color-torch-text)]">
                          {habit.action}
                        </span>
                        <span className="pill-count">@ {habit.timeOfDay}</span>
                      </div>
                      <span className="t-mono-xs">{habit.frequency}×/week</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
