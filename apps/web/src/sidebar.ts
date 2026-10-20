import { lessonKey, type LessonSummary } from '@bfb/lessons'
import { Array, Effect, Option, pipe, Schema, String } from 'effect'
import { Command, Dom, Submodel, type Update } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { modifyFields } from 'foldkit/struct'

import { type PublishedTopic, publishedTopics } from './content.ts'
import { lessonRouter } from './route.ts'

// MODEL

export const Model = Schema.Struct({
  filter: Schema.String,
  collapsedIds: Schema.Array(Schema.String),
  maybeActiveId: Schema.Option(Schema.String),
})
export type Model = typeof Model.Type

/** Starts with every topic collapsed except the one being read. */
export const init = (maybeTopicId: Option.Option<string>): Model => ({
  filter: '',
  collapsedIds: pipe(
    publishedTopics,
    Array.map((topic) => topic.id),
    Array.filter((id) => !Option.contains(maybeTopicId, id)),
  ),
  maybeActiveId: Option.none(),
})

/** Expands the topic of a page the reader navigated to. */
export const reveal = (model: Model, topicId: string): Model =>
  modifyFields(model, {
    collapsedIds: (ids) => Array.filter(ids, (id) => id !== topicId),
  })

// MESSAGE

export const Message = defineMessageUnion({
  UpdatedFilter: { value: Schema.String },
  PressedFilterKey: { key: Schema.String },
  ClickedToggle: { topicId: Schema.String },
  PressedRowKey: { rowId: Schema.String, key: Schema.String },
  FocusedRow: { rowId: Schema.String },
  CompletedFocus: {},
})
export type Message = typeof Message.Type

export const OutMessage = defineMessageUnion({
  ChoseLesson: { topic: Schema.String, slug: Schema.String },
})
export type OutMessage = typeof OutMessage.Type

// ROWS

export const filterInputId = 'sidebar-filter'

type TopicRow = {
  readonly _tag: 'Topic'
  readonly id: string
  readonly topic: PublishedTopic
  readonly lessons: ReadonlyArray<LessonSummary>
  readonly isExpanded: boolean
}

type LessonRow = {
  readonly _tag: 'Lesson'
  readonly id: string
  readonly parentId: string
  readonly lesson: LessonSummary
}

type Row = TopicRow | LessonRow

const topicRowId = (topicId: string) => `topic-${topicId}`

const lessonRowId = (lesson: LessonSummary) =>
  `lesson-${lesson.topic}--${lesson.slug}`

const rowDomId = (rowId: string) => `sidebar-row-${rowId}`

const isFiltering = (model: Model) => !String.isEmpty(model.filter.trim())

const matches = (filter: string, topic: PublishedTopic) => {
  const needle = filter.trim().toLowerCase()
  return (lesson: LessonSummary) =>
    [lesson.title, lesson.summary, lesson.slug, topic.title].some((text) =>
      text.toLowerCase().includes(needle),
    )
}

const topicRows = (model: Model): ReadonlyArray<TopicRow> =>
  pipe(
    publishedTopics,
    Array.map((topic) => ({
      _tag: 'Topic' as const,
      id: topicRowId(topic.id),
      topic,
      lessons: isFiltering(model)
        ? Array.filter(topic.lessons, matches(model.filter, topic))
        : topic.lessons,
      isExpanded:
        isFiltering(model) || !Array.contains(model.collapsedIds, topic.id),
    })),
    Array.filter(
      (row) =>
        !isFiltering(model) || Array.isReadonlyArrayNonEmpty(row.lessons),
    ),
  )

/** Rows in reading order, skipping the lessons of collapsed topics. */
export const visibleRows = (model: Model): ReadonlyArray<Row> =>
  Array.flatMap(topicRows(model), (row): ReadonlyArray<Row> => [
    row,
    ...(row.isExpanded
      ? Array.map(row.lessons, (lesson) => ({
          _tag: 'Lesson' as const,
          id: lessonRowId(lesson),
          parentId: row.id,
          lesson,
        }))
      : []),
  ])

const firstLesson = (model: Model) =>
  Array.findFirst(
    visibleRows(model),
    (row): row is LessonRow => row._tag === 'Lesson',
  )

// COMMAND

export const FocusRow = Command.define('FocusRow', {
  args: { rowId: Schema.String },
  messages: [Message.CompletedFocus],
  execute: ({ rowId }) =>
    Dom.focus(`#${rowDomId(rowId)}`).pipe(
      Effect.catch(() => Effect.void),
      Effect.as(Message.CompletedFocus()),
    ),
})

export const FocusFilter = Command.define('FocusFilter', {
  messages: [Message.CompletedFocus],
  execute: Dom.focus(`#${filterInputId}`).pipe(
    Effect.andThen(
      Effect.sync(() => {
        const input = document.getElementById(filterInputId)
        if (input instanceof HTMLInputElement) {
          input.select()
        }
      }),
    ),
    Effect.catch(() => Effect.void),
    Effect.as(Message.CompletedFocus()),
  ),
})

