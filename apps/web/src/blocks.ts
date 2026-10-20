import {
  type Block,
  Example,
  type LedgerRow,
  type MessageChannel,
  parseInline,
  parseMoney,
  type Span,
} from '@bfb/lessons'
import { Array, Option } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

// Views for lesson content. They read a parsed lesson and dispatch nothing,
// so they work with any Message type.

const spanView = <Message>(span: Span, h: HtmlBuilder<Message>) => {
  if (span._tag === 'Strong') {
    return h.strong([], [span.text])
  }
  if (span._tag === 'Emphasis') {
    return h.em([], [span.text])
  }
  if (span._tag === 'Link') {
    return h.a(
      [h.Href(span.href), h.Target('_blank'), h.Rel('noopener noreferrer')],
      [span.text],
    )
  }
  return span.text
}

export const inlineView = <Message>(text: string, h: HtmlBuilder<Message>) =>
  Array.map(parseInline(text), (span) => spanView(span, h))

const calloutLabel = { note: 'Note', tip: 'Tip', warning: 'Watch out' }

export const blockView = <Message>(
  block: Block,
  h: HtmlBuilder<Message>,
): Html => {
  if (block._tag === 'Heading') {
    return h.h2([h.Class('prose-heading')], inlineView(block.text, h))
  }
  if (block._tag === 'List') {
    const items = Array.map(block.items, (item) =>
      h.li([], inlineView(item, h)),
    )
    return block.isOrdered
      ? h.ol([h.Class('prose-list')], items)
      : h.ul([h.Class('prose-list')], items)
  }
  if (block._tag === 'Callout') {
    return h.aside(
      [h.Class(`callout callout-${block.tone}`)],
      [
        h.span([h.Class('callout-label')], [calloutLabel[block.tone]]),
        h.p([], inlineView(block.text, h)),
      ],
    )
  }
  return h.p([], inlineView(block.text, h))
}

// LEDGER

const isZero = (value: string) =>
  Option.exists(parseMoney(value), (amount) => amount === 0)

const ledgerValue = (row: LedgerRow) =>
  row.kind === 'subtract' && !isZero(row.value)
    ? `−${row.value.replace(/^-/u, '')}`
    : row.value

const ledgerRowView = <Message>(row: LedgerRow, h: HtmlBuilder<Message>) =>
  row.kind === 'note'
    ? h.tr(
        [h.Class('ledger-row ledger-note')],
        [h.td([h.Attribute('colspan', '2')], inlineView(row.label, h))],
      )
    : h.tr(
        [
          h.Class(
            isZero(row.value) && row.kind === 'subtract'
              ? 'ledger-row ledger-zero'
              : `ledger-row ledger-${row.kind}`,
          ),
        ],
        [
          h.th([h.Scope('row')], inlineView(row.label, h)),
          h.td([h.Class('ledger-value')], [ledgerValue(row)]),
        ],
      )

// MESSAGE

const channelLabel: Record<MessageChannel, string> = {
  text: 'Text message',
  email: 'Email',
  dm: 'Direct message',
  call: 'Phone call',
}

const messageView = <Message>(
  message: Extract<Example, { _tag: 'Message' }>,
  h: HtmlBuilder<Message>,
) =>
  h.div(
    [h.Class('message-example')],
    [
      h.div(
        [h.Class(`message-card message-${message.channel}`)],
        [
          h.div(
            [h.Class('message-meta')],
            [
              h.span(
                [h.Class('message-channel')],
                [channelLabel[message.channel]],
              ),
              h.span([h.Class('message-from')], [message.from]),
              message.subject === ''
                ? h.empty
                : h.span([h.Class('message-subject')], [message.subject]),
            ],
          ),
          h.div(
            [h.Class('message-body')],
            Array.map(message.body, (line) =>
              line === '' ? h.br([]) : h.p([], [line]),
            ),
          ),
        ],
      ),
      Array.match(message.flags, {
        onEmpty: () => h.empty,
        onNonEmpty: (flags) =>
          h.div(
            [h.Class('message-flags')],
            [
              h.p([h.Class('message-flags-title')], ['Red flags']),
              h.ul(
                [],
                Array.map(flags, (flag) => h.li([], inlineView(flag, h))),
              ),
            ],
          ),
      }),
    ],
  )

// EXAMPLE

export const exampleView = <Message>(
  example: Example,
  h: HtmlBuilder<Message>,
): Html =>
  h.figure(
    [h.Class(`example example-${example._tag.toLowerCase()}`)],
    [
      example.title === ''
        ? h.empty
        : h.figcaption([h.Class('example-title')], [example.title]),
      Example.match(example, {
        Ledger: ({ rows }) =>
          h.table(
            [h.Class('ledger')],
            [
              h.tbody(
                [],
                Array.map(rows, (row) => ledgerRowView(row, h)),
              ),
            ],
          ),
        Message: (message) => messageView(message, h),
        Table: ({ header, rows }) =>
          h.div(
            [h.Class('table-scroll')],
            [
              h.table(
                [h.Class('compare')],
                [
                  h.thead(
                    [],
                    [
                      h.tr(
                        [],
                        Array.map(header, (cell) =>
                          h.th([h.Scope('col')], inlineView(cell, h)),
                        ),
                      ),
                    ],
                  ),
                  h.tbody(
                    [],
                    Array.map(rows, (row) =>
                      h.tr(
                        [],
                        Array.map(row, (cell, index) =>
                          index === 0
                            ? h.th([h.Scope('row')], inlineView(cell, h))
                            : h.td([], inlineView(cell, h)),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
      }),
    ],
  )
