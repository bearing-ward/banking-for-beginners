import type { LessonPage } from '@bfb/lessons'
import { Effect, Option } from 'effect'
import { Url } from 'foldkit'
import { Command, given, message, model, story } from 'foldkit/story'
import { expect, test } from 'vitest'

import { loadPage, publishedTopics } from './content.ts'
import {
  LoadPage,
  Message,
  type Model,
  Navigate,
  PageState,
  SaveProgress,
  ScrollToTop,
  update,
} from './main.ts'
import { AppRoute } from './route.ts'
import * as Sidebar from './sidebar.ts'

const key = 'work/reading-a-pay-stub'

const pageOf = (slug: string): LessonPage => ({
  lesson: {
    topic: 'work',
    slug,
    title: slug,
    level: 'starter',
    summary: '',
    segments: [],
    takeaways: [],
    quiz: [
      { prompt: 'One?', options: ['a', 'b'], answer: 1, explanation: 'b.' },
      { prompt: 'Two?', options: ['a', 'b'], answer: 0, explanation: 'a.' },
    ],
    maybeTool: Option.none(),
  },
  maybeHistory: Option.none(),
})

const onLesson = (slug: string): Model => ({
  route: AppRoute.Lesson({ topic: 'work', slug }),
  page: PageState.Loaded({ page: pageOf(slug) }),
  sidebar: Sidebar.init(Option.some('work')),
  shortcutLabel: '⌘K',
  toolInputs: {},
  quizAnswers: {},
  completedKeys: [],
})

test('every published lesson is listed in catalog order', () => {
  for (const topic of publishedTopics) {
    expect(topic.lessons.map((lesson) => lesson.slug)).toEqual(topic.slugs)
  }
})

test('every lesson page loads and decodes', async () => {
  const keys = publishedTopics.flatMap((topic) =>
    topic.lessons.map((lesson) => `${topic.id}/${lesson.slug}`),
  )
  const pages = await Effect.runPromise(
    Effect.forEach(keys, (pageKey) => Option.getOrThrow(loadPage(pageKey))),
  )
  expect(pages.map(({ lesson }) => `${lesson.topic}/${lesson.slug}`)).toEqual(
    keys,
  )
})

test('answering every quiz question finishes the lesson and saves progress', () => {
  story(
    update,
    given(onLesson('reading-a-pay-stub')),
    message(Message.SelectedQuizAnswer({ question: 0, option: 0 })),
    Command.expectNone(),
    message(Message.SelectedQuizAnswer({ question: 0, option: 1 })),
    model((value) => expect(value.quizAnswers).toEqual({ '0': 0 })),
    message(Message.SelectedQuizAnswer({ question: 1, option: 0 })),
    Command.expectExact(SaveProgress({ completedKeys: [key] })),
    Command.resolve(SaveProgress, Message.SucceededSaveProgress()),
    model((value) => expect(value.completedKeys).toEqual([key])),
    message(Message.ClickedRetryQuiz()),
    model((value) => expect(value.quizAnswers).toEqual({})),
  )
})

test('marking a lesson done and not done saves each time', () => {
  story(
    update,
    given(onLesson('reading-a-pay-stub')),
    message(Message.ClickedMarkDone({ key })),
    Command.expectExact(SaveProgress({ completedKeys: [key] })),
    Command.resolve(SaveProgress, Message.SucceededSaveProgress()),
    message(Message.ClickedMarkNotDone({ key })),
    Command.expectExact(SaveProgress({ completedKeys: [] })),
    Command.resolve(SaveProgress, Message.FailedSaveProgress()),
    model((value) => expect(value.completedKeys).toEqual([])),
  )
})

test('calculator fields keep what the reader typed until reset', () => {
  story(
    update,
    given(onLesson('reading-a-pay-stub')),
    message(
      Message.UpdatedToolField({
        toolId: 'paycheck',
        fieldId: 'wage',
        value: '18',
      }),
    ),
    model((value) =>
      expect(value.toolInputs).toEqual({ paycheck: { wage: '18' } }),
    ),
    message(Message.ClickedResetTool({ toolId: 'paycheck' })),
    model((value) => expect(value.toolInputs).toEqual({})),
  )
})

test('changing lessons clears quiz answers, scrolls up, and loads the page', () => {
  const url = Option.getOrThrow(
    Url.fromString('https://example.test/work/first-job-paperwork'),
  )
  story(
    update,
    given({ ...onLesson('reading-a-pay-stub'), quizAnswers: { '0': 1 } }),
    message(Message.ChangedUrl({ url })),
    Command.expectExact(
      ScrollToTop(),
      LoadPage({ key: 'work/first-job-paperwork' }),
    ),
    model((value) => {
      expect(value.quizAnswers).toEqual({})
      expect(value.page).toEqual(
        PageState.Loading({ key: 'work/first-job-paperwork' }),
      )
    }),
    Command.resolve(ScrollToTop, Message.CompletedScrollToTop()),
    Command.resolve(
      LoadPage,
      Message.SucceededLoadPage({
        key: 'work/first-job-paperwork',
        page: pageOf('first-job-paperwork'),
      }),
    ),
    model((value) =>
      expect(value.page).toEqual(
        PageState.Loaded({ page: pageOf('first-job-paperwork') }),
      ),
    ),
  )
})

test('a page that arrives after navigating away is ignored', () => {
  story(
    update,
    given({
      ...onLesson('first-job-paperwork'),
      page: PageState.Loading({ key: 'work/first-job-paperwork' }),
    }),
    message(
      Message.SucceededLoadPage({ key, page: pageOf('reading-a-pay-stub') }),
    ),
    model((value) =>
      expect(value.page).toEqual(
        PageState.Loading({ key: 'work/first-job-paperwork' }),
      ),
    ),
  )
})

test('Cmd+K focuses the sidebar filter', () => {
  story(
    update,
    given(onLesson('reading-a-pay-stub')),
    message(Message.PressedFilterShortcut()),
    Command.expectExact(Sidebar.FocusFilter()),
    Command.resolve(Sidebar.FocusFilter, Sidebar.Message.CompletedFocus()),
  )
})

test('pressing Enter in the filter opens the first match', () => {
  story(
    update,
    given({
      ...onLesson('reading-a-pay-stub'),
      sidebar: { ...Sidebar.init(Option.none()), filter: 'fake check' },
    }),
    message(
      Message.GotSidebarMessage({
        message: Sidebar.Message.PressedFilterKey({ key: 'Enter' }),
      }),
    ),
    Command.expectExact(Navigate({ url: '/fraud/fake-check-scams' })),
    Command.resolve(Navigate, Message.CompletedNavigate()),
  )
})
