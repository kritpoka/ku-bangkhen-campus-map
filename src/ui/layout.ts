import { useEffect, useState } from 'react'

/** Desktop layout: the map controls keep a fixed column at the right edge and
 * cards open to the left of it, so a card never moves or covers the controls. */

/** Width of the desktop place / stop card (px) when there is room. */
export const CARD_WIDTH = 380
const CARD_MIN_WIDTH = 300
export const CARD_MARGIN = 16
/** Right edge reserved for the controls: 16 px margin + 44 px buttons + 12 px gap. */
export const CONTROLS_RESERVE = 72
/** Width of the desktop shuttle legend card at the left (px). */
export const LEGEND_WIDTH = 340

/** Card width for a viewport: narrower on small windows so it fits between the
 * controls column and the shuttle legend (when shown). */
export function cardWidth(viewportWidth: number, legend: boolean): number {
  const left = legend ? CARD_MARGIN + LEGEND_WIDTH + CARD_MARGIN : CARD_MARGIN
  return Math.max(CARD_MIN_WIDTH, Math.min(CARD_WIDTH, viewportWidth - CONTROLS_RESERVE - left))
}

export function useViewportWidth() {
  const [vw, setVw] = useState(() => window.innerWidth)
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return vw
}
