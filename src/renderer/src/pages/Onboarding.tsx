import { useState } from 'react'
import { IconExternalLink as ExternalLink, IconMic as Mic, IconArrowRight as ArrowRight, IconArrowLeft as ArrowLeft, IconCheck as Check } from '../components/icons'
import { useTorchStore } from '../store/torchStore'
import { TorchOrb } from '../components/overlay/TorchOrb'

const steps = ['splash', 'gemini', 'gmail', 'voice', 'startup', 'done'] as const
type OnboardingStep = (typeof steps)[number]

export function Onboarding(): JSX.Element {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('splash')
  const [geminiKey, setGeminiKey] = useState('')
  const [gmailAddress, setGmailAddress] = useState('')
  const [gmailPassword, setGmailPassword] = useState('')
  const [launchOnLogin, setLaunchOnLogin] = useState(true)
  const setOnboardingComplete = useTorchStore((s) => s.setOnboardingComplete)
  const [splashDone, setSplashDone] = useState(false)

  const currentIndex = steps.indexOf(currentStep)

  const goNext = async (): Promise<void> => {
    // Save Gemini key to backend when leaving step 1
    if (currentStep === 'gemini' && geminiKey) {
      try {
        await fetch('http://localhost:8000/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gemini_api_key: geminiKey })
        })
      } catch {}
    }
    // Save Gmail credentials when leaving step 2
    if (currentStep === 'gmail' && gmailAddress) {
      try {
        await fetch('http://localhost:8000/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gmail_address: gmailAddress,
            gmail_app_password: gmailPassword
          })
        })
      } catch {}
    }
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1])
    }
  }

  const goBack = (): void => {
    if (currentIndex > 1) {
      setCurrentStep(steps[currentIndex - 1])
    }
  }

  const finish = (): void => {
    setOnboardingComplete(true)
  }

  // Auto-advance splash
  if (currentStep === 'splash' && !splashDone) {
    setTimeout(() => setSplashDone(true), 2400)
    setTimeout(() => setCurrentStep('gemini'), 3000)
  }

  return (
    <div className="w-full h-full bg-[#000] flex flex-col items-center justify-center relative">
      {/* Splash */}
      {currentStep === 'splash' && (
        <div className="flex flex-col items-center splash-enter">
          <TorchOrb isActive size={64} />
          <h1 className="text-[28px] font-semibold tracking-[-1px] mt-6 fade-in">TORCH</h1>
          <p className="text-[11px] text-[#444] mt-2 tracking-[0.15em] font-mono fade-in-delay">
            Thinking, Observing, Reasoning, Creating & Handling
          </p>
        </div>
      )}

      {/* Step: Gemini API Key */}
      {currentStep === 'gemini' && (
        <div className="flex flex-col items-center max-w-[420px] w-full px-8 page-enter">
          <div className="label mb-6">STEP 1 OF 4</div>
          <h2 className="heading-lg mb-2">Connect Gemini</h2>
          <p className="text-[11px] text-[#666] mb-8 text-center">
            TORCH uses Google Gemini as its AI brain. Get a free API key from AI Studio.
          </p>
          <input
            type="password"
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            placeholder="Enter your Gemini API key"
            className="w-full text-[12px] mb-3"
          />
          <button
            onClick={() => window.torchAPI?.openExternal('https://aistudio.google.com')}
            className="flex items-center gap-2 mono-xs text-[#444] hover:text-[#666] transition-colors mb-8"
          >
            <ExternalLink size={10} />
            Get key from aistudio.google.com
          </button>
        </div>
      )}

      {/* Step: Gmail */}
      {currentStep === 'gmail' && (
        <div className="flex flex-col items-center max-w-[420px] w-full px-8 page-enter">
          <div className="label mb-6">STEP 2 OF 4</div>
          <h2 className="heading-lg mb-2">Connect Gmail</h2>
          <p className="text-[11px] text-[#666] mb-8 text-center">
            Optional. Allows TORCH to send and read emails on your behalf.
          </p>
          <input
            type="email"
            value={gmailAddress}
            onChange={(e) => setGmailAddress(e.target.value)}
            placeholder="your.email@gmail.com"
            className="w-full text-[12px] mb-3"
          />
          <input
            type="password"
            value={gmailPassword}
            onChange={(e) => setGmailPassword(e.target.value)}
            placeholder="App password"
            className="w-full text-[12px] mb-3"
          />
          <button
            onClick={() => window.torchAPI?.openExternal('https://myaccount.google.com/apppasswords')}
            className="flex items-center gap-2 mono-xs text-[#444] hover:text-[#666] transition-colors mb-8"
          >
            <ExternalLink size={10} />
            Generate app password
          </button>
        </div>
      )}

      {/* Step: Voice Test */}
      {currentStep === 'voice' && (
        <div className="flex flex-col items-center max-w-[420px] w-full px-8 page-enter">
          <div className="label mb-6">STEP 3 OF 4</div>
          <h2 className="heading-lg mb-2">Test Voice</h2>
          <p className="text-[11px] text-[#666] mb-8 text-center">
            Say "Hey TORCH" to test your microphone and wake word detection.
          </p>
          <div className="mb-8">
            <TorchOrb isActive size={48} />
          </div>
          <div className="flex items-center gap-2 px-4 py-2 border border-[#1c1c1c]">
            <Mic size={12} className="text-[#444]" />
            <span className="mono-xs text-[#444]">Say "Hey TORCH" to test</span>
          </div>
        </div>
      )}

      {/* Step: Startup */}
      {currentStep === 'startup' && (
        <div className="flex flex-col items-center max-w-[420px] w-full px-8 page-enter">
          <div className="label mb-6">STEP 4 OF 4</div>
          <h2 className="heading-lg mb-2">Preferences</h2>
          <p className="text-[11px] text-[#666] mb-8 text-center">
            Configure how TORCH starts and runs in the background.
          </p>
          <div className="w-full space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-[#0d0d0d]">
              <span className="text-[12px] text-[#aaa]">Launch TORCH on login</span>
              <button
                onClick={() => setLaunchOnLogin(!launchOnLogin)}
                className={`w-10 h-5 border flex items-center px-0.5 transition-colors duration-120 ${
                  launchOnLogin ? 'bg-white border-white' : 'bg-transparent border-[#1c1c1c]'
                }`}
              >
                <div className={`w-3.5 h-3.5 transition-all duration-120 ${
                  launchOnLogin ? 'bg-black translate-x-[18px]' : 'bg-[#333] translate-x-0'
                }`} />
              </button>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-[#0d0d0d]">
              <span className="text-[12px] text-[#aaa]">Minimize to system tray</span>
              <div className="badge-success px-2 py-1 mono-xs">always on</div>
            </div>
          </div>
        </div>
      )}

      {/* Step: Done */}
      {currentStep === 'done' && (
        <div className="flex flex-col items-center max-w-[420px] w-full px-8 page-enter">
          <div className="w-12 h-12 bg-white flex items-center justify-center mb-6">
            <Check size={24} className="text-black" />
          </div>
          <h2 className="heading-lg mb-2">TORCH is ready</h2>
          <p className="text-[11px] text-[#666] mb-8 text-center">
            Say "Hey TORCH" anytime, even when minimized. Your AI agent is always listening.
          </p>
          <button onClick={finish} className="btn-primary px-8 py-3">
            Launch TORCH
          </button>
        </div>
      )}

      {/* Navigation — bottom */}
      {currentStep !== 'splash' && currentStep !== 'done' && (
        <div className="absolute bottom-12 flex flex-col items-center gap-6">
          {/* Progress dots */}
          <div className="flex items-center gap-2">
            {steps.slice(1, -1).map((step, i) => (
              <div
                key={step}
                className={`progress-dot ${
                  steps.indexOf(currentStep) - 1 > i ? 'completed' :
                  currentStep === step ? 'active' : ''
                }`}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3">
            {currentIndex > 1 && (
              <button onClick={goBack} className="btn-secondary flex items-center gap-2">
                <ArrowLeft size={10} />
                back
              </button>
            )}
            <button onClick={goNext} className="btn-primary flex items-center gap-2">
              {currentStep === 'startup' ? 'finish' : 'next'}
              <ArrowRight size={10} />
            </button>
            {currentStep !== 'startup' && (
              <button onClick={goNext} className="mono-xs text-[#333] hover:text-[#666] transition-colors ml-2">
                skip
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
