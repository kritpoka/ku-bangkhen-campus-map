import { shuttleStops } from '../data/shuttle'
import { registerSearchItems } from './useSearch'

/** Shuttle stops are searchable by name and code (e.g. "E12", "ป้ายหอสมุด"). */
registerSearchItems(
  shuttleStops
    .filter((s) => !s.offMap)
    .map((s) => ({
      id: s.id,
      kind: 'stop' as const,
      category: 'transport' as const,
      name: { th: `ป้ายรถตะลัย ${s.name.th}`, en: `Shuttle stop: ${s.name.en}` },
      shortName: s.name,
      aliases: [s.code ?? '', `ป้าย${s.name.th}`, 'รถตะลัย', 'shuttle'].filter(Boolean),
    })),
)
