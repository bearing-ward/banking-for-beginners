import { Option } from 'effect'
import { expect, test } from 'vitest'

import { parseInline } from './inline.ts'
import { parseLesson, parseMoney } from './parse.ts'

const lesson = (body: string, header = 'tool: budget\n') =>
  `---\ntitle: Test\nlevel: starter\nsummary: A test lesson.\n${header}---\n\n${body}`

const fence = (kind: string, lines: ReadonlyArray<string>) =>
  ['```' + kind, ...lines, '```'].join('\n')

test('prose before an example sits beside it; prose after starts a new segment', () => {
  const parsed = parseLesson(
    'banking',
    'test',
    lesson(
      [
        'First paragraph.',
        '',
        '- one',
        '- two',
        '',
        fence('ledger Budget', [
          'Pay | $100.00',
          '- Rent | $60',
          '= Left | $40.00',
        ]),
        '',
        '## Next part',
        '',
        '> [!warning] Careful.',
      ].join('\n'),
    ),
  )
  expect(parsed.segments).toHaveLength(2)
  expect(parsed.segments[0]?.prose.map((block) => block._tag)).toEqual([
    'Paragraph',
    'List',
  ])
  expect(Option.isSome(parsed.segments[0]?.maybeExample ?? Option.none())).toBe(
    true,
  )
  expect(parsed.segments[1]?.prose).toEqual([
    { _tag: 'Heading', text: 'Next part' },
    { _tag: 'Callout', tone: 'warning', text: 'Careful.' },
  ])
  expect(parsed.maybeTool).toEqual(Option.some('budget'))
})

test('a ledger whose total does not add up fails with the numbers', () => {
  expect(() =>
    parseLesson(
      'banking',
      'test',
      lesson(
        fence('ledger Bad', [
          'Pay | $300.00',
          '- Tax | $22.95',
          '= Net | $277.50',
        ]),
      ),
    ),
  ).toThrow('rows above add up to 277.05')
})

test('info rows and non-money values are not counted', () => {
  const parsed = parseLesson(
    'banking',
    'test',
    lesson(
      fence('ledger Ok', [
        '~ Rate | $15.00',
        'Hours | 20 × $15',
        'Pay | $300',
        '= Total | $300.00',
      ]),
    ),
  )
  const example = Option.getOrThrow(
    parsed.segments[0]?.maybeExample ?? Option.none(),
  )
  expect(
    example._tag === 'Ledger' && example.rows.map((row) => row.kind),
  ).toEqual(['info', 'info', 'amount', 'total'])
})

test('messages keep their red flags apart from the body', () => {
  const parsed = parseLesson(
    'fraud',
    'test',
    lesson(
      fence('message A text', [
        'Channel: text',
        'From: +1 (555) 010-0000',
        'Pay now.',
        '! Urgency',
      ]),
    ),
  )
  expect(parsed.segments[0]?.maybeExample).toEqual(
    Option.some({
      _tag: 'Message',
      title: 'A text',
      channel: 'text',
      from: '+1 (555) 010-0000',
      subject: '',
      body: ['Pay now.'],
      flags: ['Urgency'],
    }),
  )
})

test('quiz questions need exactly one right answer and an explanation', () => {
  const parsed = parseLesson(
    'banking',
    'test',
    lesson(
      [
        'Intro.',
        '',
        fence('quiz', ['? Pick one', '- no', '+ yes', '> Because.']),
      ].join('\n'),
    ),
  )
  expect(parsed.quiz).toEqual([
    {
      prompt: 'Pick one',
      options: ['no', 'yes'],
      answer: 1,
      explanation: 'Because.',
    },
  ])
  expect(() =>
    parseLesson(
      'banking',
      'test',
      lesson(
        ['Intro.', '', fence('quiz', ['? Pick', '+ a', '+ b', '> x'])].join(
          '\n',
        ),
      ),
    ),
  ).toThrow('exactly one')
})

test('unknown tools, blocks, and front matter are rejected', () => {
  expect(() =>
    parseLesson(
      'banking',
      'test',
      lesson('Text.', 'tool: nope\n'),
      () => false,
    ),
  ).toThrow('unknown tool')
  expect(() =>
    parseLesson('banking', 'test', lesson(fence('chart', ['x']))),
  ).toThrow('unknown block')
  expect(() => parseLesson('banking', 'test', 'No front matter')).toThrow(
    'front matter',
  )
})

test('money parses plain amounts only', () => {
  expect(parseMoney('$1,234.50')).toEqual(Option.some(1234.5))
  expect(parseMoney('20 hours')).toEqual(Option.none())
  expect(parseMoney('6.2%')).toEqual(Option.none())
})

test('inline markup becomes spans', () => {
  expect(
    parseInline(
      'Pay **yourself** first, see [the CFPB](https://www.consumerfinance.gov).',
    ),
  ).toEqual([
    { _tag: 'Text', text: 'Pay ' },
    { _tag: 'Strong', text: 'yourself' },
    { _tag: 'Text', text: ' first, see ' },
    { _tag: 'Link', text: 'the CFPB', href: 'https://www.consumerfinance.gov' },
    { _tag: 'Text', text: '.' },
  ])
})
