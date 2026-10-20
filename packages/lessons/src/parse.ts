import { Array, Option, pipe, Schema, String } from 'effect'

import {
  type Block,
  Example,
  type Lesson,
  type LedgerRow,
  Level,
  MessageChannel,
  type Question,
  type Segment,
} from './lesson.ts'

/**
 * A lesson is a Markdown file with front matter. Prose paragraphs, lists,
 * `## headings`, and `> [!tip]` callouts go on the left. A fenced block
 * (`ledger`, `message`, or `table`) goes on the right, beside the prose
 * before it. `quiz` and `takeaways` blocks collect at the end of the page.
 * See docs/authoring-lessons.md for the full format.
 */
export class LessonError extends Error {
  readonly key: string
  readonly problem: string
  constructor({
    key,
    problem,
  }: {
    readonly key: string
    readonly problem: string
  }) {
    super(`${key}: ${problem}`)
    this.name = 'LessonError'
    this.key = key
    this.problem = problem
  }
}

const FrontMatter = Schema.Struct({
  title: Schema.NonEmptyString,
  level: Level,
  summary: Schema.NonEmptyString,
  tool: Schema.optionalKey(Schema.NonEmptyString),
})

const frontMatterPattern = /^---\n([\s\S]*?)\n---\n/u

const parseFrontMatter = (key: string, block: string) => {
  const fields = Object.fromEntries(
    Array.flatMap(block.split('\n'), (line) => {
      const match = /^(\w+):\s*(.*)$/u.exec(line)
      return match === null
        ? []
        : [[match[1] ?? '', (match[2] ?? '').trim()] as const]
    }),
  )
  return Schema.decodeUnknownOption(FrontMatter)(fields).pipe(
    Option.getOrThrowWith(
      () =>
        new LessonError({
          key,
          problem:
            'front matter needs title, level (starter, next-step, deep-dive), and summary',
        }),
    ),
  )
}

// CHUNKS

type Chunk =
  | { readonly _tag: 'Prose'; readonly lines: ReadonlyArray<string> }
  | {
      readonly _tag: 'Fence'
      readonly kind: string
      readonly title: string
      readonly lines: ReadonlyArray<string>
    }

type ChunkState = {
  readonly chunks: ReadonlyArray<Chunk>
  readonly maybeFence: Option.Option<Extract<Chunk, { _tag: 'Fence' }>>
}

const fencePattern = /^```(\w[\w-]*)?\s*(.*)$/u

const appendProseLine = (chunks: ReadonlyArray<Chunk>, line: string) =>
  Option.match(Array.last(chunks), {
    onSome: (last) =>
      last._tag === 'Prose'
        ? Array.append(Array.dropRight(chunks, 1), {
            _tag: 'Prose' as const,
            lines: Array.append(last.lines, line),
          })
        : Array.append(chunks, { _tag: 'Prose' as const, lines: [line] }),
    onNone: () => [{ _tag: 'Prose' as const, lines: [line] }],
  })

/** Splits the body into fenced blocks and blank-line separated paragraphs. */
const chunksOf = (key: string, body: string): ReadonlyArray<Chunk> => {
  const final = Array.reduce(
    body.split('\n'),
    { chunks: [], maybeFence: Option.none() } as ChunkState,
    (state, line): ChunkState =>
      Option.match(state.maybeFence, {
        onSome: (fence) =>
          line.trim() === '```'
            ? {
                chunks: Array.append(state.chunks, fence),
                maybeFence: Option.none(),
              }
            : {
                chunks: state.chunks,
                maybeFence: Option.some({
                  ...fence,
                  lines: Array.append(fence.lines, line),
                }),
              },
        onNone: () => {
          const fence = fencePattern.exec(line.trim())
          if (fence !== null) {
            return {
              chunks: state.chunks,
              maybeFence: Option.some({
                _tag: 'Fence',
                kind: fence[1] ?? '',
                title: (fence[2] ?? '').trim(),
                lines: [],
              }),
            }
          }
          if (String.isEmpty(line.trim())) {
            return {
              chunks: Array.append(state.chunks, { _tag: 'Prose', lines: [] }),
              maybeFence: Option.none(),
            }
          }
          return {
            chunks: appendProseLine(state.chunks, line),
            maybeFence: Option.none(),
          }
        },
      }),
  )
  if (Option.isSome(final.maybeFence)) {
    throw new LessonError({
      key,
      problem: `a \`\`\`${final.maybeFence.value.kind} block is never closed`,
    })
  }
  return Array.filter(
    final.chunks,
    (chunk) =>
      chunk._tag === 'Fence' || Array.isReadonlyArrayNonEmpty(chunk.lines),
  )
}

