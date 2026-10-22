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
  /** Set when something other than the camera changed (language, selection, new elements). */
  dirty: true,
  invalidate: () => {},
  touch() {
    this.dirty = true
    this.invalidate()
  },
}
