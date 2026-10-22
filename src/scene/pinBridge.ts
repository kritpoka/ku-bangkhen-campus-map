import type { Lang } from '../i18n'

/**
 * Link between the DOM pin layer (outside the canvas) and the projector
 * (inside it). The layer registers its elements; the projector writes their
 * screen position and display mode directly, so camera moves never re-render React.
 */
export const pinBridge = {
  elements: new Map<string, HTMLElement>(),
  lang: 'th' as Lang,
  selectedId: null as string | null,
  /** Screen areas covered by floating UI (CSS px); pins there are hidden. */
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
  /** Camera distance that frames the whole campus; label budgets scale from it. */
  fitDistance: 3000,
  /**
   * Landmark id at a screen point (CSS px, map-relative), or null. Labels hit
   * on their chip; dots get a generous touch radius. Set by PinProjector.
   */
  hitTest: (_x: number, _y: number): string | null => null,
  /** Set when something other than the camera changed (language, selection, new elements). */
  dirty: true,
  invalidate: () => {},
  touch() {
    this.dirty = true
    this.invalidate()
  },
}
