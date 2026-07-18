import { useNavigate } from 'react-router-dom'
import { IconFile as FileIcon } from '../components/icons'

export function FollowUps(): JSX.Element {
  const navigate = useNavigate()

  return (
    <div className="page-shell page-enter">
      <div className="page-shell__body flex flex-col items-center justify-center text-center p-8 max-w-lg mx-auto h-full">
        <div 
          className="flex items-center justify-center w-16 h-16 rounded-full mb-6" 
          style={{ 
            background: 'var(--color-torch-bg-secondary, rgba(255, 255, 255, 0.03))',
            border: '1px solid var(--color-torch-border, rgba(255, 255, 255, 0.08))' 
          }}
        >
          <FileIcon size={24} style={{ color: 'var(--color-torch-text-secondary)' }} />
        </div>
        <h1 
          className="text-xl font-semibold mb-2" 
          style={{ color: 'var(--color-torch-text)' }}
        >
          Follow-ups
        </h1>
        <p 
          className="text-sm mb-8" 
          style={{ color: 'var(--color-torch-text-secondary)', lineHeight: 1.5 }}
        >
          Track pending actions, follow-up items, and requests identified from your tasks, chat messages, or screen activity automatically.
        </p>

        <div className="flex gap-4">
          <button 
            type="button" 
            className="btn-primary" 
            onClick={() => navigate('/')}
          >
            Create a Task
          </button>
          <button 
            type="button" 
            className="btn-secondary" 
            onClick={() => navigate('/history')}
          >
            View History
          </button>
        </div>
      </div>
    </div>
  )
}
