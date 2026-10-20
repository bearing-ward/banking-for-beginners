import '@foldworks/ui/theme.css'
import './style.css'

import { Effect } from 'effect'
import { Runtime } from 'foldkit'

import {
  Flags,
  init,
  savedProgress,
  Message,
  Model,
  subscriptions,
  update,
  view,
} from './main.ts'

const flags = Effect.map(savedProgress, (completedKeys) =>
  Flags.make({
    shortcutLabel: /Mac|iPhone|iPad/u.test(navigator.userAgent)
      ? '⌘K'
      : 'Ctrl K',
    completedKeys,
  }),
)

Runtime.run(
  Runtime.makeApplication({
    Model,
    Flags,
    init,
    update,
    view,
    subscriptions,
    container: document.getElementById('app'),
    routing: {
      onUrlRequest: (request) => Message.ClickedLink({ request }),
      onUrlChange: (url) => Message.ChangedUrl({ url }),
    },
    devTools: { Message },
  }),
  { flags },
)
