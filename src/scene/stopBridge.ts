/** Link between the shuttle-stop DOM layer and its projector (see pinBridge). */
export const stopBridge = {
  elements: new Map<string, HTMLElement>(),
  /** Stop ids to draw (overlay on, filtered by the active line); empty = none. */
  visible: new Set<string>(),
  selectedId: null as string | null,
  dirty: true,
  invalidate: () => {},
  /** Nearest visible stop within the touch radius of a screen point. Set by StopProjector. */
  hitTest: (_x: number, _y: number): string | null => null,
  touch() {
    this.dirty = true
    this.invalidate()
  },
}
