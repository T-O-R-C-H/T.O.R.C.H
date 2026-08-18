import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { AgentStatus } from '../../store/torchStore'
import { useTorchStore } from '../../store/torchStore'
import { Orb, type OrbVariant } from '../aicss/Orb'
import styles from './ActivityOverlay.module.css'

const SLOW_THRESHOLD_MS = 8000

function isBusy(status: AgentStatus): boolean {
  return (
    status === 'processing' ||
    status === 'executing' ||
    status === 'listening' ||
    status === 'speaking'
  )
}

function orbVariant(status: AgentStatus, slow: boolean): OrbVariant {
  if (slow) return 'S5'
  switch (status) {
    case 'processing':
      return 'S1'
    case 'executing':
      return 'S3'
    case 'listening':
      return 'C2'
    case 'speaking':
      return 'C3'
    default:
      return 'S2'
  }
}

function shortLabel(status: AgentStatus, slow: boolean): string {
  if (slow) return 'Still working…'
  switch (status) {
    case 'processing':
      return 'Working…'
    case 'executing':
      return 'Planning…'
    case 'listening':
      return 'Listening…'
    case 'speaking':
      return 'Speaking…'
    default:
      return 'Working…'
  }
}

function BusyPill({ status }: { status: AgentStatus }): JSX.Element {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_THRESHOLD_MS)
    return () => clearTimeout(timer)
  }, [])

  return (
    <motion.div
      className={styles.pill}
      initial={{ opacity: 0, y: 8, scale: 0.96, filter: 'blur(3px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: 6, scale: 0.97, filter: 'blur(2px)' }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      <Orb variant={orbVariant(status, slow)} size={20} pill label={shortLabel(status, slow)} />
    </motion.div>
  )
}

export function ActivityOverlay(): JSX.Element {
  const status = useTorchStore((s) => s.agentStatus)
  const busy = isBusy(status)

  return (
    <div className={styles.overlay}>
      <AnimatePresence>{busy && <BusyPill key={status} status={status} />}</AnimatePresence>
    </div>
  )
}
