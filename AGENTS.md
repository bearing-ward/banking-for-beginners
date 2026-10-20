# Project instructions

Use `bun install --frozen-lockfile` and `bun run verify`. Internal workspace names stay generic. Root `hvs.project.localName` owns local identity. Compiler programs belong in each manifest's `hvs.checks.projects`. A new workspace needs its own manifest, compiler configuration, and tests.

Keep neutral core free of host globals. `packages/lessons` (catalog, parser, rules, calculators, content log) is neutral. Put browser code in `apps/web`, Worker code in `apps/api`, and Alchemy imports in `apps/deploy`. Read local README commands before running hosts. Do not deploy without user authorization. Read `FOLDKIT.md` before changing the Foldkit app. The app's Model, Messages, update, and view live in `main.ts`. `sidebar.ts` is a Submodel in its own file, and `blocks.ts` renders lesson content without dispatching Messages. `entry.ts` alone boots the runtime.

## Lessons

Follow [docs/authoring-lessons.md](docs/authoring-lessons.md). Each lesson is `packages/lessons/src/<topic>/<slug>.md`: front matter (`title`, `level`, `summary`, optional `tool`), prose segments, worked examples in fenced `ledger`, `message`, and `table` blocks, then `takeaways` and `quiz`. List slugs in `src/catalog.ts` in reading order. `lessons.test.ts` fails when a file is missing from the catalog, a catalog slug has no file, a lesson does not parse, a ledger does not add up, or a quiz is malformed. Run `bun run lessons:show <topic/slug>` while writing.

The audience is US teenagers. Write plainly, with realistic teen situations. Link only to official or nonprofit sources. This is general education, not personal financial advice.

## Figures and the rules year

Every figure that changes yearly (tax brackets, standard deduction, FICA wage base, contribution limits, minimum wage) lives in `packages/lessons/src/rules.ts`, for the year it names (today 2026). Lessons and calculators read from it; never write such a figure from memory. When the IRS, SSA, or DOL publish a new year's figures:

1. Update `rules.ts` with the new year and values, citing the source.
2. Run `bun run verify:fast`; fix tool tests whose expected numbers changed.
3. Reread every lesson that states a dollar figure (`grep -rl '20[0-9][0-9]' packages/lessons/src`), fix the text and ledgers, then `bun run content:log --note "..."`.
4. `bun run content:review --all --note "<year> figures"` once every lesson has been reread.

## Content log

After adding, editing, or deleting a lesson, run `bun run content:log --note "..."`; `verify:fast` fails until the log matches the sources. When a lesson is reread and still accurate without edits, record it with `bun run content:review <topic/slug>`. Only record a review after actually rereading the lesson against `rules.ts` and its linked sources.

When starting a session on this project, run `bun run content:status` and tell the user what needs attention before other work. That covers unlogged changes, lessons checked against an older rules year, lessons not reviewed in a year, and empty planned topics.

## Effect version

Every Effect release-train package (`effect`, `@effect/platform-*`) resolves to one exact version. Today that is 4.0.5. Bump it in every workspace manifest and in root `overrides`. Foldkit pins its `@effect/platform-browser` peer exactly, and Bun overrides don't rewrite peers, so root `resolutions` also pins that package. After `bun install`, confirm `bun.lock` lists only one version of each train package.

Foldkit 0.165–0.168 declares `effect: 4.0.0`. effect 4.0.5 turned `Crypto.randomUUIDv4`/`randomUUIDv7` into methods, which silently broke the Vite plugin's DevTools MCP relay. `patches/@foldkit%2Fvite-plugin@0.26.0.patch` carries that one-line fix. Drop it once Foldkit supports the new API. Patch-level Effect releases can break dependents, so run the full `bun run verify` after every bump.
