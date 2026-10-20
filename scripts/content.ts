import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'

import { Option, Schema } from 'effect'

import { lessonKey, topics } from '../packages/lessons/src/catalog.ts'
import {
  ContentLog,
  contentStatus,
  describeAttention,
  pendingChanges,
  recordChanges,
  recordReviews,
  type SourceFingerprint,
} from '../packages/lessons/src/content-log.ts'
import { lessonFile } from '../packages/lessons/src/parse.ts'
import { rulesYear } from '../packages/lessons/src/rules.ts'

const usage = `Usage: bun run scripts/content.ts <command>

  status [--stale-days 365]               what changed, when, and what needs attention
  log [--note "..."]                      record added, modified, and removed lessons
  review <topic/slug>... | --all [--note "..."]
                                          record that lessons were reread and still hold
  check                                   fail when sources changed without a log entry`

const root = resolve(import.meta.dirname, '..')
const lessonsSource = join(root, 'packages/lessons/src')
const logPath = join(root, 'packages/lessons/content-log.json')

const today = () => {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

const fingerprints = async (): Promise<ReadonlyArray<SourceFingerprint>> => {
  const directories = (
    await readdir(lessonsSource, { withFileTypes: true })
  ).filter((entry) => entry.isDirectory() && !entry.name.startsWith('__'))
  const nested = await Promise.all(
    directories.map(async (directory) => {
      const files = await readdir(join(lessonsSource, directory.name))
      return Promise.all(
        files.flatMap((file) =>
          Option.match(lessonFile(file), {
            onNone: () => [],
            onSome: (slug) => [
              readFile(join(lessonsSource, directory.name, file), 'utf8').then(
                (source) => ({
                  key: lessonKey(directory.name, slug),
                  hash: new Bun.CryptoHasher('sha256')
                    .update(source)
                    .digest('hex'),
                }),
              ),
            ],
          }),
        ),
      )
    }),
  )
  return nested.flat().sort((a, b) => a.key.localeCompare(b.key))
}

const readLog = async () =>
  Schema.decodeUnknownSync(ContentLog)(
    JSON.parse(await readFile(logPath, 'utf8').catch(() => '{"entries":[]}')),
  )

const writeLog = (log: ContentLog) =>
  writeFile(logPath, `${JSON.stringify(log, null, 2)}\n`)

const { positionals, values } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    note: { type: 'string' },
    all: { type: 'boolean', default: false },
    'stale-days': { type: 'string', default: '365' },
  },
})
const [command, ...keys] = positionals
const context = {
  date: today(),
  rules: rulesYear,
  ...(values.note === undefined ? {} : { note: values.note }),
}

if (command === 'log') {
  const log = await readLog()
  const changes = pendingChanges(log, await fingerprints())
  if (changes.length === 0) {
    console.log('Content log is up to date.')
  } else {
    await writeLog(recordChanges(log, changes, context))
    for (const change of changes) {
      console.log(`${context.date}  ${change.kind.padEnd(8)}  ${change.key}`)
    }
  }
} else if (command === 'review') {
  const log = await readLog()
  const sources = await fingerprints()
  if (pendingChanges(log, sources).length > 0) {
    console.error('Record source changes first with `bun run content:log`.')
    process.exit(1)
  }
  const targets = values.all ? sources.map((source) => source.key) : keys
  const unknown = targets.filter(
    (key) => !sources.some((source) => source.key === key),
  )
  if (targets.length === 0 || unknown.length > 0) {
    console.error(
      unknown.length > 0 ? `Unknown lessons: ${unknown.join(', ')}` : usage,
    )
    process.exit(1)
  }
  await writeLog(recordReviews(log, targets, context))
  console.log(
    `Reviewed ${targets.length} lesson(s) against ${rulesYear} figures.`,
  )
} else if (command === 'check') {
  const changes = pendingChanges(await readLog(), await fingerprints())
  if (changes.length > 0) {
    console.error(
      `Content log is missing ${changes.length} change(s); run \`bun run content:log\`:\n${changes
        .map((change) => `  ${change.kind} ${change.key}`)
        .join('\n')}`,
    )
    process.exit(1)
  }
  console.log('PASS content log matches lesson sources')
} else if (command === 'status') {
  const status = contentStatus(await readLog(), await fingerprints(), topics, {
    today: today(),
    rules: rulesYear,
    staleAfterDays: Number(values['stale-days']),
  })
  const header = ['lesson', 'added', 'updated', 'checked', 'rules']
  const rows = status.histories.map((history) => [
    history.key,
    history.added,
    history.updated,
    history.checked,
    history.rules,
  ])
  const widths = header.map((title, index) =>
    Math.max(title.length, ...rows.map((row) => row[index]?.length ?? 0)),
  )
  const line = (cells: ReadonlyArray<string>) =>
    cells.map((cell, index) => cell.padEnd(widths[index] ?? 0)).join('  ')
  console.log(line(header))
  for (const row of rows) {
    console.log(line(row))
  }
  console.log('')
  if (status.attention.length === 0) {
    console.log('Nothing needs attention.')
  } else {
    console.log(`Needs attention (${status.attention.length}):`)
    for (const item of status.attention) {
      console.log(`  - ${describeAttention(item)}`)
    }
  }
} else {
  console.error(usage)
  process.exit(command === undefined ? 0 : 1)
}
