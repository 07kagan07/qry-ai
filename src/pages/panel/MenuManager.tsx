import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import type { Category, MenuItem } from '../../lib/types'
import { ALLERGENS } from '../../lib/allergens'
import ItemFormModal, { type ItemDraft } from '../../components/ItemFormModal'
import { Button, Card, ErrorText, Input, Spinner } from '../../components/ui'

export default function MenuManager() {
  const { cafe } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [modal, setModal] = useState<{ categoryId: string; item?: MenuItem } | null>(null)

  const load = useCallback(async () => {
    if (!cafe) return
    const [cats, its] = await Promise.all([
      supabase.from('categories').select('*').eq('cafe_id', cafe.id).order('sort_order'),
      supabase.from('menu_items').select('*').eq('cafe_id', cafe.id).order('sort_order'),
    ])
    if (cats.error || its.error) {
      setError((cats.error ?? its.error)!.message)
    } else {
      setCategories(cats.data as Category[])
      setItems(its.data as MenuItem[])
    }
    setLoading(false)
  }, [cafe])

  useEffect(() => {
    void load()
  }, [load])

  if (!cafe) return null
  if (loading) return <Spinner label="Menü yükleniyor…" />

  async function addCategory() {
    const name = newCategoryName.trim()
    if (!name) return
    setError('')
    const { error } = await supabase.from('categories').insert({
      cafe_id: cafe!.id,
      name,
      sort_order: categories.length,
    })
    if (error) setError(error.message)
    else {
      setNewCategoryName('')
      await load()
    }
  }

  async function deleteCategory(cat: Category) {
    const count = items.filter((i) => i.category_id === cat.id).length
    const msg = count
      ? `"${cat.name}" kategorisi ve içindeki ${count} ürün silinecek. Emin misiniz?`
      : `"${cat.name}" kategorisi silinecek. Emin misiniz?`
    if (!window.confirm(msg)) return
    const { error } = await supabase.from('categories').delete().eq('id', cat.id)
    if (error) setError(error.message)
    else await load()
  }

  async function renameCategory(cat: Category) {
    const name = window.prompt('Yeni kategori adı:', cat.name)?.trim()
    if (!name || name === cat.name) return
    const { error } = await supabase.from('categories').update({ name }).eq('id', cat.id)
    if (error) setError(error.message)
    else await load()
  }

  async function deleteItem(item: MenuItem) {
    if (!window.confirm(`"${item.name}" silinecek. Emin misiniz?`)) return
    const { error } = await supabase.from('menu_items').delete().eq('id', item.id)
    if (error) setError(error.message)
    else await load()
  }

  async function toggleItem(item: MenuItem) {
    const { error } = await supabase
      .from('menu_items')
      .update({ is_active: !item.is_active })
      .eq('id', item.id)
    if (error) setError(error.message)
    else await load()
  }

  async function saveItem(draft: ItemDraft, categoryId: string, existing?: MenuItem) {
    const payload = {
      cafe_id: cafe!.id,
      category_id: categoryId,
      name: draft.name,
      description: draft.description || null,
      price: Number(draft.price),
      kcal: draft.kcal ? Number(draft.kcal) : null,
      allergens: draft.allergens,
      contains_alcohol: draft.contains_alcohol,
      contains_pork: draft.contains_pork,
      ai_suggested: draft.ai_suggested,
    }
    const q = existing
      ? supabase.from('menu_items').update(payload).eq('id', existing.id)
      : supabase.from('menu_items').insert({
          ...payload,
          sort_order: items.filter((i) => i.category_id === categoryId).length,
        })
    const { error } = await q
    if (error) throw new Error(error.message)
    await load()
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Menü Yönetimi</h1>
      </div>
      <ErrorText>{error}</ErrorText>

      <div className="mb-6 flex max-w-md gap-2">
        <Input
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          placeholder="Yeni kategori adı (örn: Sıcak İçecekler)"
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCategory())}
        />
        <Button onClick={addCategory}>Ekle</Button>
      </div>

      {categories.length === 0 && (
        <Card>
          <p className="text-sm text-ink-soft">
            Henüz kategori yok. Yukarıdan ilk kategorinizi ekleyin ya da{' '}
            <a href="/panel/ice-aktar" className="text-cobalt hover:underline">
              mevcut menünüzü AI ile içe aktarın
            </a>
            .
          </p>
        </Card>
      )}

      <div className="space-y-6">
        {categories.map((cat) => {
          const catItems = items.filter((i) => i.category_id === cat.id)
          return (
            <Card key={cat.id}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">{cat.name}</h2>
                <div className="flex gap-1">
                  <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => renameCategory(cat)}>
                    Yeniden adlandır
                  </Button>
                  <Button variant="ghost" className="!px-2 !py-1 text-xs text-coral-deep" onClick={() => deleteCategory(cat)}>
                    Sil
                  </Button>
                  <Button
                    variant="secondary"
                    className="!px-2 !py-1 text-xs"
                    onClick={() => setModal({ categoryId: cat.id })}
                  >
                    + Ürün Ekle
                  </Button>
                </div>
              </div>
              {catItems.length === 0 ? (
                <p className="text-sm text-ink-soft">Bu kategoride ürün yok.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {catItems.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`font-medium ${item.is_active ? '' : 'text-ink-soft line-through'}`}>
                            {item.name}
                          </span>
                          <span className="text-sm text-ink-soft">₺{Number(item.price).toFixed(2)}</span>
                          {item.kcal != null ? (
                            <span className="rounded border border-line bg-surface px-1.5 py-0.5 text-xs text-ink-soft">
                              {item.kcal} kcal
                            </span>
                          ) : (
                            <span className="rounded bg-coral-soft px-1.5 py-0.5 text-xs text-coral-deep" title="Mevzuat gereği kalori beyanı gerekiyor">
                              kcal eksik
                            </span>
                          )}
                          {item.ai_suggested && !item.ai_suggested.approved && (
                            <span
                              className="rounded bg-coral-soft px-1.5 py-0.5 text-xs font-medium text-coral-deep"
                              title="Beyanlar AI tarafından dolduruldu; düzenleyip kaydettiğinizde onaylanmış sayılır"
                            >
                              AI önerisi — kontrol edin
                            </span>
                          )}
                          {item.contains_alcohol && <span title="Alkol içerir">🍷</span>}
                          {item.contains_pork && <span title="Domuz ürünü içerir">🥓</span>}
                          <span className="text-sm">
                            {item.allergens.map((a) => (
                              <span key={a} title={ALLERGENS[a].label}>
                                {ALLERGENS[a].icon}
                              </span>
                            ))}
                          </span>
                        </div>
                        {item.description && (
                          <p className="truncate text-xs text-ink-soft">{item.description}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => toggleItem(item)}>
                          {item.is_active ? 'Gizle' : 'Göster'}
                        </Button>
                        <Button
                          variant="ghost"
                          className="!px-2 !py-1 text-xs"
                          onClick={() => setModal({ categoryId: cat.id, item })}
                        >
                          Düzenle
                        </Button>
                        <Button variant="ghost" className="!px-2 !py-1 text-xs text-coral-deep" onClick={() => deleteItem(item)}>
                          Sil
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )
        })}
      </div>

      {modal && (
        <ItemFormModal
          title={modal.item ? 'Ürünü Düzenle' : 'Yeni Ürün'}
          initial={modal.item}
          onClose={() => setModal(null)}
          onSave={(draft) => saveItem(draft, modal.categoryId, modal.item)}
        />
      )}
    </div>
  )
}
