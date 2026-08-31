import { describe, it, expect } from 'vitest'
import { recapToSpeak } from './useSpokenRecap'
import { spokenForm, MAX_SPOKEN_CHARS } from '../utils/voicePlayback'
import type { Message } from '../store/torchStore'

/**
 * What gets read aloud, and when.
 *
 * Two bugs live here. Messages arrive with empty content and stream in
 * character by character, so reading at arrival spoke nothing at all. And a
 * recap can carry a tool's raw output — a directory listing, a command's
 * result — which is the same mistake as reading a step list.
 */

function message(overrides: Partial<Message> & { speak?: boolean } = {}): Message & {
  speak?: boolean
} {
  return {
    id: 'm1',
    role: 'torch',
    content: 'Your file was moved.',
    timestamp: Date.now(),
    speak: true,
    ...overrides
  } as Message & { speak?: boolean }
}

describe('recapToSpeak', () => {
  it('picks a finished, speakable reply', () => {
    expect(recapToSpeak([message()], true, null)?.id).toBe('m1')
  })

  it('says nothing when the user has not opted in', () => {
    expect(recapToSpeak([message()], false, null)).toBeNull()
  })

  it('says nothing for a message the backend did not mark speakable', () => {
    // Plan messages are step lists. They must never be read out.
    expect(recapToSpeak([message({ speak: undefined })], true, null)).toBeNull()
  })

  it('waits for streamed text to arrive', () => {
    // The recap is added with empty content and filled in afterwards, so
    // reading at arrival speaks an empty string and nothing is heard.
    const streaming = message({ content: '', isStreaming: true })
    expect(recapToSpeak([streaming], true, null)).toBeNull()
  })

  it('speaks once the streamed text has settled', () => {
    const settled = message({ content: 'Your file was moved.', isStreaming: false })
    expect(recapToSpeak([settled], true, null)?.id).toBe('m1')
  })

  it('does not repeat a message it has already spoken', () => {
    expect(recapToSpeak([message()], true, 'm1')).toBeNull()
  })

  it('ignores the user’s own messages', () => {
    expect(recapToSpeak([message({ role: 'user' })], true, null)).toBeNull()
  })

  it('only considers the newest message', () => {
    const older = message({ id: 'old' })
    const newer = message({ id: 'new', speak: undefined })
    expect(recapToSpeak([older, newer], true, null)).toBeNull()
  })

  it('says nothing when there are no messages', () => {
    expect(recapToSpeak([], true, null)).toBeNull()
  })

  it('says nothing for a settled but empty reply', () => {
    expect(recapToSpeak([message({ content: '   ' })], true, null)).toBeNull()
  })
})

describe('spokenForm', () => {
  it('passes a short recap through unchanged', () => {
    expect(spokenForm('Your file was moved.')).toBe('Your file was moved.')
  })

  it('flattens whitespace so a wrapped sentence reads as one', () => {
    expect(spokenForm('Your file\n  was   moved.')).toBe('Your file was moved.')
  })

  it('returns nothing for empty input', () => {
    expect(spokenForm('   \n ')).toBe('')
  })

  it('cuts a long result down to its first sentence', () => {
    const listing = `I found the file. ${'name.txt '.repeat(80)}`
    const spoken = spokenForm(listing)

    expect(spoken).toBe('I found the file.')
  })

  it('never reads out a whole directory listing', () => {
    const listing = Array.from({ length: 60 }, (_, i) => `[DIR] folder-${i}`).join('\n')
    const spoken = spokenForm(listing)

    expect(spoken.length).toBeLessThanOrEqual(MAX_SPOKEN_CHARS + 1)
  })

  it('marks a hard cut so it does not sound like the sentence ended', () => {
    const spoken = spokenForm('x'.repeat(MAX_SPOKEN_CHARS + 50))
    expect(spoken.endsWith('…')).toBe(true)
  })
})
