import { useCallback, useEffect, useState } from 'react'
import { landmarkById } from '../data/landmarks'

const PARAM = 'place'

function fromUrl(): string | null {
  const id = new URLSearchParams(window.location.search).get(PARAM)
  return id && landmarkById.has(id) ? id : null
}

/**
 * Selected landmark id, mirrored in the URL (?place=<id>) so a place can be
 * shared or bookmarked. Uses replaceState: selecting doesn't add history entries.
 */
export function useSelection() {
  const [id, setId] = useState<string | null>(fromUrl)

  useEffect(() => {
    const onPop = () => setId(fromUrl())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const select = useCallback((next: string | null) => {
    setId(next)
    const url = new URL(window.location.href)
    if (next) url.searchParams.set(PARAM, next)
    else url.searchParams.delete(PARAM)
    window.history.replaceState(window.history.state, '', url)
  }, [])

  return [id, select] as const
}
