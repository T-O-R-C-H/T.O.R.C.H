import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTorchStore } from '../store/torchStore'
import { API_BASE, torchFetch } from '../config/api'

import {
  IconKey as Key,
  IconMail as Mail,
  IconMic as Mic,
  IconPower as Power,
  IconDatabase as Database,
  IconExternalLink as ExternalLink,
  IconShare as Share2,
  IconTerminal as Terminal
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
      <div className="flex items-center gap-3 flex-shrink-0">{children}</div>
    </div>
  )
}

function ToggleSwitch({
  checked,
  onChange
}: {
  checked: boolean
  onChange: () => void
}): JSX.Element {
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
  { name: 'Instagram', url: 'https://instagram.com', key: 'instagram' }
]

interface SegmentButtonProps {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}

function SegmentButton({ options, value, onChange }: SegmentButtonProps): JSX.Element {
  return (
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
}

export function Settings(): JSX.Element {
  const [activeTab, setActiveTab] = useState('connections')
  const navigate = useNavigate()
  const setOnboardingComplete = useTorchStore((s) => s.setOnboardingComplete)

  const [geminiKey, setGeminiKey] = useState('')
  const [gmailAddress, setGmailAddress] = useState('')
  const [gmailPassword, setGmailPassword] = useState('')
  const [emailTest, setEmailTest] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [emailTestMsg, setEmailTestMsg] = useState('')
  const [voiceModel, setVoiceModel] = useState('base')

  const [secureStorage, setSecureStorage] = useState<boolean | null>(null)

  // Capability permissions. The planner enforces these server-side.
  const [allowFiles, setAllowFiles] = useState(true)
  const [allowApps, setAllowApps] = useState(true)
  const [allowEmail, setAllowEmail] = useState(true)
  const [launchOnLogin, setLaunchOnLogin] = useState(false)
  const [minimizeToTray, setMinimizeToTray] = useState(true)
  const [browserAutomation, setBrowserAutomation] = useState<{
    playwrightInstalled: boolean
    chromiumInstalled: boolean
    ready: boolean
    message: string
  } | null>(null)

  useEffect(() => {
    const loadSystemCheck = (retries = 5): void => {
      torchFetch(`${API_BASE}/api/system-check`)
        .then((r) => {
          if (!r.ok) throw new Error()
          return r.json()
        })
        .then((data) =>
          setBrowserAutomation({
            playwrightInstalled: Boolean(data.playwright_installed),
            chromiumInstalled: Boolean(data.chromium_installed),
            ready: Boolean(data.browser_automation_ready),
            message: String(data.message || 'Browser automation is not ready.')
          })
        )
        .catch(() => {
          if (retries > 0) {
            setTimeout(() => loadSystemCheck(retries - 1), 1000)
          } else {
            setBrowserAutomation(null)
          }
        })
    }

    // Surfaced so a user is never told their keys are encrypted when the OS
    // keystore is unavailable and they are not.
    void window.torchAPI?.getPreferences().then((prefs) => {
      setLaunchOnLogin(prefs.launchOnLogin)
      setMinimizeToTray(prefs.minimizeToTray)
    })

    void window.torchAPI
      ?.getCredentialStatus()
      .then((status) => setSecureStorage(status.encryptionAvailable))
      .catch(() => setSecureStorage(null))

    const loadSettings = (retries = 5): void => {
      torchFetch(`${API_BASE}/api/settings`)
        .then((r) => {
          if (!r.ok) throw new Error()
          return r.json()
        })
        .then((data) => {
          if (data.gemini_configured) setGeminiKey('********')
          setGmailAddress(data.gmail_address || '')
          if (data.gmail_password_set) setGmailPassword('********')
          setVoiceModel(data.whisper_model_size || 'base')
          setAllowFiles(data.allow_files !== false)
          setAllowApps(data.allow_apps !== false)
          setAllowEmail(data.allow_email !== false)
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

  // Opens the site in the user's own browser. TORCH has no visibility into
  // that session, so it cannot claim the account is connected.
  const handleSocialLogin = (_key: string, url: string): void => {
    window.torchAPI?.openExternal(url)
  }

  const handleTestEmail = async (): Promise<void> => {
    setEmailTest('testing')
    setEmailTestMsg('')
    try {
      const res = await torchFetch(`${API_BASE}/api/email/test`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setEmailTest('ok')
        setEmailTestMsg(data.message || 'Gmail connection works.')
      } else {
        setEmailTest('fail')
        setEmailTestMsg(data.detail || 'Gmail sign-in failed.')
      }
    } catch {
      setEmailTest('fail')
      setEmailTestMsg('Could not reach the TORCH backend.')
    }
  }

  const [dataMessage, setDataMessage] = useState<string | null>(null)

  /** Forget learned patterns. Task history is kept — that is a separate action. */
  const handleClearMemory = async (): Promise<void> => {
    if (!confirm('Forget the habits, contacts and file patterns TORCH has learned?')) return
    try {
      const res = await torchFetch(`${API_BASE}/api/memory`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      const data = await res.json().catch(() => ({}))
      setDataMessage(
        `Cleared ${data.removed ?? 0} learned record(s). Your task history is untouched.`
      )
    } catch {
      setDataMessage("Couldn't clear that just now. Check that TORCH is running.")
    }
  }

  /** Save the task history to a file the user chooses. */
  const handleExportHistory = async (): Promise<void> => {
    try {
      const res = await torchFetch(`${API_BASE}/api/history`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `torch-history-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
      setDataMessage('History downloaded.')
    } catch {
      setDataMessage("Couldn't export your history just now.")
    }
  }

  const handleResetHabits = async (): Promise<void> => {
    if (!confirm('Reset everything TORCH has learned about which commands you use most?')) return
    try {
      const res = await torchFetch(`${API_BASE}/api/habits`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      const data = await res.json().catch(() => ({}))
      setDataMessage(`Reset ${data.removed ?? 0} habit record(s).`)
    } catch {
      setDataMessage("Couldn't reset habits just now.")
    }
  }

  const handleSave = async (): Promise<void> => {
    try {
      const payload: Record<string, unknown> = {
        gmail_address: gmailAddress,
        whisper_model_size: voiceModel,
        allow_files: allowFiles,
        allow_apps: allowApps,
        allow_email: allowEmail
      }

      const res = await torchFetch(`${API_BASE}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error('Save failed')

      // Secrets go to the OS keystore through the main process, not into .env.
      // '********' means the field was left untouched.
      const secrets: Record<string, string> = {}
      if (geminiKey && geminiKey !== '********') secrets.gemini_api_key = geminiKey
      if (gmailPassword && gmailPassword !== '********') {
        secrets.gmail_app_password = gmailPassword
      }
      if (Object.keys(secrets).length > 0) {
        const stored = await window.torchAPI?.setCredentials(secrets)
        if (stored && !stored.ok) {
          alert(stored.reason || 'Could not save your credentials securely.')
          return
        }
      }

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

  return (
    <div className="page-shell page-enter">
      <div className="settings-tabs">
        {[
          { id: 'connections', label: 'Connections' },
          { id: 'preferences', label: 'Preferences' }
        ].map((tab) => (
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
                <p className="text-[11px] text-[var(--color-torch-text-secondary)] mb-3 leading-relaxed">
                  {secureStorage === false
                    ? "This computer has no secure storage available, so TORCH can't encrypt your keys here. They won't be saved."
                    : 'Keys are encrypted by your operating system and never stored in plain text.'}
                </p>
                <SettingRow
                  label="AI Connection Key"
                  description="Powers all AI reasoning — get your key to start"
                >
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
                  <input
                    type="email"
                    value={gmailAddress}
                    onChange={(e) => setGmailAddress(e.target.value)}
                    placeholder="you@gmail.com"
                    className="w-[300px] text-[12px]"
                  />
                </SettingRow>
                <SettingRow
                  label="App Password"
                  description="Generate at myaccount.google.com/apppasswords"
                >
                  <input
                    type="password"
                    value={gmailPassword}
                    onChange={(e) => setGmailPassword(e.target.value)}
                    placeholder="Enter app password"
                    className="w-[300px] text-[12px]"
                  />
                </SettingRow>
                <SettingRow
                  label="Connection"
                  description="Spaces in the password are removed automatically when saving"
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="btn-secondary text-[11px] px-3 py-1.5"
                      onClick={() => void handleTestEmail()}
                      disabled={emailTest === 'testing'}
                    >
                      {emailTest === 'testing' ? 'Testing…' : 'Test connection'}
                    </button>
                    {emailTest === 'ok' && (
                      <span className="badge-success px-2.5 py-1 text-[11px]">{emailTestMsg}</span>
                    )}
                    {emailTest === 'fail' && (
                      <span className="badge-error px-2.5 py-1 text-[11px] max-w-[320px]">
                        {emailTestMsg}
                      </span>
                    )}
                  </div>
                </SettingRow>
              </div>

              {/* Social Accounts */}
              <div>
                <div className="flex items-center gap-2.5 mb-4">
                  <Share2 size={13} className="text-[var(--color-torch-text-tertiary)]" />
                  <span className="t-label">CONNECTED ACCOUNTS</span>
                </div>
                <p className="text-[12px] text-[var(--color-torch-text-secondary)] mb-5 leading-relaxed">
                  TORCH can open these sites with a message ready for you, but it cannot post or
                  send on your behalf — you publish it yourself.
                </p>

                {SOCIAL_PLATFORMS.map((platform) => (
                  <div key={platform.key} className="setting-row">
                    <div>
                      <div className="setting-row__label">{platform.name}</div>
                      <div className="setting-row__desc font-mono">Opens in your browser</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSocialLogin(platform.key, platform.url)}
                      className="btn-secondary text-[10px] px-3 py-1.5"
                    >
                      Open site
                    </button>
                  </div>
                ))}

                {/* Playwright status */}
                <div className="mt-4 p-4 card">
                  {browserAutomation?.ready ? (
                    <div className="flex items-center gap-2">
                      <span className="topbar-dot topbar-dot--live" />
                      <p className="t-mono-xs">Browser automation ready</p>
                    </div>
                  ) : browserAutomation ? (
                    <>
                      <p className="t-mono-xs" style={{ color: 'var(--color-torch-error)' }}>
                        {browserAutomation.message}
                      </p>
                      <p className="t-mono-xs mt-1.5">
                        {browserAutomation.playwrightInstalled
                          ? 'playwright install chromium'
                          : 'pip install playwright && playwright install chromium'}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="t-mono-xs">Checking browser automation…</p>
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
                <SettingRow
                  label="Voice Model Size"
                  description="Larger = more accurate but slower"
                >
                  <SegmentButton
                    options={[
                      { value: 'tiny', label: 'TINY' },
                      { value: 'base', label: 'BASE' },
                      { value: 'small', label: 'SMALL' }
                    ]}
                    value={voiceModel}
                    onChange={setVoiceModel}
                  />
                </SettingRow>
              </div>

              {/* Permissions — enforced by the planner, not cosmetic */}
              <div>
                <div className="flex items-center gap-2.5 mb-4">
                  <Power size={13} className="text-[var(--color-torch-text-tertiary)]" />
                  <span className="t-label">WHAT TORCH CAN DO</span>
                </div>
                <p className="text-[11px] text-[var(--color-torch-text-secondary)] mb-3 leading-relaxed">
                  Switching one off stops TORCH using those tools at all — it will say so instead of
                  trying.
                </p>
                <SettingRow label="Find and open your files">
                  <ToggleSwitch checked={allowFiles} onChange={() => setAllowFiles(!allowFiles)} />
                </SettingRow>
                <SettingRow label="Open apps and run commands">
                  <ToggleSwitch checked={allowApps} onChange={() => setAllowApps(!allowApps)} />
                </SettingRow>
                <SettingRow label="Read and send your email">
                  <ToggleSwitch checked={allowEmail} onChange={() => setAllowEmail(!allowEmail)} />
                </SettingRow>
              </div>

              {/* Startup */}
              <div>
                <div className="flex items-center gap-2.5 mb-4">
                  <Power size={13} className="text-[var(--color-torch-text-tertiary)]" />
                  <span className="t-label">STARTUP & BEHAVIOR</span>
                </div>
                <SettingRow label="Launch on login">
                  <ToggleSwitch
                    checked={launchOnLogin}
                    onChange={() => {
                      const next = !launchOnLogin
                      setLaunchOnLogin(next)
                      void window.torchAPI?.setPreferences({ launchOnLogin: next })
                    }}
                  />
                </SettingRow>
                <SettingRow
                  label="Minimize to tray"
                  description="Off minimizes to the taskbar instead"
                >
                  <ToggleSwitch
                    checked={minimizeToTray}
                    onChange={() => {
                      const next = !minimizeToTray
                      setMinimizeToTray(next)
                      void window.torchAPI?.setPreferences({ minimizeToTray: next })
                    }}
                  />
                </SettingRow>
              </div>

              {/* Data */}
              <div>
                <div className="flex items-center gap-2.5 mb-4">
                  <Database size={13} className="text-[var(--color-torch-text-tertiary)]" />
                  <span className="t-label">DATA MANAGEMENT</span>
                </div>
                <div className="flex gap-3 font-mono">
                  <button
                    type="button"
                    className="btn-secondary text-[10px]"
                    onClick={() => void handleClearMemory()}
                  >
                    Clear memory
                  </button>
                  <button
                    type="button"
                    className="btn-secondary text-[10px]"
                    onClick={() => void handleExportHistory()}
                  >
                    Export history
                  </button>
                  <button
                    type="button"
                    className="btn-danger text-[10px]"
                    onClick={() => void handleResetHabits()}
                  >
                    Reset all habits
                  </button>
                </div>
                {dataMessage && (
                  <p className="text-[11px] text-[var(--color-torch-text-secondary)] mt-3">
                    {dataMessage}
                  </p>
                )}
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
                      setOnboardingComplete(false)
                      navigate('/')
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
