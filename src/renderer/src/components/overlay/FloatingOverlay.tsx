import { useState, useEffect, useRef, useCallback } from 'react'
import { TorchLogo } from '../ui/TorchLogo'
import { CmdArrowUp } from '../icons/cleanIcons'
import { ApprovalCard } from '../chat/ApprovalCard'
import { LinkifiedText } from '../chat/LinkifiedText'
import { useWebSocket } from '../../hooks/useWebSocket'
import { useTorchStore, type Step } from '../../store/torchStore'
import { formatAgentContent } from '../../utils/plainLanguage'
import {
  enrichOverlayCommand,
  getClipboardActions,
  getContextSuggestions
} from '../../utils/overlayContext'

interface DesktopContext {
  windowTitle: string
  appName: string
  clipboardText: string
  focusLabel?: string
}

interface ClipboardChange {
  id: string
  text: string
  timestamp: number
  kind: 'code' | 'url' | 'email' | 'text'
}

const CLIPBOARD_LABELS: Record<string, string> = {
  code: 'Copied Code',
  url: 'Copied URL',
  email: 'Copied Email',
  text: 'Copied Text'
}

export function FloatingOverlay(): JSX.Element {
  const [input, setInput] = useState('')
  const [context, setContext] = useState<DesktopContext>({
    windowTitle: '',
    appName: 'Desktop',
    clipboardText: ''
  })
  const [clipboardPopup, setClipboardPopup] = useState<ClipboardChange | null>(null)
  const [reply, setReply] = useState('')
  const [pendingApproval, setPendingApproval] = useState<{
    messageId: string
    stepId: string
    summary: string
  } | null>(null)

  const { sendCommand, sendApproval } = useWebSocket()
  const wsConnected = useTorchStore((s) => s.wsConnected)
  const agentStatus = useTorchStore((s) => s.agentStatus)
  const messages = useTorchStore((s) => s.messages)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const popupTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const lastReplyId = useRef<string | null>(null)

  const isBusy =
    agentStatus === 'processing' ||
    agentStatus === 'executing' ||
    agentStatus === 'awaiting_approval'

  const refreshContext = useCallback(async (): Promise<void> => {
    const ctx = await window.torchAPI?.getDesktopContext()
    if (ctx) setContext(ctx)
  }, [])

  useEffect(() => {
    void refreshContext()
    const interval = setInterval(() => {
      void refreshContext()
    }, 4000)

    const handleActivate = (): void => {
      void refreshContext()
      inputRef.current?.focus()
    }

    const handleClipboard = (_e: unknown, change: ClipboardChange): void => {
      setClipboardPopup(change)
      if (popupTimer.current) clearTimeout(popupTimer.current)
      popupTimer.current = setTimeout(() => setClipboardPopup(null), 12000)
    }

    window.torchAPI?.onOverlayActivate(handleActivate)
    window.torchAPI?.onClipboardChanged(handleClipboard)

    return (): void => {
      clearInterval(interval)
      if (popupTimer.current) clearTimeout(popupTimer.current)
      window.torchAPI?.removeOverlayActivate()
      window.torchAPI?.removeClipboardChanged()
    }
  }, [refreshContext])

  useEffect(() => {
    const lastAgent = [...messages].reverse().find((m) => m.role === 'torch')
    if (!lastAgent || lastAgent.id === lastReplyId.current) return

    if (lastAgent.content) {
      lastReplyId.current = lastAgent.id
      setReply(formatAgentContent(lastAgent.content))
    }

    const hitlStep = lastAgent.steps?.find((s: Step) => s.status === 'hitl_required')
    if (hitlStep) {
      setPendingApproval({
        messageId: lastAgent.id,
        stepId: hitlStep.id,
        summary: hitlStep.label
      })
    }
  }, [messages])

  const handleSend = useCallback(
    (rawCommand: string): void => {
      const command = rawCommand.trim()
      if (!command || isBusy) return

      setClipboardPopup(null)
      setReply('')
      setPendingApproval(null)
      lastReplyId.current = null

      const enriched = enrichOverlayCommand(command, context)
      useTorchStore.getState().setAgentStatus('processing')
      sendCommand(enriched)
      setInput('')
    },
    [context, isBusy, sendCommand]
  )

  const suggestions = getContextSuggestions(context.appName, clipboardPopup?.kind)
  const clipboardActions = clipboardPopup ? getClipboardActions(clipboardPopup.kind) : []

  return (
    <div className="floating-overlay">
      <div className="floating-overlay__header overlay-drag">
        <TorchLogo width={72} />
        <div className="floating-overlay__context">
          <span className="floating-overlay__context-label">Active</span>
          <span className="floating-overlay__context-app">{context.appName}</span>
          {context.focusLabel && (
            <span className="floating-overlay__context-focus">{context.focusLabel}</span>
          )}
        </div>
        <div className="floating-overlay__header-actions overlay-no-drag">
          <button
            type="button"
            className="floating-overlay__icon-btn"
            onClick={() => window.torchAPI?.openMainWindow()}
            aria-label="Open main window"
            title="Open TORCH"
          >
            ↗
          </button>
          <button
            type="button"
            className="floating-overlay__icon-btn"
            onClick={() => window.torchAPI?.hideOverlay()}
            aria-label="Hide overlay"
            title="Hide"
          >
            ×
          </button>
        </div>
      </div>

      {clipboardPopup && (
        <div className="floating-overlay__clipboard overlay-no-drag">
          <div className="floating-overlay__clipboard-head">
            <span>{CLIPBOARD_LABELS[clipboardPopup.kind] || 'Copied'}</span>
            <button type="button" onClick={() => setClipboardPopup(null)}>
              ×
            </button>
          </div>
          <p className="floating-overlay__clipboard-preview">{clipboardPopup.text.slice(0, 120)}</p>
          <div className="floating-overlay__clipboard-actions">
            {clipboardActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => handleSend(action.command)}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="floating-overlay__body overlay-no-drag">
        {!wsConnected && (
          <p className="floating-overlay__status floating-overlay__status--warn">
            Connecting to TORCH…
          </p>
        )}

        {isBusy && !reply && (
          <div className="floating-overlay__status">
            <span className="typing-square" />
            <span className="typing-square" style={{ animationDelay: '0.12s' }} />
            <span className="typing-square" style={{ animationDelay: '0.24s' }} />
            <span>Working on it…</span>
          </div>
        )}

        {reply && (
          <div className="floating-overlay__reply">
            <LinkifiedText text={reply} />
          </div>
        )}

        {pendingApproval && (
          <ApprovalCard
            summary={pendingApproval.summary}
            onApprove={() => {
              sendApproval(pendingApproval.messageId, pendingApproval.stepId, 'approve')
              setPendingApproval(null)
            }}
            onEdit={() => {}}
            onCancel={() => {
              sendApproval(pendingApproval.messageId, pendingApproval.stepId, 'cancel')
              setPendingApproval(null)
            }}
          />
        )}
      </div>

      <div className="floating-overlay__chips overlay-no-drag">
        {suggestions.slice(0, 3).map((s) => (
          <button key={s.label} type="button" onClick={() => handleSend(s.command)}>
            {s.label}
          </button>
        ))}
      </div>

      <div className="floating-overlay__input overlay-no-drag">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask TORCH in ${context.appName}…`}
          rows={2}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend(input)
            }
          }}
        />
        <button
          type="button"
          className="cmd-input-send"
          disabled={!input.trim() || isBusy}
          onClick={() => handleSend(input)}
          aria-label="Send"
        >
          <CmdArrowUp size={14} />
        </button>
      </div>
    </div>
  )
}
