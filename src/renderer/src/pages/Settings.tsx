import { useState, useEffect } from 'react'

import {
  IconKey as Key,
  IconMail as Mail,
  IconMic as Mic,
  IconMonitor as Monitor,
  IconPalette as Palette,
  IconPower as Power,
  IconDatabase as Database,
  IconExternalLink as ExternalLink,
  IconShare as Share2,
} from '../components/icons'


interface SettingRowProps {
  label: string
  description?: string
  children: React.ReactNode
}

function SettingRow({ label, description, children }: SettingRowProps): JSX.Element {
  return (
    <div className="flex items-center justify-between py-4 border-b border-[#0e0e0e]">
      <div className="flex-1 min-w-0 mr-4">
        <div className="text-[13px] text-[#ccc]">{label}</div>
        {description && <div className="text-[11px] text-[#444] mt-0.5">{description}</div>}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {children}
      </div>
    </div>
  )
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }): JSX.Element {
  return (
    <button
      onClick={onChange}
      className={`w-10 h-5 border flex items-center px-0.5 transition-all duration-150 ${checked ? 'bg-white border-white' : 'bg-transparent border-[#222]'
        }`}
    >
      <div className={`w-3.5 h-3.5 transition-all duration-150 ${checked ? 'bg-black translate-x-[18px]' : 'bg-[#444] translate-x-0'
        }`} />
    </button>
  )
}

const SOCIAL_PLATFORMS = [
  { name: 'X / Twitter', url: 'https://twitter.com', key: 'twitter' },
  { name: 'LinkedIn', url: 'https://linkedin.com', key: 'linkedin' },
  { name: 'WhatsApp Web', url: 'https://web.whatsapp.com', key: 'whatsapp' },
  { name: 'Instagram', url: 'https://instagram.com', key: 'instagram' },
]

