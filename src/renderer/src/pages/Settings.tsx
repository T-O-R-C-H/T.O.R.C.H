import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTorchStore } from '../store/torchStore'
import { API_BASE } from '../config/api'

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
  IconTerminal as Terminal,
} from '../components/icons'


interface SettingRowProps {
  label: string
  description?: string
  children: React.ReactNode
}

function SettingRow({ label, description, children }: SettingRowProps): JSX.Element {
  return (
    <div className="setting-row">
      <div className="flex-1 min-w-0 mr-4">
        <div className="setting-row__label">{label}</div>
        {description && <div className="setting-row__desc">{description}</div>}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {children}
      </div>
    </div>
  )
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }): JSX.Element {
  return (
    <button type="button" onClick={onChange} aria-pressed={checked} className="toggle-track">
      <div className="toggle-knob" />
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
  const navigate = useNavigate();
  const setOnboardingComplete = useTorchStore((s) => s.setOnboardingComplete)

  const [geminiKey, setGeminiKey] = useState('')
  const [gmailAddress, setGmailAddress] = useState('')
  const [gmailPassword, setGmailPassword] = useState('')
  const [wakeWordSensitivity, setWakeWordSensitivity] = useState(50)
  const [screenWatchInterval, setScreenWatchInterval] = useState('30')
  const [voiceModel, setVoiceModel] = useState('base')
  const [theme, setTheme] = useState('light')
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
    const loadSystemCheck = (retries = 5) => {
      fetch(`${API_BASE}/api/system-check`)
        .then((r) => {
          if (!r.ok) throw new Error()
          return r.json()
        })
        .then((data) => setPlaywrightInstalled(data.playwright_installed))
        .catch(() => {
          if (retries > 0) {
            setTimeout(() => loadSystemCheck(retries - 1), 1000)
          } else {
            setPlaywrightInstalled(null)
          }
        })
    }

    const loadSettings = (retries = 5) => {
      fetch(`${API_BASE}/api/settings`)
        .then((r) => {
          if (!r.ok) throw new Error()
          return r.json()
        })
        .then((data) => {
          if (data.gemini_configured) setGeminiKey('********')
          setGmailAddress(data.gmail_address || '')
          if (data.gmail_password_set) setGmailPassword('********')
          setWakeWordSensitivity(data.wake_word_sensitivity * 100 || 50)
          setScreenWatchInterval(data.screen_watch_interval?.toString() || '30')
          setVoiceModel(data.whisper_model_size || 'base')
        })
        .catch(() => {
          if (retries > 0) {
            setTimeout(() => loadSettings(retries - 1), 1000)
          }
        })
    }

    loadSystemCheck()
    loadSettings()
  }, [])

  const handleSocialLogin = (key: string, url: string): void => {
    window.torchAPI?.openExternal(url)
    const updated = { ...socialConnected, [key]: true }
    setSocialConnected(updated)
    localStorage.setItem('torch_social_connected', JSON.stringify(updated))
  }

  const handleSave = async (): Promise<void> => {
    try {
      const payload: Record<string, unknown> = {
        gmail_address: gmailAddress,
        wake_word_sensitivity: wakeWordSensitivity / 100,
        screen_watch_interval: screenWatchInterval === 'off' ? 0 : Number(screenWatchInterval),
        whisper_model_size: voiceModel,
      }

      if (geminiKey && geminiKey !== '********') {
        payload.gemini_api_key = geminiKey
      }
      if (gmailPassword && gmailPassword !== '********') {
        payload.gmail_app_password = gmailPassword
      }

      const res = await fetch(`${API_BASE}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error('Save failed')

      if (geminiKey) {
        useTorchStore.getState().setShowSettingsKeyBanner(false)
        useTorchStore.getState().setDemoMode(false)
      }
      if (gmailPassword && gmailPassword !== '********') {
        setGmailPassword('********')
      }
      if (geminiKey && geminiKey !== '********') {
        setGeminiKey('********')
      }
    } catch {
      alert('Failed to save. Make sure TORCH is running and the backend is online.')
    }
  }

  const SegmentButton = ({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }): JSX.Element => (
    <div className="segment-control">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`segment-control__btn ${value === opt.value ? 'active' : ''}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )

  return (
    <div className="page-shell page-enter">
      <div className="settings-tabs">
        {([
          { id: 'connections', label: 'Connections' },
          { id: 'preferences', label: 'Preferences' },
        ]).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="page-shell__body">
      <div className="px-6 py-6 max-w-[680px] space-y-8">

        {/* ══════════════════════════════════════════════════════════════
           TAB: CONNECTIONS
           ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'connections' && (
          <>
            {/* API Configuration */}
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <Key size={13} className="text-[var(--color-torch-text-tertiary)]" />
                <span className="t-label">API CONFIGURATION</span>
              </div>
              <SettingRow label="AI Connection Key" description="Powers all AI reasoning — get your key to start">
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="Enter API key"
                  className="w-[300px] text-[12px]"
                />
                <button
                  type="button"
                  onClick={() => window.torchAPI?.openExternal('https://aistudio.google.com')}
                  className="btn-secondary p-2.5"
                >
                  <ExternalLink size={12} />
                </button>
              </SettingRow>
            </div>

            {/* Gmail */}
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <Mail size={13} className="text-[var(--color-torch-text-tertiary)]" />
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
                <Share2 size={13} className="text-[var(--color-torch-text-tertiary)]" />
                <span className="t-label">CONNECTED ACCOUNTS</span>
              </div>
              <p className="text-[12px] text-[var(--color-torch-text-secondary)] mb-5 leading-relaxed">
                TORCH uses browser automation to post — no API keys needed.
                Just make sure you are logged into these platforms in your browser.
              </p>

              {SOCIAL_PLATFORMS.map((platform) => {
                const connected = socialConnected[platform.key] || false
                return (
                  <div key={platform.key} className="setting-row">
                    <div>
                      <div className="setting-row__label">{platform.name}</div>
                      <div className="setting-row__desc font-mono">Login-based access</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleSocialLogin(platform.key, platform.url)}
                        className="btn-secondary text-[10px] px-3 py-1.5"
                      >
                        Open & login
                      </button>
                      <div className="pill-count flex items-center gap-1.5">
                        <span className={`topbar-dot ${connected ? 'topbar-dot--live' : ''}`} style={{ width: 6, height: 6 }} />
                        {connected ? 'connected' : 'not verified'}
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Playwright status */}
              <div className="mt-4 p-4 card">
                {playwrightInstalled === true ? (
                  <div className="flex items-center gap-2">
                    <span className="topbar-dot topbar-dot--live" />
                    <p className="t-mono-xs">Playwright installed — browser automation ready</p>
                  </div>
                ) : playwrightInstalled === false ? (
                  <>
                    <p className="t-mono-xs" style={{ color: 'var(--color-torch-error)' }}>Playwright not installed — run in terminal:</p>
                    <p className="t-mono-xs mt-1.5">playwright install chromium</p>
                  </>
                ) : (
                  <>
                    <p className="t-mono-xs">Playwright required — run in terminal:</p>
                    <p className="t-mono-xs mt-1.5">playwright install chromium</p>
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
                <Mic size={13} className="text-[var(--color-torch-text-tertiary)]" />
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
                <Monitor size={13} className="text-[var(--color-torch-text-tertiary)]" />
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
                <Palette size={13} className="text-[var(--color-torch-text-tertiary)]" />
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
                <Power size={13} className="text-[var(--color-torch-text-tertiary)]" />
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
                <Database size={13} className="text-[var(--color-torch-text-tertiary)]" />
                <span className="t-label">DATA MANAGEMENT</span>
              </div>
              <div className="flex gap-3 font-mono">
                <button className="btn-secondary text-[10px]">Clear memory</button>
                <button className="btn-secondary text-[10px]">Export history</button>
                <button className="btn-danger text-[10px]">Reset all habits</button>
              </div>
            </div>

            {/* Developer Tools */}
            <div className="pt-6 border-t border-[var(--color-torch-border-subtle)]">
              <div className="flex items-center gap-2.5 mb-4">
                <Terminal size={13} className="text-[var(--color-torch-text-tertiary)]" />
                <span className="t-label">DEVELOPER TOOLS</span>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => navigate('/terminal')} 
                  className="btn-secondary text-[10px] px-4 py-2 flex items-center gap-2 font-mono"
                >
                  Open Activity Log
                </button>
                <button 
                  onClick={() => {
                    setOnboardingComplete(false);
                    navigate('/');
                  }} 
                  className="btn-secondary text-[10px] px-4 py-2 flex items-center gap-2 font-mono"
                >
                  Replay Intro
                </button>
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
    </div>
  )
}
