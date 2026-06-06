import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconPlay as Play, IconX as Delete, IconSparkles as Sparkles, IconLoader as Loader } from '../components/icons'
import { useTorchStore } from '../store/torchStore'

interface Skill {
  id: string
  name: string
  command: string
  created_at: string
  run_count: number
}

export function Skills(): JSX.Element {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const demoMode = useTorchStore((s) => s.demoMode)

  const fetchSkills = async (): Promise<void> => {
    try {
      if (demoMode) {
        // Fallback for demo mode
        const demoSkills: Skill[] = [
          {
            id: 'demo-1',
            name: 'Morning Briefing',
            command: 'Read recent emails, search the web for tech news, and output a summary',
            created_at: new Date().toISOString(),
            run_count: 5
          },
          {
            id: 'demo-2',
            name: 'Clean Downloads',
            command: 'Delete all temporary files from my downloads folder',
            created_at: new Date().toISOString(),
            run_count: 2
          }
        ]
        setSkills(demoSkills)
        setLoading(false)
        return
      }

      const response = await fetch('http://localhost:8000/api/skills')
      if (!response.ok) {
        throw new Error('Failed to load skills')
      }
      const data = await response.json()
      setSkills(data)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Error fetching skills')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSkills()
  }, [demoMode])

  const handleRunSkill = async (skill: Skill): Promise<void> => {
    if (demoMode) {
      navigate('/', { state: { runCommand: skill.command } })
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
        navigate('/', { state: { runCommand: data.command } })
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
      setSkills((prev) => prev.filter((s) => s.id !== skillId))
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
      setSkills((prev) => prev.filter((s) => s.id !== skillId))
    } catch (err: any) {
      alert(err.message || 'Error deleting skill')
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
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
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