export function Settings(): JSX.Element {
  const [activeTab, setActiveTab] = useState("connections");

  const [geminiKey, setGeminiKey] = useState('')
  const [gmailAddress, setGmailAddress] = useState('')
  const [gmailPassword, setGmailPassword] = useState('')
  const [wakeWordSensitivity, setWakeWordSensitivity] = useState(50)
  const [screenWatchInterval, setScreenWatchInterval] = useState('30')
  const [voiceModel, setVoiceModel] = useState('base')
  const [theme, setTheme] = useState('dark')
  const [launchOnLogin, setLaunchOnLogin] = useState(false)
  const [minimizeToTray, setMinimizeToTray] = useState(true)
  const [playwrightInstalled, setPlaywrightInstalled] = useState<boolean | null>(null)

  // Local state for social connection status (persisted via localStorage)
  const [socialConnected, setSocialConnected] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('torch_social_connected') || '{}')
    } catch {
      return {}
    }
  })

  useEffect(() => {
    // Check playwright status
    fetch('http://localhost:8000/api/system-check')
      .then((r) => r.json())
      .then((data) => setPlaywrightInstalled(data.playwright_installed))
      .catch(() => setPlaywrightInstalled(null))

    // Fetch current settings
    fetch('http://localhost:8000/api/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.gemini_configured) setGeminiKey('********') // Don't show full key
        setGmailAddress(data.gmail_address || '')
        setWakeWordSensitivity(data.wake_word_sensitivity * 100 || 50)
        setScreenWatchInterval(data.screen_watch_interval?.toString() || '30')
        setVoiceModel(data.whisper_model_size || 'base')
      })
      .catch((err) => console.error('Failed to fetch settings:', err))
  }, [])

  const handleSocialLogin = (key: string, url: string): void => {
    window.torchAPI?.openExternal(url)
    const updated = { ...socialConnected, [key]: true }
    setSocialConnected(updated)
    localStorage.setItem('torch_social_connected', JSON.stringify(updated))
  }

  const handleSave = async (): Promise<void> => {
    try {
      const payload: any = {
        gmail_address: gmailAddress,
        gmail_app_password: gmailPassword,
        wake_word_sensitivity: wakeWordSensitivity / 100,
        screen_watch_interval: screenWatchInterval === 'off' ? 0 : Number(screenWatchInterval),
        whisper_model_size: voiceModel,
      }

      // Only send API key if it's not the masked placeholder
      if (geminiKey && geminiKey !== '********') {
        payload.gemini_api_key = geminiKey
      }

      await fetch('http://localhost:8000/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      // If gemini key was just saved, clear the warning banner
      if (geminiKey) {
        useTorchStore.getState().setShowSettingsKeyBanner(false)
        useTorchStore.getState().setDemoMode(false)
      }
      alert('Settings saved')
    } catch {
      alert('Failed to save — is the backend running?')
    }
  }

  const SegmentButton = ({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }): JSX.Element => (
    <div className="inline-flex border border-[#181818] divide-x divide-[#181818]">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-4 py-1.5 text-[10px] font-mono tracking-[0.04em] transition-all duration-120 ${value === opt.value ? 'bg-white text-black font-medium' : 'text-[#444] hover:text-[#888]'
            }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )

  return (
    <div className="flex-1 flex flex-col h-full page-enter overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-[#141414] flex-shrink-0">
        <h1 className="t-page-title">Settings</h1>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 px-6 border-b border-[#141414] flex-shrink-0">
        {([
          { id: 'connections', label: 'Connections' },
          { id: 'preferences', label: 'Preferences' },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '10px',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: activeTab === tab.id ? '#000000' : '#888888',
              background: activeTab === tab.id ? '#ffffff' : 'transparent',
              border: activeTab === tab.id ? '1px solid #000000' : '1px solid #888888',
              padding: '8px 16px',
              cursor: 'pointer',
              transition: 'all 150ms ease',
              borderRadius: 0,
              marginRight: '4px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="px-6 py-6 max-w-[680px] space-y-8">

        {/* ══════════════════════════════════════════════════════════════
           TAB: CONNECTIONS
           ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'connections' && (
          <>
            {/* API Configuration */}
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <Key size={13} className="text-[#555]" />
                <span className="t-label">API CONFIGURATION</span>
              </div>
              <SettingRow label="Gemini API Key" description="Powers all AI reasoning — get yours at aistudio.google.com">
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="Enter API key"
                  className="w-[300px] text-[12px]"
                />
                <button
                  onClick={() => window.torchAPI?.openExternal('https://aistudio.google.com')}
                  className="p-2.5 text-[#333] hover:text-white border border-[#181818] hover:border-[#333] transition-all"
                >
                  <ExternalLink size={12} />
                </button>
              </SettingRow>
            </div>

            {/* Gmail */}
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <Mail size={13} className="text-[#555]" />
                <span className="t-label">GMAIL CONNECTION</span>
              </div>
              <SettingRow label="Gmail Address">
                <input type="email" value={gmailAddress} onChange={(e) => setGmailAddress(e.target.value)} placeholder="you@gmail.com" className="w-[300px] text-[12px]" />
              </SettingRow>
              <SettingRow label="App Password" description="Generate at myaccount.google.com/apppasswords">
                <input type="password" value={gmailPassword} onChange={(e) => setGmailPassword(e.target.value)} placeholder="Enter app password" className="w-[300px] text-[12px]" />
              </SettingRow>
            </div>

            {/* Social Accounts */}
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <Share2 size={13} className="text-[#555]" />
                <span className="t-label">CONNECTED ACCOUNTS</span>
              </div>
              <p className="text-[12px] text-[#444] mb-5 leading-relaxed">
                TORCH uses browser automation to post — no API keys needed.
                Just make sure you are logged into these platforms in your browser.
              </p>

              {SOCIAL_PLATFORMS.map((platform) => {
                const connected = socialConnected[platform.key] || false
                return (
                  <div key={platform.key} className="flex items-center justify-between py-3.5 border-b border-[#0e0e0e]">
                    <div>
                      <div className="text-[13px] text-[#ccc]">{platform.name}</div>
                      <div className="text-[11px] text-[#333] mt-0.5 font-mono">Login-based access</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleSocialLogin(platform.key, platform.url)}
                        className="btn-secondary text-[10px] px-3 py-1.5"
                      >
                        Open & login
                      </button>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 border border-[#181818]">
                        <div className={`w-1.5 h-1.5 ${connected ? 'bg-white' : 'bg-[#333]'}`} />
                        <span className={`t-mono-xs ${connected ? 'text-[#aaa]' : 'text-[#333]'}`}>
                          {connected ? 'connected' : 'not verified'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Playwright status */}
              <div className="mt-4 p-4 border border-[#181818] bg-[#060606]">
                {playwrightInstalled === true ? (
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-white" />
                    <p className="t-mono-xs text-[#666]">PLAYWRIGHT INSTALLED — browser automation ready</p>
                  </div>
                ) : playwrightInstalled === false ? (
                  <>
                    <p className="t-mono-xs text-[#ef4444]">PLAYWRIGHT NOT INSTALLED — run in terminal:</p>
                    <p className="t-mono-xs text-white mt-1.5">playwright install chromium</p>
                  </>
                ) : (
                  <>
                    <p className="t-mono-xs text-[#444]">PLAYWRIGHT REQUIRED — run in terminal:</p>
                    <p className="t-mono-xs text-white mt-1.5">playwright install chromium</p>
                  </>
                )}
              </div>
            </div>

            {/* Save */}
            <div className="pb-8">
              <button onClick={handleSave} className="btn-primary px-8 py-2.5 text-[11px]">
                Save settings
              </button>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════
           TAB: GENERAL
           ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'preferences' && (
          <>
            {/* Voice */}
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <Mic size={13} className="text-[#555]" />
                <span className="t-label">VOICE SETTINGS</span>
              </div>
              <SettingRow label="Wake Word Sensitivity">
                <span className="t-mono-xs text-[#555] w-10 text-right">{wakeWordSensitivity}%</span>
                <input type="range" min="0" max="100" value={wakeWordSensitivity} onChange={(e) => setWakeWordSensitivity(Number(e.target.value))} className="w-[200px] accent-white" />
              </SettingRow>
              <SettingRow label="Voice Model Size" description="Larger = more accurate but slower">
                <SegmentButton
                  options={[{ value: 'tiny', label: 'TINY' }, { value: 'base', label: 'BASE' }, { value: 'small', label: 'SMALL' }]}
                  value={voiceModel}
                  onChange={setVoiceModel}
                />
              </SettingRow>
            </div>

            {/* Screen Watch */}
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <Monitor size={13} className="text-[#555]" />
                <span className="t-label">SCREEN WATCH</span>
              </div>
              <SettingRow label="Capture Interval">
                <SegmentButton
                  options={[{ value: '15', label: '15S' }, { value: '30', label: '30S' }, { value: '60', label: '60S' }, { value: 'off', label: 'OFF' }]}
                  value={screenWatchInterval}
                  onChange={setScreenWatchInterval}
                />
              </SettingRow>
            </div>

            {/* Appearance */}
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <Palette size={13} className="text-[#555]" />
                <span className="t-label">APPEARANCE</span>
              </div>
              <SettingRow label="Theme">
                <SegmentButton
                  options={[{ value: 'dark', label: 'DARK' }, { value: 'light', label: 'LIGHT' }]}
                  value={theme}
                  onChange={setTheme}
                />
              </SettingRow>
            </div>

            {/* Startup */}
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <Power size={13} className="text-[#555]" />
                <span className="t-label">STARTUP & BEHAVIOR</span>
              </div>
              <SettingRow label="Launch on login">
                <ToggleSwitch checked={launchOnLogin} onChange={() => setLaunchOnLogin(!launchOnLogin)} />
              </SettingRow>
              <SettingRow label="Minimize to tray">
                <ToggleSwitch checked={minimizeToTray} onChange={() => setMinimizeToTray(!minimizeToTray)} />
              </SettingRow>
            </div>

            {/* Data */}
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <Database size={13} className="text-[#555]" />
                <span className="t-label">DATA MANAGEMENT</span>
              </div>
              <div className="flex gap-3">
                <button className="btn-secondary text-[10px]">Clear memory</button>
                <button className="btn-secondary text-[10px]">Export history</button>
                <button className="btn-danger text-[10px]">Reset all habits</button>
              </div>
            </div>

            {/* Save */}
            <div className="pb-8">
              <button onClick={handleSave} className="btn-primary px-8 py-2.5 text-[11px]">
                Save settings
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
