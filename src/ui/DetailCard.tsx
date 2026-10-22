import { useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { Landmark } from '../data/types'
import { PlaceBody, PlaceHeader } from './PlaceDetails'

/** Width of the desktop card (px); the map keeps pins and fly-to targets clear of it. */
export const CARD_WIDTH = 380
export const CARD_MARGIN = 16

/** Desktop place card floating at the right, like the reference's detail card. */
export function DetailCard({ landmark, onClose, onFocus }: { landmark: Landmark; onClose: () => void; onFocus: () => void }) {
  const { t } = useTranslation()
  const titleId = useId()
  const ref = useRef<HTMLElement>(null)

  // Keyboard users who opened the card from a pin land inside it.
  useEffect(() => {
    if (document.activeElement?.matches(':focus-visible')) ref.current?.focus({ preventScroll: true })
  }, [landmark.id])

  return (
    <aside
      ref={ref}
      tabIndex={-1}
      aria-labelledby={titleId}
      aria-label={t('panel.details')}
      className="pointer-events-auto absolute top-[84px] right-4 bottom-4 z-30 flex w-[380px] animate-[card-in_220ms_ease-out] flex-col overflow-hidden rounded-3xl bg-white/97 shadow-2xl shadow-ku-900/15 ring-1 ring-black/5 backdrop-blur outline-none motion-reduce:animate-none"
      style={{ maxHeight: 'calc(100% - 100px)', height: 'fit-content' }}
    >
      <div className="border-b border-slate-100 p-4">
        <PlaceHeader landmark={landmark} titleId={titleId} onClose={onClose} onFocus={onFocus} />
      </div>
      <div key={landmark.id} className="overflow-y-auto overscroll-contain p-4">
        <PlaceBody landmark={landmark} />
      </div>
    </aside>
  )
}
