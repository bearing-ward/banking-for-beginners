import { BrowserKeyValueStore } from '@effect/platform-browser'
import {
  findTool,
  type Lesson,
  type LessonHistory,
  lessonKey,
  LessonPage,
  type LessonSummary,
  levelLabel,
  type Question,
  rulesYear,
  type Segment,
  type Tool,
  tools,
} from '@bfb/lessons'
import { AppHeader, Badge, Breadcrumb, Button } from '@foldworks/ui'
import { Array, Effect, Option, Record, Schema } from 'effect'
import { KeyValueStore } from 'effect/persistence'
import { Command, Dom, type Runtime, Subscription, Update } from 'foldkit'
import type { Document, Html, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { load, pushUrl, UrlRequest } from 'foldkit/navigation'
import { defineTaggedUnion } from 'foldkit/schema'
import { modifyFields } from 'foldkit/struct'
import { toString as urlToString, Url } from 'foldkit/url'

import { blockView, exampleView, inlineView } from './blocks.ts'
import {
  allLessons,
  findLesson,
  findTopic,
  lessonCount,
  loadPage,
  neighboursOf,
  plannedTopics,
  type PublishedTopic,
  publishedTopics,
  summaryKey,
} from './content.ts'
import {
  AppRoute,
  homeRouter,
  lessonRouter,
  toolsRouter,
  urlToAppRoute,
} from './route.ts'
import * as Sidebar from './sidebar.ts'

// MODEL

// A lesson's prose, examples, quiz, and history load when its page opens.
// `None` is every page that is not a lesson.
export const PageState = defineTaggedUnion({
  None: {},
  Loading: { key: Schema.String },
  Loaded: { page: LessonPage },
  Failed: { key: Schema.String },
})
export type PageState = typeof PageState.Type

/** What the reader typed into each calculator field, by tool then field. */
export const ToolInputs = Schema.Record(
  Schema.String,
  Schema.Record(Schema.String, Schema.String),
)
export type ToolInputs = typeof ToolInputs.Type

/** The option chosen for each answered quiz question, by question index. */
export const QuizAnswers = Schema.Record(Schema.String, Schema.Number)
export type QuizAnswers = typeof QuizAnswers.Type

export const Model = Schema.Struct({
  route: AppRoute,
  page: PageState,
  sidebar: Sidebar.Model,
  shortcutLabel: Schema.String,
  toolInputs: ToolInputs,
  quizAnswers: QuizAnswers,
  completedKeys: Schema.Array(Schema.String),
})
export type Model = typeof Model.Type

// MESSAGE

export const Message = defineMessageUnion({
  ClickedLink: { request: UrlRequest },
  ChangedUrl: { url: Url },
  CompletedNavigate: {},
  CompletedLoadExternal: {},
  CompletedScrollToTop: {},
  SucceededLoadPage: { key: Schema.String, page: LessonPage },
  FailedLoadPage: { key: Schema.String },
  UpdatedToolField: {
    toolId: Schema.String,
    fieldId: Schema.String,
    value: Schema.String,
  },
  ClickedResetTool: { toolId: Schema.String },
  SelectedQuizAnswer: { question: Schema.Number, option: Schema.Number },
  ClickedRetryQuiz: {},
  ClickedMarkDone: { key: Schema.String },
  ClickedMarkNotDone: { key: Schema.String },
  ClickedResetProgress: {},
  SucceededSaveProgress: {},
  FailedSaveProgress: {},
  PressedFilterShortcut: {},
  GotSidebarMessage: { message: Sidebar.Message },
})
export type Message = typeof Message.Type

// FLAGS

export const Flags = Schema.Struct({
  shortcutLabel: Schema.String,
  completedKeys: Schema.Array(Schema.String),
})
export type Flags = typeof Flags.Type

const progressStorageKey = 'banking-for-beginners/completed'

const CompletedJson = Schema.fromJsonString(Schema.Array(Schema.String))

/** Reads the lessons this browser has finished; none when nothing is saved. */
export const savedProgress: Effect.Effect<ReadonlyArray<string>> = Effect.gen(
  function* () {
    const store = yield* KeyValueStore.KeyValueStore
    const json = yield* Effect.fromOption(
      Option.fromNullishOr(yield* store.get(progressStorageKey)),
    )
    return yield* Schema.decodeEffect(CompletedJson)(json)
  },
).pipe(
  Effect.catch(() => Effect.succeed([])),
  Effect.provide(BrowserKeyValueStore.layerLocalStorage),
)

// INIT

const routeTopic = (route: AppRoute) =>
  route._tag === 'Lesson' ? Option.some(route.topic) : Option.none()

const pageKey = (page: PageState) =>
  PageState.match(page, {
    None: () => Option.none<string>(),
    Loading: ({ key }) => Option.some(key),
    Loaded: ({ page: { lesson } }) =>
      Option.some(lessonKey(lesson.topic, lesson.slug)),
    Failed: ({ key }) => Option.some(key),
  })

/** The page state for a route, and the key to load if it is not loaded yet. */
const openPage = (route: AppRoute, page: PageState) =>
  Option.match(
    route._tag === 'Lesson'
      ? Option.map(findLesson(route.topic, route.slug), summaryKey)
      : Option.none(),
    {
      onNone: () => ({
        page: PageState.None(),
        maybeKeyToLoad: Option.none<string>(),
      }),
      onSome: (key) =>
        Option.contains(pageKey(page), key) && page._tag !== 'Failed'
          ? { page, maybeKeyToLoad: Option.none<string>() }
          : {
              page: PageState.Loading({ key }),
              maybeKeyToLoad: Option.some(key),
            },
    },
  )

export const init: Runtime.RoutingApplicationInit<Model, Message, Flags> = (
  flags,
  url,
) => {
  const route = urlToAppRoute(url)
  const opened = openPage(route, PageState.None())
  const model: Model = {
    route,
    page: opened.page,
    sidebar: Sidebar.init(routeTopic(route)),
    shortcutLabel: flags.shortcutLabel,
    toolInputs: {},
    quizAnswers: {},
    completedKeys: flags.completedKeys,
  }
  return Option.match(opened.maybeKeyToLoad, {
    onNone: () => ({ model }),
    onSome: (key) => ({ model, commands: [LoadPage({ key })] }),
  })
}

// COMMAND

export const Navigate = Command.define('Navigate', {
  args: { url: Schema.String },
  messages: [Message.CompletedNavigate],
  execute: ({ url }) =>
    pushUrl(url).pipe(Effect.as(Message.CompletedNavigate())),
})

const LoadExternal = Command.define('LoadExternal', {
  args: { href: Schema.String },
  messages: [Message.CompletedLoadExternal],
  execute: ({ href }) =>
    load(href).pipe(Effect.as(Message.CompletedLoadExternal())),
})

export const ScrollToTop = Command.define('ScrollToTop', {
  messages: [Message.CompletedScrollToTop],
  execute: Dom.scrollIntoViewAfterPaint('#top', { block: 'start' }).pipe(
    Effect.catch(() => Effect.void),
    Effect.as(Message.CompletedScrollToTop()),
  ),
})

export const LoadPage = Command.define('LoadPage', {
  args: { key: Schema.String },
  messages: [Message.SucceededLoadPage, Message.FailedLoadPage],
  execute: ({ key }) =>
    Option.match(loadPage(key), {
      onNone: () => Effect.succeed(Message.FailedLoadPage({ key })),
      onSome: (load) =>
        load.pipe(
          Effect.map((page) => Message.SucceededLoadPage({ key, page })),
          Effect.catch(() => Effect.succeed(Message.FailedLoadPage({ key }))),
        ),
    }),
})

export const SaveProgress = Command.define('SaveProgress', {
  args: { completedKeys: Schema.Array(Schema.String) },
  messages: [Message.SucceededSaveProgress, Message.FailedSaveProgress],
  execute: ({ completedKeys }) =>
    Effect.gen(function* () {
      const store = yield* KeyValueStore.KeyValueStore
      yield* store.set(
        progressStorageKey,
        Schema.encodeSync(CompletedJson)(completedKeys),
      )
      return Message.SucceededSaveProgress()
    }).pipe(
      Effect.catch(() => Effect.succeed(Message.FailedSaveProgress())),
      Effect.provide(BrowserKeyValueStore.layerLocalStorage),
    ),
})

// UPDATE

type UpdateReturn = Update.Return<Model, Message>

const currentKey = (route: AppRoute) =>
  route._tag === 'Lesson'
    ? Option.some(lessonKey(route.topic, route.slug))
    : Option.none()

const loadedLesson = (model: Model) =>
  model.page._tag === 'Loaded'
    ? Option.some(model.page.page.lesson)
    : Option.none<Lesson>()

const withCompleted = (model: Model, key: string, isDone: boolean) => {
  const completedKeys = isDone
    ? Array.dedupe(Array.append(model.completedKeys, key))
    : Array.filter(model.completedKeys, (completed) => completed !== key)
  return {
    model: modifyFields(model, { completedKeys: () => completedKeys }),
    commands: [SaveProgress({ completedKeys })],
  }
}

/** Answering the last open question finishes the lesson. */
const answerQuestion = (
  model: Model,
  question: number,
  option: number,
): UpdateReturn => {
  const answers = Record.set(model.quizAnswers, String(question), option)
  const answered = modifyFields(model, { quizAnswers: () => answers })
  return Option.match(
    Option.filter(
      loadedLesson(model),
      (lesson) => Record.size(answers) === lesson.quiz.length,
    ),
    {
      onNone: () => ({ model: answered }),
      onSome: (lesson) =>
        withCompleted(answered, lessonKey(lesson.topic, lesson.slug), true),
    },
  )
}

const foldSidebar = Update.foldChild({
  update: Sidebar.update,
  read: (model: Model) => Option.some(model.sidebar),
  write: (model, nextSidebar) =>
    modifyFields(model, { sidebar: () => nextSidebar }),
  toParentMessage: (message) => Message.GotSidebarMessage({ message }),
  foldOutMessage: Sidebar.OutMessage.match<Update.Step<Model, Message>>({
    ChoseLesson:
      ({ topic, slug }) =>
      (model) => ({
        model,
        commands: [Navigate({ url: lessonRouter({ topic, slug }) })],
      }),
  }),
})

const foldSidebarFocus = Update.foldChildStep({
  update: Sidebar.focusFilter,
  read: (model: Model) => Option.some(model.sidebar),
  write: (model, nextSidebar) =>
    modifyFields(model, { sidebar: () => nextSidebar }),
  toParentMessage: (message) => Message.GotSidebarMessage({ message }),
})

export const update = (model: Model, message: Message) =>
  Message.match<UpdateReturn>(message, {
    ClickedLink: ({ request }) =>
      UrlRequest.match<UpdateReturn>(request, {
        Internal: ({ url }) => ({
          model,
          commands: [Navigate({ url: urlToString(url) })],
        }),
        External: ({ href }) => ({ model, commands: [LoadExternal({ href })] }),
      }),
    ChangedUrl: ({ url }) => {
      const route = urlToAppRoute(url)
      const opened = openPage(route, model.page)
      const isSamePage = Option.exists(currentKey(route), (key) =>
        Option.contains(currentKey(model.route), key),
      )
      return {
        model: modifyFields(model, {
          route: () => route,
          page: () => opened.page,
          sidebar: (sidebar) =>
            Option.match(routeTopic(route), {
              onNone: () => sidebar,
              onSome: (topicId) => Sidebar.reveal(sidebar, topicId),
            }),
          quizAnswers: (answers) => (isSamePage ? answers : {}),
        }),
        commands: [
          ScrollToTop(),
          ...Option.toArray(
            Option.map(opened.maybeKeyToLoad, (key) => LoadPage({ key })),
          ),
        ],
      }
    },
    CompletedNavigate: () => ({ model }),
    CompletedLoadExternal: () => ({ model }),
    CompletedScrollToTop: () => ({ model }),
    SucceededLoadPage: ({ key, page }) =>
      Option.contains(pageKey(model.page), key) && model.page._tag === 'Loading'
        ? {
            model: modifyFields(model, {
              page: () => PageState.Loaded({ page }),
            }),
          }
        : { model },
    FailedLoadPage: ({ key }) =>
      Option.contains(pageKey(model.page), key) && model.page._tag === 'Loading'
        ? {
            model: modifyFields(model, {
              page: () => PageState.Failed({ key }),
            }),
          }
        : { model },
    UpdatedToolField: ({ toolId, fieldId, value }) => ({
      model: modifyFields(model, {
        toolInputs: (inputs) =>
          Record.set(
            inputs,
            toolId,
            Record.set(inputs[toolId] ?? {}, fieldId, value),
          ),
      }),
    }),
    ClickedResetTool: ({ toolId }) => ({
      model: modifyFields(model, {
        toolInputs: (inputs) => Record.remove(inputs, toolId),
      }),
    }),
    SelectedQuizAnswer: ({ question, option }) =>
      Record.has(model.quizAnswers, String(question))
        ? { model }
        : answerQuestion(model, question, option),
    ClickedRetryQuiz: () => ({
      model: modifyFields(model, { quizAnswers: () => ({}) }),
    }),
    ClickedMarkDone: ({ key }) => withCompleted(model, key, true),
    ClickedMarkNotDone: ({ key }) => withCompleted(model, key, false),
    ClickedResetProgress: () => ({
      model: modifyFields(model, { completedKeys: () => [] }),
      commands: [SaveProgress({ completedKeys: [] })],
    }),
    SucceededSaveProgress: () => ({ model }),
    FailedSaveProgress: () => ({ model }),
    PressedFilterShortcut: () => foldSidebarFocus(model),
    GotSidebarMessage: ({ message: child }) => foldSidebar(model, child),
  })

// SUBSCRIPTION

export const subscriptions = Subscription.make<Model, Message>()(() => ({
  filterShortcut: Subscription.persistent(
    Subscription.keyBindings<Message>({
      bindings: [
        {
          keys: 'Mod+K',
          mapEvent: () => Message.PressedFilterShortcut(),
          whileTyping: 'Allow',
          preventDefault: true,
        },
      ],
    }),
  ),
}))

// VIEW

const lessonHref = (lesson: LessonSummary) =>
  lessonRouter({ topic: lesson.topic, slug: lesson.slug })

const levelTone = {
  starter: 'success',
  'next-step': 'info',
  'deep-dive': 'warning',
} as const

const levelBadge = (lesson: LessonSummary, h: HtmlBuilder<Message>) =>
  Badge.view(
    {
      label: levelLabel[lesson.level],
      tone: levelTone[lesson.level],
      variant: 'outline',
    },
    h,
  )

const isDone = (model: Model, key: string) =>
  Array.contains(model.completedKeys, key)

const doneBadge = (h: HtmlBuilder<Message>) =>
  Badge.view({ label: 'done', tone: 'success', dot: true }, h)

const headerView = (h: HtmlBuilder<Message>) =>
  AppHeader.view(
    {
      title: 'Banking for Beginners',
      titleHref: homeRouter(),
      leading: [h.span([h.Class('brand-mark'), h.AriaHidden(true)], ['$'])],
      status: [
        h.span(
          [
            h.Class('rules-badge'),
            h.Title(
              `Tax figures, limits, and wages are checked against ${rulesYear} rules.`,
            ),
          ],
          [
            Badge.view(
              { label: `${rulesYear} figures`, tone: 'muted', mono: true },
              h,
            ),
          ],
        ),
      ],
      actions: [
        h.a([h.Class('header-link'), h.Href(toolsRouter())], ['Calculators']),
      ],
      sticky: true,
    },
    h,
  )

// HOME

const lessonCardView = (
  model: Model,
  lesson: LessonSummary,
  h: HtmlBuilder<Message>,
) =>
  h.keyed('li')(
    summaryKey(lesson),
    [],
    [
      h.a(
        [
          h.Class(
            isDone(model, summaryKey(lesson))
              ? 'lesson-card lesson-card-done'
              : 'lesson-card',
          ),
          h.Href(lessonHref(lesson)),
        ],
        [
          h.div(
            [h.Class('lesson-card-heading')],
            [
              h.span([h.Class('lesson-card-title')], [lesson.title]),
              isDone(model, summaryKey(lesson))
                ? doneBadge(h)
                : levelBadge(lesson, h),
            ],
          ),
          h.p([h.Class('lesson-card-summary')], [lesson.summary]),
        ],
      ),
    ],
  )

const topicDoneCount = (model: Model, topic: PublishedTopic) =>
  Array.filter(topic.lessons, (lesson) => isDone(model, summaryKey(lesson)))
    .length

const topicView = (
  model: Model,
  topic: PublishedTopic,
  h: HtmlBuilder<Message>,
) =>
  h.section(
    [h.Class('topic'), h.AriaLabelledBy(`topic-${topic.id}`)],
    [
      h.div(
        [h.Class('topic-heading')],
        [
          h.div(
            [h.Class('topic-title-row')],
            [
              h.h2([h.Id(`topic-${topic.id}`)], [topic.title]),
              h.span(
                [h.Class('topic-progress')],
                [
                  `${topicDoneCount(model, topic)} of ${topic.lessons.length} done`,
                ],
              ),
            ],
          ),
          h.p([h.Class('muted')], [topic.blurb]),
        ],
      ),
      h.ul(
        [h.Class('lesson-grid')],
        Array.map(topic.lessons, (lesson) => lessonCardView(model, lesson, h)),
      ),
    ],
  )

const plannedView = (h: HtmlBuilder<Message>) =>
  h.section(
    [h.Class('topic'), h.AriaLabelledBy('topic-planned')],
    [
      h.div(
        [h.Class('topic-heading')],
        [
          h.h2([h.Id('topic-planned')], ['Coming next']),
          h.p([h.Class('muted')], ['These topics are planned.']),
        ],
      ),
      h.ul(
        [h.Class('planned-grid')],
        Array.map(plannedTopics, (topic) =>
          h.keyed('li')(
            topic.id,
            [h.Class('planned-card')],
            [
              h.span([h.Class('lesson-card-title')], [topic.title]),
              h.p([h.Class('lesson-card-summary')], [topic.blurb]),
            ],
          ),
        ),
      ),
    ],
  )

const topicIndexView = (model: Model, h: HtmlBuilder<Message>) =>
  h.nav(
    [h.Class('topic-index'), h.AriaLabel('Topics')],
    [
      h.ul(
        [],
        Array.map(publishedTopics, (topic) =>
          h.keyed('li')(
            topic.id,
            [],
            [
              h.a(
                [h.Href(`#topic-${topic.id}`)],
                [
                  h.span([h.Class('topic-index-title')], [topic.title]),
                  h.span(
                    [h.Class('topic-index-count')],
                    [`${topicDoneCount(model, topic)}/${topic.lessons.length}`],
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    ],
  )

const nextLesson = (model: Model) =>
  Array.findFirst(allLessons, (lesson) => !isDone(model, summaryKey(lesson)))

const progressView = (model: Model, h: HtmlBuilder<Message>) => {
  const done = Array.filter(allLessons, (lesson) =>
    isDone(model, summaryKey(lesson)),
  ).length
  return h.div(
    [h.Class('progress')],
    [
      h.div(
        [h.Class('progress-text')],
        [
          h.strong([], [`${done} of ${lessonCount} lessons done`]),
          Option.match(nextLesson(model), {
            onNone: () => h.span([], [' · You finished every lesson.']),
            onSome: (lesson) =>
              h.span(
                [],
                [
                  done === 0 ? ' · Start with ' : ' · Up next: ',
                  h.a([h.Href(lessonHref(lesson))], [lesson.title]),
                ],
              ),
          }),
        ],
      ),
      h.progress([
        h.Class('progress-bar'),
        h.Value(String(done)),
        h.Max(String(lessonCount)),
        h.AriaLabel('Lessons done'),
      ]),
      done === 0
        ? h.empty
        : Button.view(
            {
              label: 'Reset progress',
              onClick: Message.ClickedResetProgress(),
              variant: 'ghost',
              size: 'xs',
            },
            h,
          ),
    ],
  )
}

const homeView = (model: Model, h: HtmlBuilder<Message>) =>
  h.main(
    [h.Class('home')],
    [
      h.section(
        [h.Class('hero')],
        [
          h.h1([], ['Banking for Beginners']),
          h.p(
            [h.Class('hero-lede')],
            [
              'Short lessons about the money stuff nobody explains: your first paycheck, bank account, tax return, credit card, and lease. Read the notes on the left, the worked example on the right, then check yourself.',
            ],
          ),
          h.p(
            [h.Class('muted')],
            [
              `${lessonCount} lessons in ${publishedTopics.length} topics. Every worked example is checked by the build, and dollar figures follow ${rulesYear} US rules. General information, not personal financial advice.`,
            ],
          ),
          progressView(model, h),
        ],
      ),
      topicIndexView(model, h),
      ...Array.map(publishedTopics, (topic) => topicView(model, topic, h)),
      Array.isReadonlyArrayEmpty(plannedTopics) ? h.empty : plannedView(h),
    ],
  )

// TOOLS

const unitPrefix = {
  dollars: '$',
  percent: '',
  years: '',
  months: '',
  hours: '',
}

const unitSuffix = {
  dollars: '',
  percent: '%',
  years: 'years',
  months: 'months',
  hours: 'hours',
}

const fieldValue = (
  model: Model,
  tool: Tool,
  fieldId: string,
  initial: number,
) => model.toolInputs[tool.id]?.[fieldId] ?? String(initial)

const parsedValues = (model: Model, tool: Tool) =>
  Object.fromEntries(
    tool.fields.map((field) => {
      const parsed = Number(fieldValue(model, tool, field.id, field.initial))
      return [
        field.id,
        Number.isFinite(parsed)
          ? Math.min(field.max, Math.max(field.min, parsed))
          : field.initial,
      ]
    }),
  )

const toolView = (model: Model, tool: Tool, h: HtmlBuilder<Message>) => {
  const result = tool.compute(parsedValues(model, tool))
  return h.section(
    [h.Class('tool'), h.AriaLabelledBy(`tool-${tool.id}`)],
    [
      h.div(
        [h.Class('tool-heading')],
        [
          h.h2([h.Id(`tool-${tool.id}`)], [tool.title]),
          Record.has(model.toolInputs, tool.id)
            ? Button.view(
                {
                  label: 'Reset',
                  onClick: Message.ClickedResetTool({ toolId: tool.id }),
                  variant: 'ghost',
                  size: 'xs',
                },
                h,
              )
            : h.empty,
        ],
      ),
      h.p([h.Class('muted')], [tool.intro]),
      h.div(
        [h.Class('tool-body')],
        [
          h.div(
            [h.Class('tool-fields')],
            Array.map(tool.fields, (field) => {
              const inputId = `tool-${tool.id}-${field.id}`
              return h.keyed('div')(
                field.id,
                [h.Class('tool-field')],
                [
                  h.label([h.For(inputId)], [field.label]),
                  h.div(
                    [h.Class('tool-input')],
                    [
                      unitPrefix[field.unit] === ''
                        ? h.empty
                        : h.span(
                            [h.Class('tool-unit')],
                            [unitPrefix[field.unit]],
                          ),
                      h.input([
                        h.Id(inputId),
                        h.Type('number'),
                        h.InputMode('decimal'),
                        h.Min(String(field.min)),
                        h.Max(String(field.max)),
                        h.Step(String(field.step)),
                        h.Value(
                          fieldValue(model, tool, field.id, field.initial),
                        ),
                        h.OnInput((value) =>
                          Message.UpdatedToolField({
                            toolId: tool.id,
                            fieldId: field.id,
                            value,
                          }),
                        ),
                      ]),
                      unitSuffix[field.unit] === ''
                        ? h.empty
                        : h.span(
                            [h.Class('tool-unit')],
                            [unitSuffix[field.unit]],
                          ),
                    ],
                  ),
                ],
              )
            }),
          ),
          h.div(
            [h.Class('tool-results'), h.AriaLive('polite')],
            [
              h.table(
                [h.Class('ledger'), h.AriaLabel(`${tool.title} results`)],
                [
                  h.tbody(
                    [],
                    Array.map(result.rows, (row) =>
                      h.keyed('tr')(
                        row.label,
                        [
                          h.Class(
                            row.isEmphasized
                              ? 'ledger-row ledger-total'
                              : 'ledger-row',
                          ),
                        ],
                        [
                          h.th([h.Scope('row')], [row.label]),
                          h.td([h.Class('ledger-value')], [row.value]),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              h.p([h.Class('tool-note')], [result.note]),
            ],
          ),
        ],
      ),
    ],
  )
}

const toolsView = (model: Model, h: HtmlBuilder<Message>) =>
  h.main(
    [h.Class('tools-page')],
    [
      Breadcrumb.view(
        {
          ariaLabel: 'Location',
          items: [{ label: 'Lessons', href: homeRouter() }],
          current: 'Calculators',
        },
        h,
      ),
      h.header(
        [h.Class('lesson-header')],
        [
          h.h1([], ['Calculators']),
          h.p(
            [h.Class('lesson-summary')],
            [
              'Change the numbers and the results update as you type. Every calculator is an estimate; real pay, interest, and loans have more moving parts.',
            ],
          ),
        ],
      ),
      ...Array.map(tools, (tool) => toolView(model, tool, h)),
    ],
  )

// LESSON

const segmentView = (segment: Segment, h: HtmlBuilder<Message>) =>
  h.div(
    [
      h.Class(
        Option.isSome(segment.maybeExample)
          ? 'segment'
          : 'segment segment-prose-only',
      ),
    ],
    [
      h.div(
        [h.Class('segment-prose')],
        Array.map(segment.prose, (block) => blockView(block, h)),
      ),
      Option.match(segment.maybeExample, {
        onNone: () => h.empty,
        onSome: (example) =>
          h.div([h.Class('segment-example')], [exampleView(example, h)]),
      }),
    ],
  )

const optionClass = (
  question: Question,
  index: number,
  maybeChosen: Option.Option<number>,
) =>
  Option.match(maybeChosen, {
    onNone: () => 'quiz-option',
    onSome: (chosen) =>
      index === question.answer
        ? 'quiz-option quiz-option-correct'
        : index === chosen
          ? 'quiz-option quiz-option-wrong'
          : 'quiz-option quiz-option-dimmed',
  })

const questionView = (
  model: Model,
  question: Question,
  index: number,
  h: HtmlBuilder<Message>,
) => {
  const maybeChosen = Record.get(model.quizAnswers, String(index))
  return h.keyed('li')(
    String(index),
    [h.Class('quiz-question')],
    [
      h.p(
        [h.Class('quiz-prompt'), h.Id(`quiz-${index}`)],
        inlineView(question.prompt, h),
      ),
      h.div(
        [
          h.Class('quiz-options'),
          h.Role('group'),
          h.AriaLabelledBy(`quiz-${index}`),
        ],
        Array.map(question.options, (option, optionIndex) =>
          h.button(
            [
              h.Type('button'),
              h.Class(optionClass(question, optionIndex, maybeChosen)),
              h.AriaPressed(
                Option.contains(maybeChosen, optionIndex) ? 'true' : 'false',
              ),
              h.Disabled(Option.isSome(maybeChosen)),
              h.OnClick(
                Message.SelectedQuizAnswer({
                  question: index,
                  option: optionIndex,
                }),
              ),
            ],
            inlineView(option, h),
          ),
        ),
      ),
      Option.match(maybeChosen, {
        onNone: () => h.empty,
        onSome: (chosen) =>
          h.p(
            [
              h.Class(
                chosen === question.answer
                  ? 'quiz-feedback quiz-feedback-correct'
                  : 'quiz-feedback quiz-feedback-wrong',
              ),
              h.Role('status'),
            ],
            [
              h.strong(
                [],
                [chosen === question.answer ? 'Right. ' : 'Not quite. '],
              ),
              ...inlineView(question.explanation, h),
            ],
          ),
      }),
    ],
  )
}

const quizScore = (model: Model, lesson: Lesson) =>
  Array.filter(lesson.quiz, (question, index) =>
    Option.contains(
      Record.get(model.quizAnswers, String(index)),
      question.answer,
    ),
  ).length

const quizView = (model: Model, lesson: Lesson, h: HtmlBuilder<Message>) =>
  Array.match(lesson.quiz, {
    onEmpty: () => h.empty,
    onNonEmpty: (quiz) =>
      h.section(
        [h.Class('quiz'), h.AriaLabelledBy('quiz-title')],
        [
          h.h2([h.Id('quiz-title')], ['Check yourself']),
          h.ol(
            [h.Class('quiz-questions')],
            Array.map(quiz, (question, index) =>
              questionView(model, question, index, h),
            ),
          ),
          Record.size(model.quizAnswers) === quiz.length
            ? h.div(
                [h.Class('quiz-score')],
                [
                  h.p(
                    [],
                    [
                      `You got ${quizScore(model, lesson)} of ${quiz.length}. `,
                      quizScore(model, lesson) === quiz.length
                        ? 'Nice work.'
                        : 'Reread the parts you missed, then try again.',
                    ],
                  ),
                  Button.view(
                    {
                      label: 'Try again',
                      onClick: Message.ClickedRetryQuiz(),
                      variant: 'outline',
                      size: 'sm',
                    },
                    h,
                  ),
                ],
              )
            : h.empty,
        ],
      ),
  })

const takeawaysView = (lesson: Lesson, h: HtmlBuilder<Message>) =>
  Array.match(lesson.takeaways, {
    onEmpty: () => h.empty,
    onNonEmpty: (takeaways) =>
      h.section(
        [h.Class('takeaways'), h.AriaLabelledBy('takeaways-title')],
        [
          h.h2([h.Id('takeaways-title')], ['Remember']),
          h.ul(
            [],
            Array.map(takeaways, (item) => h.li([], inlineView(item, h))),
          ),
        ],
      ),
  })

const lessonToolView = (
  model: Model,
  lesson: Lesson,
  h: HtmlBuilder<Message>,
) =>
  Option.match(Option.flatMap(lesson.maybeTool, findTool), {
    onNone: () => h.empty,
    onSome: (tool) =>
      h.div(
        [h.Class('lesson-tool')],
        [
          h.p([h.Class('lesson-tool-label')], ['Try it']),
          toolView(model, tool, h),
        ],
      ),
  })

const doneToggleView = (model: Model, key: string, h: HtmlBuilder<Message>) =>
  h.div(
    [h.Class('done-toggle')],
    [
      isDone(model, key)
        ? Button.view(
            {
              label: 'Done ✓ (undo)',
              onClick: Message.ClickedMarkNotDone({ key }),
              variant: 'outline',
              size: 'sm',
            },
            h,
          )
        : Button.view(
            {
              label: 'Mark lesson as done',
              onClick: Message.ClickedMarkDone({ key }),
              size: 'sm',
            },
            h,
          ),
    ],
  )

const months = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

const formatDate = (isoDate: string) => {
  const [year = '', month = '1', day = '1'] = isoDate.split('-')
  return `${months[Number(month) - 1] ?? ''} ${Number(day)}, ${year}`
}

const historyView = (
  maybeHistory: Option.Option<LessonHistory>,
  h: HtmlBuilder<Message>,
) =>
  Option.match(maybeHistory, {
    onNone: () => h.empty,
    onSome: (history) =>
      h.p(
        [h.Class('lesson-history')],
        [
          `Added ${formatDate(history.added)}`,
          ...(history.updated === history.added
            ? []
            : [` · Updated ${formatDate(history.updated)}`]),
          ` · Checked against ${history.rules} figures on ${formatDate(history.checked)}`,
        ],
      ),
  })

const pagerLinkView = (
  maybeLesson: Option.Option<LessonSummary>,
  direction: 'previous' | 'next',
  h: HtmlBuilder<Message>,
) =>
  Option.match(maybeLesson, {
    onNone: () => h.span([]),
    onSome: (lesson) =>
      h.a(
        [h.Class(`pager-link pager-${direction}`), h.Href(lessonHref(lesson))],
        [
          h.span(
            [h.Class('pager-label')],
            [direction === 'previous' ? '← Previous' : 'Next →'],
          ),
          h.span([h.Class('pager-title')], [lesson.title]),
        ],
      ),
  })

const pageMessageView = (text: string, h: HtmlBuilder<Message>) =>
  h.section([h.Class('page-message')], [h.p([h.Class('muted')], [text])])

const pageBodyView = (
  model: Model,
  page: LessonPage,
  h: HtmlBuilder<Message>,
) => {
  const { lesson } = page
  return [
    h.div(
      [h.Class('segments')],
      Array.map(lesson.segments, (segment) => segmentView(segment, h)),
    ),
    lessonToolView(model, lesson, h),
    takeawaysView(lesson, h),
    quizView(model, lesson, h),
    doneToggleView(model, lessonKey(lesson.topic, lesson.slug), h),
  ]
}

const lessonView = (
  model: Model,
  lesson: LessonSummary,
  h: HtmlBuilder<Message>,
) => {
  const neighbours = neighboursOf(lesson)
  const maybePage =
    model.page._tag === 'Loaded' ? Option.some(model.page.page) : Option.none()
  return h.main(
    [h.Class('lesson')],
    [
      Breadcrumb.view(
        {
          ariaLabel: 'Location',
          items: [
            { label: 'Lessons', href: homeRouter() },
            {
              label: Option.match(findTopic(lesson.topic), {
                onNone: () => lesson.topic,
                onSome: (topic) => topic.title,
              }),
              href: `${homeRouter()}#topic-${lesson.topic}`,
            },
          ],
          current: lesson.title,
        },
        h,
      ),
      h.header(
        [h.Class('lesson-header')],
        [
          h.div(
            [h.Class('lesson-title-row')],
            [
              h.h1([], [lesson.title]),
              levelBadge(lesson, h),
              isDone(model, summaryKey(lesson)) ? doneBadge(h) : h.empty,
            ],
          ),
          h.p([h.Class('lesson-summary')], [lesson.summary]),
          historyView(
            Option.flatMap(maybePage, (page) => page.maybeHistory),
            h,
          ),
        ],
      ),
      ...PageState.match(model.page, {
        None: () => [],
        Loading: () => [pageMessageView('Loading…', h)],
        Failed: () => [
          pageMessageView(
            'This lesson could not be loaded. Reload the page to try again.',
            h,
          ),
        ],
        Loaded: ({ page }) => pageBodyView(model, page, h),
      }),
      h.nav(
        [h.Class('pager'), h.AriaLabel('More lessons')],
        [
          pagerLinkView(neighbours.maybePrevious, 'previous', h),
          pagerLinkView(neighbours.maybeNext, 'next', h),
        ],
      ),
    ],
  )
}

const notFoundView = (path: string, h: HtmlBuilder<Message>) =>
  h.main(
    [h.Class('not-found')],
    [
      h.h1([], ['No lesson here']),
      h.p([h.Class('muted')], [`Nothing lives at ${path}.`]),
      h.a([h.Href(homeRouter())], ['Browse every lesson']),
    ],
  )

const siteName = 'Banking for Beginners'

const pageTitle = (route: AppRoute) =>
  AppRoute.match(route, {
    Home: () => siteName,
    Tools: () => `Calculators · ${siteName}`,
    Lesson: ({ topic, slug }) =>
      Option.match(findLesson(topic, slug), {
        onNone: () => `Not found · ${siteName}`,
        onSome: (lesson) => `${lesson.title} · ${siteName}`,
      }),
    NotFound: () => `Not found · ${siteName}`,
  })

const pageView = (model: Model, h: HtmlBuilder<Message>): Html =>
  AppRoute.match(model.route, {
    Home: () => homeView(model, h),
    Tools: () => toolsView(model, h),
    Lesson: ({ topic, slug }) =>
      Option.match(findLesson(topic, slug), {
        onNone: () => notFoundView(`/${topic}/${slug}`, h),
        onSome: (lesson) => lessonView(model, lesson, h),
      }),
    NotFound: ({ path }) => notFoundView(path, h),
  })

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: pageTitle(model.route),
  body: h.div(
    [h.Class('app'), h.Id('top')],
    [
      headerView(h),
      h.div(
        [h.Class('layout')],
        [
          h.aside(
            [h.Class('layout-sidebar')],
            [
              h.submodel({
                slotId: 'sidebar',
                model: model.sidebar,
                view: Sidebar.view,
                viewInputs: {
                  maybeCurrentKey: currentKey(model.route),
                  completedKeys: model.completedKeys,
                  shortcutLabel: model.shortcutLabel,
                },
                toParentMessage: (message) =>
                  Message.GotSidebarMessage({ message }),
              }),
            ],
          ),
          pageView(model, h),
        ],
      ),
    ],
  ),
})
