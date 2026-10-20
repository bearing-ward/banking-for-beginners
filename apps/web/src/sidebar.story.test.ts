import { Option } from 'effect'
import { Command, given, message, model, story } from 'foldkit/story'
import { expect, test } from 'vitest'

import { publishedTopics } from './content.ts'
import {
  FocusFilter,
  FocusRow,
  init,
  Message,
  type Model,
  OutMessage,
  update,
  visibleRows,
} from './sidebar.ts'

const firstLesson = 'lesson-fraud--spotting-a-scam'
const secondLesson = 'lesson-fraud--phishing-texts-and-emails'
const fraudRow = 'topic-fraud'
const firstTopicRow = `topic-${publishedTopics[0]?.id}`

const fraudLessonRows = (model: Model) =>
  visibleRows(model).filter((row) => row.id.startsWith('lesson-fraud--'))

const focused = (rowId: string) =>
  Command.resolve(FocusRow({ rowId }), Message.CompletedFocus())

test('only the current topic starts expanded', () => {
  const rows = visibleRows(init(Option.some('fraud')))
  expect(rows.filter((row) => row._tag === 'Topic')).toHaveLength(
    publishedTopics.length,
  )
  expect(rows.filter((row) => row._tag === 'Lesson')).toHaveLength(
    publishedTopics.find((topic) => topic.id === 'fraud')?.lessons.length ?? 0,
  )
})

test('rows list each topic followed by its lessons', () => {
  const rows = visibleRows({ ...init(Option.none()), collapsedIds: [] })
  const [first] = publishedTopics
  expect(rows[0]?.id).toBe(firstTopicRow)
  expect(rows[1]?.id).toBe(`lesson-${first?.id}--${first?.slugs[0]}`)
  expect(rows).toHaveLength(
    publishedTopics.reduce(
      (count, topic) => count + 1 + topic.lessons.length,
      0,
    ),
  )
})

test('arrow keys move between rows, and up from the top returns to the filter', () => {
  story(
    update,
    given(init(Option.some('fraud'))),
    message(Message.PressedRowKey({ rowId: firstLesson, key: 'ArrowDown' })),
    Command.expectExact(FocusRow({ rowId: secondLesson })),
    focused(secondLesson),
    model((value) =>
      expect(value.maybeActiveId).toEqual(Option.some(secondLesson)),
    ),
    message(Message.PressedRowKey({ rowId: firstTopicRow, key: 'ArrowUp' })),
    Command.expectExact(FocusFilter()),
    Command.resolve(FocusFilter, Message.CompletedFocus()),
  )
})

test('left on a lesson jumps to its topic, left again collapses it', () => {
  story(
    update,
    given(init(Option.some('fraud'))),
    message(Message.PressedRowKey({ rowId: secondLesson, key: 'ArrowLeft' })),
    focused(fraudRow),
    message(Message.PressedRowKey({ rowId: fraudRow, key: 'ArrowLeft' })),
    focused(fraudRow),
    model((value: Model) => {
      expect(value.collapsedIds).toContain('fraud')
      expect(fraudLessonRows(value)).toEqual([])
    }),
    message(Message.PressedRowKey({ rowId: fraudRow, key: 'ArrowRight' })),
    focused(fraudRow),
    model((value) => expect(value.collapsedIds).not.toContain('fraud')),
    message(Message.PressedRowKey({ rowId: fraudRow, key: 'ArrowRight' })),
    focused(firstLesson),
  )
})

test('clicking a topic toggles it', () => {
  story(
    update,
    given(init(Option.some('fraud'))),
    message(Message.ClickedToggle({ topicId: 'fraud' })),
    model((value) => expect(value.collapsedIds).toContain('fraud')),
    message(Message.ClickedToggle({ topicId: 'fraud' })),
    model((value) => expect(value.collapsedIds).not.toContain('fraud')),
  )
})

test('filtering shows matches, even inside a collapsed topic', () => {
  story(
    update,
    given(init(Option.none())),
    message(Message.UpdatedFilter({ value: 'fake check' })),
    model((value) =>
      expect(visibleRows(value).map((row) => row.id)).toEqual([
        fraudRow,
        'lesson-fraud--fake-check-scams',
      ]),
    ),
    message(Message.PressedFilterKey({ key: 'ArrowDown' })),
    focused(fraudRow),
    message(Message.PressedFilterKey({ key: 'Escape' })),
    model((value) => {
      expect(value.filter).toBe('')
      expect(fraudLessonRows(value)).toEqual([])
    }),
  )
})

test('a filter with no matches leaves nothing to open', () => {
  story(
    update,
    given({ ...init(Option.some('fraud')), filter: 'no such lesson' }),
    model((value) => expect(visibleRows(value)).toEqual([])),
    message(Message.PressedFilterKey({ key: 'Enter' })),
    Command.expectNone(),
  )
})

test('Enter in the filter asks the parent to open the first match', () => {
  const result = update(
    { ...init(Option.some('fraud')), filter: 'money mule' },
    Message.PressedFilterKey({ key: 'Enter' }),
  )
  expect(result.outMessage).toEqual(
    OutMessage.ChoseLesson({ topic: 'fraud', slug: 'money-mules' }),
  )
})
