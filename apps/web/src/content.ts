import {
  LessonPage,
  LessonSummary,
  lessonKey,
  type Topic,
  topics,
} from '@bfb/lessons'
import { Array, Effect, Option, pipe, Schema } from 'effect'
import { pageLoaders, summaries } from 'virtual:lessons'

// NOTE: The app ships only each lesson's front matter. A page's prose,
// examples, quiz, and history load when it opens; see `lessons-plugin.ts`.
const allSummaries = Schema.decodeUnknownSync(Schema.Array(LessonSummary))(
  summaries,
)

/** Loads everything a lesson's page shows beyond its summary. */
export const loadPage = (key: string) =>
  pipe(
    Option.fromNullishOr(pageLoaders[key]),
    Option.map((load) =>
      Effect.tryPromise(load).pipe(
        Effect.flatMap((module) =>
          Schema.decodeUnknownEffect(LessonPage)(module.default),
        ),
      ),
    ),
  )

export type PublishedTopic = Topic & {
  readonly lessons: ReadonlyArray<LessonSummary>
}

export const publishedTopics: ReadonlyArray<PublishedTopic> = pipe(
  topics,
  Array.filter((topic) => topic.status === 'published'),
  Array.map((topic) => ({
    ...topic,
    lessons: Array.filter(
      allSummaries,
      (summary) => summary.topic === topic.id,
    ),
  })),
)

export const plannedTopics: ReadonlyArray<Topic> = Array.filter(
  topics,
  (topic) => topic.status === 'planned',
)

export const allLessons = Array.flatMap(
  publishedTopics,
  (topic) => topic.lessons,
)

export const lessonCount = allLessons.length

export const summaryKey = (lesson: LessonSummary) =>
  lessonKey(lesson.topic, lesson.slug)

export const findLesson = (topic: string, slug: string) =>
  Array.findFirst(
    allLessons,
    (lesson) => lesson.topic === topic && lesson.slug === slug,
  )

export const findTopic = (id: string) =>
  Array.findFirst(publishedTopics, (topic) => topic.id === id)

export type Neighbours = {
  readonly maybePrevious: Option.Option<LessonSummary>
  readonly maybeNext: Option.Option<LessonSummary>
}

export const neighboursOf = (lesson: LessonSummary): Neighbours =>
  pipe(
    Array.findFirstIndex(
      allLessons,
      (candidate) =>
        candidate.topic === lesson.topic && candidate.slug === lesson.slug,
    ),
    Option.match({
      onNone: () => ({
        maybePrevious: Option.none(),
        maybeNext: Option.none(),
      }),
      onSome: (index) => ({
        maybePrevious: Array.get(allLessons, index - 1),
        maybeNext: Array.get(allLessons, index + 1),
      }),
    }),
  )
