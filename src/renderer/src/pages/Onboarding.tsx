import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ObArrowRight as ArrowRight,
  ObFile as FileIcon,
  ObMail as MailIcon,
  ObMonitor as AppIcon,
  ObPointer
} from '../components/icons/cleanIcons'
import { TorchLogo } from '../components/ui/TorchLogo'
import { useTorchStore } from '../store/torchStore'
import { API_BASE, torchFetch } from '../config/api'
import { useWebSocket } from '../hooks/useWebSocket'
import { permissionsFromSettings } from '../utils/permissions'

const ONBOARDING_STEPS = ['welcome', 'name', 'permissions', 'first_task', 'done'] as const
type OnboardingStep = (typeof ONBOARDING_STEPS)[number]

const LOCAL_FIRST_TASK = 'List the files and folders in my home folder'
const RESTRICTED_FIRST_TASK = 'What can you do?'

const STEP_TRANSITION = { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const }

const stepVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 32 : -32, filter: 'blur(4px)' }),
  center: { opacity: 1, x: 0, filter: 'blur(0px)' },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -32 : 32, filter: 'blur(4px)' })
}

const WELCOME_FEATURES = [
  {
    title: 'Plain-language commands',
    desc: 'Describe what you need. TORCH breaks it into steps and executes on your desktop.'
  },
  {
    title: 'Local-first',
    desc: 'Files and activity stay on your machine. You choose what TORCH can access.'
  },
  {
    title: 'You stay in control',
    desc: 'Sensitive actions pause for approval. Stop or adjust any task mid-run.'
  }
] as const

const PERMISSION_ITEMS = [
  {
    id: 'files' as const,
    icon: FileIcon,
    label: 'Files & folders',
    desc: 'Search and read documents so TORCH can find, summarize, or organize them.'
  },
  {
    id: 'apps' as const,
    icon: AppIcon,
    label: 'Applications',
    desc: 'Open and control apps to complete multi-step workflows on your PC.'
  },
  {
    id: 'email' as const,
    icon: MailIcon,
    label: 'Email',
    desc: 'Optional. Draft and send mail when you need it — enable later in Settings.'
  }
] as const

function ProgressDots({ step, total }: { step: number; total: number }): JSX.Element {
  return (
    <div className="ob-progress">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`progress-dot ${i + 1 === step ? 'active' : ''} ${i + 1 < step ? 'completed' : ''}`}
        />
      ))}
    </div>
  )
}