// UPDATE

type UpdateReturn = Update.ReturnWithOutMessage<Model, Message, OutMessage>

const focusRow = (model: Model, rowId: string): UpdateReturn => ({
  model: modifyFields(model, { maybeActiveId: () => Option.some(rowId) }),
  commands: [FocusRow({ rowId })],
})

/** Lets the parent move focus to the filter, for example on Cmd+K. */
export const focusFilter = (model: Model): Update.Return<Model, Message> => ({
  model,
  commands: [FocusFilter()],
})

const toggle = (model: Model, topicId: string): Model =>
  modifyFields(model, {
    collapsedIds: (ids) =>
      Array.contains(ids, topicId)
        ? Array.filter(ids, (id) => id !== topicId)
        : Array.append(ids, topicId),
  })

const navigateFromRow = (
  model: Model,
  rowId: string,
  key: string,
): UpdateReturn => {
  const rows = visibleRows(model)
  return Option.match(
    Array.findFirstIndex(rows, (row) => row.id === rowId),
    {
      onNone: () => ({ model }),
      onSome: (index) => {
        const row = rows[index]
        const moveTo = (target: Option.Option<Row>) =>
          Option.match(target, {
            onNone: () => ({ model }),
            onSome: (next: Row) => focusRow(model, next.id),
          })
        if (key === 'ArrowDown') {
          return moveTo(Array.get(rows, index + 1))
        }
        if (key === 'ArrowUp') {
          return index === 0
            ? focusFilter(model)
            : moveTo(Array.get(rows, index - 1))
        }
        if (key === 'Home') {
          return moveTo(Array.head(rows))
        }
        if (key === 'End') {
          return moveTo(Array.last(rows))
        }
        if (row?._tag === 'Topic' && key === 'ArrowRight') {
          return row.isExpanded
            ? moveTo(Array.get(rows, index + 1))
            : focusRow(toggle(model, row.topic.id), row.id)
        }
        if (row?._tag === 'Topic' && key === 'ArrowLeft') {
          return row.isExpanded && !isFiltering(model)
            ? focusRow(toggle(model, row.topic.id), row.id)
            : { model }
        }
        if (row?._tag === 'Lesson' && key === 'ArrowLeft') {
          return focusRow(model, row.parentId)
        }
        return { model }
      },
    },
  )
}

export const update = (model: Model, message: Message) =>
  Message.match<UpdateReturn>(message, {
    UpdatedFilter: ({ value }) => ({
      model: modifyFields(model, {
        filter: () => value,
        maybeActiveId: () => Option.none(),
      }),
    }),
    PressedFilterKey: ({ key }) => {
      if (key === 'ArrowDown') {
        return Option.match(Array.head(visibleRows(model)), {
          onNone: () => ({ model }),
          onSome: (row) => focusRow(model, row.id),
        })
      }
      if (key === 'Enter') {
        return Option.match(firstLesson(model), {
          onNone: () => ({ model }),
          onSome: (row) => ({
            model,
            outMessage: OutMessage.ChoseLesson({
              topic: row.lesson.topic,
              slug: row.lesson.slug,
            }),
          }),
        })
      }
      if (key === 'Escape') {
        return {
          model: modifyFields(model, { filter: () => '' }),
        }
      }
      return { model }
    },
    ClickedToggle: ({ topicId }) =>
      isFiltering(model) ? { model } : { model: toggle(model, topicId) },
    PressedRowKey: ({ rowId, key }) => navigateFromRow(model, rowId, key),
    FocusedRow: ({ rowId }) => ({
      model: modifyFields(model, { maybeActiveId: () => Option.some(rowId) }),
    }),
    CompletedFocus: () => ({ model }),
  })

// VIEW

export type ViewInputs = Readonly<{
  maybeCurrentKey: Option.Option<string>
  completedKeys: ReadonlyArray<string>
  shortcutLabel: string
}>

const navigationKeys = [
  'ArrowDown',
  'ArrowUp',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
]

const rowKeyHandler = (rowId: string, h: HtmlBuilder<Message>) =>
  h.OnKeyDownPreventDefault((key, modifiers) =>
    Array.contains(navigationKeys, key) &&
    !modifiers.altKey &&
    !modifiers.metaKey &&
    !modifiers.ctrlKey
      ? Option.some(Message.PressedRowKey({ rowId, key }))
      : Option.none(),
  )

const tabStop = (
  rows: ReadonlyArray<Row>,
  model: Model,
  inputs: ViewInputs,
) => {
  const isVisible = (id: string) => Array.some(rows, (row) => row.id === id)
  const current = Option.flatMap(inputs.maybeCurrentKey, (key) =>
    pipe(
      rows,
      Array.findFirst(
        (row) =>
          row._tag === 'Lesson' &&
          lessonKey(row.lesson.topic, row.lesson.slug) === key,
      ),
      Option.map((row) => row.id),
    ),
  )
  return pipe(
    model.maybeActiveId,
    Option.filter(isVisible),
    Option.orElse(() => current),
    Option.orElse(() => Option.map(Array.head(rows), (row) => row.id)),
  )
}

