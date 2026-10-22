import { useEffect, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Landmark } from '../data/types'
import { PlaceBody, PlaceHeader } from './PlaceDetails'
import { SHEET_TOP, Sheet, useViewportHeight } from './Sheet'

/** Snap heights for the place sheet: peek (title row), half, full. */
export function placeSnaps(vh: number) {
  return [168, Math.round(Math.min(vh * 0.5, 460)), vh - SHEET_TOP]
}
const HALF = 1

interface Props {
  landmark: Landmark
  onClose: () => void
  onFocus: () => void
  onHeight: (px: number) => void
}

/** Mobile place sheet with peek / half / full snap points. Opens at half. */
export function BottomSheet({ landmark, onClose, onFocus, onHeight }: Props) {
  const { t } = useTranslation()
  const titleId = useId()
  const vh = useViewportHeight()
  const snaps = useMemo(() => placeSnaps(vh), [vh])
  const [snap, setSnap] = useState(HALF)

  // A new place opens at half height.
  useEffect(() => setSnap(HALF), [landmark.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <Sheet
      snaps={snaps}
      snap={snap}
      onSnap={setSnap}
      onClose={onClose}
      onHeight={onHeight}
      labelledBy={titleId}
      expandLabel={t('panel.expand')}
      collapseLabel={t('panel.collapse')}
      header={<PlaceHeader landmark={landmark} titleId={titleId} onClose={onClose} onFocus={onFocus} />}
    >
      <div key={landmark.id}>
        <PlaceBody landmark={landmark} />
      </div>
    </Sheet>
  )
}
