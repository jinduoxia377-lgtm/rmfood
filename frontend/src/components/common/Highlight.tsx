interface HighlightProps {
  text: string
  keyword: string
}

export function Highlight({ text, keyword }: HighlightProps) {
  if (!keyword.trim()) return <>{text}</>
  const parts = text.split(new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === keyword.toLowerCase()
          ? <mark key={i} className="bg-warning-200 dark:bg-warning-800/50 text-warning-900 dark:text-warning-200 rounded px-0.5">{part}</mark>
          : part,
      )}
    </>
  )
}