const rowAttributes = (
  rowId: string,
  maybeTabStop: Option.Option<string>,
  h: HtmlBuilder<Message>,
) => [
  h.Id(rowDomId(rowId)),
  h.Tabindex(Option.contains(maybeTabStop, rowId) ? 0 : -1),
  h.OnFocus(Message.FocusedRow({ rowId })),
  rowKeyHandler(rowId, h),
]

const lessonRowView = (
  row: LessonRow,
  maybeTabStop: Option.Option<string>,
  inputs: ViewInputs,
  h: HtmlBuilder<Message>,
) => {
  const isCurrent = Option.contains(
    inputs.maybeCurrentKey,
    lessonKey(row.lesson.topic, row.lesson.slug),
  )
  return h.keyed('li')(
    row.id,
    [],
    [
      h.a(
        [
          ...rowAttributes(row.id, maybeTabStop, h),
          h.Class(
            isCurrent ? 'sidebar-link sidebar-link-current' : 'sidebar-link',
          ),
          h.Href(
            lessonRouter({
              topic: row.lesson.topic,
              slug: row.lesson.slug,
            }),
          ),
          ...(isCurrent ? [h.AriaCurrent('page')] : []),
        ],
        [
          h.span([h.Class('sidebar-link-title')], [row.lesson.title]),
          Array.contains(
            inputs.completedKeys,
            lessonKey(row.lesson.topic, row.lesson.slug),
          )
            ? h.span([h.Class('sidebar-done'), h.AriaLabel('done')], ['✓'])
            : h.empty,
        ],
      ),
    ],
  )
}

const topicView = (
  row: TopicRow,
  model: Model,
  maybeTabStop: Option.Option<string>,
  inputs: ViewInputs,
  h: HtmlBuilder<Message>,
) => {
  const listId = `sidebar-list-${row.topic.id}`
  return h.keyed('li')(
    row.id,
    [h.Class('sidebar-topic')],
    [
      h.button(
        [
          ...rowAttributes(row.id, maybeTabStop, h),
          h.Type('button'),
          h.Class('sidebar-toggle'),
          h.AriaExpanded(row.isExpanded),
          h.AriaControls(listId),
          h.OnClick(Message.ClickedToggle({ topicId: row.topic.id })),
        ],
        [
          h.span(
            [h.Class('sidebar-chevron'), h.AriaHidden(true)],
            [row.isExpanded ? '▾' : '▸'],
          ),
          h.span([h.Class('sidebar-topic-title')], [row.topic.title]),
          h.span([h.Class('sidebar-count')], [`${row.lessons.length}`]),
        ],
      ),
      row.isExpanded
        ? h.ul(
            [h.Id(listId), h.Class('sidebar-list')],
            Array.map(row.lessons, (lesson) =>
              lessonRowView(
                {
                  _tag: 'Lesson',
                  id: lessonRowId(lesson),
                  parentId: row.id,
                  lesson,
                },
                maybeTabStop,
                inputs,
                h,
              ),
            ),
          )
        : h.empty,
    ],
  )
}

const emptyView = (model: Model, h: HtmlBuilder<Message>) =>
  h.p(
    [h.Class('sidebar-empty')],
    [`No lessons match “${model.filter.trim()}”.`],
  )

export const view = Submodel.defineView<Model, Message, ViewInputs>(
  (model, inputs, h): Html => {
    const rows = visibleRows(model)
    const maybeTabStop = tabStop(rows, model, inputs)
    return h.nav(
      [h.Class('sidebar'), h.AriaLabel('Lessons')],
      [
        h.div(
          [h.Class('sidebar-filter')],
          [
            h.input([
              h.Id(filterInputId),
              h.Type('search'),
              h.Class('sidebar-filter-input'),
              h.Placeholder('Find a lesson'),
              h.AriaLabel('Find a lesson'),
              h.AriaKeyshortcuts(
                inputs.shortcutLabel === '⌘K' ? 'Meta+K' : 'Control+K',
              ),
              h.Autocomplete('off'),
              h.Value(model.filter),
              h.OnInput((value) => Message.UpdatedFilter({ value })),
              h.OnKeyDownPreventDefault((key) =>
                key === 'ArrowDown' ||
                key === 'Enter' ||
                (key === 'Escape' && isFiltering(model))
                  ? Option.some(Message.PressedFilterKey({ key }))
                  : Option.none(),
              ),
            ]),
            h.kbd(
              [h.Class('sidebar-shortcut'), h.AriaHidden(true)],
              [inputs.shortcutLabel],
            ),
          ],
        ),
        Array.match(topicRows(model), {
          onEmpty: () => emptyView(model, h),
          onNonEmpty: (topicRowList) =>
            h.ul(
              [h.Class('sidebar-topics')],
              Array.map(topicRowList, (row) =>
                topicView(row, model, maybeTabStop, inputs, h),
              ),
            ),
        }),
      ],
    )
  },
)
