<img src="assets/icon.svg" width="64" height="64" alt="">

# Banking for Beginners

Short money lessons for teenagers who are about to handle it on their own: a first job, a first bank account, a first tax return, a first credit card, a first lease. Each page is one idea. Notes are on the left and a worked example is on the right: a pay stub, a budget, a scam text with its red flags marked. Many pages have a **Try it** calculator, and every page ends with a short quiz. Progress is saved in the browser.

Every worked example is checked by the build: a ledger whose rows do not add up to its totals fails the tests. Dollar figures that change yearly come from one file, `packages/lessons/src/rules.ts` (currently 2026 US figures), and each page shows the date it was last checked against them.

The content is US-focused general education, not personal financial advice.

Built on the cafe stack (Cloudflare, Alchemy, Foldkit, Effect) with [Foldworks](https://foldworks.dev) UI, using [Effect by Example](../effectbyexample) as the template (see `PROVENANCE.json`).

## What's here

86 lessons in 12 topics:

- **Money basics** (7): Needs and wants, trade-offs, goals, and the habits everything else builds on.
- **Banking** (8): Checking and savings accounts, debit cards, statements, fees, and keeping your money safe.
- **Work and paychecks** (7): Your first job: the paperwork, the pay stub, and why your check is smaller than you expected.
- **Taxes** (6): How income tax works, what withholding is, and how to file your first return.
- **Budgets and bills** (8): Plan where your money goes, keep bills on time, and price out life on your own.
- **Saving** (6): Emergency funds, interest, and where to keep money you will need later.
- **Credit and borrowing** (9): Credit scores, credit cards, loans, and the borrowing traps to stay out of.
- **Investing** (8): Risk and return, index funds, retirement accounts, and why starting young matters.
- **Fraud and scams** (11): Spot the tricks scammers use on teens, protect your identity, and know what to do if it happens.
- **Insurance** (5): How insurance works, and the policies you will meet first: car, health, and renters.
- **Paying for college** (6): What school really costs, the FAFSA, free money, and student loans.
- **Turning 18** (5): What changes when you become a legal adult: contracts, cars, and your rights as a customer.

Seven calculators, on lesson pages and together at `/tools`: paycheck estimator, compound growth, 50/30/20 budget, credit card payoff, emergency fund planner, loan calculator, and price in hours of work.

## Run it

```sh
bun install --frozen-lockfile
bun run foldkit:source   # pinned Foldkit source in repos/foldkit, for reference
bun run dev
```

`bun run dev` serves the site through [Portless](https://github.com/vercel-labs/portless) at `https://banking-for-beginners.localhost`. The first time, Portless needs its HTTPS proxy on port 443, which prompts for your password, so start it once from a terminal:

```sh
sudo bunx portless proxy start --https
```

Use `bun run dev:direct` (or `PORTLESS=0 bun run dev`) to skip the proxy and serve on `http://localhost:4321`.

## Add a lesson

1. Create `packages/lessons/src/<topic>/<slug>.md`:

   ````md
   ---
   title: Reading your first pay stub
   level: starter
   summary: One or two sentences for the index card and page lede.
   tool: paycheck
   ---

   Prose for the left column. **Bold** defines a term.

   ```ledger Maya's pay stub
   Gross pay | $300.00
   - Social Security (6.2%) | $18.60
   - Medicare (1.45%) | $4.35
   = Net pay | $277.05
   ```

   ```takeaways
   - Budget with net pay.
   ```

   ```quiz
   ? Which is bigger?
   - Net pay
   + Gross pay
   > Gross pay is before taxes come out.
   ```
   ````

2. Add the slug to its topic's `slugs` in `packages/lessons/src/catalog.ts`, in reading order. A topic is published once it has slugs.
3. Run `bun run lessons:show <topic>/<slug>` to see the parsed page and catch arithmetic or format errors.
4. Run `bun run content:log --note "what changed"` to record it in the content log.
5. Run `bun run verify:fast`.

The full format and writing rules (audience, tone, sources, figures) are in [docs/authoring-lessons.md](docs/authoring-lessons.md).

## Content log

`packages/lessons/content-log.json` is an append-only history of every lesson: when it was added, modified, reviewed, or removed, a hash of its source, and the rules year it was checked against. Pages show "Added · Updated · Checked against 2026 figures on …".

```sh
bun run content:status                        # dates plus anything needing attention
bun run content:log --note "..."              # record added, modified, and removed lessons
bun run content:review taxes/do-you-need-to-file   # reread and still accurate
bun run content:review --all --note "2027 figures" # after updating rules.ts, once lessons are reread
```

`content:status` flags unlogged changes, lessons checked against an older rules year than `rules.ts`, lessons not reviewed in 365 days (`--stale-days N`), and planned topics with no lessons. `verify:fast` fails while the log is out of sync with the sources.

## Layout

```text
packages/
  lessons/   lesson Markdown, parser and ledger checks, catalog, 2026 rules, calculators, content log (neutral)
apps/
  web/       Foldkit site with Foldworks UI; lessons-plugin.ts turns Markdown into lazy page chunks
             sidebar.ts: lesson finder (Cmd/Ctrl+K), collapsible topics, arrow-key navigation, done marks
  api/       Cloudflare Worker: /api/health, JSON 404 for other /api routes, then static assets
  deploy/    Alchemy stack: Worker plus Foldkit website
```

## Verify

```sh
bun run verify:fast         # types, Effect diagnostics, format, lint, content log, tests
bun run verify:template     # HVS compiler-ownership checks, Foldkit source pin
bun run browser:install     # once
bun run verify:integration  # real alchemy dev host, browser run, DevTools MCP
bun run verify:production   # built Worker and assets in Miniflare
bun run verify              # everything
```

## Deploy

`bun run deploy` needs Cloudflare credentials and your explicit go-ahead. After the first deploy, the stack key (`BankingForBeginners`) and resource key (`Website`) are durable identities.

### GitHub Pages

The site is static, so it also runs on GitHub Pages. `.github/workflows/pages.yml` builds and publishes it on every push to `main`. To turn it on, set Settings → Pages → Source to "GitHub Actions". Pages needs a public repository, or a paid plan for a private one.

Pages serves the site below `/<repository>/`. `bun run build:pages` builds with Vite's `base` set from `PAGES_BASE` (default `/banking-for-beginners/`; the workflow passes the real path). It also writes an HTML copy for every lesson and `/tools`, so deep links return 200, and a `404.html` that boots the app for any other path. `bun run verify:pages` serves that build the way Pages does and checks it in a browser; `bun run verify` includes it.
