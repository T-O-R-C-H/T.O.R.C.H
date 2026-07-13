import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IconPlay as Play,
  IconX as Delete,
  IconSparkles as Sparkles,
  IconLoader as Loader,
  IconAdd as Add
} from '../components/icons'
import { useTorchStore } from '../store/torchStore'
import { API_BASE } from '../config/api'
import { runShortcut } from '../utils/runShortcut'

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

interface Skill {
  id: string
  name: string
  command: string
  created_at: string
  run_count: number
}

export function Skills(): JSX.Element {
  const skills = useTorchStore((s) => s.skills)
  const fetchSkills = useTorchStore((s) => s.fetchSkills)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCommand, setNewCommand] = useState('')
  const [runningSkillIdsState, setRunningSkillIdsState] = useState<Set<string>>(() => new Set())
  const runningSkillIds = useRef(new Set<string>())
  const navigate = useNavigate()
  const demoMode = useTorchStore((s) => s.demoMode)

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      try {
        await fetchSkills()
        if (!cancelled) setError(null)
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err) || 'Error fetching skills')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return (): void => {
      cancelled = true
    }
  }, [fetchSkills, demoMode])

  const handleRunSkill = async (skill: Skill): Promise<void> => {
    if (runningSkillIds.current.has(skill.id)) return
    runningSkillIds.current.add(skill.id)
    setRunningSkillIdsState((current) => new Set(current).add(skill.id))
    if (demoMode) {
      navigate('/chat', { state: { runCommand: skill.command } })
      runningSkillIds.current.delete(skill.id)
      setRunningSkillIdsState((current) => {
        const next = new Set(current)
        next.delete(skill.id)
        return next
      })
      return
    }

    try {
      const data = await runShortcut(skill.id)
      await fetchSkills()
      navigate('/chat', { state: { runCommand: data.command } })
    } catch (err) {
      alert(getErrorMessage(err) || 'Error executing skill')
    } finally {
      runningSkillIds.current.delete(skill.id)
      setRunningSkillIdsState((current) => {
        const next = new Set(current)
        next.delete(skill.id)
        return next
      })
    }
  }

  const handleDeleteSkill = async (e: React.MouseEvent, skillId: string): Promise<void> => {
    e.stopPropagation() // Prevent triggering the card click (run command)

    if (demoMode) {
      useTorchStore.setState({ skills: skills.filter((s) => s.id !== skillId) })
      return
    }

    if (!confirm('Are you sure you want to delete this skill?')) {
      return
    }

    try {
      const response = await fetch(`${API_BASE}/api/skills/${skillId}`, {
        method: 'DELETE'
      })
      if (!response.ok) {
        throw new Error('Failed to delete skill')
      }
      await fetchSkills()
    } catch (err) {
      alert(getErrorMessage(err) || 'Error deleting skill')
    }
  }

  const handleCreateSkill = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()

    if (!newName.trim() || !newCommand.trim()) {
      alert('Name and command cannot be empty')
      return
    }

    if (demoMode) {
      const newSkill: Skill = {
        id: `demo-${Date.now()}`,
        name: newName.trim(),
        command: newCommand.trim(),
        created_at: new Date().toISOString(),
        run_count: 0
      }
      useTorchStore.setState({ skills: [newSkill, ...skills] })
      setNewName('')
      setNewCommand('')
      setShowAddForm(false)
      return
    }

    try {
      const response = await fetch(`${API_BASE}/api/skills`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newName.trim(),
          command: newCommand.trim()
        })
      })
      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.detail || 'Failed to create skill')
      }
      await fetchSkills()
      setNewName('')
      setNewCommand('')
      setShowAddForm(false)
    } catch (err) {
      alert(getErrorMessage(err) || 'Error creating skill')
    }
  }

  return (
    <div className="page-shell page-enter">
      <div className="page-shell__body">
        <div className="page-toolbar">
          <span className="pill-count">{skills.length} saved</span>
          <button
            onClick={(): void => setShowAddForm(!showAddForm)}
            className="btn-secondary text-[10px] px-4 py-1.5 flex items-center gap-1.5"
          >
            {showAddForm ? <Delete size={10} /> : <Add size={10} />}
            <span>{showAddForm ? 'Cancel' : 'New Skill'}</span>
          </button>
        </div>
        {showAddForm && (
          <form onSubmit={handleCreateSkill} className="mb-6 card space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="t-label">Skill name</label>
                <input
                  type="text"
                  placeholder="e.g. Morning Briefing"
                  value={newName}
                  onChange={(e): void => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="t-label">Command</label>
                <input
                  type="text"
                  placeholder="e.g. check my emails and summarize today's news"
                  value={newCommand}
                  onChange={(e): void => setNewCommand(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" className="btn-primary text-[10px] px-5 py-1.5">
                Create
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center h-[300px]">
            <Loader size={24} className="spinner mb-2" />
            <p className="text-sm text-[var(--color-torch-text-tertiary)]">
              Loading skill repository...
            </p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-center">
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-torch-error)' }}>
              Failed to connect to backend
            </p>
            <p className="text-xs text-[var(--color-torch-text-tertiary)] max-w-[300px] leading-relaxed">
              Make sure the backend python server is running. {error}
            </p>
          </div>
        ) : skills.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-center">
            <Sparkles size={28} className="text-[var(--color-torch-border)] mb-4" />
            <p className="text-[14px] font-medium text-[var(--color-torch-text-secondary)]">
              No custom skills yet
            </p>
            <p className="text-[12px] text-[var(--color-torch-text-tertiary)] mt-1.5 max-w-[320px] leading-relaxed">
              Ask TORCH to save any task: <br />
              <span className="italic">
                &quot;Save this as a skill called Morning Briefing&quot;
              </span>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {skills.map((skill) => (
              <div
                key={skill.id}
                onClick={(): void => {
                  if (!runningSkillIdsState.has(skill.id)) void handleRunSkill(skill)
                }}
                aria-busy={runningSkillIdsState.has(skill.id)}
                className={`group relative card hover:border-[var(--color-torch-border-hover)] transition-colors duration-150 flex flex-col justify-between min-h-[140px] ${runningSkillIdsState.has(skill.id) ? 'cursor-wait' : 'cursor-pointer'}`}
              >
                <button
                  type="button"
                  onClick={(e): Promise<void> => handleDeleteSkill(e, skill.id)}
                  className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-1"
                  style={{ color: 'var(--color-torch-text-tertiary)' }}
                  title="Delete skill"
                >
                  <Delete size={12} />
                </button>

                <div>
                  <div className="text-[14px] font-medium text-[var(--color-torch-text)] mb-2">
                    {skill.name}
                  </div>
                  <p className="text-[12px] font-mono text-[var(--color-torch-text-secondary)] leading-relaxed line-clamp-3 mb-4 select-none">
                    {skill.command}
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-[var(--color-torch-border-subtle)] pt-3 mt-auto">
                  <div className="flex items-center gap-1">
                    <span className="t-mono-xs">Runs:</span>
                    <span className="t-mono-xs text-[var(--color-torch-text)]">
                      {skill.run_count}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 t-mono-xs text-[var(--color-torch-text-secondary)]">
                    {runningSkillIdsState.has(skill.id) ? (
                      <Loader size={10} className="spinner" />
                    ) : (
                      <Play size={10} />
                    )}
                    <span>{runningSkillIdsState.has(skill.id) ? 'Running…' : 'Run'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
