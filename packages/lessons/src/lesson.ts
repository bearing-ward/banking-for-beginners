import { Schema } from 'effect'

export const Level = Schema.Literals(['starter', 'next-step', 'deep-dive'])
export type Level = typeof Level.Type

export const levelLabel: Record<Level, string> = {
  starter: 'starter',
  'next-step': 'next step',
  'deep-dive': 'deep dive',
}

// PROSE

/** Prose on the left. Text keeps its inline markup; see `parseInline`. */
export const Block = Schema.TaggedUnion({
  Paragraph: { text: Schema.String },
  Heading: { text: Schema.String },
  List: { isOrdered: Schema.Boolean, items: Schema.Array(Schema.String) },
  Callout: {
    tone: Schema.Literals(['note', 'tip', 'warning']),
    text: Schema.String,
  },
})
export type Block = typeof Block.Type

// EXAMPLES

export const LedgerRowKind = Schema.Literals([
  'amount',
  'add',
  'subtract',
  'total',
  'info',
  'note',
])
export type LedgerRowKind = typeof LedgerRowKind.Type

export const LedgerRow = Schema.Struct({
  kind: LedgerRowKind,
  label: Schema.String,
  value: Schema.String,
})
export type LedgerRow = typeof LedgerRow.Type

export const MessageChannel = Schema.Literals(['text', 'email', 'dm', 'call'])
export type MessageChannel = typeof MessageChannel.Type

/** What sits on the right of a segment: the worked example the prose explains. */
export const Example = Schema.TaggedUnion({
  Ledger: { title: Schema.String, rows: Schema.Array(LedgerRow) },
  Message: {
    title: Schema.String,
    channel: MessageChannel,
    from: Schema.String,
    subject: Schema.String,
    body: Schema.Array(Schema.String),
    flags: Schema.Array(Schema.String),
  },
  Table: {
    title: Schema.String,
    header: Schema.Array(Schema.String),
    rows: Schema.Array(Schema.Array(Schema.String)),
  },
})
export type Example = typeof Example.Type

export const Segment = Schema.Struct({
  prose: Schema.Array(Block),
  maybeExample: Schema.OptionFromNullOr(Example),
})
export type Segment = typeof Segment.Type

export const Question = Schema.Struct({
  prompt: Schema.String,
  options: Schema.Array(Schema.String),
  answer: Schema.Number,
  explanation: Schema.String,
})
export type Question = typeof Question.Type

// LESSONS

/** What lists and links need: everything from the front matter, no body. */
export const LessonSummary = Schema.Struct({
  topic: Schema.String,
  slug: Schema.String,
  title: Schema.String,
  level: Level,
  summary: Schema.String,
})
export type LessonSummary = typeof LessonSummary.Type

export const Lesson = Schema.Struct({
  ...LessonSummary.fields,
  segments: Schema.Array(Segment),
  takeaways: Schema.Array(Schema.String),
  quiz: Schema.Array(Question),
  maybeTool: Schema.OptionFromNullOr(Schema.String),
})
export type Lesson = typeof Lesson.Type

/** Dates readers see on a page: first added, last changed, last checked. */
export const LessonHistory = Schema.Struct({
  key: Schema.String,
  added: Schema.String,
  updated: Schema.String,
  checked: Schema.String,
  rules: Schema.String,
})
export type LessonHistory = typeof LessonHistory.Type

/** Everything one lesson's page shows beyond its summary. */
export const LessonPage = Schema.Struct({
  lesson: Lesson,
  maybeHistory: Schema.OptionFromNullOr(LessonHistory),
})
export type LessonPage = typeof LessonPage.Type
