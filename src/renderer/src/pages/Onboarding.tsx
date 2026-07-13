import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ObArrowRight as ArrowRight,
  ObFile as FileIcon,
  ObMail as MailIcon,
  ObMonitor as AppIcon,
  ObPointer
} from '../components/icons/cleanIcons'
import { TorchWordmark } from '../components/ui/TorchWordmark'
import { useTorchStore } from '../store/torchStore'
import { API_BASE } from '../config/api'

const ONBOARDING_STEPS = ['welcome', 'name', 'permissions', 'first_task'] as const
type OnboardingStep = (typeof ONBOARDING_STEPS)[number]

const FIRST_TASK_COMMAND = 'Find and summarize my latest report'

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
  const [nameSubmitted, setNameSubmitted] = useState(false)

  const [allowFiles, setAllowFiles] = useState(true)
  const [allowApps, setAllowApps] = useState(true)
  const [allowEmail, setAllowEmail] = useState(false)

  const setOnboardingComplete = useTorchStore((s) => s.setOnboardingComplete)
  const setShowSettingsKeyBanner = useTorchStore((s) => s.setShowSettingsKeyBanner)
  const setPendingLaunchCommand = useTorchStore((s) => s.setPendingLaunchCommand)
  const setDemoMode = useTorchStore((s) => s.setDemoMode)

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
    if (!/^[a-zA-Z0-9\s'\-]+$/.test(trimmed)) {
      setNameError('Use letters, numbers, spaces, or hyphens only.')
      return false
    }
    setNameError(null)
    return true
  }

  useEffect(() => {
    if (currentStep === 'name') validateName(userName, nameSubmitted)
  }, [userName, currentStep, nameSubmitted])

  const goTo = (step: OnboardingStep, dir: number): void => {
    setDirection(dir)
    setCurrentStep(step)
  }

  const handleNext = (): void => {
    if (currentStep === 'welcome') goTo('name', 1)
    else if (currentStep === 'name') {
      setNameSubmitted(true)
      if (validateName(userName, true)) {
        localStorage.setItem('torch_user_name', userName.trim())
        goTo('permissions', 1)
      }
    } else if (currentStep === 'permissions') goTo('first_task', 1)
  }

  const handleBack = (): void => {
    if (currentStep === 'name') {
      setNameSubmitted(false)
      goTo('welcome', -1)
    } else if (currentStep === 'permissions') goTo('name', -1)
    else if (currentStep === 'first_task') goTo('permissions', -1)
  }

  const finishAndLaunch = async (): Promise<void> => {
    try {
      await fetch(`${API_BASE}/api/settings`)
      setShowSettingsKeyBanner(false)
    } catch {
      setShowSettingsKeyBanner(true)
      setDemoMode(true)
    }
    setPendingLaunchCommand(FIRST_TASK_COMMAND)
    setOnboardingComplete(true)
  }

  const stepIndex = ONBOARDING_STEPS.indexOf(currentStep) + 1

  return (
    <div className="onboarding-page select-none">
      <div className="ob-shell flex flex-col items-center text-center">
        <ProgressDots step={stepIndex} total={ONBOARDING_STEPS.length} />

        <AnimatePresence mode="wait" custom={direction}>
          {currentStep === 'welcome' && (
            <StepPanel stepKey="welcome" direction={direction}>
              <TorchWordmark size="lg" />
              <p className="ob-acronym">Thinking · Observing · Reasoning · Creating · Handling</p>
              <p className="ob-lead">
                A desktop AI agent that automates everyday work — files, apps, and email — from one
                command line.
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

              <button type="button" onClick={handleNext} className="ob-btn-primary">
                Get Started
                <ArrowRight size={14} />
              </button>
            </StepPanel>
          )}

          {currentStep === 'name' && (
            <StepPanel stepKey="name" direction={direction}>
              <TorchWordmark size="sm" />
              <h2 className="ob-title">What should we call you?</h2>
              <p className="ob-lead">
                Used in replies and status updates. Stored locally on this device only.
              </p>

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
                  onClick={handleNext}
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
              <h2 className="ob-title">Set your permissions</h2>
              <p className="ob-lead">
                Control what TORCH can access. Change any of these later in Settings.
              </p>

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
                <button type="button" onClick={handleNext} className="ob-btn-primary">
                  Continue
                  <ArrowRight size={13} />
                </button>
              </div>
            </StepPanel>
          )}

          {currentStep === 'first_task' && (
            <StepPanel stepKey="first_task" direction={direction}>
              <h2 className="ob-title">Run your first task</h2>
              <p className="ob-lead">
                We&apos;ve filled in a sample command. Press Run — it will open Command Center and
                execute there, just like a real task.
              </p>

              <div className="ob-command-block">
                <textarea
                  readOnly
                  tabIndex={-1}
                  value={FIRST_TASK_COMMAND}
                  className="ob-command-input"
                  rows={2}
                  aria-label="Sample command"
                />
              </div>

              <div className="ob-pointer-row">
                <ObPointer size={22} className="ob-pointer-icon" />
                <span className="ob-pointer-hint">Press Run to continue</span>
              </div>

              <button
                type="button"
                onClick={() => void finishAndLaunch()}
                className="ob-btn-primary ob-btn-run"
              >
                Run in Command Center
                <ArrowRight size={14} />
              </button>
            </StepPanel>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
