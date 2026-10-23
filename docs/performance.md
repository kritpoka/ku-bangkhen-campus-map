# Performance notes (milestone 6)

## Method

Lighthouse 12, mobile form factor (simulated slow 4G + 4× CPU throttling), run
against the production build (`npm run build && npx vite preview`) in headed
Chrome on a Mac with a real GPU. Each figure is the **median of 3 runs**;
category scores show all three runs because WebGL timing varies a lot between
runs. Headless Chrome with software GL gives much worse, unrepresentative
blocking-time numbers, so it wasn't used for these.

## Results

| | Before | After |
|---|---|---|
| Performance | 50 (47/50/52) | 64 (31/64/74) |
| Accessibility | 100 | 100 |
| Best practices | 100 | 100 |
| SEO | 92 (no robots.txt) | 100 |
| First Contentful Paint | 4.96 s | 2.93 s |
| Largest Contentful Paint | 5.12 s | 3.08 s |
| Speed Index | 4.96 s | 3.82 s |
| Total Blocking Time | 0.78 s | 1.20 s |
| Time to Interactive | 6.14 s | 6.22 s |
| CLS | 0 | 0 |

Total Blocking Time didn't improve: building the 3D scene is now spread over
several shorter tasks (each ≤ ~300 ms in a typical run, previously ~1 s), but the
total work is about the same and the 4× CPU throttle counts most of it. The
"after" run that scored 31 had a single 10-second GPU stall — an artefact of the
measuring machine, not reproduced in the other runs.

## Bundle (gzipped)

| Chunk | Before | After |
|---|---|---|
| UI shell (React, i18n, UI, landmark + shuttle data) | — | 124 KB |
| 3D scene (three.js, R3F, scene code, OSM data) | — | 360 KB |
| **Single bundle (before split)** | **545 KB** | — |
| CSS | 7 KB | 7 KB |

The first paint now needs only the 124 KB shell; the scene chunk loads after it.

## What changed

- **Code split:** the UI shell renders first; three.js + scene + OSM data are a
  lazy chunk, started after the shell's first paint. The shell talks to the
  camera through `src/scene/mapApi.ts` (no three.js import).
- **Loading state:** a campus-shaped skeleton with a status line instead of a
  blank map.
- **Data:** one quantised TopoJSON (`campus.topo.json`, 77 KB gz) replaces six
  GeoJSON files (≈ 138 KB gz): shared arcs, 1e5 quantisation (≈ 2.5 cm),
  invisible context (> 270 m outside the campus, fully faded) dropped, and only
  the properties the renderer reads. JSON imports are emitted as `JSON.parse`
  strings.
- **Fonts:** Google Fonts stylesheet loaded without blocking render.
- **Staged scene build:** ground/roads → campus buildings → context buildings →
  trees → landmark models + pins, one task each.
- **Rendering:** `frameloop="demand"` (0 frames while idle — verified), pixel
  ratio capped at 1.5 on touch devices, 2048 px shadow map on phones.
