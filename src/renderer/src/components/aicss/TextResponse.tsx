import styles from './TextResponse.module.css'
import type { ReactNode } from 'react'

export function TextResponse({ children }: { children?: ReactNode }): JSX.Element {
  return <div className={styles.prose}>{children}</div>
}