import { Array, Option, pipe } from 'effect'

/** A run of prose text: plain, **strong**, *emphasis*, or a [link](https://…). */
export type Span =
  | { readonly _tag: 'Text'; readonly text: string }
  | { readonly _tag: 'Strong'; readonly text: string }
  | { readonly _tag: 'Emphasis'; readonly text: string }
  | { readonly _tag: 'Link'; readonly text: string; readonly href: string }

const inlinePattern =
  /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/gu

const spanOf = (match: RegExpMatchArray): Span => {
  const [, strong, emphasis, linkText, href] = match
  if (strong !== undefined) {
    return { _tag: 'Strong', text: strong }
  }
  if (emphasis !== undefined) {
    return { _tag: 'Emphasis', text: emphasis }
  }
  return { _tag: 'Link', text: linkText ?? '', href: href ?? '' }
}

export const parseInline = (text: string): ReadonlyArray<Span> => {
  const matches = [...text.matchAll(inlinePattern)]
  const ends = Array.map(
    matches,
    (match) => (match.index ?? 0) + match[0].length,
  )
  return pipe(
    matches,
    Array.flatMap((match, index): ReadonlyArray<Span> => {
      const start = index === 0 ? 0 : (ends[index - 1] ?? 0)
      const before = text.slice(start, match.index ?? 0)
      return [
        ...(before === '' ? [] : [{ _tag: 'Text' as const, text: before }]),
        spanOf(match),
      ]
    }),
    (spans) => {
      const rest = text.slice(Option.getOrElse(Array.last(ends), () => 0))
      return rest === ''
        ? spans
        : [...spans, { _tag: 'Text' as const, text: rest }]
    },
  )
}

/** The words of a prose text without its markup, for search and summaries. */
export const plainText = (text: string) =>
  parseInline(text)
    .map((span) => span.text)
    .join('')
