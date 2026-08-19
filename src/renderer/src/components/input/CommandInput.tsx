import { useState, useRef, useEffect, type KeyboardEvent } from 'react'

import { useTorchStore } from '../../store/torchStore'

import { useWebSocket } from '../../hooks/useWebSocket'

import { CmdArrowUp } from '../icons/cleanIcons'

import { API_BASE } from '../../config/api'

interface CommandInputProps {
  onSend: (command: string) => void
}

const FALLBACK_MODELS = [
  { id: 'auto', label: 'Auto' },

  { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },

  { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },

  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },

  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },

  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },

  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },

  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' }
  ,
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },

  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8' },

  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' }
]

export function CommandInput({ onSend }: CommandInputProps): JSX.Element {
  const [text, setText] = useState('')

  const [justSent, setJustSent] = useState(false)

  const [models, setModels] = useState(FALLBACK_MODELS)

  const inputRef = useRef<HTMLTextAreaElement>(null)

  const agentStatus = useTorchStore((s) => s.agentStatus)

  const wsConnected = useTorchStore((s) => s.wsConnected)

  const demoMode = useTorchStore((s) => s.demoMode)

  const selectedModel = useTorchStore((s) => s.selectedModel)

  const setSelectedModel = useTorchStore((s) => s.setSelectedModel)

  const { sendStopCommand } = useWebSocket()

  useEffect(() => {
    if (demoMode) return

    fetch(`${API_BASE}/api/models`)
      .then((r) => r.json())

      .then((data) => {
        if (Array.isArray(data.models) && data.models.length > 0) {
          setModels(data.models)
        }
      })

      .catch(() => {})
  }, [demoMode, wsConnected])

  const handleSend = (): void => {
    const trimmed = text.trim()

    if (!trimmed) return

    onSend(trimmed)

    setJustSent(true)

    setText('')

    if (inputRef.current) inputRef.current.style.height = '34px'

    inputRef.current?.focus()
  }

  const handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()

      handleSend()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setText(e.target.value)

    e.target.style.height = '34px'

    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
  }

  const isProcessing =
    agentStatus === 'processing' ||
    agentStatus === 'executing' ||
    agentStatus === 'awaiting_input' ||
    agentStatus === 'awaiting_approval'

  const canSend = text.trim().length > 0 && !isProcessing

  return (
    <div className="cmd-input-bar">
      {isProcessing && (
        <div
          className="cmd-banner"
          style={{ marginBottom: 12, maxWidth: 680, margin: '0 auto 12px' }}
        >
          <span className="cmd-banner__text">Task running</span>

          <button
            type="button"
            className="cmd-banner__btn"
            onClick={() => {
              if (demoMode) useTorchStore.getState().setAgentStatus('idle')
              else sendStopCommand()
            }}
          >
            Stop
          </button>
        </div>
      )}

      <div
        className={`cmd-input-box ${text ? 'cmd-input-box--active' : ''} ${justSent ? 'cmd-input-box--sent' : ''}`}
        onAnimationEnd={() => setJustSent(false)}
      >
        <div className="cmd-input-row">
          <textarea
            ref={inputRef}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Tell TORCH what to do…"
            disabled={isProcessing}
            className="cmd-input-textarea"
            rows={1}
          />

          <div className="cmd-input-actions">
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              className={`cmd-input-send ${justSent ? 'cmd-input-send--sent' : ''}`}
              aria-label="Send command"
            >
              <CmdArrowUp size={14} />
            </button>
          </div>
        </div>

        <div className="cmd-input-meta">
          <label className="cmd-model-picker">
            <span className="sr-only">AI model</span>

            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={isProcessing}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          <span>{demoMode ? 'Demo mode' : wsConnected ? 'Ready' : 'Reconnecting'}</span>

          <span>Enter to send</span>
        </div>
      </div>
    </div>
  )
}
