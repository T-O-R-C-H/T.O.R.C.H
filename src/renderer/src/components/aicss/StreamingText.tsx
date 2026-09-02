import { useEffect, useMemo, useState } from 'react'
import styles from './StreamingText.module.css'
import { LinkifiedText } from '../chat/LinkifiedText'

/**
 * Reveals a reply as it arrives.
 *
 * Words fade in one after another rather than a caret typing characters. The
 * caret was a solid black block that sat at the end of every reply - and it
 * was rendered whether or not anything was still streaming, so a finished
 * message kept a cursor parked after its full stop.
 *
 * Fading by word also reads faster than character-by-character: the eye takes
 * a whole word at once, so the text arrives at reading speed instead of
 * typing speed.
 */

/** Gap between one word appearing and the next. */
const WORD_STAGGER_MS = 28

/**
 * Cap on the total reveal.
 *
 * A long reply would otherwise take its word count times the stagger, and
 * nobody wants to watch a paragraph arrive for six seconds. Past this the
 * stagger compresses so the whole thing still lands promptly.
 */
const MAX_REVEAL_MS = 1200

export function StreamingText({ text }: { text: string }): JSX.Element {
  const [revealed, setRevealed] = useState(false)

  /*
   * Split on whitespace but keep it, so the original spacing survives, and
   * work out each word's delay here rather than while rendering.
   */
  const parts = useMemo(() => {
    const pieces = text.split(/(\s+)/)
    const wordCount = pieces.filter((piece) => piece.trim()).length || 1
    const stagger = Math.min(WORD_STAGGER_MS, MAX_REVEAL_MS / wordCount)

    // Reduce rather than a running counter: the compiler rules out mutating
    // a variable during render, and this needs no mutation to say the same.
    return pieces.reduce<{ piece: string; isWord: boolean; delay: number }[]>((acc, piece) => {
      const isWord = Boolean(piece.trim())
      const wordsSoFar = acc.filter((entry) => entry.isWord).length
      acc.push({ piece, isWord, delay: isWord ? wordsSoFar * stagger : 0 })
      return acc
    }, [])
  }, [text])

  useEffect(() => {
    // A frame's delay lets the initial state paint, so the transition runs
    // rather than the text simply appearing already-visible.
    const id = window.requestAnimationFrame(() => setRevealed(true))
    return () => window.cancelAnimationFrame(id)
  }, [text])

  return (
    <p className={styles.prose}>
      {parts.map(({ piece, isWord, delay }, index) =>
        isWord ? (
          <span
            key={index}
            className={`${styles.word} ${revealed ? styles.wordIn : ''}`}
            style={{ transitionDelay: `${delay}ms` }}
          >
            <LinkifiedText text={piece} />
          </span>
        ) : (
          <span key={index}>{piece}</span>
        )
      )}
    </p>
  )
}
