import { create } from 'zustand'

// ─── TYPES ───

export type AgentStatus = 'idle' | 'listening' | 'processing' | 'executing' | 'speaking' | 'awaiting_approval'
export type InputMode = 'type' | 'voice' | 'heytorch'
export type StepStatus = 'pending' | 'active' | 'done' | 'failed' | 'hitl_required'

export interface Step {
  id: string
  label: string
  tool: string
  args: Record<string, unknown>
  status: StepStatus
  result?: string
  error?: string
  requiresApproval: boolean
}

export interface Message {
  id: string
  role: 'user' | 'torch' | 'system'
  content: string
  timestamp: number
  steps?: Step[]
  isTyping?: boolean
  reversible?: boolean
  undoState?: 'available' | 'undone' | 'expired'
  undoResult?: string
}

export interface Metrics {
  tasksCompleted: number
  tasksDelta: number
  timeSaved: number
  timeDelta: number
  actionsExecuted: number
  actionsDelta: number
  successRate: number
  successDelta: number
}

export interface TerminalLine {
  id: string
  timestamp: string
  content: string
  type: 'info' | 'success' | 'error' | 'warning' | 'hitl'
}
export interface Skill {
  id: string
  name: string
  command: string
  created_at: string
  run_count: number
}

export interface TorchState {
  // Agent
  agentStatus: AgentStatus
  setAgentStatus: (status: AgentStatus) => void

  // Input
  inputMode: InputMode
  setInputMode: (mode: InputMode) => void

  // Messages
  messages: Message[]
  addMessage: (msg: Message) => void
  updateMessage: (id: string, updates: Partial<Message>) => void
  updateStep: (messageId: string, stepId: string, updates: Partial<Step>) => void
  clearMessages: () => void

  // Metrics
  metrics: Metrics
  setMetrics: (metrics: Partial<Metrics>) => void

  // Terminal
  terminalLines: TerminalLine[]
  addTerminalLine: (line: TerminalLine) => void
  clearTerminal: () => void

  // Overlay
  overlayVisible: boolean
  setOverlayVisible: (visible: boolean) => void
  overlayStatus: 'idle' | 'listening' | 'processing' | 'speaking'
  setOverlayStatus: (status: 'idle' | 'listening' | 'processing' | 'speaking') => void
  overlayReply: string
  setOverlayReply: (reply: string) => void

  // Screen Watch
  screenWatchEnabled: boolean
  setScreenWatchEnabled: (enabled: boolean) => void

  // WebSocket
  wsConnected: boolean
  setWsConnected: (connected: boolean) => void

  // Onboarding
  onboardingComplete: boolean
  setOnboardingComplete: (complete: boolean) => void

  // Current task count (for sidebar badge)
  activeTaskCount: number
  setActiveTaskCount: (count: number) => void

  // Demo Mode
  demoMode: boolean
  setDemoMode: (val: boolean) => void

  // Settings tab
  activeSettingsTab: 'connections' | 'general'
  setActiveSettingsTab: (tab: 'connections' | 'general') => void

  // Warning banner
  showSettingsKeyBanner: boolean
  setShowSettingsKeyBanner: (show: boolean) => void

  // Skills
  skills: Skill[]
  setSkills: (skills: Skill[]) => void
  fetchSkills: () => Promise<void>
}

export const useTorchStore = create<TorchState>((set) => ({
  // Agent
  agentStatus: 'idle',
  setAgentStatus: (status): void => set({ agentStatus: status }),

  // Input
  inputMode: 'type',
  setInputMode: (mode): void => set({ inputMode: mode }),

  // Messages
  messages: [],
  addMessage: (msg): void =>
    set((state) => ({ messages: [...state.messages, msg] })),
  updateMessage: (id, updates): void =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      )
    })),
  updateStep: (messageId, stepId, updates): void =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId
          ? {
              ...m,
              steps: m.steps?.map((s) =>
                s.id === stepId ? { ...s, ...updates } : s
              )
            }
          : m
      )
    })),
  clearMessages: (): void => set({ messages: [] }),

  // Metrics (starts at 0 for new users)
  metrics: {
    tasksCompleted: 0,
    tasksDelta: 0,
    timeSaved: 0.0,
    timeDelta: 0.0,
    actionsExecuted: 0,
    actionsDelta: 0,
    successRate: 100,
    successDelta: 0
  },
  setMetrics: (updates): void =>
    set((state) => ({ metrics: { ...state.metrics, ...updates } })),

  // Terminal
  terminalLines: [],
  addTerminalLine: (line): void =>
    set((state) => ({ terminalLines: [...state.terminalLines, line] })),
  clearTerminal: (): void => set({ terminalLines: [] }),

  // Overlay
  overlayVisible: false,
  setOverlayVisible: (visible): void => set({ overlayVisible: visible }),
  overlayStatus: 'idle',
  setOverlayStatus: (status): void => set({ overlayStatus: status }),
  overlayReply: '',
  setOverlayReply: (reply): void => set({ overlayReply: reply }),

  // Screen Watch
  screenWatchEnabled: false,
  setScreenWatchEnabled: (enabled): void => set({ screenWatchEnabled: enabled }),

  // WebSocket
  wsConnected: false,
  setWsConnected: (connected): void => set({ wsConnected: connected }),

  // Onboarding
  onboardingComplete: localStorage.getItem('torch_onboarding_complete') === 'true',
  setOnboardingComplete: (complete): void => {
    localStorage.setItem('torch_onboarding_complete', String(complete))
    set({ onboardingComplete: complete })
  },

  // Tasks
  activeTaskCount: 0,
  setActiveTaskCount: (count): void => set({ activeTaskCount: count }),

  // Demo Mode — not persisted to localStorage, always starts fresh
  demoMode: false,
  setDemoMode: (val): void => set({ demoMode: val }),

  // Settings tab
  activeSettingsTab: 'connections',
  setActiveSettingsTab: (tab): void => set({ activeSettingsTab: tab }),

  // Warning banner
  showSettingsKeyBanner: false,
  setShowSettingsKeyBanner: (show): void => set({ showSettingsKeyBanner: show }),

  // Skills
  skills: [],
  setSkills: (skills): void => set({ skills }),
  fetchSkills: async (): Promise<void> => {
    const demoMode = useTorchStore.getState().demoMode
    if (demoMode) {
      const demoSkills: Skill[] = [
        {
          id: 'demo-1',
          name: 'Morning Briefing',
          command: 'Read recent emails, search the web for tech news, and output a summary',
          created_at: new Date().toISOString(),
          run_count: 5
        },
        {
          id: 'demo-2',
          name: 'Clean Downloads',
          command: 'Delete all temporary files from my downloads folder',
          created_at: new Date().toISOString(),
          run_count: 2
        }
      ]
      set({ skills: demoSkills })
      return
    }
    try {
      const response = await fetch('http://localhost:8000/api/skills')
      if (response.ok) {
        const data = await response.json()
        set({ skills: data })
      }
    } catch (err) {
      console.error('Error fetching skills:', err)
    }
  }
}))
