import { readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { Option } from 'effect'

import { lessonFile, parseLesson } from '../packages/lessons/src/parse.ts'
import { isTool } from '../packages/lessons/src/tools.ts'

// Parses lessons and prints what the page will show, for authoring.
// Usage: bun run lessons:show <topic/slug | topic>...
const lessonsRoot = resolve(import.meta.dirname, '../packages/lessons/src')

const keysFor = async (target: string) => {
  if (target.includes('/')) {
    return [target]
  }
  const files = await readdir(join(lessonsRoot, target)).catch(() => [])
  return files.flatMap((file) =>
    Option.match(lessonFile(file), {
      onNone: () => [],
      onSome: (slug) => [`${target}/${slug}`],
    }),
  )
}

const targets = process.argv.slice(2)
if (targets.length === 0) {
  console.error('Usage: bun run lessons:show <topic/slug | topic>...')
  process.exit(1)
}

for (const key of (await Promise.all(targets.map(keysFor))).flat()) {
  const [topic = '', slug = ''] = key.split('/')
  const file = Bun.file(join(lessonsRoot, topic, `${slug}.md`))
  if (!(await file.exists())) {
    console.log(`\n===== ${key}: no such lesson`)
    process.exitCode = 1
    continue
  }
  try {
    const lesson = parseLesson(topic, slug, await file.text(), isTool)
    console.log(`\n===== ${key} [${lesson.level}] ${lesson.title}`)
    console.log(`  ${lesson.summary}`)
    if (Option.isSome(lesson.maybeTool)) {
      console.log(`  tool: ${lesson.maybeTool.value}`)
    }
    for (const segment of lesson.segments) {
      for (const block of segment.prose) {
        const text =
          block._tag === 'List'
            ? block.items.map((item) => `• ${item}`).join(' ')
            : block.text
        console.log(`\n  ${block._tag.toUpperCase()}: ${text}`)
      }
      if (Option.isSome(segment.maybeExample)) {
        const example = segment.maybeExample.value
        console.log(`  ┃ ${example._tag}: ${example.title}`)
        if (example._tag === 'Ledger') {
          for (const row of example.rows) {
            console.log(
              `  ┃   ${row.kind.padEnd(8)} ${row.label} | ${row.value}`,
            )
          }
        } else if (example._tag === 'Table') {
          for (const row of [example.header, ...example.rows]) {
            console.log(`  ┃   ${row.join(' | ')}`)
          }
        } else {
          console.log(
            `  ┃   ${example.channel} from ${example.from} ${example.subject}`,
          )
          for (const line of example.body) {
            console.log(`  ┃   ${line}`)
          }
          for (const flag of example.flags) {
            console.log(`  ┃   ! ${flag}`)
          }
        }
      }
    }
    console.log(
      `\n  TAKEAWAYS: ${lesson.takeaways.length}, QUIZ: ${lesson.quiz.length}`,
    )
    for (const question of lesson.quiz) {
      console.log(
        `  ? ${question.prompt} → ${question.options[question.answer] ?? ''}`,
      )
    }
  } catch (error) {
    console.log(
      `\n===== ${key}: ${error instanceof Error ? error.message : String(error)}`,
    )
    process.exitCode = 1
  }
}
