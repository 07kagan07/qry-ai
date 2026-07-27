import { useParams } from 'react-router-dom'
import { usePublicMenu } from '../../lib/usePublicMenu'
import { ALLERGENS, ALLERGEN_LIST } from '../../lib/allergens'
import { Spinner, Button } from '../../components/ui'

// Mevzuattaki "yazılı alternatif" şartı için yazdırılabilir tam menü.
export default function PrintMenu() {
  const { slug } = useParams()
  const { cafe, categories, loading, error } = usePublicMenu(slug)

  if (loading) return <Spinner label="Menü yükleniyor…" />
  if (error || !cafe) return <p className="mt-20 text-center text-ink-soft">{error || 'Menü bulunamadı.'}</p>

  return (
    <div className="mx-auto max-w-2xl bg-white p-8 print-page shadow-sm">
      <div className="no-print mb-6 flex justify-end">
        <Button onClick={() => window.print()}>🖨️ Yazdır</Button>
      </div>

      <header className="mb-6 text-center">
        <h1 className="text-3xl font-bold">{cafe.name}</h1>
        {cafe.address && <p className="mt-1 text-sm text-ink-soft">{cafe.address}</p>}
      </header>

      {categories.map((cat) => (
        <section key={cat.id} className="mb-6">
          <h2 className="mb-2 border-b-2 border-ink pb-1 text-xl font-bold">{cat.name}</h2>
          <table className="w-full text-sm">
            <tbody>
              {cat.items.map((item) => (
                <tr key={item.id} className="border-b border-line align-top">
                  <td className="py-2 pr-4">
                    <div className="font-semibold">{item.name}</div>
                    {item.description && <div className="text-ink-soft">{item.description}</div>}
                    <div className="mt-0.5 text-xs text-ink-soft">
                      {item.kcal != null && <span className="mr-2">{item.kcal} kcal</span>}
                      {item.contains_alcohol && <span className="mr-2">• Alkollü</span>}
                      {item.contains_pork && <span className="mr-2">• Domuz ürünü içerir</span>}
                      {item.allergens.length > 0 && (
                        <span>
                          Alerjenler: {item.allergens.map((a) => ALLERGENS[a].label).join(', ')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap py-2 text-right font-semibold">
                    ₺{Number(item.price).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      <footer className="mt-8 border-t border-line pt-4 text-xs text-ink-soft">
        <p className="mb-2">
          Alerjen, enerji (kcal), alkol ve domuz ürünü bilgileri Türk Gıda Kodeksi Gıda Etiketleme
          ve Tüketicileri Bilgilendirme Yönetmeliği kapsamında beyan edilmiştir. Şiddetli alerjiniz
          varsa lütfen personelimize danışın.
        </p>
        <p>
          14 majör alerjen:{' '}
          {ALLERGEN_LIST.map((a) => a.label).join(', ')}.
        </p>
      </footer>
    </div>
  )
}
