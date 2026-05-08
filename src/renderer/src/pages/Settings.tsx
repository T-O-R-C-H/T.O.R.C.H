import { useState } from 'react'
import { Settings as SettingsIcon, Key, Mail, Mic, Monitor, Palette, Power, Database, ExternalLink } from 'lucide-react'

interface SettingRowProps {
  label: string
  description?: string
  children: React.ReactNode
}

function SettingRow({ label, description, children }: SettingRowProps): JSX.Element {
  return (
    <div className="flex items-center justify-between py-4 border-b border-[#0d0d0d]">
      <div>
        <div className="text-[12px] text-[#ccc]">{label}</div>
        {description && <div className="text-[10px] text-[#444] mt-0.5">{description}</div>}
      </div>
      <div className="flex items-center gap-2">
        {children}
      </div>
    </div>
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

  return (
    <div className="flex-1 flex flex-col h-full page-enter overflow-y-auto">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#1c1c1c] flex-shrink-0">
        <SettingsIcon size={14} className="text-[#666]" />
        <span className="label">SETTINGS</span>
      </div>

      <div className="px-6 py-4 max-w-[640px] space-y-6">
        {/* API Configuration */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Key size={12} className="text-[#444]" />
            <span className="label">API CONFIGURATION</span>
          </div>
          <div className="space-y-0">
            <SettingRow label="Gemini API Key" description="Get your key from aistudio.google.com">
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="Enter API key"
                className="w-[280px] text-[11px]"
              />
              <button
                onClick={() => window.torchAPI?.openExternal('https://aistudio.google.com')}
                className="p-2 text-[#333] hover:text-[#666]"
              >
                <ExternalLink size={12} />
              </button>
            </SettingRow>
          </div>
        </div>

        {/* Gmail */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Mail size={12} className="text-[#444]" />
            <span className="label">GMAIL CONNECTION</span>
          </div>
          <SettingRow label="Gmail Address">
            <input
              type="email"
              value={gmailAddress}
              onChange={(e) => setGmailAddress(e.target.value)}
              placeholder="you@gmail.com"
              className="w-[280px] text-[11px]"
            />
          </SettingRow>
          <SettingRow label="App Password" description="Generate at myaccount.google.com/apppasswords">
            <input
              type="password"
              value={gmailPassword}
              onChange={(e) => setGmailPassword(e.target.value)}
              placeholder="Enter app password"
              className="w-[280px] text-[11px]"
            />
          </SettingRow>
        </div>

        {/* Voice */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Mic size={12} className="text-[#444]" />
            <span className="label">VOICE SETTINGS</span>
          </div>
          <SettingRow label="Wake Word Sensitivity">
            <span className="mono-xs text-[#333] w-8 text-right">{wakeWordSensitivity}%</span>
            <input
              type="range"
              min="0" max="100"
              value={wakeWordSensitivity}
              onChange={(e) => setWakeWordSensitivity(Number(e.target.value))}
              className="w-[200px] accent-white"
            />
          </SettingRow>
          <SettingRow label="Voice Model Size" description="Larger = more accurate, slower">
            <div className="flex border border-[#1c1c1c]">
              {['tiny', 'base', 'small'].map((model) => (
                <button
                  key={model}
                  onClick={() => setVoiceModel(model)}
                  className={`px-3 py-1.5 mono-xs ${
                    voiceModel === model ? 'bg-white text-black' : 'text-[#333]'
                  }`}
                >
                  {model}
                </button>
              ))}
            </div>
          </SettingRow>
        </div>

        {/* Screen Watch */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Monitor size={12} className="text-[#444]" />
            <span className="label">SCREEN WATCH</span>
          </div>
          <SettingRow label="Capture Interval">
            <div className="flex border border-[#1c1c1c]">
              {[
                { value: '15', label: '15s' },
                { value: '30', label: '30s' },
                { value: '60', label: '60s' },
                { value: 'off', label: 'off' }
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setScreenWatchInterval(opt.value)}
                  className={`px-3 py-1.5 mono-xs ${
                    screenWatchInterval === opt.value ? 'bg-white text-black' : 'text-[#333]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </SettingRow>
        </div>

        {/* Appearance */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Palette size={12} className="text-[#444]" />
            <span className="label">APPEARANCE</span>
          </div>
          <SettingRow label="Theme">
            <div className="flex border border-[#1c1c1c]">
              {['dark', 'light'].map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`px-3 py-1.5 mono-xs ${
                    theme === t ? 'bg-white text-black' : 'text-[#333]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </SettingRow>
        </div>

        {/* Startup */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Power size={12} className="text-[#444]" />
            <span className="label">STARTUP & BEHAVIOR</span>
          </div>
          <SettingRow label="Launch on login">
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
          </SettingRow>
          <SettingRow label="Minimize to tray">
            <button
              onClick={() => setMinimizeToTray(!minimizeToTray)}
              className={`w-10 h-5 border flex items-center px-0.5 transition-colors duration-120 ${
                minimizeToTray ? 'bg-white border-white' : 'bg-transparent border-[#1c1c1c]'
              }`}
            >
              <div className={`w-3.5 h-3.5 transition-all duration-120 ${
                minimizeToTray ? 'bg-black translate-x-[18px]' : 'bg-[#333] translate-x-0'
              }`} />
            </button>
          </SettingRow>
        </div>

        {/* Data */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Database size={12} className="text-[#444]" />
            <span className="label">DATA MANAGEMENT</span>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary text-[10px]">Clear memory</button>
            <button className="btn-secondary text-[10px]">Export history</button>
            <button className="btn-danger text-[10px]">Reset all habits</button>
          </div>
        </div>
      </div>
    </div>
  )
}
