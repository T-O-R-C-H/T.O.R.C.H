import { useCallback, useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { AnimatePresence, motion, useScroll, useSpring } from 'motion/react'
import DownloadPage from './pages/DownloadPage'
import Home from './pages/Home'
import How from './pages/How'
import NotFound from './pages/NotFound'
import Privacy from './pages/Privacy'
import Safety from './pages/Safety'
import { EASE, Footer, Nav } from './ui'
import type { Route } from './ui'

const ROUTES: Route[] = ['/', '/how', '/safety', '/download', '/privacy']

const TITLES: Record<Route, string> = {
  '/': 'TORCH: the AI agent that uses your computer',
  '/how': 'How it works · TORCH',
  '/safety': 'Safety · TORCH',
  '/download': 'Download TORCH for Windows',
  '/privacy': 'Privacy · TORCH',
  '/404': 'Not found · TORCH'
}

function readRoute(): Route {
  const raw = window.location.hash.replace(/^#/, '')
  if (raw === '' || raw === '/') return '/'
  return (ROUTES as string[]).includes(raw) ? (raw as Route) : '/404'
}

function useRouter(): [Route, (to: Route) => void] {
  const [route, setRoute] = useState<Route>(readRoute)
  const routeRef = useRef(route)
  routeRef.current = route

  useEffect(() => {
    const onHash = (): void => setRoute(readRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    document.title = TITLES[route]
  }, [route])

  const go = useCallback((to: Route): void => {
    if (to === routeRef.current) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    window.location.hash = to
  }, [])

  return [route, go]
}

function Page({ route, go }: { route: Route; go: (to: Route) => void }): JSX.Element {
  switch (route) {
    case '/how':
      return <How go={go} />
    case '/safety':
      return <Safety go={go} />
    case '/download':
      return <DownloadPage />
    case '/privacy':
      return <Privacy />
    case '/404':
      return <NotFound go={go} />
    default:
      return <Home go={go} />
  }
}

export default function App(): JSX.Element {
  const [route, go] = useRouter()
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 180, damping: 30, mass: 0.3 })
  const first = useRef(true)
  useEffect(() => {
    first.current = false
  }, [])

  return (
    <>
      <motion.div className="progress" style={{ scaleX: progress }} aria-hidden="true" />
      <Nav route={route} go={go} />

      <AnimatePresence mode="wait" onExitComplete={() => window.scrollTo(0, 0)}>
        <motion.main
          key={route}
          id="main"
          className="page"
          initial={first.current ? false : { opacity: 0, y: 40, filter: 'blur(12px)' }}
          animate={{
            opacity: 1,
            y: 0,
            filter: 'blur(0px)',
            transition: { duration: 0.7, ease: EASE, delay: 0.25 }
          }}
          exit={{
            opacity: 0,
            y: -24,
            filter: 'blur(10px)',
            transition: { duration: 0.35, ease: EASE }
          }}
        >
          <Page route={route} go={go} />
        </motion.main>
      </AnimatePresence>

      {/* The curtain: a sheet with TORCH's mark wipes up between pages. */}
      <AnimatePresence>
        <motion.div
          key={`curtain-${route}`}
          className="curtain"
          initial={
            first.current ? { clipPath: 'inset(100% 0 0 0)' } : { clipPath: 'inset(100% 0 0 0)' }
          }
          animate={
            first.current
              ? { clipPath: 'inset(100% 0 0 0)' }
              : {
                  clipPath: ['inset(100% 0 0 0)', 'inset(0% 0 0 0)', 'inset(0 0 100% 0)'],
                  transition: { duration: 1.05, times: [0, 0.42, 1], ease: EASE }
                }
          }
          aria-hidden="true"
        >
          <motion.img
            src="icon.png"
            alt=""
            width="64"
            height="64"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={
              first.current
                ? {}
                : {
                    scale: [0.6, 1, 1.1],
                    opacity: [0, 1, 0],
                    transition: { duration: 1.05, times: [0, 0.45, 1] }
                  }
            }
          />
        </motion.div>
      </AnimatePresence>

      <Footer go={go} />
    </>
  )
}
