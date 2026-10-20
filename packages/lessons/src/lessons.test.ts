import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { Option } from 'effect'
import { describe, expect, test } from 'vitest'

import { topics } from './catalog.ts'
import { lessonFile, parseLesson } from './parse.ts'
import { isTool } from './tools.ts'

const sourceRoot = import.meta.dirname

const lessonFiles = (topic: string) => {
  try {
    return readdirSync(join(sourceRoot, topic)).flatMap((file) =>
      Option.toArray(lessonFile(file)),
    )
  } catch {
    return []
  }
}

test('every lesson directory belongs to a topic', () => {
  const directories = readdirSync(sourceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('__'))
    .map((entry) => entry.name)
  const ids = topics.map((topic) => topic.id)
  expect(directories.filter((directory) => !ids.includes(directory))).toEqual(
    [],
  )
})

describe.each(topics)('$title lessons', (topic) => {
  test('the catalog lists exactly the lesson files', () => {
    expect([...topic.slugs].sort()).toEqual(lessonFiles(topic.id).sort())
  })

  test.each([...topic.slugs])(
    '%s parses, adds up, and ends with a quiz',
    (slug) => {
      const lesson = parseLesson(
        topic.id,
        slug,
        readFileSync(join(sourceRoot, topic.id, `${slug}.md`), 'utf8'),
        isTool,
      )
      expect(lesson.takeaways.length).toBeGreaterThan(0)
      expect(lesson.quiz.length).toBeGreaterThanOrEqual(2)
    },
  )
})
