import { ALLERGEN_LIST } from '../lib/allergens'
import type { Cafe } from '../lib/types'

interface Props {
  cafe: Cafe
  className?: string
}

// Tüm menü temalarında aynı yasal metni gösteren tek kaynak — tema başına
// kopyalanmaz, içerik hep tutarlı kalır.
export default function AllergenLegend({ cafe, className = '' }: Props) {
  return (
    <footer className={`overflow-hidden rounded-xl border border-line bg-surface ${className}`}>
      <div className="p-4 text-xs text-ink-soft">
        <h3 className="font-display mb-2 text-sm font-bold text-ink">Alerjen bilgilendirmesi</h3>
        <p className="mb-3 leading-relaxed">
          Alerjen, enerji (kcal), alkol ve domuz ürünü bilgileri Türk Gıda Kodeksi Gıda
          Etiketleme ve Tüketicileri Bilgilendirme Yönetmeliği kapsamında beyan edilmiştir.
          Şiddetli alerjiniz varsa siparişten önce personelimize danışın.
        </p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {ALLERGEN_LIST.map((a) => (
            <span key={a.key}>
              {a.icon} {a.label}
            </span>
          ))}
        </div>
        {(cafe.phone || cafe.instagram) && (
          <p className="mt-3 border-t border-line pt-2">
            {cafe.phone && <span className="mr-3">Tel: {cafe.phone}</span>}
            {cafe.instagram && <span>Instagram: {cafe.instagram}</span>}
          </p>
        )}
      </div>
    </footer>
  )
}
