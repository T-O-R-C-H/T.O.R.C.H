import styles from './StreamingText.module.css'
import { useEffect, useState } from 'react'
import { RichText } from '../chat/RichText'

export function StreamingText({ text }: { text: string }): JSX.Element {
  const [shown, setShown] = useState('')

  useEffect(() => {
    let i = 0
    const id = setInterval(() => {
      i += 2
      setShown(text.slice(0, i))
      if (i >= text.length) clearInterval(id)
    }, 9)
    return () => clearInterval(id)
  }, [text])

  const streaming = shown.length < text.length

  return (
    <div className={styles.prose}>
      <RichText text={shown} />
      <span className={streaming ? `${styles.caret} ${styles.caretSteady}` : styles.caret} />
    </div>
  )
}
