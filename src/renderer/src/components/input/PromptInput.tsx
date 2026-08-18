import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import styles from './PromptInput.module.css'
import { useTorchStore } from '../../store/torchStore'
import { useWebSocket } from '../../hooks/useWebSocket'
import { API_BASE } from '../../config/api'

interface PromptInputProps {
  onSend: (command: string) => void
  onEnhance?: (prompt: string, signal?: AbortSignal) => Promise<string>
}

const FALLBACK_MODELS = [
  { id: 'auto', label: 'Auto' },
  { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
  { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' }
]

const ENHANCED =
  'Be clear and specific: state the goal, add the relevant context and constraints, define the expected output format and tone, and note any assumptions. Ask a clarifying question first if key details are missing.'

async function mockEnhance(prompt: string, signal?: AbortSignal): Promise<string> {
  void prompt
  await new Promise((r) => setTimeout(r, 2200))
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  return ENHANCED
}

type Phase = 'idle' | 'enhancing' | 'enhanced'

const ArrowUpIcon = ({ size = 14 }: { size?: number }): JSX.Element => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5 12 7-7 7 7" />
    <path d="M12 19V5" />
  </svg>
)

const LoaderIcon = (): JSX.Element => (
  <svg className={styles.spinner} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
)

const CheckIcon = (): JSX.Element => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

const SparklesIcon = (): JSX.Element => (
  <svg className={styles.menuIcon} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    <path d="M20 3v4" />
    <path d="M22 5h-4" />
  </svg>
)

function modelBrand(id: string): { bg: string; glyph: JSX.Element } | null {
  if (id.startsWith('claude')) {
    return { bg: '#d97757', glyph: <span>Cl</span> }
  }
  if (id.startsWith('gemini')) {
    return { bg: 'linear-gradient(135deg,#4285f4,#9b72cb,#d96570)', glyph: <span>Ge</span> }
  }
  if (id.startsWith('deepseek')) {
    return { bg: '#4d6bfe', glyph: <span>Ds</span> }
  }
  return null
}

export function PromptInput({ onSend, onEnhance = mockEnhance }: PromptInputProps): JSX.Element {
  const [text, setText] = useState('')
  const [justSent, setJustSent] = useState(false)
  const [models, setModels] = useState(FALLBACK_MODELS)
  const [phase, setPhase] = useState<Phase>('idle')
  const [menuOpen, setMenuOpen] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

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

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const isProcessing =
    agentStatus === 'processing' ||
    agentStatus === 'executing' ||
    agentStatus === 'awaiting_input' ||
    agentStatus === 'awaiting_approval'

  const hasText = text.trim().length > 0
  const enhancing = phase === 'enhancing'
  const sendActive = hasText && !isProcessing && !enhancing

  const handleSend = (): void => {
    const trimmed = text.trim()
    if (!trimmed || enhancing) return
    onSend(trimmed)
    setJustSent(true)
    setText('')
    setPhase('idle')
    if (inputRef.current) inputRef.current.style.height = '18px'
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
    e.target.style.height = '18px'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`
  }

  const handleEnhance = async (): Promise<void> => {
    if (!hasText || enhancing) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setPhase('enhancing')
    try {
      const improved = await onEnhance(text, controller.signal)
      setText(improved)
      setPhase('enhanced')
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') setPhase('idle')
    }
  }

  const pillLabel = enhancing ? (
    <LoaderIcon />
  ) : phase === 'enhanced' ? (
    <CheckIcon />
  ) : (
    <SparklesIcon />
  )

  const pillText = enhancing
    ? 'Enhancing…'
    : phase === 'enhanced'
      ? 'Enhanced'
      : 'Enhance prompt'

  return (
    <div className={styles.wrap}>
      {isProcessing && (
        <div className={styles.banner}>
          <span className={styles.bannerText}>Task running</span>
          <button
            type="button"
            className={styles.bannerBtn}
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
        className={styles.frame + (justSent ? ' ' + styles.justSent : '')}
        data-enhancing={enhancing ? '' : undefined}
        onAnimationEnd={() => setJustSent(false)}
      >
        <div className={styles.editorWrap}>
          <textarea
            ref={inputRef}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Tell TORCH what to do…"
            disabled={isProcessing}
            className={styles.field + (enhancing ? ' ' + styles.enhancing : '')}
            rows={1}
            aria-label="Command"
          />
        </div>

        <div className={styles.row}>
          <div className={styles.left}>
            <div className={styles.plusWrap}>
              <button
                type="button"
                className={styles.iconBtn + ' ' + styles.modelBtn}
                onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-label="Choose model"
              >
                {modelBrand(selectedModel) ? (
                  <span className={styles.modelBadge} style={{ background: modelBrand(selectedModel)?.bg }}>
                    {modelBrand(selectedModel)?.glyph}
                  </span>
                ) : (
                  <span className={styles.modelBadgeAuto}>A</span>
                )}
              </button>

              {menuOpen && (
                <div className={styles.menu} role="menu">
                  {models.map((m) => {
                    const active = m.id === selectedModel
                    return (
                      <button
                        key={m.id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={active}
                        className={styles.menuItem + (active ? ' ' + styles.menuItemActive : '')}
                        onClick={() => {
                          setSelectedModel(m.id)
                          setMenuOpen(false)
                        }}
                      >
                        {modelBrand(m.id) ? (
                          <span className={styles.menuBrand} style={{ background: modelBrand(m.id)?.bg }}>
                            {modelBrand(m.id)?.glyph}
                          </span>
                        ) : (
                          <span className={styles.menuBrandAuto}>{m.label.charAt(0)}</span>
                        )}
                        <span className={styles.menuName}>{m.label}</span>
                        {active && <CheckIcon />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className={styles.right}>
            {hasText && !enhancing && (
              <button type="button" className={styles.pill} onClick={() => void handleEnhance()}>
                {pillLabel}
                <span>{pillText}</span>
              </button>
            )}
            {hasText && enhancing && (
              <span className={styles.pill + ' ' + styles.pillBusy}>
                {pillLabel}
                <span>{pillText}</span>
              </span>
            )}
            <button
              type="button"
              onClick={handleSend}
              disabled={!sendActive}
              className={styles.iconBtn + ' ' + styles.send + (sendActive ? ' ' + styles.sendActive : '')}
              aria-label="Send command"
            >
              {enhancing ? <LoaderIcon /> : <ArrowUpIcon size={14} />}
            </button>
          </div>
        </div>

        <div className={styles.meta}>
          <span className={styles.metaItem}>
            {demoMode ? 'Demo mode' : wsConnected ? 'Ready' : 'Reconnecting'}
          </span>
          <span className={styles.metaItem}>
            {selectedModel === 'auto' ? 'Auto model' : selectedModel}
          </span>
          <span className={styles.metaItem}>Enter to send</span>
        </div>
      </div>
    </div>
  )
}