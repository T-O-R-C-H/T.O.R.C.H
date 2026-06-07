import { HashRouter, Routes, Route } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { Topbar } from './components/layout/Topbar'
import { HeyTorch } from './components/overlay/HeyTorch'
import { useTorchStore } from './store/torchStore'

// Pages
import { Command } from './pages/Command'
import { Terminal } from './pages/Terminal'
import { ScreenWatch } from './pages/ScreenWatch'
import { History } from './pages/History'
import { Memory } from './pages/Memory'
import { Insights } from './pages/Insights'
import { Tasks } from './pages/Tasks'
import { Settings } from './pages/Settings'
import { Onboarding } from './pages/Onboarding'
import { Skills } from './pages/Skills'
import { WebSearch } from './pages/tools/WebSearch'
import { Files } from './pages/tools/Files'
import { Messaging } from './pages/tools/Messaging'
import { Browser } from './pages/tools/Browser'

function OverlayRoute(): JSX.Element {
  return (
    <div className="w-full h-full flex items-end justify-center pb-10 bg-transparent">
      <HeyTorch />
    </div>
  )
}

function AppLayout(): JSX.Element {
  return (
    <div className="w-full h-full flex bg-[#000]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <Routes>
          <Route path="/" element={<Command />} />
          <Route path="/chat" element={<Command />} />
          <Route path="/terminal" element={<Terminal />} />
          <Route path="/screenwatch" element={<ScreenWatch />} />
          <Route path="/history" element={<History />} />
          <Route path="/memory" element={<Memory />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/skills" element={<Skills />} />
          <Route path="/tools/search" element={<WebSearch />} />
          <Route path="/tools/files" element={<Files />} />
          <Route path="/tools/messaging" element={<Messaging />} />
          <Route path="/tools/browser" element={<Browser />} />
        </Routes>
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
        <Route path="/*" element={
          onboardingComplete ? <AppLayout /> : <Onboarding />
        } />
      </Routes>
    </HashRouter>
  )
}

export default App
