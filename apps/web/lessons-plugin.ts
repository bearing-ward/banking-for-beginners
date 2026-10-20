import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { Schema } from 'effect'
import type { Plugin, ViteDevServer } from 'vite'

import {
  ContentLog,
  historyOf,
  isTool,
  type LessonPage,
  LessonPage as LessonPageSchema,
  type LessonSummary,
  lessonKey,
  parseLesson,
  topics,
} from '../../packages/lessons/src/index.ts'

const lessonsRoot = resolve(import.meta.dirname, '../../packages/lessons')
const sourceRoot = join(lessonsRoot, 'src')
const contentLogPath = join(lessonsRoot, 'content-log.json')

// `virtual:lessons` lists every published lesson's front matter, small enough
// to ship with the app. Each `virtual:lesson-page/<topic>/<slug>` holds the
// rest of one page (prose, examples, quiz, history) as its own chunk, which
// the app loads when that page opens.
const indexId = 'virtual:lessons'
const pagePrefix = 'virtual:lesson-page/'
const resolved = (id: string) => `\0${id}`

const readLesson = async (topic: string, slug: string) => {
  const path = join(sourceRoot, topic, `${slug}.md`)
  return {
    path,
    lesson: parseLesson(topic, slug, await readFile(path, 'utf8'), isTool),
  }
}

const summaryOf = ({
  topic,
  slug,
  title,
  level,
  summary,
}: LessonSummary): LessonSummary => ({ topic, slug, title, level, summary })

const published = topics.filter((topic) => topic.status === 'published')

export const lessonsPlugin = (): Plugin => ({
  name: 'lessons',
  resolveId(id) {
    return id === indexId || id.startsWith(pagePrefix) ? resolved(id) : null
  },
  async load(id) {
    if (id === resolved(indexId)) {
      const summaries: Array<LessonSummary> = []
      for (const topic of published) {
        for (const slug of topic.slugs) {
          const { path, lesson } = await readLesson(topic.id, slug)
          this.addWatchFile(path)
          summaries.push(summaryOf(lesson))
        }
      }
      const loaders = summaries.map((summary) => {
        const key = lessonKey(summary.topic, summary.slug)
        return `  ${JSON.stringify(key)}: () => import(${JSON.stringify(`${pagePrefix}${key}`)}),`
      })
      return [
        `export const summaries = ${JSON.stringify(summaries)}`,
        `export const pageLoaders = {\n${loaders.join('\n')}\n}`,
      ].join('\n')
    }
    if (id.startsWith(resolved(pagePrefix))) {
      const key = id.slice(resolved(pagePrefix).length)
      const [topic = '', slug = ''] = key.split('/')
      const { path, lesson } = await readLesson(topic, slug)
      this.addWatchFile(path)
      this.addWatchFile(contentLogPath)
      const log = Schema.decodeUnknownSync(ContentLog)(
        JSON.parse(await readFile(contentLogPath, 'utf8')),
      )
      const page: LessonPage = { lesson, maybeHistory: historyOf(log, key) }
      return `export default ${JSON.stringify(Schema.encodeSync(LessonPageSchema)(page))}`
    }
    return null
  },
  // A changed lesson or log can change any page and the index, so drop every
  // virtual module and reload.
  handleHotUpdate({ file, server }) {
    if (file.startsWith(lessonsRoot) && !file.endsWith('.test.ts')) {
      invalidateAll(server)
      server.ws.send({ type: 'full-reload' })
      return []
    }
    return undefined
  },
})

const invalidateAll = (server: ViteDevServer) => {
  for (const module of server.moduleGraph.idToModuleMap.values()) {
    if (module.id?.startsWith('\0virtual:lesson')) {
      server.moduleGraph.invalidateModule(module)
    }
  }
}
