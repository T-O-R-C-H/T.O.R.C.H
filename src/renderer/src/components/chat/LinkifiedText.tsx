interface LinkifiedTextProps {
  text: string
  className?: string
}

const RICH_TEXT_REGEX = /\*\*([^*\n]+)\*\*|https?:\/\/[^\s<>"{}|\\^`[\]]+/gi

export function LinkifiedText({ text, className }: LinkifiedTextProps): JSX.Element {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  const regex = new RegExp(RICH_TEXT_REGEX.source, RICH_TEXT_REGEX.flags)
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const token = match[0]
    if (match[1]) {
      parts.push(<strong key={`bold-${match.index}`}>{match[1]}</strong>)
    } else {
      parts.push(
        <a
          key={`${match.index}-${token}`}
          href={token}
          className="chat-link"
          onClick={(e) => {
            e.preventDefault()
            window.torchAPI?.openExternal(token)
          }}
        >
          {token}
        </a>
      )
    }
    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  if (parts.length === 0) {
    return <span className={className}>{text}</span>
  }

  return <span className={className}>{parts}</span>
}
