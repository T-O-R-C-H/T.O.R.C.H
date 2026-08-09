import { useEffect, useRef, useCallback, useState } from 'react'
import { ConversationTurn } from './ConversationTurn'
import { useAgentWatchdog } from './AgentActivity'
import { useTorchStore } from '../../store/torchStore'
import { TorchLogo } from '../ui/TorchLogo'
import { CmdFileSearch, CmdFolder, CmdMail, CmdMonitor } from '../icons/cleanIcons'
import { buildChatTurns } from '../../utils/chatTurns'
import { useWebSocket } from '../../hooks/useWebSocket'
import { formatAgentContent } from '../../utils/plainLanguage'
import { ClarificationPrompt } from './ClarificationPrompt'

const promptSuggestions = [
  {
    icon: CmdFileSearch,
    title: 'Find a file',
    command: 'Find my latest report in Documents',
    desc: 'Search folders and open what you need'
  },
  {
    icon: CmdMail,
    title: 'Draft an email',
    command: 'Draft a short follow-up email to the team',
    desc: 'Compose and review before sending'
  },
  {
    icon: CmdFolder,
    title: 'Summarize a document',
    command: 'Summarize the PDF in my Downloads folder',
    desc: 'Get key points without reading every page'
  },
  {
    icon: CmdMonitor,
    title: 'Open an application',
    command: 'Open VS Code and my latest project folder',
    desc: 'Launch apps and navigate your desktop'
  }
]

interface ChatAreaProps {
  onApprove?: (messageId: string, stepId: string) => void
  onEdit?: (messageId: string, stepId: string) => void
  onCancel?: (messageId: string, stepId: string) => void
  onSend?: (command: string) => void
}

function SuggestionCard({
  icon: Icon,
  title,
  desc,
  onClick
}: {
  icon: typeof CmdFileSearch
  title: string
  desc: string
  onClick: () => void
}): JSX.Element {
  return (
    <button type="button" className="cmd-suggestion" onClick={onClick}>
      <span className="cmd-suggestion__icon">
        <Icon size={16} />
      </span>
      <span>
        <div className="cmd-suggestion__title">{title}</div>
        <div className="cmd-suggestion__desc">{desc}</div>
      </span>
    </button>
  )
}

export function ChatArea({ onApprove, onEdit, onCancel, onSend }: ChatAreaProps): JSX.Element {
  const messages = useTorchStore((s) => s.messages)
  const agentStatus = useTorchStore((s) => s.agentStatus)
  const demoMode = useTorchStore((s) => s.demoMode)
  const wsConnected = useTorchStore((s) => s.wsConnected)
  const scrollRef = useRef<HTMLDivElement>(null)
  const previousMessageCount = useRef(messages.length)
  const { sendStopCommand } = useWebSocket()
  
  const [startingUp, setStartingUp] = useState(true)

  useEffect(() => {
    if (!wsConnected && !demoMode) return
    const timer = window.setTimeout(() => setStartingUp(false), 0)
    return () => window.clearTimeout(timer)
  }, [wsConnected, demoMode])

  const turns = buildChatTurns(messages)
  const lastTurn = turns[turns.length - 1]
  const isBusy =
    agentStatus === 'processing' ||
    agentStatus === 'executing' ||
    agentStatus === 'awaiting_input' ||
    agentStatus === 'awaiting_approval'
  const visionControlActive = Boolean(
    lastTurn?.agent?.steps?.some((step) => step.tool === 'vision_control')
  )
  const pendingLastTurn = Boolean(isBusy && lastTurn?.user && !lastTurn?.agent)
  const activityStartedAt = lastTurn?.user?.timestamp

  const handleActivityTimeout = useCallback((): void => {
    const offline = !navigator.onLine || (!demoMode && !wsConnected)
    if (demoMode) {
      useTorchStore.getState().setAgentStatus('idle')
    } else {
      sendStopCommand()
    }
    useTorchStore.getState().addMessage({
      id: crypto.randomUUID(),
      role: 'torch',
      content: formatAgentContent(
        offline
          ? "You're offline or TORCH lost connection. I stopped the task. Reconnect to Wi‑Fi and try again."
          : "This took too long, so I stopped. Try a simpler request, or check Settings if screen capture or email isn't set up."
      ),
      timestamp: Date.now(),
      steps: []
    })
    useTorchStore.getState().setAgentStatus('idle')
  }, [demoMode, sendStopCommand, wsConnected])

  // Local multimodal inference can legitimately take minutes on CPU. Vision
  // control already has a visible Stop button and a hard 25-step limit, so the
  // short watchdog remains for ordinary tasks but must not cancel vision work.
  useAgentWatchdog(isBusy && !visionControlActive, activityStartedAt, handleActivityTimeout)

  useEffect(() => {
    if (scrollRef.current) {
      const isNewMessage = messages.length !== previousMessageCount.current
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: isNewMessage ? 'smooth' : 'auto'
      })
      previousMessageCount.current = messages.length
    }
  }, [messages, agentStatus])

  if (messages.length === 0) {
    if (startingUp && !demoMode) {
      return (
        <div className="cmd-idle">
          <div className="cmd-idle__header">
            <TorchLogo size={72} />
            <p className="cmd-idle__title">Starting TORCH…</p>
            <p className="cmd-idle__subtitle">
              Waking up the local agent server. This takes a few seconds.
            </p>
          </div>
        </div>
      )
    }

    return (
      <div className="cmd-idle">
        <div className="cmd-idle__header">
          <TorchLogo size={72} />
          <p className="cmd-idle__title">Command Center</p>
          <p className="cmd-idle__subtitle">
            Tell TORCH what to do, or pick a suggestion below. Every step runs live in this view.
          </p>
        </div>

        <div className="cmd-suggestions">
          {promptSuggestions.map((s) => (
            <SuggestionCard
              key={s.title}
              icon={s.icon}
              title={s.title}
              desc={s.desc}
              onClick={() => onSend?.(s.command)}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="cmd-feed">
      <div className="cmd-feed__inner">
        {turns.map((turn) => {
          if (turn.system) {
            return (
              <div key={turn.id} className="chat-system fade-in">
                {turn.system.content}
              </div>
            )
          }

          const agentId = turn.agent?.id ?? turn.user?.id ?? turn.id
          const isPendingTurn = pendingLastTurn && turn.id === lastTurn?.id
          const hasFailedSteps = Boolean(turn.agent?.steps?.some((s) => s.status === 'failed'))

          return (
            <ConversationTurn
              key={turn.id}
              user={turn.user}
              agent={turn.agent}
              showActivity={
                (isPendingTurn || Boolean(turn.agent?.isStreaming && !turn.agent.content)) &&
                !hasFailedSteps
              }
              activityStatus={agentStatus}
              activityStartedAt={turn.user?.timestamp}
              onActivityTimeout={isPendingTurn ? handleActivityTimeout : undefined}
              onApprove={(stepId) => onApprove?.(agentId, stepId)}
              onEdit={(stepId) => onEdit?.(agentId, stepId)}
              onCancel={(stepId) => onCancel?.(agentId, stepId)}
            />
          )
        })}
        <ClarificationPrompt />
      </div>
    </div>
  )
}