function StepPanel({
  children,
  stepKey,
  direction
}: {
  children: React.ReactNode
  stepKey: string
  direction: number
}): JSX.Element {
  return (
    <motion.div
      key={stepKey}
      custom={direction}
      variants={stepVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={STEP_TRANSITION}
      className="flex flex-col items-center w-full"
    >
      {children}
    </motion.div>
  )
}

/**
 * The final screen shows the first task's result as proof it really ran, not
 * as output to read - a listing of a home folder is hundreds of lines, and
 * printing it whole pushes the title and the finish button off the screen.
 */
const RESULT_PREVIEW_LINES = 6

function previewResult(result: string): { text: string; hidden: number } {
  const lines = result.trimEnd().split('\n')
  if (lines.length <= RESULT_PREVIEW_LINES) return { text: lines.join('\n'), hidden: 0 }
  return {
    text: lines.slice(0, RESULT_PREVIEW_LINES).join('\n'),
    hidden: lines.length - RESULT_PREVIEW_LINES
  }
}

function FirstTaskResult({ result }: { result: string }): JSX.Element {
  const { text, hidden } = previewResult(result)
  return (
    <div className="ob-command-block ob-result text-left">
      <p className="ob-name-field__label mb-2">Result</p>
      <p className="ob-row-desc ob-result__body">{text}</p>
      {hidden > 0 && <p className="ob-result__more">and {hidden} more lines</p>}
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }): JSX.Element {
  return (
    <button type="button" onClick={onChange} aria-pressed={checked} className="toggle-track">
      <div className="toggle-knob" />
    </button>
  )
}

export function Onboarding(): JSX.Element {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome')
  const [direction, setDirection] = useState(1)
  const [userName, setUserName] = useState(() => localStorage.getItem('torch_user_name') || '')
  const [nameError, setNameError] = useState<string | null>(null)

  /*
   * Seeded from the backend on mount rather than from constants.
   *
   * These start as whatever is already configured, because the permissions
   * screen writes all three on Continue: hardcoded defaults meant that
   * walking through onboarding silently switched off a capability the user
   * had already turned on. The literals below are only what shows for the
   * fraction of a second before the real values land, and they match the
   * backend's own defaults so a fresh install sees no flicker.
   */
  const [allowFiles, setAllowFiles] = useState(true)
  const [allowApps, setAllowApps] = useState(true)
  const [allowEmail, setAllowEmail] = useState(true)
  const [permissionsLoaded, setPermissionsLoaded] = useState(false)
  const [permissionSaving, setPermissionSaving] = useState(false)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [firstTaskRequestId, setFirstTaskRequestId] = useState<string | null>(null)
  const [firstTaskRunning, setFirstTaskRunning] = useState(false)
  const [firstTaskError, setFirstTaskError] = useState<string | null>(null)
  const [firstTaskResult, setFirstTaskResult] = useState('')

  const setOnboardingComplete = useTorchStore((s) => s.setOnboardingComplete)
  const setShowSettingsKeyBanner = useTorchStore((s) => s.setShowSettingsKeyBanner)
  const wsConnected = useTorchStore((s) => s.wsConnected)
  const lastTaskOutcome = useTorchStore((s) => s.lastTaskOutcome)
  const setLastTaskOutcome = useTorchStore((s) => s.setLastTaskOutcome)
  const { sendCommand } = useWebSocket()

  const firstTaskCommand = allowFiles ? LOCAL_FIRST_TASK : RESTRICTED_FIRST_TASK

  // Screens 4 and 5 greet the user by the name they gave on screen 2.
  const firstName = userName.trim().split(/\s+/)[0] || ''

  const permissionState = {
    files: { value: allowFiles, set: setAllowFiles },
    apps: { value: allowApps, set: setAllowApps },
    email: { value: allowEmail, set: setAllowEmail }
  }

  const validateName = (val: string, requireValue = false): boolean => {
    const trimmed = val.trim()
    if (!trimmed) {
      if (requireValue) setNameError('Enter a name to continue.')
      else setNameError(null)
      return false
    }
    if (trimmed.length > 50) {
      setNameError('Keep it under 50 characters.')
      return false
    }
    if (/<[^>]*>|[{}()[\]]/.test(trimmed)) {
      setNameError('Remove symbols and special characters.')
      return false
    }
    if (!/^[a-zA-Z0-9\s'-]+$/.test(trimmed)) {
      setNameError('Use letters, numbers, spaces, or hyphens only.')
      return false
    }
    setNameError(null)
    return true
  }

  const goTo = (step: OnboardingStep, dir: number): void => {
    setDirection(dir)
    setCurrentStep(step)
  }

  const handleNext = async (): Promise<void> => {
    if (currentStep === 'welcome') goTo('name', 1)
    else if (currentStep === 'name') {
      if (validateName(userName, true)) {
        localStorage.setItem('torch_user_name', userName.trim())
        goTo('permissions', 1)
      }
    } else if (currentStep === 'permissions') {
      setPermissionSaving(true)
      setPermissionError(null)
      const saved = await savePermissions()
      setPermissionSaving(false)
      if (saved) goTo('first_task', 1)
    }
  }

  /**
   * Persist the capability choices. The planner reads these and refuses tools
   * whose capability is switched off, so the toggles decide real behaviour.
   */
  const savePermissions = async (): Promise<boolean> => {
    /* Never write values that were never read - that is exactly how an
       already-configured capability got switched off. */
    if (!permissionsLoaded) {
      setPermissionError("TORCH couldn't read your current settings yet. Try again in a moment.")
      return false
    }
    try {
      const response = await torchFetch(`${API_BASE}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allow_files: allowFiles,
          allow_apps: allowApps,
          allow_email: allowEmail
        })
      })
      if (!response.ok) throw new Error('Settings were not accepted')
      return true
    } catch {
      setPermissionError(
        "TORCH couldn't save those permissions. Check the connection and try again."
      )
      return false
    }
  }

  /*
   * Seed the toggles from what is actually configured.
   *
   * Onboarding writes all three capabilities when the user presses Continue,
   * so starting from constants meant re-running it quietly turned settings
   * off. Reading first makes the screen show the current state and makes
   * Continue a no-op unless the user actually changed something.
   */
  useEffect(() => {
    let cancelled = false
    torchFetch(`${API_BASE}/api/settings`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const seeded = permissionsFromSettings(data, {
          files: allowFiles,
          apps: allowApps,
          email: allowEmail
        })
        setAllowFiles(seeded.files)
        setAllowApps(seeded.apps)
        setAllowEmail(seeded.email)
        setPermissionsLoaded(true)
      })
      .catch(() => {
        // The permissions screen blocks on this rather than saving values it
        // never read - writing guesses is how the setting got clobbered.
        if (!cancelled) setPermissionsLoaded(false)
      })
    return (): void => {
      cancelled = true
    }
  }, [])

  const handleBack = (): void => {
    if (currentStep === 'name') {
      goTo('welcome', -1)
    } else if (currentStep === 'permissions') goTo('name', -1)
    else if (currentStep === 'first_task') goTo('permissions', -1)
  }

  const runFirstTask = async (): Promise<void> => {
    if (!wsConnected || firstTaskRunning) {
      setFirstTaskError('TORCH is still connecting. Wait a moment, then try again.')
      return
    }

    setFirstTaskRunning(true)
    setFirstTaskError(null)
    setFirstTaskResult('')
    setLastTaskOutcome(null)

    try {
      const response = await torchFetch(`${API_BASE}/api/settings`)
      if (!response.ok) throw new Error('Settings unavailable')
      const data = await response.json()
      setShowSettingsKeyBanner(
        !(
          data.gemini_configured ||
          data.openai_configured ||
          data.anthropic_configured ||
          data.deepseek_configured
        )
      )
    } catch {
      setShowSettingsKeyBanner(true)
    }

    const requestId = crypto.randomUUID()
    setFirstTaskRequestId(requestId)
    sendCommand(firstTaskCommand, requestId)
  }

  useEffect(() => {
    if (!firstTaskRequestId || lastTaskOutcome?.requestId !== firstTaskRequestId) return

    setFirstTaskRunning(false)
    setLastTaskOutcome(null)
    if (lastTaskOutcome.status === 'completed') {
      setFirstTaskResult(lastTaskOutcome.summary)
      goTo('done', 1)
    } else {
      setFirstTaskError(lastTaskOutcome.summary || 'That task did not finish. Try again.')
    }
  }, [firstTaskRequestId, lastTaskOutcome, setLastTaskOutcome])

  const stepIndex = ONBOARDING_STEPS.indexOf(currentStep) + 1

  return (
    <div className="onboarding-page select-none">
      <div className="ob-shell flex flex-col items-center text-center">
        <ProgressDots step={stepIndex} total={ONBOARDING_STEPS.length} />

        <AnimatePresence mode="wait" custom={direction}>
          {currentStep === 'welcome' && (
            <StepPanel stepKey="welcome" direction={direction}>
              <div className="ob-stagger">
                <div className="ob-mark-breathe">
                  <TorchLogo size={64} />
                </div>
                <h2 className="ob-title">Meet TORCH</h2>
                <p className="ob-lead">
                  TORCH does things on your computer so you don&rsquo;t have to. Just tell it what
                  you need, in plain words.
                </p>

                <div className="ob-features">
                  {WELCOME_FEATURES.map((item, i) => (
                    <div key={item.title} className="ob-feature">
                      <span className="ob-feature-num">{String(i + 1).padStart(2, '0')}</span>
                      <div className="ob-feature-body">
                        <div className="ob-feature-title">{item.title}</div>
                        <div className="ob-feature-desc">{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <button type="button" onClick={() => void handleNext()} className="ob-btn-primary">
                  Get started
                  <ArrowRight size={14} />
                </button>

                <p className="ob-footnote">No coding. No setup steps.</p>
              </div>
            </StepPanel>
          )}

          {currentStep === 'name' && (
            <StepPanel stepKey="name" direction={direction}>
              <h2 className="ob-title">What should TORCH call you?</h2>
              <p className="ob-lead">So it can talk to you like a person.</p>

              <div className="ob-name-wrap">
                <div className="ob-name-field">
                  <label className="ob-name-field__label" htmlFor="ob-name-input">
                    Your name
                  </label>
                  <input
                    id="ob-name-input"
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="e.g. Alex"
                    autoFocus
                    className="ob-name-field__input"
                  />
                  <div className="ob-name-field__footer">
                    <span className="ob-name-field__error">{nameError || '\u00A0'}</span>
                    <span className="ob-name-field__hint">Max 50 chars</span>
                  </div>
                </div>
              </div>

              <div className="ob-actions">
                <button type="button" onClick={handleBack} className="ob-btn-ghost">
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => void handleNext()}
                  disabled={!!nameError || !userName.trim()}
                  className="ob-btn-primary"
                >
                  Continue
                  <ArrowRight size={13} />
                </button>
              </div>
            </StepPanel>
          )}

          {currentStep === 'permissions' && (
            <StepPanel stepKey="permissions" direction={direction}>
              <h2 className="ob-title">Here&rsquo;s what TORCH needs</h2>
              <p className="ob-lead">You can change any of this later in Settings.</p>

              <div className="ob-card">
                {PERMISSION_ITEMS.map(({ id, icon: Icon, label, desc }) => {
                  const { value, set } = permissionState[id]
                  return (
                    <div key={id} className="ob-row items-start">
                      <div className="ob-row-main">
                        <div className="ob-row-label">
                          <Icon size={15} className="ob-row-icon" />
                          {label}
                        </div>
                        <p className="ob-row-desc">{desc}</p>
                      </div>
                      <Toggle checked={value} onChange={() => set(!value)} />
                    </div>
                  )
                })}
              </div>

              <div className="ob-actions">
                <button type="button" onClick={handleBack} className="ob-btn-ghost">
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => void handleNext()}
                  disabled={permissionSaving}
                  className="ob-btn-primary"
                >
                  {permissionSaving ? 'Saving…' : 'Continue'}
                  <ArrowRight size={13} />
                </button>
              </div>
              {permissionError && <p className="ob-name-field__error mt-3">{permissionError}</p>}
            </StepPanel>
          )}

          {currentStep === 'first_task' && (
            <StepPanel stepKey="first_task" direction={direction}>
              <h2 className="ob-title">Try it out{firstName ? `, ${firstName}` : ''}.</h2>
              <p className="ob-lead">
                Tap run and watch TORCH work. This only reads — nothing on your computer changes.
              </p>

              <div className="ob-command-block">
                <textarea
                  readOnly
                  tabIndex={-1}
                  value={firstTaskCommand}
                  className="ob-command-input"
                  rows={2}
                  aria-label="Sample command"
                />
              </div>

              <div className="ob-pointer-row">
                <ObPointer size={22} className="ob-pointer-icon" />
                <span className="ob-pointer-hint">
                  {firstTaskRunning
                    ? 'Running your task…'
                    : wsConnected
                      ? 'Ready to run'
                      : 'Connecting to TORCH…'}
                </span>
              </div>

              {firstTaskError && <p className="ob-name-field__error mb-3">{firstTaskError}</p>}

              <button
                type="button"
                onClick={() => void runFirstTask()}
                disabled={!wsConnected || firstTaskRunning}
                className="ob-btn-primary ob-btn-run"
              >
                {firstTaskRunning ? 'Running…' : firstTaskError ? 'Try again' : 'Run task'}
                <ArrowRight size={14} />
              </button>
            </StepPanel>
          )}

          {currentStep === 'done' && (
            <StepPanel stepKey="done" direction={direction}>
              <div className="ob-mark-breathe">
                <TorchLogo size={64} />
              </div>
              <h2 className="ob-title">You&rsquo;re set{firstName ? `, ${firstName}` : ''}.</h2>
              <p className="ob-lead">
                Just say what you need. TORCH asks before anything important, and you can always
                undo.
              </p>

              {firstTaskResult && <FirstTaskResult result={firstTaskResult} />}

              <button
                type="button"
                onClick={() => setOnboardingComplete(true)}
                className="ob-btn-primary ob-btn-run"
              >
                Start using TORCH
                <ArrowRight size={14} />
              </button>
            </StepPanel>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
