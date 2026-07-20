import { useNavigate } from 'react-router-dom'
import { IconInbox as InboxIcon } from '../components/icons'

export function Inbox(): JSX.Element {
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
          <InboxIcon size={24} style={{ color: 'var(--color-torch-text-secondary)' }} />
        </div>
        <h1 
          className="text-xl font-semibold mb-2" 
          style={{ color: 'var(--color-torch-text)' }}
        >
          Inbox
        </h1>
        <p 
          className="text-sm mb-8" 
          style={{ color: 'var(--color-torch-text-secondary)', lineHeight: 1.5 }}
        >
          Your connected email inbox will sync here. TORCH can read your messages to extract tasks, draft updates, and keep your workspace synchronized.
        </p>

        <div className="flex gap-4">
          <button 
            type="button" 
            className="btn-primary" 
            onClick={() => navigate('/settings')}
          >
            Configure Email Settings
          </button>
          <button 
            type="button" 
            className="btn-secondary" 
            onClick={() => navigate('/')}
          >
            Go to Command Center
          </button>
        </div>
      </div>
    </div>
  )
}
