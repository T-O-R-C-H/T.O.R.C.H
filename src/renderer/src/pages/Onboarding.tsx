import { useState, useEffect } from 'react'
import { 
  IconArrowRight as ArrowRight, 
  IconCheck as Check, 
  IconLoader as Loader,
  IconFile as FileIcon,
  IconMail as MailIcon,
  IconMonitor as AppIcon
} from '../components/icons'
import { useTorchStore } from '../store/torchStore'
import { TorchOrb } from '../components/overlay/TorchOrb'

const ONBOARDING_STEPS = ['welcome', 'name', 'permissions', 'first_task', 'closing'] as const
type OnboardingStep = (typeof ONBOARDING_STEPS)[number]

export function Onboarding(): JSX.Element {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome')
  const [userName, setUserName] = useState(() => localStorage.getItem('torch_user_name') || '')
  const [nameError, setNameError] = useState<string | null>(null)
  
  // Permissions
  const [allowFiles, setAllowFiles] = useState(true)
  const [allowApps, setAllowApps] = useState(true)
  const [allowEmail, setAllowEmail] = useState(false)

  // First Task Simulation
  const [taskStarted, setTaskStarted] = useState(false)
  const [simulatedSteps, setSimulatedSteps] = useState<Array<{ label: string; status: 'pending' | 'active' | 'done' }>>([])
  const [taskRecap, setTaskRecap] = useState<string | null>(null)
  const [taskComplete, setTaskComplete] = useState(false)

  const setOnboardingComplete = useTorchStore((s) => s.setOnboardingComplete)
  const setShowSettingsKeyBanner = useTorchStore((s) => s.setShowSettingsKeyBanner)

  // Validate name in real-time
  const validateName = (val: string): boolean => {
    const trimmed = val.trim()
    if (!trimmed) {
      setNameError('Name cannot be empty.')
      return false
    }
    if (trimmed.length > 50) {
      setNameError('Name must be 50 characters or less.')
      return false
    }
    // Reject HTML/scripts or suspicious characters like brackets or scripts
    const scriptOrHtmlPattern = /<[^>]*>|[{}()[\]]/
    if (scriptOrHtmlPattern.test(trimmed)) {
      setNameError('Please enter a standard name without symbols or code.')
      return false
    }
    // Simple check: allow alphanumeric, spaces, hyphens, and apostrophes
    const validNamePattern = /^[a-zA-Z0-9\s'\-]+$/
    if (!validNamePattern.test(trimmed)) {
      setNameError('Please use only letters, numbers, spaces, hyphens, or apostrophes.')
      return false
    }

    setNameError(null)
    return true
  }

  // Effect to validate name when it changes
  useEffect(() => {
    if (currentStep === 'name') {
      validateName(userName)
    }
  }, [userName, currentStep])

  const handleNext = (): void => {
    if (currentStep === 'welcome') {
      setCurrentStep('name')
    } else if (currentStep === 'name') {
      if (validateName(userName)) {
        localStorage.setItem('torch_user_name', userName.trim())
        setCurrentStep('permissions')
      }
    } else if (currentStep === 'permissions') {
      setCurrentStep('first_task')
    } else if (currentStep === 'first_task') {
      setCurrentStep('closing')
    }
  }

  const handleBack = (): void => {
    if (currentStep === 'name') {
      setCurrentStep('welcome')
    } else if (currentStep === 'permissions') {
      setCurrentStep('name')
    } else if (currentStep === 'first_task') {
      setCurrentStep('permissions')
      // Reset task simulation
      setTaskStarted(false)
      setSimulatedSteps([])
      setTaskRecap(null)
      setTaskComplete(false)
    }
  }

  const startFirstTaskSimulation = (): void => {
    setTaskStarted(true)
    setSimulatedSteps([
      { label: 'Looking for report.pdf...', status: 'active' },
      { label: 'Summarizing document contents...', status: 'pending' }
    ])

    setTimeout(() => {
      setSimulatedSteps([
        { label: 'Found report.pdf in Documents.', status: 'done' },
        { label: 'Reading report.pdf...', status: 'active' }
      ])
    }, 1500)

    setTimeout(() => {
      setSimulatedSteps([
        { label: 'Found report.pdf in Documents.', status: 'done' },
        { label: 'Summarized document contents.', status: 'done' }
      ])
      setTaskRecap('Done! I found your document and summarized it.')
      setTaskComplete(true)
    }, 3200)
  }

  const handleFinish = async (): Promise<void> => {
    try {
      // Connect to local settings to see if it defaults correctly
      await fetch('http://localhost:8000/api/settings')
      setShowSettingsKeyBanner(false)
    } catch {
      setShowSettingsKeyBanner(true)
    }
    // Set onboarding complete
    setOnboardingComplete(true)
  }


  return (
    <div className="w-full h-full bg-[#000] flex flex-col items-center justify-center relative overflow-hidden select-none">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#0b0a16_0%,_#000000_70%)] pointer-events-none opacity-60" />

      {/* Main Container with smooth fade-in animation */}
      <div className="max-w-[480px] w-full px-8 flex flex-col items-center z-10 text-center animate-fade-in-up duration-300">
        
        {/* STEP 1: Welcome Screen */}
        {currentStep === 'welcome' && (
          <div className="page-enter flex flex-col items-center w-full">
            <TorchOrb isActive size={72} />
            <h1 className="text-[32px] font-semibold tracking-tight text-white mt-8 mb-4">Welcome to TORCH</h1>
            <p className="text-[14px] leading-relaxed text-[#94a3b8] mb-8 font-sans max-w-[380px]">
              TORCH is your personal AI assistant that automates tasks on your computer. 
              No coding, no setup steps — just describe what you need in plain English.
            </p>
            <button 
              onClick={handleNext}
              className="px-8 py-3.5 bg-white text-black font-medium text-[13.5px] rounded-full hover:bg-neutral-200 active:scale-95 transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-white/5"
            >
              Get Started
              <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* STEP 2: Name Capture */}
        {currentStep === 'name' && (
          <div className="page-enter flex flex-col items-center w-full">
            <TorchOrb isActive={false} size={48} />
            <h2 className="text-[24px] font-semibold text-white mt-6 mb-2">What should TORCH call you?</h2>
            <p className="text-[13px] text-[#64748b] mb-8">Let's personalize your experience.</p>
            
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Enter your preferred name"
              autoFocus
              className={`w-full text-[14px] px-5 py-3.5 bg-[#0a0a0d] border ${
                nameError ? 'border-red-500/40 focus:border-red-500' : 'border-[#1a1a24] focus:border-white'
              } text-white rounded-xl focus:outline-none transition-colors mb-2 text-center font-medium`}
            />

            <div className="min-h-[20px] mb-8">
              {nameError && (
                <p className="text-[11.5px] text-[#f87171] font-sans font-medium">{nameError}</p>
              )}
            </div>

            <div className="flex gap-4">
              <button 
                onClick={handleBack}
                className="px-6 py-3 bg-[#0d0d12] border border-[#1a1a24] text-[#94a3b8] text-[13px] rounded-full hover:text-white transition-colors cursor-pointer"
              >
                Back
              </button>
              <button 
                onClick={handleNext}
                disabled={!!nameError || !userName.trim()}
                className={`px-8 py-3 font-semibold text-[13px] rounded-full flex items-center gap-2 cursor-pointer transition-all ${
                  !!nameError || !userName.trim() 
                    ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed opacity-50' 
                    : 'bg-white text-black hover:bg-neutral-200 active:scale-95 shadow-md shadow-white/5'
                }`}
              >
                Continue
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Permissions */}
        {currentStep === 'permissions' && (
          <div className="page-enter flex flex-col items-center w-full">
            <div className="text-[10px] tracking-[0.2em] font-mono text-[#475569] mb-4">STEP 1 OF 3</div>
            <h2 className="text-[24px] font-semibold text-white mb-2">Enable Permissions</h2>
            <p className="text-[12.5px] text-[#64748b] mb-6">
              TORCH runs locally on your PC. Let's grant the permissions you need.
            </p>

            <div className="w-full bg-[#07070a]/60 border border-[#111119] rounded-2xl p-5 text-left mb-6 space-y-4">
              {/* File Permission */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#111119]">
                <div>
                  <div className="flex items-center gap-2">
                    <FileIcon size={14} className="text-[#38bdf8]" />
                    <span className="text-[13px] font-medium text-white">Search &amp; Read Files</span>
                  </div>
                  <span className="text-[11px] text-[#475569] block mt-1">
                    Required to locate and read spreadsheets, documents, or reports for tasks.
                  </span>
                </div>
                <button
                  onClick={() => setAllowFiles(!allowFiles)}
                  className={`w-10 h-5 border flex items-center px-0.5 rounded-full transition-colors shrink-0 ${
                    allowFiles ? 'bg-white border-white' : 'bg-transparent border-[#27273a]'
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded-full transition-transform ${
                    allowFiles ? 'bg-black translate-x-[20px]' : 'bg-[#475569] translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Apps Permission */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#111119]">
                <div>
                  <div className="flex items-center gap-2">
                    <AppIcon size={14} className="text-[#a78bfa]" />
                    <span className="text-[13px] font-medium text-white">Open Applications</span>
                  </div>
                  <span className="text-[11px] text-[#475569] block mt-1">
                    Required to open programs like your browser, folders, or terminal.
                  </span>
                </div>
                <button
                  onClick={() => setAllowApps(!allowApps)}
                  className={`w-10 h-5 border flex items-center px-0.5 rounded-full transition-colors shrink-0 ${
                    allowApps ? 'bg-white border-white' : 'bg-transparent border-[#27273a]'
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded-full transition-transform ${
                    allowApps ? 'bg-black translate-x-[20px]' : 'bg-[#475569] translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Email Connection */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <MailIcon size={14} className="text-[#fb7185]" />
                    <span className="text-[13px] font-medium text-white">Email Connection (Optional)</span>
                  </div>
                  <span className="text-[11px] text-[#475569] block mt-1">
                    Required only if you want TORCH to compose or search your emails.
                  </span>
                </div>
                <button
                  onClick={() => setAllowEmail(!allowEmail)}
                  className={`w-10 h-5 border flex items-center px-0.5 rounded-full transition-colors shrink-0 ${
                    allowEmail ? 'bg-white border-white' : 'bg-transparent border-[#27273a]'
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded-full transition-transform ${
                    allowEmail ? 'bg-black translate-x-[20px]' : 'bg-[#475569] translate-x-0'
                  }`} />
                </button>
              </div>
            </div>

            <div className="flex gap-4 items-center">
              <button 
                onClick={handleBack}
                className="px-6 py-3 bg-[#0d0d12] border border-[#1a1a24] text-[#94a3b8] text-[13px] rounded-full hover:text-white transition-colors cursor-pointer"
              >
                Back
              </button>
              <button 
                onClick={handleNext}
                className="px-8 py-3 bg-white text-black font-semibold text-[13px] rounded-full hover:bg-neutral-200 active:scale-95 transition-all shadow-md shadow-white/5 cursor-pointer"
              >
                Continue
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: First Task Simulator */}
        {currentStep === 'first_task' && (
          <div className="page-enter flex flex-col items-center w-full">
            <div className="text-[10px] tracking-[0.2em] font-mono text-[#475569] mb-4">STEP 2 OF 3</div>
            <h2 className="text-[24px] font-semibold text-white mb-2">Try your first task</h2>
            <p className="text-[12.5px] text-[#64748b] mb-6">
              Let's see TORCH in action. Tap the card below to run a test search.
            </p>

            {!taskStarted ? (
              <button
                onClick={startFirstTaskSimulation}
                className="w-full flex items-center gap-4 bg-[#0a0a0d] border border-[#1a1a24] hover:border-white/20 p-5 rounded-2xl cursor-pointer text-left transition-all active:scale-[0.99] group shadow-lg"
              >
                <div className="p-3 bg-[#38bdf8]/10 text-[#38bdf8] rounded-xl group-hover:scale-105 transition-transform">
                  <FileIcon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-medium text-white">Find my latest report</div>
                  <div className="text-[11px] text-[#475569] mt-0.5 font-mono tracking-wider uppercase">SIMULATE SEARCH</div>
                </div>
                <ArrowRight size={16} className="text-[#475569] group-hover:translate-x-1 transition-transform" />
              </button>
            ) : (
              <div className="w-full bg-[#07070a]/80 border border-[#111119] rounded-2xl p-5 text-left mb-6 font-mono text-[12px] space-y-3.5 shadow-xl">
                {simulatedSteps.map((step, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3 animate-fade-in">
                    <div className="flex items-center gap-2.5">
                      {step.status === 'active' && <Loader size={12} className="text-white animate-spin" />}
                      {step.status === 'done' && <Check size={12} className="text-emerald-400" />}
                      {step.status === 'pending' && <div className="w-3 h-3 rounded-full border border-neutral-800" />}
                      <span className={
                        step.status === 'done' ? 'text-emerald-400/90' : 
                        step.status === 'active' ? 'text-white font-medium' : 'text-[#475569]'
                      }>
                        {step.label}
                      </span>
                    </div>
                  </div>
                ))}

                {taskRecap && (
                  <div className="mt-4 pt-4 border-t border-[#111119] text-[#e2e8f0] animate-fade-in leading-relaxed font-sans text-[13px]">
                    {taskRecap}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-4 items-center mt-6">
              {!taskStarted && (
                <button 
                  onClick={handleBack}
                  className="px-6 py-3 bg-[#0d0d12] border border-[#1a1a24] text-[#94a3b8] text-[13px] rounded-full hover:text-white transition-colors cursor-pointer"
                >
                  Back
                </button>
              )}
              {taskComplete && (
                <button 
                  onClick={handleNext}
                  className="px-8 py-3 bg-white text-black font-semibold text-[13px] rounded-full hover:bg-neutral-200 active:scale-95 transition-all shadow-md shadow-white/5 cursor-pointer animate-fade-in"
                >
                  Continue
                  <ArrowRight size={13} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* STEP 5: Closing screen */}
        {currentStep === 'closing' && (
          <div className="page-enter flex flex-col items-center w-full">
            <div className="text-[10px] tracking-[0.2em] font-mono text-[#475569] mb-4">STEP 3 OF 3</div>
            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mb-6 shadow-lg shadow-white/10">
              <Check size={26} className="text-black" />
            </div>
            <h2 className="text-[26px] font-semibold text-white mb-3">All set, {localStorage.getItem('torch_user_name')}!</h2>
            <p className="text-[13.5px] leading-relaxed text-[#94a3b8] mb-8 font-sans max-w-[340px]">
              TORCH is now configured and ready. You are in complete control of your computer automation.
            </p>
            <button 
              onClick={handleFinish} 
              className="px-10 py-4 bg-white text-black font-semibold text-[14px] rounded-full hover:bg-neutral-200 active:scale-95 transition-all cursor-pointer shadow-lg shadow-white/10"
            >
              Enter Command Center
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
