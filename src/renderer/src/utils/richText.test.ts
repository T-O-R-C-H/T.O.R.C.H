import { describe, expect, it } from 'vitest'
import { parseBlocks } from './richText'

describe('reply layout', () => {
  it('turns bullet and numbered lines into lists and keeps paragraphs apart', () => {
    const blocks = parseBlocks(
      'I can help with:\n- files\n- email\n\nSteps:\n1. Open it\n2. Save it\n\nAnything else?'
    )
    expect(blocks.map((block) => block.kind)).toEqual([
      'paragraph',
      'bullets',
      'paragraph',
      'numbers',
      'paragraph'
    ])
    expect(blocks[1]).toEqual({ kind: 'bullets', items: ['files', 'email'] })
    expect(blocks[3]).toEqual({ kind: 'numbers', items: ['Open it', 'Save it'] })
  })

  it('treats a plain sentence as one paragraph', () => {
    expect(parseBlocks('The Calculator shows 1,000.')).toEqual([
      { kind: 'paragraph', lines: ['The Calculator shows 1,000.'] }
    ])
  })
})
