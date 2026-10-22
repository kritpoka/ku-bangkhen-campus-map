import {
  BookOpen,
  DoorOpen,
  Building2,
  Bus,
  GraduationCap,
  Landmark,
  Trophy,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import type { Category } from '../data/types'

/**
 * Visual identity per category, shared by map pins and filter chips.
 * Colors are chosen for >= 4.5:1 contrast against white icons and text.
 */
export const categoryStyle: Record<Category, { color: string; icon: LucideIcon }> = {
  faculty: { color: '#006664', icon: GraduationCap },
  food: { color: '#c2410c', icon: UtensilsCrossed },
  sport: { color: '#1d4ed8', icon: Trophy },
  library: { color: '#6d28d9', icon: BookOpen },
  admin: { color: '#475569', icon: Building2 },
  transport: { color: '#a16207', icon: Bus },
  landmark: { color: '#b91c1c', icon: Landmark },
  gate: { color: '#be185d', icon: DoorOpen },
}
