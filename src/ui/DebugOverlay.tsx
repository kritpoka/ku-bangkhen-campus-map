import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { perf, usePerfFlags, type PerfFlags } from '../lib/perf'

const TOGGLES: (keyof PerfFlags)[] = ['shadows', 'blur', 'pins', 'stops', 'trees']

/**
 * `?debug=1` overlay: live rendering stats and switches that turn individual
 * costs off, to find what slows the map down on a real device. Reads
 * `perf.stats` four times a second, so it doesn't add per-frame work itself.
 */
export function DebugOverlay() {
  const { t } = useTranslation()
  const flags = usePerfFlags()
  const [s, setS] = useState({ ...perf.stats, fps: 0 })

  useEffect(() => {
    let frames = perf.stats.frames, at = performance.now()
    const id = window.setInterval(() => {
      const now = performance.now()
      const fps = ((perf.stats.frames - frames) * 1000) / (now - at)
      frames = perf.stats.frames
      at = now
      setS({ ...perf.stats, fps })
    }, 250)
    return () => window.clearInterval(id)
  }, [])

  const row = (label: string, value: string) => (
    <div className="flex justify-between gap-3">
      <span className="text-white/60">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
  return (
    <div
      data-debug-overlay
      className="pointer-events-auto fixed top-[84px] left-3 z-50 w-[188px] rounded-xl bg-slate-900/85 p-2.5 font-mono text-[11px] leading-snug text-white shadow-lg"
    >
      <div className="mb-1 flex justify-between font-sans text-[12px] font-semibold">
        <span>{t('debug.title')}</span>
        <span className={s.moving ? 'text-amber-300' : 'text-emerald-300'}>{s.moving ? t('debug.moving') : t('debug.idle')}</span>
      </div>
      {row(t('debug.fps'), s.fps.toFixed(0))}
      {row(t('debug.frame'), s.rafMs ? `${s.rafMs.toFixed(1)} ms` : '–')}
      {row(t('debug.cpu'), `${s.cpuMs.toFixed(1)} ms`)}
      {row(t('debug.dpr'), s.dpr.toFixed(2))}
      {row(t('debug.calls'), String(s.calls))}
      {row(t('debug.triangles'), `${(s.triangles / 1000).toFixed(0)}k`)}
      <div className="mt-2 flex flex-wrap gap-1 font-sans">
        {TOGGLES.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={flags[k]}
            onClick={() => perf.setFlag(k, !flags[k])}
            className={`rounded-full px-2 py-1 text-[11px] font-semibold ${flags[k] ? 'bg-emerald-500 text-white' : 'bg-white/15 text-white/70 line-through'}`}
          >
            {t(`debug.${k}`)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => perf.setDprCap(perf.dprCap === 2 ? Infinity : 2)}
          className="rounded-full bg-white/15 px-2 py-1 text-[11px] font-semibold text-white"
        >
          {t('debug.maxDpr', { value: perf.dprCap === 2 ? '2' : t('debug.auto') })}
        </button>
      </div>
      <p className="mt-1.5 font-sans text-[10.5px] text-white/60">{t('debug.hint')}</p>
    </div>
  )
}
