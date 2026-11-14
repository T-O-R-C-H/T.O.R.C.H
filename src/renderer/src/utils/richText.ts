/** Split reply text into paragraphs and lists; see components/chat/RichText.tsx. */
export type Block =
  | { kind: 'paragraph'; lines: string[] }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'numbers'; items: string[] }

const BULLET = /^\s*(?:[-*•])\s+(.*)$/
const NUMBERED = /^\s*\d{1,2}[.)]\s+(.*)$/

export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = []
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    const bullet = BULLET.exec(line)
    const numbered = bullet ? null : NUMBERED.exec(line)
    const last = blocks[blocks.length - 1]
    if (bullet) {
      if (last?.kind === 'bullets') last.items.push(bullet[1])
      else blocks.push({ kind: 'bullets', items: [bullet[1]] })
    } else if (numbered) {
      if (last?.kind === 'numbers') last.items.push(numbered[1])
      else blocks.push({ kind: 'numbers', items: [numbered[1]] })
    } else if (!line.trim()) {
      // A blank line ends whatever was open; the next text starts afresh.
      if (last && !(last.kind === 'paragraph' && last.lines.length === 0)) {
        blocks.push({ kind: 'paragraph', lines: [] })
      }
    } else if (last?.kind === 'paragraph') {
      last.lines.push(line)
    } else {
      blocks.push({ kind: 'paragraph', lines: [line] })
    }
  }
  return blocks.filter((block) => block.kind !== 'paragraph' || block.lines.length > 0)
}
