# End-to-end interaction tests

Automated checks for map gestures and selection. They drive the **dev server**
(they use the dev-only `window.__kuMap` / `window.__kuGesture` hooks).

```bash
npm run dev -- --port 5179        # in another terminal
npm run test:touch                # multi-touch gestures, Chrome mobile emulation (26 checks)
npm run test:desktop              # mouse + keyboard on desktop Chrome (9 checks)
npm run test:webkit               # Safari engine: native taps + synthetic multi-touch (9 checks)
```

Requirements: Google Chrome installed (tests use `channel: 'chrome'`), and for
WebKit a one-time `npx playwright-core install webkit`. Set `MAP_URL` to test
another address.

Touches are sent through the Chrome DevTools Protocol with explicit
timestamps from a virtual clock, so double-tap windows and fling velocities
are exact even when software rendering makes frames slow.

These complement, not replace, testing on real phones: emulation can't judge
how a gesture *feels* (inertia, thresholds, finger occlusion).
