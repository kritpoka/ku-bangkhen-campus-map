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
- **Rendering:** `frameloop="demand"` (0 frames while idle — verified), 2048 px
  shadow map on phones. (The pixel-ratio cap of 1.5 was replaced by adaptive
  resolution; see below.)

## Phone frame rate and sharpness

Reported on an iPhone 13: stutter while panning/zooming, and a blurry scene
(the old pixel-ratio cap of 1.5 on a 3x screen).

### Measuring

- `?debug=1` shows a live overlay: frame rate, display-frame time while moving,
  CPU time per frame, DPR, draw calls, triangles, and switches for shadows,
  backdrop blur, pins, shuttle stops and trees, plus a resolution cap (auto / 2).
- `node tests/perf/profile.mjs [--throttle 4] [--gpu] [--dpr 3]` pans and pinches
  in iPhone-13 emulation (390×844 @3x, CPU throttling) on this machine's real
  GPU and prints per-frame costs per switch. `--gpu` waits for the GPU after
  each frame (1-pixel readPixels), so the time includes GPU work.

### Findings (headed Chrome, Apple-silicon Mac GPU, iPhone 13 emulation)

CPU + GPU time per frame while panning/pinching (`--gpu`, no throttling):

| Configuration (old code) | ms / frame | Draw calls |
|---|---|---|
| DPR 1.5 (old cap), all on | 4.65 | 60 |
| DPR 1.5, shadows off | 3.34 | 47 |
| DPR 3, all on | 8.3–9.8 | 60 |
| DPR 3, shadow-map pass skipped | 7.0 | 47 |
| DPR 3, shadows off | 5.7 | 47 |
| DPR 3, MSAA off | 7.0 | 60 |
| DPR 3, trees off | 7.9 | 50 |

Main thread with 4x CPU throttling: script 2.3 ms + style 1.7 ms + layout 0.1 ms
per frame; pins and stops are most of the style time (~0.6 / ~0.9 ms).
Turning backdrop blur off changes nothing measurable in Chrome; its cost is
in iOS Safari's compositor, which this setup can't measure.

Top causes, in order:

1. **Pixels:** frame cost roughly doubles from DPR 1.5 to 3. A phone GPU is
   ~2–3x slower than this one, so full resolution on every moving frame
   would be ~17–25 ms (under 60 fps), and the 1.5 cap made rest frames blurry.
2. **Shadows:** the shadow map was redrawn every frame (13 extra draw calls
   over every building and tree, ~1.3–2.7 ms here) because the sun follows the
   view; the per-pixel shadow lookup costs another ~1.3 ms at DPR 3.
3. **Double rendering:** the sun's "target moved → render once more" asked for
   a second frame for each touch event, doubling GPU and main-thread work
   during drags (≈ 253 ms/s of main-thread time for a 60 Hz drag, now ≈ 160).
4. **Backdrop blur** over the WebGL canvas (6 surfaces): a known iOS Safari
   per-frame cost; not measurable in Chrome.
5. **DOM pin/stop writes:** every pin's transform and z-index were rewritten
   each frame, including hidden ones (~1.5 ms/frame at 4x throttle).

Not a significant cost: the touch handlers (camera maths per event is
microseconds; rendering is already once per animation frame) and label
collision (37 pins). Per-frame allocations were small (strings, closures).

### Changes

- **Adaptive resolution** (`src/scene/quality.tsx`): at rest the map renders at
  full sharpness (DPR up to 3 on phones, 2 on desktops); rendering is on
  demand, so a still map costs nothing. While the camera moves (gesture,
  fling, fly-to, desktop drag), phones render at DPR 1.25; a rAF-based
  monitor steps that down by 0.25 (to 0.75) if the browser can't keep up with
  the display. 40 ms after motion ends, one full-resolution frame is drawn.
  Resolution changes happen at the start of a frame, so there's no blank flash.
- **Shadows** are redrawn only at rest. While moving, the sun and its shadow
  map stay put (shadows stay correct in world space; zooming far out can show
  unshadowed edges until the map stops). Moving frames: 47 draw calls instead of 60.
- **No double frames:** removed as a side effect (the sun doesn't move while moving).
- **Backdrop blur off on touch devices** (surfaces are 90–97 % opaque anyway;
  the attribution goes from 75 % to 90 %). `?debug=1` can turn it back on to compare.
- **Pins and stops:** hidden elements aren't touched; transforms and z-index
  are written only when they change; the priority sort runs only when the
  selection changes.
- **Shaders** are compiled up front (`compileAsync`) once the scene is built,
  so off-screen landmarks don't compile mid-gesture.
- MSAA stays on: on tile-based phone GPUs it's nearly free, and it keeps the
  1.25x motion frames from looking jagged.

### After (same harness)

| | DPR | Draw calls | ms / frame (CPU + GPU) |
|---|---|---|---|
| Moving | 1.25 | 47 | 4.3 |
| At rest (one frame) | 3 (1170×2532) | 60 | ~8–10 |

On this machine the GPU-sync overhead dominates small frames; on a fill-bound
phone GPU the moving frames draw 31 % fewer pixels than the old 1.5 cap and
83 % fewer than full resolution, without the shadow pass.
To confirm on the device, use `?debug=1` (see the README).
