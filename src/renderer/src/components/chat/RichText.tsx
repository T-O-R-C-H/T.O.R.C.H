import { LinkifiedText } from './LinkifiedText'
import { parseBlocks } from '../../utils/richText'

/**
 * A reply laid out the way a person would write it: paragraphs, bulleted
 * and numbered lists, bold, and links.
 *
 * Replies used to be one pre-wrapped block, so a list of what TORCH can do
 * read as a single run-on paragraph with bullet characters in it. Nothing
 * here interprets HTML: text is split on line structure only.
 */
export function RichText({ text, className }: { text: string; className?: string }): JSX.Element {
  const blocks = parseBlocks(text)
  return (
    <div className={'rich-text' + (className ? ' ' + className : '')}>
      {blocks.map((block, index) => {
        if (block.kind === 'bullets') {
          return (
            <ul key={index}>
              {block.items.map((item, j) => (
                <li key={j} style={{ ['--i' as string]: j }}>
                  <LinkifiedText text={item} />
                </li>
              ))}
            </ul>
          )
        }
        if (block.kind === 'numbers') {
          return (
            <ol key={index}>
              {block.items.map((item, j) => (
                <li key={j} style={{ ['--i' as string]: j }}>
                  <LinkifiedText text={item} />
                </li>
              ))}
            </ol>
          )
        }
        return (
          <p key={index}>
            {block.lines.map((line, j) => (
              <span key={j}>
                {j > 0 && <br />}
                <LinkifiedText text={line} />
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
}
