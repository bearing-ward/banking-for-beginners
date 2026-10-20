import { Array, Option, Order, pipe, Schema } from 'effect'

import type { Topic } from './catalog.ts'
import type { LessonHistory } from './lesson.ts'

/**
 * The content log is an append-only history of every lesson: when it was
 * added, changed, reviewed, or removed, and which tax year's figures it was
 * checked against at the time. `scripts/content.ts` maintains it.
 */
export const ChangeKind = Schema.Literals([
  'added',
  'modified',
  'reviewed',
  'removed',
])
export type ChangeKind = typeof ChangeKind.Type

export const IsoDate = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/u),
)

export const LogEntry = Schema.Struct({
  date: IsoDate,
  key: Schema.String,
  kind: ChangeKind,
  hash: Schema.String,
  rules: Schema.String,
  note: Schema.optionalKey(Schema.String),
})
export type LogEntry = typeof LogEntry.Type

export const ContentLog = Schema.Struct({ entries: Schema.Array(LogEntry) })
export type ContentLog = typeof ContentLog.Type

export type SourceFingerprint = { readonly key: string; readonly hash: string }

export type PendingChange = {
  readonly key: string
  readonly kind: 'added' | 'modified' | 'removed'
  readonly hash: string
}

const entriesFor = (log: ContentLog, key: string) =>
  Array.filter(log.entries, (entry) => entry.key === key)

const latest = (log: ContentLog, key: string) =>
  Array.last(entriesFor(log, key))

const isLive = (entry: LogEntry) => entry.kind !== 'removed'

const loggedKeys = (log: ContentLog) =>
  Array.dedupe(Array.map(log.entries, (entry) => entry.key))

/** Source changes that have not been written to the log yet. */
export const pendingChanges = (
  log: ContentLog,
  sources: ReadonlyArray<SourceFingerprint>,
): ReadonlyArray<PendingChange> => {
  const changed = Array.getSomes(
    Array.map(sources, (source) =>
      Option.match(Option.filter(latest(log, source.key), isLive), {
        onNone: () =>
          Option.some({
            key: source.key,
            kind: 'added' as const,
            hash: source.hash,
          }),
        onSome: (entry) =>
          entry.hash === source.hash
            ? Option.none()
            : Option.some({
                key: source.key,
                kind: 'modified' as const,
                hash: source.hash,
              }),
      }),
    ),
  )
  const removed = pipe(
    loggedKeys(log),
    Array.filter(
      (key) =>
        Option.exists(latest(log, key), isLive) &&
        !Array.some(sources, (source) => source.key === key),
    ),
    Array.map((key) => ({ key, kind: 'removed' as const, hash: '' })),
  )
  return [...changed, ...removed]
}

export type EntryContext = {
  readonly date: string
  readonly rules: string
  readonly note?: string
}

const toEntry = (
  change: {
    readonly key: string
    readonly kind: ChangeKind
    readonly hash: string
  },
  context: EntryContext,
): LogEntry => ({
  date: context.date,
  key: change.key,
  kind: change.kind,
  hash: change.hash,
  rules: context.rules,
  ...(context.note === undefined ? {} : { note: context.note }),
})

export const recordChanges = (
  log: ContentLog,
  changes: ReadonlyArray<PendingChange>,
  context: EntryContext,
): ContentLog => ({
  entries: [
    ...log.entries,
    ...Array.map(changes, (change) => toEntry(change, context)),
  ],
})

/** Marks lessons as reviewed without a content change. */
export const recordReviews = (
  log: ContentLog,
  keys: ReadonlyArray<string>,
  context: EntryContext,
): ContentLog => ({
  entries: [
    ...log.entries,
    ...Array.getSomes(
      Array.map(keys, (key) =>
        Option.map(Option.filter(latest(log, key), isLive), (entry) =>
          toEntry({ key, kind: 'reviewed', hash: entry.hash }, context),
        ),
      ),
    ),
  ],
})

