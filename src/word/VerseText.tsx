import type { VerseSpan } from './types.ts'

export function VerseText({ spans }: { spans: readonly VerseSpan[] }) {
  return (
    <>
      {spans.map((span, index) => {
        const className = [
          span.voice === 'jesus' ? 'speech' : undefined,
          span.lit ? 'verse-lit' : undefined,
          span.italic ? 'verse-supplied' : undefined,
        ]
          .filter(Boolean)
          .join(' ')
        const Tag = span.italic ? 'em' : 'span'
        return (
          <Tag key={index} className={className || undefined}>
            {span.text}
          </Tag>
        )
      })}
    </>
  )
}
