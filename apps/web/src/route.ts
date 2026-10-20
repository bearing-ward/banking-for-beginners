import { pipe, Schema } from 'effect'
import { Route } from 'foldkit'
import { defineRouteUnion, literal, slash, string } from 'foldkit/route'
import type { Url } from 'foldkit/url'

export const AppRoute = defineRouteUnion({
  Home: {},
  Tools: {},
  About: {},
  Lesson: { topic: Schema.String, slug: Schema.String },
  NotFound: { path: Schema.String },
})
export type AppRoute = typeof AppRoute.Type

// The site may be served below a path, such as `/banking-for-beginners/` on
// GitHub Pages. Vite's `base` sets `BASE_URL`; routes are parsed without it
// and printed with it.
const base = import.meta.env.BASE_URL.replace(/\/$/u, '')

const homeRoute = pipe(Route.root, Route.mapTo(AppRoute.Home))

const toolsRoute = pipe(literal('tools'), Route.mapTo(AppRoute.Tools))

const aboutRoute = pipe(literal('about'), Route.mapTo(AppRoute.About))

const lessonRoute = pipe(
  string('topic'),
  slash(string('slug')),
  Route.mapTo(AppRoute.Lesson),
)

export const homeRouter = () => `${base}${homeRoute()}`

export const toolsRouter = () => `${base}${toolsRoute()}`

export const aboutRouter = () => `${base}${aboutRoute()}`

export const lessonRouter = (
  params: Parameters<typeof lessonRoute>[0],
): string => `${base}${lessonRoute(params)}`

const parseRoute = Route.parseUrlWithFallback(
  Route.oneOf(lessonRoute, toolsRoute, aboutRoute, homeRoute),
  AppRoute.NotFound,
)

export const urlToAppRoute = (url: Url): AppRoute =>
  parseRoute(
    base !== '' &&
      (url.pathname === base || url.pathname.startsWith(`${base}/`))
      ? { ...url, pathname: url.pathname.slice(base.length) || '/' }
      : url,
  )
