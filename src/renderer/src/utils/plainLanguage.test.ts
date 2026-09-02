import { describe, it, expect } from 'vitest'
import { toPlainLanguage } from './plainLanguage'

/**
 * This is the last thing standing between a raw Python error and the chat.
 * Users of TORCH are not expected to have opened a terminal, so nothing
 * technical may survive this function.
 */

describe('recognised failures', () => {
  it.each([
    ['file not found: C:/Users/x/invoice.pdf', 'find'],
    ['PermissionError: access denied', 'permission'],
    ['ConnectionError: network unreachable', 'connection'],
    ['Invalid api key provided', 'Settings'],
    ['Cancelled by user', 'cancelled']
  ])('translates %s', (raw, expected) => {
    expect(toPlainLanguage(raw).toLowerCase()).toContain(expected.toLowerCase())
  })
})

describe('unknown tool', () => {
  // The backend translates this before sending; this is the backstop for any
  // path that skips translation.
  it.each(['Unknown tool: list_directory', 'ERROR: Unknown tool: send_fax', 'tool not registered'])(
    'translates %s',
    (raw) => {
      const result = toPlainLanguage(raw)
      expect(result.toLowerCase()).not.toContain('unknown tool')
      expect(result.toLowerCase()).not.toContain('tool not registered')
      expect(result).toContain("isn't something I know how to do")
    }
  )

  it('never leaks the tool name', () => {
    expect(toPlainLanguage('Unknown tool: list_directory')).not.toContain('list_directory')
  })
})

describe('technical output never reaches the user', () => {
  it.each([
    'Traceback (most recent call last):\n  File "main.py", line 42',
    'raise RuntimeError("boom")',
    'KeyError: tasks_completed',
    'line 88, in execute_plan'
  ])('sanitises %s', (raw) => {
    const result = toPlainLanguage(raw)
    expect(result).not.toContain('Traceback')
    expect(result).not.toContain('line ')
    expect(result.length).toBeLessThan(140)
  })
})

describe('empty input', () => {
  it.each([undefined, '', '   '])('falls back for %s', (raw) => {
    expect(toPlainLanguage(raw as string | undefined)).toBeTruthy()
  })
})

describe('plain messages pass through', () => {
  it('keeps an already-friendly message readable', () => {
    const result = toPlainLanguage('I found the file.')
    expect(result).toContain('found the file')
  })

  it('strips markdown emphasis', () => {
    expect(toPlainLanguage('I found **your** file.')).not.toContain('**')
  })
})

describe('a plain sentence survives, however long', () => {
  it('keeps a quota message that runs past the old 140-character limit', () => {
    // This exact sentence was being replaced by "Something went wrong on this
    // step", so the user never learned their allowance had run out.
    const recap =
      "I couldn't finish that. This AI model has run out of allowance on your plan. " +
      'Wait a minute and try again, or pick a different model in Settings.'

    expect(recap.length).toBeGreaterThan(140)
    expect(toPlainLanguage(recap)).toContain('run out of allowance')
  })

  it('still replaces a stack trace', () => {
    expect(toPlainLanguage('Traceback (most recent call last): File "x.py", line 3')).toBe(
      'Something went wrong on this step. Try rephrasing your request.'
    )
  })

  it('still replaces a raw error object', () => {
    expect(toPlainLanguage("503 UNAVAILABLE {'error': {'code': 503}}")).toBe(
      'Something went wrong on this step. Try rephrasing your request.'
    )
  })

  it('still replaces something genuinely enormous', () => {
    expect(toPlainLanguage('word '.repeat(200))).toBe(
      'Something went wrong on this step. Try rephrasing your request.'
    )
  })
})
