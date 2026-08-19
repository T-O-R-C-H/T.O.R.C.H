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
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
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

const OPENAI_PATH =
  'M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z'

const ANTHROPIC_PATH =
  'M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z'

const DEEPSEEK_PATH =
  'M23.748 4.651c-.254-.124-.364.113-.512.233-.051.04-.094.09-.137.137-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.155-.708-.311-.955-.65-.172-.24-.219-.509-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.094.172.187.129.323-.082.28-.18.553-.266.833-.055.179-.137.218-.328.14a5.5 5.5 0 0 1-1.737-1.179c-.857-.828-1.631-1.743-2.597-2.46a12 12 0 0 0-.689-.47c-.985-.957.13-1.743.387-1.836.27-.098.094-.433-.778-.428-.872.003-1.67.295-2.687.685a3 3 0 0 1-.465.136 9.6 9.6 0 0 0-2.883-.101c-1.885.21-3.39 1.1-4.497 2.622C.082 8.776-.231 10.854.152 13.02c.403 2.284 1.568 4.175 3.36 5.653 1.857 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.132-.284 4.994-1.86.47.234.962.328 1.78.398.629.058 1.235-.031 1.705-.129.735-.155.684-.836.418-.961-2.155-1.004-1.682-.595-2.112-.926 1.095-1.295 2.768-3.598 3.284-6.733.05-.346.115-.834.108-1.114-.004-.171.035-.238.23-.257a4.2 4.2 0 0 0 1.545-.475c1.397-.763 1.96-2.016 2.093-3.517.02-.23-.004-.467-.247-.588M11.58 18.168c-2.088-1.642-3.101-2.183-3.52-2.16-.39.024-.32.472-.234.763.09.288.207.487.371.74.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.168-1.361-.801-2.5-1.86-3.301-3.306-.775-1.393-1.225-2.888-1.299-4.482-.02-.385.094-.522.477-.592a4.7 4.7 0 0 1 1.53-.038c2.131.311 3.946 1.264 5.467 2.774.868.86 1.525 1.887 2.202 2.89.72 1.066 1.494 2.082 2.48 2.915.348.291.626.513.892.677-.802.09-2.14.109-3.055-.615zm1.001-6.44a.306.306 0 0 1 .415-.287.3.3 0 0 1 .113.074.3.3 0 0 1 .086.214c0 .17-.136.307-.308.307a.303.303 0 0 1-.306-.307m3.11 1.596c-.2.081-.4.151-.591.16a1.25 1.25 0 0 1-.798-.254c-.274-.23-.47-.358-.551-.758a1.7 1.7 0 0 1 .015-.588c.07-.327-.007-.537-.238-.727-.188-.156-.426-.199-.689-.199a.6.6 0 0 1-.254-.078.253.253 0 0 1-.114-.358 1 1 0 0 1 .192-.21c.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.392.451.462.576.685.915.176.264.336.536.446.848.066.194-.02.353-.25.45'

function ModelLogo({ id, size = 14 }: { id: string; size?: number }): JSX.Element | null {
  if (id.startsWith('claude')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#d97757" aria-hidden="true">
        <path d={ANTHROPIC_PATH} />
      </svg>
    )
  }
  if (id.startsWith('gemini')) {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M16 8.016A8.522 8.522 0 0 0 8.016 16h-.032A8.521 8.521 0 0 0 0 8.016v-.032A8.521 8.521 0 0 0 7.984 0h.032A8.522 8.522 0 0 0 16 7.984v.032z"
          fill="url(#pi-gemini-grad)"
        />
        <defs>
          <radialGradient
            id="pi-gemini-grad"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="matrix(16.1326 5.4553 -43.70045 129.2322 1.588 6.503)"
          >
            <stop offset=".067" stopColor="#9168C0" />
            <stop offset=".343" stopColor="#5684D1" />
            <stop offset=".672" stopColor="#1BA1E3" />
          </radialGradient>
        </defs>
      </svg>
    )
  }
  if (id.startsWith('deepseek')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#4d6bfe" aria-hidden="true">
        <path d={DEEPSEEK_PATH} />
      </svg>
    )
  }
  if (id.startsWith('gpt') || id.startsWith('openai')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#10a37f" aria-hidden="true">
        <path d={OPENAI_PATH} />
      </svg>
    )
  }
  return null
}

const ArrowUpIcon = ({ size = 14 }: { size?: number }): JSX.Element => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m5 12 7-7 7 7" />
    <path d="M12 19V5" />
  </svg>
)

const LoaderIcon = (): JSX.Element => (
  <svg
    className={styles.spinner}
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
)

const CheckIcon = ({ size = 13 }: { size?: number }): JSX.Element => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

const SparklesIcon = (): JSX.Element => (
  <svg
    className={styles.menuIcon}
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    <path d="M20 3v4" />
    <path d="M22 5h-4" />
  </svg>
)

function ModelGlyph({ id, size = 14 }: { id: string; size?: number }): JSX.Element {
  const logo = ModelLogo({ id, size })
  if (logo) return logo
  return <SparklesIcon />
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

  const pillText = enhancing ? 'Enhancing…' : phase === 'enhanced' ? 'Enhanced' : 'Enhance prompt'

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
          <div className={styles.modelWrap}>
            <button
              type="button"
              className={styles.modelBtn}
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="Choose model"
              title="Choose model"
            >
              <ModelGlyph id={selectedModel} />
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
                      <span className={styles.menuBrand}>
                        <ModelGlyph id={m.id} />
                      </span>
                      <span className={styles.menuName}>{m.label}</span>
                      {active && <CheckIcon />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className={styles.row}>
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
              className={
                styles.iconBtn + ' ' + styles.send + (sendActive ? ' ' + styles.sendActive : '')
              }
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
