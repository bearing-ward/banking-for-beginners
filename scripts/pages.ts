import { join, resolve } from 'node:path'

import { chromium, expect } from '@playwright/test'

import { run } from './checks.ts'

const root = resolve(import.meta.dirname, '..')
const dist = join(root, 'apps/web/dist')
const base = '/banking-for-beginners'

// Serves the build the way GitHub Pages does: below the repository path,
// `/x` from `x`, `x.html` or `x/index.html`, and 404.html with status 404
// for anything else.
const servePages = () =>
  Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request) {
      const { pathname } = new URL(request.url)
      if (pathname !== base && !pathname.startsWith(`${base}/`)) {
        return new Response('Not found', { status: 404 })
      }
      const path = decodeURIComponent(pathname.slice(base.length))
      for (const candidate of [path, `${path}.html`, `${path}/index.html`]) {
        const file = Bun.file(join(dist, candidate))
        if (!candidate.endsWith('/') && (await file.exists())) {
          return new Response(file)
        }
      }
      return new Response(Bun.file(join(dist, '404.html')), { status: 404 })
    },
  })

export async function verifyPages(): Promise<void> {
  // `build:pages` defaults `PAGES_BASE` to `${base}/`.
  console.log((await run(['bun', 'run', 'build:pages'])).stdout)
  const server = servePages()
  const url = `http://127.0.0.1:${server.port}${base}`
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    const errors: Array<string> = []
    page.on('pageerror', (error) => errors.push(error.message))

    const deepLink = await page.goto(`${url}/fraud/fake-check-scams`)
    expect(deepLink?.status()).toBe(200)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Fake check scams' }),
    ).toBeVisible()

    await page.getByRole('link', { name: /Next/u }).click()
    await expect(page).toHaveURL(new RegExp(`${base}/fraud/[a-z-]+$`, 'u'))
    await page
      .getByRole('link', { name: 'Banking for Beginners' })
      .first()
      .click()
    await expect(page).toHaveURL(`${url}/`)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Banking for Beginners' }),
    ).toBeVisible()

    const tools = await page.goto(`${url}/tools`)
    expect(tools?.status()).toBe(200)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Calculators' }),
    ).toBeVisible()

    const about = await page.goto(`${url}/about`)
    expect(about?.status()).toBe(200)
    await expect(page).toHaveTitle('About · Banking for Beginners')
    await expect(page.getByText('This is not financial advice!')).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'file an issue' }),
    ).toHaveAttribute(
      'href',
      'https://github.com/bearing-ward/banking-for-beginners/issues/new',
    )

    const missing = await page.goto(`${url}/no/such-page`)
    expect(missing?.status()).toBe(404)
    await expect(page).toHaveTitle('Not found · Banking for Beginners')

    expect(errors).toEqual([])
    console.log(
      `PASS GitHub Pages build below ${base}/: deep link, calculators, navigation, and 404`,
    )
  } finally {
    await browser.close()
    await server.stop(true)
  }
}

if (import.meta.main) {
  await verifyPages()
}
