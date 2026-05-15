import { useState } from 'react'
import { IconSettings as SettingsIcon, IconKey as Key, IconMail as Mail, IconMic as Mic, IconMonitor as Monitor, IconPalette as Palette, IconPower as Power, IconDatabase as Database, IconExternalLink as ExternalLink, IconShare as Share2 } from '../components/icons'

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
      className={`w-10 h-5 border flex items-center px-0.5 transition-all duration-150 ${
        checked ? 'bg-white border-white' : 'bg-transparent border-[#222]'
      }`}
    >
      <div className={`w-3.5 h-3.5 transition-all duration-150 ${
        checked ? 'bg-black translate-x-[18px]' : 'bg-[#444] translate-x-0'
      }`} />
    </button>
  )
}

export function Settings(): JSX.Element {
  const [geminiKey, setGeminiKey] = useState('')
  const [gmailAddress, setGmailAddress] = useState('')
  const [gmailPassword, setGmailPassword] = useState('')
  const [wakeWordSensitivity, setWakeWordSensitivity] = useState(50)
  const [screenWatchInterval, setScreenWatchInterval] = useState('30')
  const [voiceModel, setVoiceModel] = useState('base')
  const [theme, setTheme] = useState('dark')
  const [launchOnLogin, setLaunchOnLogin] = useState(false)
  const [minimizeToTray, setMinimizeToTray] = useState(true)

  const handleSave = async (): Promise<void> => {
    try {
      await fetch('http://localhost:8000/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gemini_api_key: geminiKey,
          gmail_address: gmailAddress,
          gmail_app_password: gmailPassword,
          wake_word_sensitivity: wakeWordSensitivity / 100,
          screen_watch_interval: screenWatchInterval === 'off' ? 0 : Number(screenWatchInterval),
          whisper_model_size: voiceModel,
        })
      })
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
          className={`px-4 py-1.5 text-[10px] font-mono tracking-[0.04em] transition-all duration-120 ${
            value === opt.value ? 'bg-white text-black font-medium' : 'text-[#444] hover:text-[#888]'
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

      <div className="px-6 py-6 max-w-[680px] space-y-8">
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
          
          {[
            { name: 'X / Twitter', url: 'https://twitter.com' },
            { name: 'LinkedIn', url: 'https://linkedin.com' },
            { name: 'WhatsApp Web', url: 'https://web.whatsapp.com' },
            { name: 'Instagram', url: 'https://instagram.com' },
          ].map((platform) => (
            <div key={platform.name} className="flex items-center justify-between py-3.5 border-b border-[#0e0e0e]">
              <div>
                <div className="text-[13px] text-[#ccc]">{platform.name}</div>
                <div className="text-[11px] text-[#333] mt-0.5 font-mono">Playwright automation</div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.torchAPI?.openExternal(platform.url)}
                  className="btn-secondary text-[10px] px-3 py-1.5"
                >
                  Open & login
                </button>
                <div className="flex items-center gap-1.5 px-2.5 py-1 border border-[#181818]">
                  <div className="w-1.5 h-1.5 bg-[#333]" />
                  <span className="t-mono-xs text-[#333]">not verified</span>
                </div>
              </div>
            </div>
          ))}
          
          <div className="mt-4 p-4 border border-[#181818] bg-[#060606]">
            <p className="t-mono-xs text-[#444]">PLAYWRIGHT REQUIRED — run in terminal:</p>
            <p className="t-mono-xs text-white mt-1.5">playwright install chromium</p>
          </div>
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
      </div>
    </div>
  )
}
