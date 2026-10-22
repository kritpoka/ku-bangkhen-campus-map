import { useCallback, useEffect, useState } from 'react'
import { landmarkById } from '../data/landmarks'

const PARAM = 'place'
/** Marks history entries this app pushed, so closing can step back instead of adding entries. */
const PUSHED = 'ku-map:place'

function fromUrl(): string | null {
  const id = new URLSearchParams(window.location.search).get(PARAM)
  return id && landmarkById.has(id) ? id : null
}

function urlWith(id: string | null) {
  const url = new URL(window.location.href)
  if (id) url.searchParams.set(PARAM, id)
  else url.searchParams.delete(PARAM)
  return url
}

/**
 * Selected landmark id, mirrored in the URL (?place=<id>) so a place can be
 * shared or bookmarked.
 *
 * History: opening a place pushes an entry, so the phone's back gesture/button
 * closes the place instead of leaving the site; switching places replaces it.
 * A ?place= deep link gets a base entry underneath for the same reason.
 */
export function useSelection() {
  const [id, setId] = useState<string | null>(() => {
    const initial = fromUrl()
    if (initial && window.history.state?.[PUSHED] === undefined) {
      window.history.replaceState({ ...window.history.state }, '', urlWith(null))
      window.history.pushState({ ...window.history.state, [PUSHED]: initial }, '', urlWith(initial))
    }
    return initial
  })

  useEffect(() => {
    const onPop = () => setId(fromUrl())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const select = useCallback((next: string | null) => {
    const pushed = window.history.state?.[PUSHED] !== undefined
    if (next) {
      setId(next)
      if (pushed) window.history.replaceState({ ...window.history.state, [PUSHED]: next }, '', urlWith(next))
      else window.history.pushState({ ...window.history.state, [PUSHED]: next }, '', urlWith(next))
    } else if (pushed) {
      // Step back over our own entry; popstate then clears the selection.
      window.history.back()
    } else {
      setId(null)
      window.history.replaceState(window.history.state, '', urlWith(null))
    }
  }, [])

  return [id, select] as const
}
