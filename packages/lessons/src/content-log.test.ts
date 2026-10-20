import { Option } from 'effect'
import { expect, test } from 'vitest'

import type { Topic } from './catalog.ts'
import {
  type ContentLog,
  contentStatus,
  historyOf,
  pendingChanges,
  recordChanges,
  recordReviews,
} from './content-log.ts'

const empty: ContentLog = { entries: [] }
const day = (date: string) => ({ date, rules: '2025' })

const added = recordChanges(
  empty,
  pendingChanges(empty, [
    { key: 'taxes/a', hash: 'a1' },
    { key: 'taxes/b', hash: 'b1' },
  ]),
  day('2026-01-01'),
)

test('new sources are pending as added, then nothing is pending', () => {
  expect(pendingChanges(empty, [{ key: 'taxes/a', hash: 'a1' }])).toEqual([
    { key: 'taxes/a', kind: 'added', hash: 'a1' },
  ])
  expect(
    pendingChanges(added, [
      { key: 'taxes/a', hash: 'a1' },
      { key: 'taxes/b', hash: 'b1' },
    ]),
  ).toEqual([])
})

test('edited and deleted sources are pending as modified and removed', () => {
  expect(pendingChanges(added, [{ key: 'taxes/a', hash: 'a2' }])).toEqual([
    { key: 'taxes/a', kind: 'modified', hash: 'a2' },
    { key: 'taxes/b', kind: 'removed', hash: '' },
  ])
})

test('a removed lesson that comes back is added again', () => {
  const removed = recordChanges(
    added,
    pendingChanges(added, [{ key: 'taxes/a', hash: 'a1' }]),
    day('2026-02-01'),
  )
  expect(
    pendingChanges(removed, [
      { key: 'taxes/a', hash: 'a1' },
      { key: 'taxes/b', hash: 'b1' },
    ]),
  ).toEqual([{ key: 'taxes/b', kind: 'added', hash: 'b1' }])
})

test('history separates the last content change from the last check', () => {
  const modified = recordChanges(
    added,
    [{ key: 'taxes/a', kind: 'modified', hash: 'a2' }],
    day('2026-03-01'),
  )
  const reviewed = recordReviews(modified, ['taxes/a'], {
    date: '2026-05-01',
    rules: '2026',
  })
  expect(historyOf(reviewed, 'taxes/a')).toEqual(
    Option.some({
      key: 'taxes/a',
      added: '2026-01-01',
      updated: '2026-03-01',
      checked: '2026-05-01',
      rules: '2026',
    }),
  )
})

test('status flags unlogged, older-rules, stale, and empty-topic content', () => {
  const topics: ReadonlyArray<Topic> = [
    {
      id: 'taxes',
      title: 'Taxes',
      blurb: '',
      status: 'published',
      slugs: ['a', 'b'],
    },
    {
      id: 'college',
      title: 'College',
      blurb: '',
      status: 'planned',
      slugs: [],
    },
  ]
  const reviewedB = recordReviews(added, ['taxes/b'], {
    date: '2026-06-20',
    rules: '2026',
  })
  const status = contentStatus(
    reviewedB,
    [
      { key: 'taxes/a', hash: 'a1' },
      { key: 'taxes/b', hash: 'b1' },
      { key: 'taxes/c', hash: 'c1' },
    ],
    topics,
    { today: '2026-07-01', rules: '2026', staleAfterDays: 90 },
  )
  expect(status.attention.map((item) => item._tag)).toEqual([
    'Unlogged',
    'CheckedAgainstOlderRules',
    'NotReviewedRecently',
    'EmptyTopic',
  ])
  expect(status.histories.map((history) => history.key)).toEqual([
    'taxes/a',
    'taxes/b',
  ])
})
