import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { Sidebar } from './components/layout/Sidebar'
import { Topbar } from './components/layout/Topbar'
import { UpdateNotice } from './components/layout/UpdateNotice'
import { Toaster } from './components/layout/Toaster'
import { GuidanceOverlay } from './components/overlay/GuidanceOverlay'
import { CommandPill } from './components/pill/CommandPill'
import { Companion } from './pages/Companion'
import { TaskPanel } from './components/pill/TaskPanel'
import { useTorchStore } from './store/torchStore'
import { useSpokenRecap } from './hooks/useSpokenRecap'
import { Command } from './pages/Command'
import { Today } from './pages/Today'
import { Terminal } from './pages/Terminal'
import { ScreenWatch } from './pages/ScreenWatch'
import { History } from './pages/History'
import { Memory } from './pages/Memory'
import { Insights } from './pages/Insights'
import { Settings } from './pages/Settings'
import { Onboarding } from './pages/Onboarding'
import { Skills } from './pages/Skills'
import { Clipboard } from './pages/Clipboard'
import { Inbox } from './pages/Inbox'
import ControlBorder from './pages/ControlBorder'

/** These windows are transparent: the page must not paint its own background. */
function TransparentRoute({ children }: { children: React.ReactNode }): JSX.Element {
  useEffect(() => {
    document.body.style.background = 'transparent'
    document.documentElement.style.background = 'transparent'
    return (): void => {
      document.body.style.background = ''
      document.documentElement.style.background = ''
    }
  }, [])
  return <>{children}</>
}

function GuidanceRoute(): JSX.Element {
  useEffect(() => {
    document.body.style.background = 'transparent'
    document.documentElement.style.background = 'transparent'
    return (): void => {
      document.body.style.background = ''
      document.documentElement.style.background = ''
    }
  }, [])
  return <GuidanceOverlay />
}

function AppLayout(): JSX.Element {
  // Reads the final recap aloud when the user has opted in.
  useSpokenRecap()

  return (
    /* The title bar spans the whole window, above the sidebar. A frameless
       window has no other drag handle, so it cannot sit in one column. */
    <div className="app-root">
      <Topbar />

      <div className="app-shell">
        <Sidebar />

        <div className="app-main">
          <UpdateNotice />

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
              <Route path="/insights" element={<Insights />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/skills" element={<Skills />} />
              <Route path="/tools/clipboard" element={<Clipboard />} />

              {/* Pages that were only ever shells (Files, Follow-ups, Web
                  Search, Browser, Messaging) are gone. An old link to one
                  lands on Chat, which is where those tasks are really done. */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
      </div>
      <Toaster />
    </div>
  )
}

function App(): JSX.Element {
  const onboardingComplete = useTorchStore((s) => s.onboardingComplete)

  return (
    <HashRouter>
      <Routes>
        <Route path="/guide" element={<GuidanceRoute />} />
        <Route
          path="/pill"
          element={
            <TransparentRoute>
              <CommandPill />
            </TransparentRoute>
          }
        />
        <Route
          path="/task-panel"
          element={
            <TransparentRoute>
              <TaskPanel />
            </TransparentRoute>
          }
        />
        <Route
          path="/companion"
          element={
            <TransparentRoute>
              <Companion />
            </TransparentRoute>
          }
        />
        <Route path="/control-border" element={<ControlBorder />} />
        <Route path="/*" element={onboardingComplete ? <AppLayout /> : <Onboarding />} />
      </Routes>
    </HashRouter>
  )
}

export default App
