# Authoring lessons

Banking for Beginners teaches money to teenagers who are about to handle it on their own: a first job, a first bank account, a first tax return, a first lease. Each lesson is one short page about one idea. The prose is on the left, and a worked example sits beside it on the right: a pay stub, a budget, a scam text, a comparison table. A reader should finish a page knowing what the thing is, why it matters to them now, and what to do.

The content is for the United States. Dollar figures come from `packages/lessons/src/rules.ts` for the tax year it names (today 2026).

## File format

A lesson is `packages/lessons/src/<topic>/<slug>.md`:

````md
---
title: Reading your first pay stub
level: starter
summary: One or two sentences for the index card and the page lede.
tool: paycheck
---

A paragraph of prose. Inline markup: **strong**, _emphasis_, and
[links](https://www.irs.gov) (https only).

```ledger Maya's first paycheck
~ Hours worked | 20 × $15.00
Gross pay | $300.00
- Social Security (6.2%) | $18.60
- Medicare (1.45%) | $4.35
= Net pay | $277.05
```

The next paragraph starts a new segment. Its example goes on the right.

## A heading inside the lesson

- Bullet lists
- work like this

> [!tip] Callouts start with `> [!tip]`, `> [!warning]`, or `> [!note]`.

```takeaways
- Gross pay is what you earned; net pay is what you get.
```

```quiz
? Which is usually bigger?
- Net pay
+ Gross pay
> Gross pay is before taxes and deductions come out.
```
````

### Front matter

- `title`: short, plain, sentence case.
- `level`: `starter` (no background needed), `next-step` (builds on starter lessons), or `deep-dive` (more numbers or detail).
- `summary`: one or two sentences, shown on the index card and under the title.
- `tool` (optional): a "Try it" calculator from `src/tools.ts`: `paycheck`, `compound-growth`, `budget`, `card-payoff`, `emergency-fund`, `loan`, `hours-of-work`. Use one only when it fits the lesson.

### Segments

Paragraphs, lists, headings, and callouts collect into a segment's prose. A fenced example block closes the segment and sits beside its prose. Prose after it starts a new segment. A segment without an example shows prose only. Aim for two to four examples per lesson.

### Example blocks

**`ledger <title>`**: rows of `Label | value` that add up. The build checks the arithmetic, so every worked example must be right to the cent.

- `Label | $300.00`: an amount, added to the running total.
- `+ Label | $50.00`: added. `- Label | $18.60`: subtracted.
- `= Label | $277.05`: a total. It must equal the running total, or the build fails.
- `~ Label | anything`: an info row that is not counted (rates, hours, dates). A row whose value is not plain money (`20 × $15`, `6.2%`, `Monthly`) is info too.
- `# text`: a note row in small print.

Use separate ledgers rather than one ledger that mixes unrelated sums.

**`message <title>`**: a text, email, DM, or call script, for fraud lessons and real-life examples.

```message A text that looks like your bank
Channel: text
From: +1 (555) 013-2245
Your account is LOCKED. Verify now at bank-secure-login.co or lose access.
! Urgent threat and a deadline
! A link that is not your bank's real website
```

`Channel` is `text`, `email`, `dm`, or `call`. `From` is required; `Subject` is optional (for email). Lines starting with `!` are the red flags, listed under the message. Use fictional numbers (`555-01xx`), and made-up but realistic domains. Never use a real company's real domain for a scam sender.

**`table <title>`**: a comparison table, pipe separated; the first row is the header.

```table Checking or savings?
| | Checking | Savings |
| For | Spending | Saving |
| Interest | Little or none | Some |
```

### Takeaways and quiz

Every lesson ends with a `takeaways` block (two to four bullets) and a `quiz` block (two or three questions). Each question has `? prompt`, two to four options (`+` for the one right answer, `-` for the rest), and a `> explanation` that teaches, not only says "correct". Vary the position of the right answer.

## Writing

- Write for a 15 to 18 year old. Plain words, short sentences, second person. Define a term the first time you use it, in **bold**.
- Make it concrete: realistic names, jobs (lifeguard, barista, grocery clerk, babysitter, DoorDash), and amounts a teen would see.
- Explain why, then what to do. End on an action they can take.
- No lectures, no shaming, no "simply" or "just", no em dashes, no emoji. Stay neutral about brands: "a payment app such as Venmo, Zelle, or Cash App" is fine; do not recommend a specific company.
- One idea per lesson, roughly 50 to 120 lines of Markdown. Two short lessons beat one long one.
- Mention when something depends on your state (minimum wage, state income tax, age rules) and point to where to look it up.
- Link only to official or nonprofit sources: federal `.gov` sites (irs.gov, consumerfinance.gov, ftc.gov, fdic.gov, ncua.gov, studentaid.gov, dol.gov, ssa.gov, sec.gov, investor.gov, healthcare.gov, identitytheft.gov, ic3.gov, fbi.gov, nhtsa.gov), annualcreditreport.com, finra.org, naic.org, and the NCMEC sites (missingkids.org, report.cybertip.org, takeitdown.ncmec.org). Never link to a product.

## Correctness

- Take every figure that changes yearly from `src/rules.ts`. Do not write a tax figure, limit, or wage from memory. If a lesson needs a figure that is not in `rules.ts`, report it with a source instead of guessing.
- Name the year: "In 2026, the standard deduction for a single filer is $16,100." When `rules.ts` moves to a new year, these sentences are what reviewers reread.
- General information, not personal advice. Do not promise returns. When investing, say that values go up and down.
- Ledgers must add up (the build checks them), and the prose must agree with the ledger.

## Commands

```sh
bun run lessons:show <topic>/<slug>   # parse a lesson and print its segments, examples, and quiz
bun run lessons:show <topic>           # every lesson in a topic
bunx oxfmt --write packages/lessons/src/<topic>
```

A lesson that fails to parse, or whose ledger does not add up, prints the problem and exits non-zero.

## Boundaries for parallel authors

- Only create files under your own topic directories (and `.cache/<your-name>/` for scratch work).
- Do not edit `catalog.ts`, `rules.ts`, `tools.ts`, `content-log.json`, `package.json`, the site, or another topic's files. Report the slugs in reading order, and anything you need, instead.
