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
          ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-800/50 text-yellow-900 dark:text-yellow-200 rounded px-0.5">{part}</mark>
          : part,
      )}
    </>
  )
}
