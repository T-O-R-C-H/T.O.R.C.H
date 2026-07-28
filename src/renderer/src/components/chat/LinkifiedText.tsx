interface LinkifiedTextProps {
  text: string
  className?: string
}

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi

export function LinkifiedText({ text, className }: LinkifiedTextProps): JSX.Element {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  const regex = new RegExp(URL_REGEX.source, URL_REGEX.flags)
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const url = match[0]
    parts.push(
      <a
        key={`${match.index}-${url}`}
        href={url}
        className="chat-link"
        onClick={(e) => {
          e.preventDefault()
          window.torchAPI?.openExternal(url)
        }}
      >
        {url}
      </a>
    )
    lastIndex = match.index + url.length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  if (parts.length === 0) {
    return <span className={className}>{text}</span>
  }

  return <span className={className}>{parts}</span>
}
