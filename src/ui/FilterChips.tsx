import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CHIPS, chipStyle, type ChipId } from './filters'

interface Props {
  active: Set<ChipId>
  onChange: (next: Set<ChipId>) => void
  className?: string
}

/**
 * Multi-select category chips with an "all" chip. Selecting "all" (or
 * deselecting the last chip) returns to showing everything. Scrolls
 * horizontally when it doesn't fit.
 */
export function FilterChips({ active, onChange, className = '' }: Props) {
  const { t } = useTranslation()
  const toggle = (id: ChipId) => {
    const next = new Set(active)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }
  const chip = (id: ChipId | 'all', pressed: boolean, onClick: () => void) => {
    const { color, icon: Icon } = chipStyle(id)
    return (
      <button
        key={id}
        type="button"
        aria-pressed={pressed}
        onClick={onClick}
        className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] leading-normal font-medium whitespace-nowrap shadow-sm ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ku-600 motion-reduce:transition-none ${
          pressed ? 'text-white ring-transparent' : 'bg-white/95 text-slate-700 ring-black/8 hover:bg-white'
        }`}
        style={pressed ? { backgroundColor: color } : undefined}
      >
        {pressed && id !== 'all' ? (
          <Check className="size-4" strokeWidth={2.6} aria-hidden />
        ) : (
          <Icon className="size-4" style={pressed ? undefined : { color }} aria-hidden />
        )}
        {t(`filters.${id}`)}
      </button>
    )
  }
  return (
    <div
      role="group"
      aria-label={t('filters.label')}
      className={`flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      {chip('all', active.size === 0, () => onChange(new Set()))}
      {CHIPS.map((c) => chip(c.id, active.has(c.id), () => toggle(c.id)))}
    </div>
  )
}
