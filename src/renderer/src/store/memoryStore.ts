import { create } from 'zustand'

export interface Habit {
  id: string
  action: string
  frequency: number
  lastOccurrence: number
  timeOfDay: string
  category: string
}

export interface Prediction {
  id: string
  label: string
  confidence: number
  action: string
  timeEstimate: string
}

export interface ActivityEntry {
  id: string
  timestamp: number
  app: string
  description: string
  screenshot?: string
}

export interface HistoryEntry {
  id: string
  command: string
  timestamp: number
  status: 'completed' | 'failed' | 'cancelled'
  stepsCount: number
  duration: number
  steps: { label: string; status: string }[]
}

export interface MemoryState {
  habits: Habit[]
  setHabits: (habits: Habit[]) => void

  predictions: Prediction[]
  setPredictions: (predictions: Prediction[]) => void

  activityLog: ActivityEntry[]
  addActivity: (entry: ActivityEntry) => void
  clearActivity: () => void

  history: HistoryEntry[]
  addHistory: (entry: HistoryEntry) => void
  setHistory: (history: HistoryEntry[]) => void
  clearHistory: () => void

  frequentCommands: { command: string; count: number }[]
  setFrequentCommands: (commands: { command: string; count: number }[]) => void

  frequentContacts: { name: string; count: number }[]
  setFrequentContacts: (contacts: { name: string; count: number }[]) => void

  frequentFiles: { path: string; count: number }[]
  setFrequentFiles: (files: { path: string; count: number }[]) => void
}

export const useMemoryStore = create<MemoryState>((set) => ({
  habits: [],
  setHabits: (habits): void => set({ habits }),

  predictions: [],
  setPredictions: (predictions): void => set({ predictions }),

  activityLog: [],
  addActivity: (entry): void => set((state) => ({ activityLog: [...state.activityLog, entry] })),
  clearActivity: (): void => set({ activityLog: [] }),

  history: [],
  addHistory: (entry): void => set((state) => ({ history: [entry, ...state.history] })),
  setHistory: (history): void => set({ history }),
  clearHistory: (): void => set({ history: [] }),

  frequentCommands: [],
  setFrequentCommands: (commands): void => set({ frequentCommands: commands }),

  frequentContacts: [],
  setFrequentContacts: (contacts): void => set({ frequentContacts: contacts }),

  frequentFiles: [],
  setFrequentFiles: (files): void => set({ frequentFiles: files })
}))
