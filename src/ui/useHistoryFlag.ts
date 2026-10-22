import { useCallback, useEffect, useState } from 'react'

/**
 * A boolean UI layer (e.g. an expanded search sheet) backed by a history
 * entry, so the phone's back gesture/button closes it instead of leaving.
 */
export function useHistoryFlag(key: string) {
  const [open, setOpen] = useState(() => !!window.history.state?.[key])

  useEffect(() => {
    const onPop = () => setOpen(!!window.history.state?.[key])
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [key])

  const show = useCallback(() => {
    if (window.history.state?.[key]) return setOpen(true)
    window.history.pushState({ ...window.history.state, [key]: true }, '')
    setOpen(true)
  }, [key])

  const hide = useCallback(() => {
    if (window.history.state?.[key]) window.history.back()
    else setOpen(false)
  }, [key])

  return [open, show, hide] as const
}