// PROSE

const joinLines = (lines: ReadonlyArray<string>) =>
  lines
    .map((line) => line.trim())
    .join(' ')
    .replace(/\s+/gu, ' ')
    .trim()

const listItems = (lines: ReadonlyArray<string>, marker: RegExp) =>
  Array.reduce(lines, Array.empty<string>(), (items, line) =>
    marker.test(line)
      ? Array.append(items, line.replace(marker, '').trim())
      : Option.match(Array.last(items), {
          onNone: () => [line.trim()],
          onSome: (last) =>
            Array.append(Array.dropRight(items, 1), `${last} ${line.trim()}`),
        }),
  )

const bullet = /^\s*[-*]\s+/u
const numbered = /^\s*\d+\.\s+/u
const calloutTone = /^\[!(note|tip|warning)\]\s*/iu

const proseBlock = (lines: ReadonlyArray<string>): Block => {
  const first = lines[0] ?? ''
  if (first.startsWith('#')) {
    return {
      _tag: 'Heading',
      text: joinLines([first.replace(/^#+\s*/u, ''), ...lines.slice(1)]),
    }
  }
  if (bullet.test(first)) {
    return { _tag: 'List', isOrdered: false, items: listItems(lines, bullet) }
  }
  if (numbered.test(first)) {
    return { _tag: 'List', isOrdered: true, items: listItems(lines, numbered) }
  }
  if (first.startsWith('>')) {
    const text = joinLines(lines.map((line) => line.replace(/^>\s?/u, '')))
    const tone = calloutTone.exec(text)
    return {
      _tag: 'Callout',
      tone:
        tone === null
          ? 'note'
          : ((tone[1] ?? 'note').toLowerCase() as 'note' | 'tip' | 'warning'),
      text: text.replace(calloutTone, ''),
    }
  }
  return { _tag: 'Paragraph', text: joinLines(lines) }
}

// LEDGERS

const moneyPattern = /^-?\$?\d{1,3}(?:,\d{3})*(?:\.\d+)?$|^-?\$?\d+(?:\.\d+)?$/u

/** `$1,234.50` is 1234.5; anything that is not plain money is not an amount. */
export const parseMoney = (value: string): Option.Option<number> =>
  moneyPattern.test(value.trim())
    ? Option.some(Number(value.trim().replace(/[$,]/gu, '')))
    : Option.none()

const markerKinds: Record<string, LedgerRow['kind']> = {
  '+': 'add',
  '-': 'subtract',
  '=': 'total',
  '~': 'info',
}

const ledgerRow = (key: string, line: string): LedgerRow => {
  const trimmed = line.trim()
  if (trimmed.startsWith('#')) {
    return { kind: 'note', label: trimmed.replace(/^#\s*/u, ''), value: '' }
  }
  const marker = /^([+\-=~])\s+/u.exec(trimmed)
  const rest = marker === null ? trimmed : trimmed.slice(marker[0].length)
  const [label = '', value = '', ...extra] = rest
    .split('|')
    .map((part) => part.trim())
  if (String.isEmpty(label) || Array.isArrayNonEmpty(extra)) {
    throw new LessonError({
      key,
      problem: `ledger row "${trimmed}" should be "Label | value"`,
    })
  }
  const isMoney = Option.isSome(parseMoney(value))
  const kind = Option.match(Option.fromNullishOr(marker?.[1]), {
    onNone: () => (isMoney ? 'amount' : 'info'),
    onSome: (symbol) => markerKinds[symbol] ?? 'info',
  })
  if (kind !== 'amount' && kind !== 'info' && !isMoney) {
    throw new LessonError({
      key,
      problem: `ledger row "${trimmed}" needs a dollar amount after "|"`,
    })
  }
  return { kind, label, value }
}

const cents = (amount: number) => Math.round(amount * 100)

/**
 * Plain and `+` rows add to a running total, `-` rows subtract, and every `=`
 * row must equal the running total to the cent. A worked example that does
 * not add up fails the build.
 */
export const checkLedger = (
  key: string,
  title: string,
  rows: ReadonlyArray<LedgerRow>,
) => {
  Array.reduce(rows, 0, (running, row) => {
    const amount = cents(Option.getOrElse(parseMoney(row.value), () => 0))
    if (row.kind === 'amount' || row.kind === 'add') {
      return running + amount
    }
    if (row.kind === 'subtract') {
      return running - amount
    }
    if (row.kind === 'total' && amount !== running) {
      throw new LessonError({
        key,
        problem: `ledger "${title}": "${row.label}" says ${row.value}, but the rows above add up to ${(running / 100).toFixed(2)}`,
      })
    }
    return running
  })
}

// FENCED BLOCKS

const fieldPattern = /^(from|subject|channel):\s*(.*)$/iu

const messageExample = (
  key: string,
  title: string,
  lines: ReadonlyArray<string>,
): Example => {
  const fields = Object.fromEntries(
    Array.flatMap(lines, (line) => {
      const match = fieldPattern.exec(line.trim())
      return match === null
        ? []
        : [[(match[1] ?? '').toLowerCase(), (match[2] ?? '').trim()] as const]
    }),
  )
  const channel = Schema.decodeUnknownOption(MessageChannel)(
    fields['channel'] ?? 'text',
  )
  if (Option.isNone(channel) || fields['from'] === undefined) {
    throw new LessonError({
      key,
      problem: `message "${title}" needs "From:" and a channel of text, email, dm, or call`,
    })
  }
  const content = Array.filter(lines, (line) => !fieldPattern.test(line.trim()))
  return Example.cases.Message.make({
    title,
    channel: channel.value,
    from: fields['from'],
    subject: fields['subject'] ?? '',
    body: pipe(
      content,
      Array.filter((line) => !line.trim().startsWith('!')),
      Array.map((line) => line.trim()),
      Array.dropWhile(String.isEmpty),
      (body) =>
        Array.reverse(Array.dropWhile(Array.reverse(body), String.isEmpty)),
    ),
    flags: pipe(
      content,
      Array.filter((line) => line.trim().startsWith('!')),
      Array.map((line) => line.trim().replace(/^!+\s*/u, '')),
    ),
  })
}

const tableExample = (
  key: string,
  title: string,
  lines: ReadonlyArray<string>,
): Example => {
  const rows = pipe(
    lines,
    Array.filter(
      (line) =>
        !String.isEmpty(line.trim()) && !/^\|?\s*-[-|\s]*$/u.test(line.trim()),
    ),
    Array.map((line) =>
      line
        .trim()
        .replace(/^\||\|$/gu, '')
        .split('|')
        .map((cell) => cell.trim()),
    ),
  )
  const [header, ...body] = rows
  if (header === undefined || Array.isArrayEmpty(body)) {
    throw new LessonError({
      key,
      problem: `table "${title}" needs a header row and a body`,
    })
  }
  if (body.some((row) => row.length !== header.length)) {
    throw new LessonError({
      key,
      problem: `table "${title}": every row needs ${header.length} cells`,
    })
  }
  return Example.cases.Table.make({ title, header, rows: body })
}

const ledgerExample = (
  key: string,
  title: string,
  lines: ReadonlyArray<string>,
): Example => {
  const rows = pipe(
    lines,
    Array.filter((line) => !String.isEmpty(line.trim())),
    Array.map((line) => ledgerRow(key, line)),
  )
  checkLedger(key, title, rows)
  return Example.cases.Ledger.make({ title, rows })
}

const quizQuestions = (
  key: string,
  lines: ReadonlyArray<string>,
): ReadonlyArray<Question> => {
  type Draft = {
    prompt: string
    options: ReadonlyArray<string>
    answers: ReadonlyArray<number>
    explanation: string
  }
  const drafts = Array.reduce(lines, Array.empty<Draft>(), (drafts, raw) => {
    const line = raw.trim()
    if (line.startsWith('?')) {
      return Array.append(drafts, {
        prompt: line.slice(1).trim(),
        options: [],
        answers: [],
        explanation: '',
      })
    }
    return Option.match(Array.last(drafts), {
      onNone: () => drafts,
      onSome: (draft) => {
        const replaceLast = (next: Draft) =>
          Array.append(Array.dropRight(drafts, 1), next)
        if (line.startsWith('+') || line.startsWith('-')) {
          return replaceLast({
            ...draft,
            options: Array.append(draft.options, line.slice(1).trim()),
            answers: line.startsWith('+')
              ? Array.append(draft.answers, draft.options.length)
              : draft.answers,
          })
        }
        if (line.startsWith('>')) {
          return replaceLast({
            ...draft,
            explanation: `${draft.explanation} ${line.slice(1).trim()}`.trim(),
          })
        }
        return drafts
      },
    })
  })
  return Array.map(drafts, (draft) => {
    const [answer] = draft.answers
    if (
      answer === undefined ||
      draft.answers.length !== 1 ||
      draft.options.length < 2 ||
      String.isEmpty(draft.explanation)
    ) {
      throw new LessonError({
        key,
        problem: `quiz question "${draft.prompt}" needs 2+ options, exactly one "+" answer, and a "> explanation"`,
      })
    }
    return {
      prompt: draft.prompt,
      options: draft.options,
      answer,
      explanation: draft.explanation,
    }
  })
}

// SEGMENTS

type Body = {
  readonly segments: ReadonlyArray<Segment>
  readonly takeaways: ReadonlyArray<string>
  readonly quiz: ReadonlyArray<Question>
}

const withProse = (segments: ReadonlyArray<Segment>, block: Block) =>
  Option.match(Array.last(segments), {
    onSome: (last) =>
      Option.isNone(last.maybeExample)
        ? Array.append(Array.dropRight(segments, 1), {
            prose: Array.append(last.prose, block),
            maybeExample: Option.none(),
          })
        : Array.append(segments, {
            prose: [block],
            maybeExample: Option.none(),
          }),
    onNone: () => [{ prose: [block], maybeExample: Option.none() }],
  })

const withExample = (segments: ReadonlyArray<Segment>, example: Example) =>
  Option.match(Array.last(segments), {
    onSome: (last) =>
      Option.isNone(last.maybeExample)
        ? Array.append(Array.dropRight(segments, 1), {
            prose: last.prose,
            maybeExample: Option.some(example),
          })
        : Array.append(segments, {
            prose: [],
            maybeExample: Option.some(example),
          }),
    onNone: () => [{ prose: [], maybeExample: Option.some(example) }],
  })

const parseBody = (key: string, body: string): Body =>
  Array.reduce(
    chunksOf(key, body),
    { segments: [], takeaways: [], quiz: [] } as Body,
    (state, chunk): Body => {
      if (chunk._tag === 'Prose') {
        return {
          ...state,
          segments: withProse(state.segments, proseBlock(chunk.lines)),
        }
      }
      const withSegmentExample = (example: Example): Body => ({
        ...state,
        segments: withExample(state.segments, example),
      })
      if (chunk.kind === 'ledger') {
        return withSegmentExample(ledgerExample(key, chunk.title, chunk.lines))
      }
      if (chunk.kind === 'message') {
        return withSegmentExample(messageExample(key, chunk.title, chunk.lines))
      }
      if (chunk.kind === 'table') {
        return withSegmentExample(tableExample(key, chunk.title, chunk.lines))
      }
      if (chunk.kind === 'quiz') {
        return {
          ...state,
          quiz: [...state.quiz, ...quizQuestions(key, chunk.lines)],
        }
      }
      if (chunk.kind === 'takeaways') {
        return {
          ...state,
          takeaways: [
            ...state.takeaways,
            ...listItems(
              Array.filter(chunk.lines, (line) => !String.isEmpty(line.trim())),
              bullet,
            ),
          ],
        }
      }
      throw new LessonError({
        key,
        problem: `unknown block \`\`\`${chunk.kind}; use ledger, message, table, quiz, or takeaways`,
      })
    },
  )

/** `paystubs.md` is the lesson `paystubs`. */
export const lessonFile = (fileName: string): Option.Option<string> =>
  fileName.endsWith('.md')
    ? Option.some(fileName.slice(0, -'.md'.length))
    : Option.none()

export const parseLesson = (
  topic: string,
  slug: string,
  source: string,
  isTool: (id: string) => boolean = () => true,
): Lesson => {
  const key = `${topic}/${slug}`
  const normalized = source.replace(/\r\n/gu, '\n')
  const frontMatter = frontMatterPattern.exec(normalized)
  if (frontMatter === null) {
    throw new LessonError({ key, problem: 'missing --- front matter ---' })
  }
  const header = parseFrontMatter(key, frontMatter[1] ?? '')
  if (header.tool !== undefined && !isTool(header.tool)) {
    throw new LessonError({ key, problem: `unknown tool "${header.tool}"` })
  }
  const body = parseBody(key, normalized.slice(frontMatter[0].length))
  if (Array.isReadonlyArrayEmpty(body.segments)) {
    throw new LessonError({ key, problem: 'has no prose' })
  }
  return {
    topic,
    slug,
    title: header.title,
    level: header.level,
    summary: header.summary,
    segments: body.segments,
    takeaways: body.takeaways,
    quiz: body.quiz,
    maybeTool: Option.fromNullishOr(header.tool),
  }
}
