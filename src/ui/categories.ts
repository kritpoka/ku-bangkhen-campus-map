import {
  BookOpen,
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
  food: { color: '#b45309', icon: UtensilsCrossed },
  sport: { color: '#1d63c9', icon: Trophy },
  library: { color: '#6d4fc2', icon: BookOpen },
  admin: { color: '#475569', icon: Building2 },
  transport: { color: '#a16207', icon: Bus },
  landmark: { color: '#be3a16', icon: Landmark },
}