/** Dates readers see on a page: first added, last changed, last checked. */
export const historyOf = (
  log: ContentLog,
  key: string,
): Option.Option<LessonHistory> => {
  const entries = entriesFor(log, key)
  return Option.map(Option.filter(Array.last(entries), isLive), (last) => {
    const changes = Array.filter(entries, (entry) => entry.kind !== 'reviewed')
    return {
      key,
      added: Option.match(Array.head(entries), {
        onNone: () => last.date,
        onSome: (first) => first.date,
      }),
      updated: Option.match(Array.last(changes), {
        onNone: () => last.date,
        onSome: (change) => change.date,
      }),
      checked: last.date,
      rules: last.rules,
    }
  })
}

export const Attention = Schema.TaggedUnion({
  Unlogged: { key: Schema.String, kind: Schema.String },
  CheckedAgainstOlderRules: {
    key: Schema.String,
    checked: Schema.String,
    current: Schema.String,
  },
  NotReviewedRecently: {
    key: Schema.String,
    checked: Schema.String,
    days: Schema.Number,
  },
  EmptyTopic: { topic: Schema.String },
})
export type Attention = typeof Attention.Type

export type StatusOptions = {
  readonly today: string
  readonly rules: string
  readonly staleAfterDays: number
}

export type ContentStatus = {
  readonly histories: ReadonlyArray<LessonHistory>
  readonly attention: ReadonlyArray<Attention>
}

const daysBetween = (from: string, to: string) =>
  Math.floor((Date.parse(to) - Date.parse(from)) / 86_400_000)

const byKey = Order.mapInput(
  Order.String,
  (history: LessonHistory) => history.key,
)

export const contentStatus = (
  log: ContentLog,
  sources: ReadonlyArray<SourceFingerprint>,
  topics: ReadonlyArray<Topic>,
  options: StatusOptions,
): ContentStatus => {
  const histories = pipe(
    sources,
    Array.map((source) => historyOf(log, source.key)),
    Array.getSomes,
    Array.sort(byKey),
  )
  const unlogged = Array.map(pendingChanges(log, sources), (change) =>
    Attention.cases.Unlogged.make({ key: change.key, kind: change.kind }),
  )
  const olderRules = Array.getSomes(
    Array.map(histories, (history) =>
      history.rules === options.rules
        ? Option.none()
        : Option.some(
            Attention.cases.CheckedAgainstOlderRules.make({
              key: history.key,
              checked: history.rules,
              current: options.rules,
            }),
          ),
    ),
  )
  const stale = Array.getSomes(
    Array.map(histories, (history) => {
      const days = daysBetween(history.checked, options.today)
      return days > options.staleAfterDays
        ? Option.some(
            Attention.cases.NotReviewedRecently.make({
              key: history.key,
              checked: history.checked,
              days,
            }),
          )
        : Option.none()
    }),
  )
  const empty = pipe(
    topics,
    Array.filter((topic) => Array.isReadonlyArrayEmpty(topic.slugs)),
    Array.map((topic) =>
      Attention.cases.EmptyTopic.make({ topic: topic.title }),
    ),
  )
  return {
    histories,
    attention: [...unlogged, ...olderRules, ...stale, ...empty],
  }
}

export const describeAttention = (attention: Attention): string =>
  Attention.match(attention, {
    Unlogged: ({ key, kind }) =>
      `${key}: ${kind} but not in the content log (run \`bun run content:log\`)`,
    CheckedAgainstOlderRules: ({ key, checked, current }) =>
      `${key}: last checked against ${checked} figures, current rules are ${current}; reread it against rules.ts`,
    NotReviewedRecently: ({ key, checked, days }) =>
      `${key}: not reviewed for ${days} days (since ${checked})`,
    EmptyTopic: ({ topic }) => `${topic}: planned topic with no lessons yet`,
  })
