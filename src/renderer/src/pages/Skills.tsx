import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconPlay as Play, IconX as Delete, IconSparkles as Sparkles, IconLoader as Loader, IconAdd as Add } from '../components/icons'
import { useTorchStore } from '../store/torchStore'

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
  const navigate = useNavigate()
  const demoMode = useTorchStore((s) => s.demoMode)

  const loadSkills = async (): Promise<void> => {
    try {
      setLoading(true)
      await fetchSkills()
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Error fetching skills')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSkills()
  }, [demoMode])

  const handleRunSkill = async (skill: Skill): Promise<void> => {
    if (demoMode) {
      navigate('/chat', { state: { runCommand: skill.command } })
      return
    }

    try {
      const response = await fetch(`http://localhost:8000/api/skills/${skill.id}/run`, {
        method: 'POST'
      })
      if (!response.ok) {
        throw new Error('Failed to run skill')
      }
      const data = await response.json()
      if (data.status === 'success') {
        // Fetch updated skills to sync run count across views
        await fetchSkills()
        navigate('/chat', { state: { runCommand: data.command } })
      } else {
        throw new Error(data.message || 'Error running skill')
      }
    } catch (err: any) {
      alert(err.message || 'Error executing skill')
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
      const response = await fetch(`http://localhost:8000/api/skills/${skillId}`, {
        method: 'DELETE'
      })
      if (!response.ok) {
        throw new Error('Failed to delete skill')
      }
      await fetchSkills()
    } catch (err: any) {
      alert(err.message || 'Error deleting skill')
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
      const response = await fetch('http://localhost:8000/api/skills', {
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
    } catch (err: any) {
      alert(err.message || 'Error creating skill')
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full page-enter overflow-y-auto bg-black text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#141414] flex-shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="t-page-title">Skills</h1>
          <span className="t-mono-xs text-[#333] border border-[#181818] px-2.5 py-1">
            {skills.length} saved
          </span>
        </div>
        <button
          onClick={(): void => setShowAddForm(!showAddForm)}
          className="btn-secondary text-[10px] px-4 py-1.5 flex items-center gap-1.5"
        >
          {showAddForm ? <Delete size={10} /> : <Add size={10} />}
          <span>{showAddForm ? 'Cancel' : 'New Skill'}</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        {showAddForm && (
          <form onSubmit={handleCreateSkill} className="mb-6 p-5 border border-[#181818] bg-[#050505] space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-[#444] font-mono uppercase tracking-wider">Skill Name</label>
                <input
                  type="text"
                  placeholder="e.g. Morning Briefing"
                  value={newName}
                  onChange={(e): void => setNewName(e.target.value)}
                  className="bg-black border border-[#181818] text-white text-[12px] px-3 py-2 w-full focus:border-[#444]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] text-[#444] font-mono uppercase tracking-wider">Command</label>
                <input
                  type="text"
                  placeholder="e.g. check my emails and summarize today's news"
                  value={newCommand}
                  onChange={(e): void => setNewCommand(e.target.value)}
                  className="bg-black border border-[#181818] text-white text-[12px] px-3 py-2 w-full focus:border-[#444]"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="btn-primary text-[10px] px-5 py-1.5"
              >
                Create
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center h-[300px]">
            <Loader size={24} className="spinner text-[#666] mb-2" />
            <p className="text-sm text-[#444]">Loading skill repository...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-center">
            <p className="text-sm text-[#ef4444] font-medium mb-1">Failed to connect to backend</p>
            <p className="text-xs text-[#444] max-w-[300px] leading-relaxed">
              Make sure the backend python server is running. {error}
            </p>
          </div>
        ) : skills.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-center">
            <Sparkles size={28} className="text-[#222] mb-4" />
            <p className="text-[14px] text-[#444] font-medium">No custom skills yet</p>
            <p className="text-[12px] text-[#2a2a2a] mt-1.5 max-w-[320px] leading-relaxed">
              Ask TORCH to save any task: <br />
              <span className="text-[#666] italic">"Save this as a skill called Morning Briefing"</span>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {skills.map((skill) => (
              <div
                key={skill.id}
                onClick={(): Promise<void> => handleRunSkill(skill)}
                className="group relative flex flex-col justify-between border border-[#181818] bg-[#050505] p-5 hover:border-[#333] cursor-pointer transition-all duration-150"
              >
                {/* Delete Button */}
                <button
                  onClick={(e): Promise<void> => handleDeleteSkill(e, skill.id)}
                  className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 text-[#444] hover:text-[#fff] transition-all p-1"
                  title="Delete skill"
                >
                  <Delete size={12} />
                </button>

                {/* Card Top */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[14px] font-semibold text-white tracking-tight group-hover:text-[#fff]">
                      {skill.name}
                    </span>
                  </div>
                  <p className="text-[12px] text-[#666] font-mono leading-relaxed line-clamp-3 mb-4 select-none">
                    {skill.command}
                  </p>
                </div>

                {/* Card Bottom */}
                <div className="flex items-center justify-between border-t border-[#111] pt-3 mt-auto">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-[#333] font-mono tracking-wider uppercase">
                      Runs:
                    </span>
                    <span className="text-[10px] text-[#888] font-mono font-medium">
                      {skill.run_count}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-[#666] font-mono group-hover:text-white transition-colors duration-150">
                    <Play size={10} className="text-[#444] group-hover:text-white" />
                    <span>Run</span>
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
