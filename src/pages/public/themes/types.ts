import type { AllergenKey } from '../../../lib/allergens'
import type { Cafe, CategoryWithItems } from '../../../lib/types'

export interface MenuThemeProps {
  cafe: Cafe
  /** Alerjen dışlama filtresi uygulanmış, en az 1 ürünü olan kategoriler — nav sekmeleri için. */
  allCategories: CategoryWithItems[]
  /** allCategories'in ayrıca seçili kategoriye göre daraltılmış hâli — asıl render edilecek olan. */
  shownCategories: CategoryWithItems[]
  activeCategory: string | null
  onSelectCategory: (id: string | null) => void
  excludedAllergens: AllergenKey[]
  onToggleAllergen: (key: AllergenKey) => void
  filterOpen: boolean
  onToggleFilterOpen: () => void
}
