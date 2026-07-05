import { useNavigate } from 'react-router-dom'
import { useTorchStore } from '../store/torchStore'
import { TorchWordmark } from '../components/ui/TorchWordmark'

const quickActions = [
  { label: 'Find a file', command: 'Find my latest report in Documents' },
  { label: 'Check inbox', command: 'Check my recent emails' },
  { label: 'Search the web', command: 'Search the web for AI news today' },
  { label: 'Read my screen', command: 'Read my desktop and tell me what you see' }
]

export function Today(): JSX.Element {
  const navigate = useNavigate()
  const metrics = useTorchStore((s) => s.metrics)
  const userName = localStorage.getItem('torch_user_name') || 'there'

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning'
    : hour < 17 ? 'Good afternoon'
    : 'Good evening'

  const runCommand = (command: string): void => {
    navigate('/chat', { state: { runCommand: command } })
  }

  return (
    <div className="page-shell page-enter">
      <div className="page-shell__body today-page">
        <div className="today-hero">
          <TorchWordmark size="sm" />
          <h1 className="today-hero__title">{greeting}, {userName}</h1>
          <p className="today-hero__subtitle">
            Your desktop agent is ready. Pick a quick action or open Chat to give TORCH a task.
          </p>
        </div>

        <div className="today-stats">
          <div className="today-stat card">
            <span className="today-stat__label">Tasks done</span>
            <span className="today-stat__value">{metrics.tasksCompleted}</span>
          </div>
          <div className="today-stat card">
            <span className="today-stat__label">Time saved</span>
            <span className="today-stat__value">{metrics.timeSaved.toFixed(1)}h</span>
          </div>
          <div className="today-stat card">
            <span className="today-stat__label">Actions</span>
            <span className="today-stat__value">{metrics.actionsExecuted}</span>
          </div>
          <div className="today-stat card">
            <span className="today-stat__label">Success rate</span>
            <span className="today-stat__value">{metrics.successRate}%</span>
          </div>
        </div>

        <div className="today-section">
          <h2 className="today-section__title">Quick actions</h2>
          <div className="today-actions">
            {quickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                className="cmd-suggestion"
                onClick={() => runCommand(action.command)}
              >
                <span>
                  <div className="cmd-suggestion__title">{action.label}</div>
                  <div className="cmd-suggestion__desc">{action.command}</div>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="today-section">
          <h2 className="today-section__title">Jump in</h2>
          <div className="today-links">
            <button type="button" className="btn-secondary" onClick={() => navigate('/chat')}>
              Open Command Center
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate('/tools/clipboard')}>
              View clipboard
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate('/history')}>
              Task history
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
