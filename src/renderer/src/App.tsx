import { HashRouter, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'

import { Sidebar } from './components/layout/Sidebar'

import { Topbar } from './components/layout/Topbar'

import { FloatingOverlay } from './components/overlay/FloatingOverlay'

import { useTorchStore } from './store/torchStore'

import { Command } from './pages/Command'

import { Today } from './pages/Today'

import { Terminal } from './pages/Terminal'

import { ScreenWatch } from './pages/ScreenWatch'

import { History } from './pages/History'

import { Memory } from './pages/Memory'

import { Insights } from './pages/Insights'

import { Tasks } from './pages/Tasks'

import { Settings } from './pages/Settings'

import { Onboarding } from './pages/Onboarding'

import { Skills } from './pages/Skills'

import { Clipboard } from './pages/Clipboard'

import { Inbox } from './pages/Inbox'

import { FollowUps } from './pages/FollowUps'

import { WebSearch } from './pages/tools/WebSearch'

import { Files } from './pages/tools/Files'

import { Messaging } from './pages/tools/Messaging'

import { Browser } from './pages/tools/Browser'

function OverlayRoute(): JSX.Element {
  useEffect(() => {
    document.body.style.background = 'transparent'
    document.documentElement.style.background = 'transparent'
    return (): void => {
      document.body.style.background = ''
      document.documentElement.style.background = ''
    }
  }, [])

  return (
    <div className="overlay-shell">
      <FloatingOverlay />
    </div>
  )
}

function AppLayout(): JSX.Element {
  return (
    <div className="app-shell">
      <Sidebar />

      <div className="app-main">
        <Topbar />

        <div className="app-routes">
          <Routes>
            <Route path="/" element={<Command />} />

            <Route path="/chat" element={<Command />} />

            <Route path="/today" element={<Today />} />

            <Route path="/terminal" element={<Terminal />} />

            <Route path="/screenwatch" element={<ScreenWatch />} />

            <Route path="/history" element={<History />} />

            <Route path="/memory" element={<Memory />} />

            <Route path="/inbox" element={<Inbox />} />

            <Route path="/follow-ups" element={<FollowUps />} />

            <Route path="/insights" element={<Insights />} />

            <Route path="/tasks" element={<Tasks />} />

            <Route path="/settings" element={<Settings />} />

            <Route path="/skills" element={<Skills />} />

            <Route path="/tools/clipboard" element={<Clipboard />} />

            <Route path="/tools/search" element={<WebSearch />} />

            <Route path="/tools/files" element={<Files />} />

            <Route path="/tools/messaging" element={<Messaging />} />

            <Route path="/tools/browser" element={<Browser />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}

function App(): JSX.Element {
  const onboardingComplete = useTorchStore((s) => s.onboardingComplete)

  return (
    <HashRouter>
      <Routes>
        <Route path="/overlay" element={<OverlayRoute />} />

        <Route path="/*" element={onboardingComplete ? <AppLayout /> : <Onboarding />} />
      </Routes>
    </HashRouter>
  )
}

export default App
