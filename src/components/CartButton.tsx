import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useCart } from '../context/CartContext'
import { getTrackedOrderIds, addTrackedOrder, removeTrackedOrder } from '../lib/orderTracking'
import { formatPrice } from '../lib/currency'
import { useLocale, useT } from '../context/LocaleContext'
import type { UIKey } from '../lib/uiText'
import type { LocaleKey } from '../lib/locales'
import type { Cafe, OrderStatus } from '../lib/types'
import { Button, ErrorText, Input, Label, Textarea } from './ui'

interface Props {
  cafe: Cafe
}

type FormState = 'idle' | 'sending'

interface TrackedOrder {
  id: string
  status: OrderStatus
  total: number
  items: { name: string; quantity: number; note: string | null }[]
}

const STATUS_ICON: Record<OrderStatus, string> = {
  pending: '🛍️',
  preparing: '👨‍🍳',
  ready: '✅',
  completed: '✅',
  cancelled: '❌',
}

const STATUS_LABEL_KEY: Record<OrderStatus, UIKey> = {
  pending: 'order.statusPending',
  preparing: 'order.statusPreparing',
  ready: 'order.statusReady',
  completed: 'order.statusCompleted',
  cancelled: 'order.statusCancelled',
}

const ACTIVE_STATUSES: OrderStatus[] = ['pending', 'preparing']
const POLL_MS = 20000

async function fetchOrderStatus(id: string, locale: LocaleKey | null): Promise<TrackedOrder | null> {
  const { data, error } = await supabase.rpc('get_order_status', { p_id: id, p_locale: locale })
  if (error || !data || data.length === 0) return null
  const row = data[0] as {
    status: OrderStatus
    total: number
    items: { name: string; quantity: number; note: string | null }[]
  }
  return { id, status: row.status, total: row.total, items: row.items ?? [] }
}

// CallWaiterButton (sağ-alt) ve ReservationButton (sol-alt) ile aynı yerde
// (PublicMenu.tsx) render edilir, alt-ortada konumlanır. Sepet CartContext'ten
// gelir. Müşteri arka arkaya birden fazla sipariş verirse hepsinin durumunu
// aynı anda görebilir — sadece en sonuncusunu değil (bkz. orderTracking.ts).
export default function CartButton({ cafe }: Props) {
  const cart = useCart()
  const t = useT()
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const [trackedOrders, setTrackedOrders] = useState<TrackedOrder[]>([])
  const [checkingTracked, setCheckingTracked] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [state, setState] = useState<FormState>('idle')

  useEffect(() => {
    if (!cafe.order_enabled) {
      setCheckingTracked(false)
      return
    }
    const ids = getTrackedOrderIds(cafe.slug)
    if (ids.length === 0) {
      setCheckingTracked(false)
      return
    }
    let cancelled = false
    Promise.all(ids.map((id) => fetchOrderStatus(id, locale))).then((results) => {
      if (cancelled) return
      const valid = results.filter((r): r is TrackedOrder => r != null)
      // Artık bulunamayan (silinmiş) siparişleri takipten düşür.
      for (const [i, id] of ids.entries()) {
        if (!results[i]) removeTrackedOrder(cafe.slug, id)
      }
      setTrackedOrders(valid)
      setCheckingTracked(false)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cafe.slug, cafe.order_enabled])

  // trackedOrders her yeni sipariş eklendiğinde değişiyor ama interval'i her
  // seferinde yeniden kurmak istemiyoruz — bir ref üzerinden en güncel listeyi
  // okuyoruz, aksi halde interval'in kapandığı an (closure) hangi sipariş
  // listesiyse ona takılı kalır ve yeni eklenen siparişler yanlış karta
  // (ya da hiç) eşlenirdi (bu tam olarak yaşanan hataydı).
  const trackedRef = useRef<TrackedOrder[]>([])
  useEffect(() => {
    trackedRef.current = trackedOrders
  }, [trackedOrders])

  // Aynı closure-bayatlama sorunu locale için de geçerli: interval kurulduğu
  // andaki dili hatırlar, sonradan değişse haberi olmaz.
  const localeRef = useRef<LocaleKey | null>(locale)
  useEffect(() => {
    localeRef.current = locale
  }, [locale])

  const hasActive = trackedOrders.some((o) => ACTIVE_STATUSES.includes(o.status))
  useEffect(() => {
    if (!hasActive) return
    const interval = window.setInterval(async () => {
      const ids = trackedRef.current.map((o) => o.id)
      const results = await Promise.all(ids.map((id) => fetchOrderStatus(id, localeRef.current)))
      const byId = new Map(results.filter((r): r is TrackedOrder => r != null).map((r) => [r.id, r]))
      setTrackedOrders((prev) => prev.map((o) => byId.get(o.id) ?? o))
    }, POLL_MS)
    return () => window.clearInterval(interval)
  }, [hasActive])

  // Müşteri sağ üstteki dil seçiciden dili değiştirdiğinde, ürün adları o anda
  // (durumu ne olursa olsun — sadece "aktif" siparişler değil) yeni dile göre
  // yeniden çekilir. İlk render'da (mount effect'i zaten aynı işi yaptığı için)
  // tekrar çalışmaması gerekiyor — bunu bir ref ile atlıyoruz.
  const mountedLocaleEffect = useRef(false)
  useEffect(() => {
    if (!mountedLocaleEffect.current) {
      mountedLocaleEffect.current = true
      return
    }
    const ids = trackedRef.current.map((o) => o.id)
    if (ids.length === 0) return
    let cancelled = false
    Promise.all(ids.map((id) => fetchOrderStatus(id, locale))).then((results) => {
      if (cancelled) return
      const byId = new Map(results.filter((r): r is TrackedOrder => r != null).map((r) => [r.id, r]))
      setTrackedOrders((prev) => prev.map((o) => byId.get(o.id) ?? o))
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale])

  if (!cafe.order_enabled || checkingTracked) return null

  function close() {
    setOpen(false)
    setState('idle')
    setError('')
  }

  function dismissOrder(id: string) {
    removeTrackedOrder(cafe.slug, id)
    setTrackedOrders((prev) => prev.filter((o) => o.id !== id))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim() || !phone.trim()) {
      setError(t('order.validationError'))
      return
    }
    if (cart.items.length === 0) {
      setError(t('order.emptyCartError'))
      return
    }
    setState('sending')
    const { data: orderId, error: rpcErr } = await supabase.rpc('create_order', {
      p_cafe_id: cafe.id,
      p_customer_name: name.trim(),
      p_phone: phone.trim(),
      p_note: note.trim() || null,
      p_items: cart.items.map((i) => ({ menu_item_id: i.menuItemId, quantity: i.quantity, note: i.note })),
      p_locale: locale,
    })
    if (rpcErr || !orderId) {
      setState('idle')
      setError(t('order.submitError'))
      return
    }
    addTrackedOrder(cafe.slug, orderId as string)
    setTrackedOrders((prev) => [
      {
        id: orderId as string,
        status: 'pending',
        total: cart.total,
        items: cart.items.map((i) => ({ name: i.name, quantity: i.quantity, note: i.note })),
      },
      ...prev,
    ])
    cart.clear()
    setState('idle')
    setShowForm(false)
  }

  const activeCount = trackedOrders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length
  const buttonMeta =
    trackedOrders.length > 0
      ? {
          icon: '🛍️',
          label: `${t('order.myOrders', { n: trackedOrders.length })}${activeCount > 0 ? ' •' : ''}`,
        }
      : {
          icon: '🛍️',
          label: cart.count > 0 ? t('order.cartButton', { n: cart.count }) : t('order.orderButton'),
        }

  const displayForm = showForm || trackedOrders.length === 0

  return (
    <>
      <div className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2 pb-[env(safe-area-inset-bottom)]">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-11 touch-manipulation items-center gap-2 rounded-full bg-cobalt px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-cobalt-deep active:scale-[0.97]"
        >
          <span aria-hidden>{buttonMeta.icon}</span>
          {buttonMeta.label}
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-4"
          onClick={close}
          style={{ overscrollBehavior: 'contain' }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-title"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-md flex-col rounded-xl bg-white shadow-xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-line p-4 sm:p-5">
              <h2 id="cart-title" className="text-lg font-bold">
                {displayForm ? t('order.cartTitle') : t('order.myOrdersTitle')}
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Kapat"
                className="flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-lg text-ink-soft hover:bg-porcelain hover:text-ink active:bg-porcelain"
              >
                ✕
              </button>
            </div>

            {!displayForm ? (
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
                {trackedOrders.map((o) => (
                  <div
                    key={o.id}
                    className={`rounded-lg border p-3 ${
                      o.status === 'ready' || o.status === 'completed'
                        ? 'border-teal bg-teal-soft'
                        : o.status === 'cancelled'
                          ? 'border-coral bg-coral-soft'
                          : 'border-line bg-porcelain'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-ink">
                        {STATUS_ICON[o.status]} {t(STATUS_LABEL_KEY[o.status])}
                      </p>
                      {!ACTIVE_STATUSES.includes(o.status) && (
                        <button
                          type="button"
                          onClick={() => dismissOrder(o.id)}
                          className="shrink-0 text-xs text-ink-soft underline"
                        >
                          {t('form.hide')}
                        </button>
                      )}
                    </div>
                    <ul className="mt-1.5 space-y-0.5 text-sm text-ink-soft">
                      {o.items.map((i, idx) => (
                        <li key={idx}>
                          {i.quantity}× {i.name}
                          {i.note && (
                            <span className="ml-1 font-medium text-coral-deep">
                              — {t('order.itemNote', { note: i.note })}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1.5 font-semibold text-ink">{formatPrice(o.total, cafe.currency)}</p>
                  </div>
                ))}
                <Button onClick={() => setShowForm(true)} variant="secondary" className="w-full">
                  {t('order.newOrderButton')}
                </Button>
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                {cart.items.length === 0 ? (
                  <p className="text-sm text-ink-soft">{t('order.emptyCart')}</p>
                ) : (
                  <form onSubmit={onSubmit} className="space-y-4">
                    <ul className="space-y-2">
                      {cart.items.map((i) => (
                        <li key={i.lineId} className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-ink">{i.name}</p>
                            <p className="text-xs text-ink-soft">{formatPrice(i.price, cafe.currency)}</p>
                            {i.note && (
                              <p className="truncate text-xs font-medium text-coral-deep">
                                {t('order.itemNote', { note: i.note })}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => cart.updateQuantity(i.lineId, i.quantity - 1)}
                              aria-label={`${i.name} miktarını azalt`}
                              className="flex h-8 w-8 touch-manipulation items-center justify-center rounded-lg border border-line text-ink active:scale-95"
                            >
                              −
                            </button>
                            <span className="w-5 text-center text-sm font-semibold text-ink">
                              {i.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => cart.updateQuantity(i.lineId, i.quantity + 1)}
                              aria-label={`${i.name} miktarını artır`}
                              className="flex h-8 w-8 touch-manipulation items-center justify-center rounded-lg border border-line text-ink active:scale-95"
                            >
                              +
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-center justify-between border-t border-line pt-3">
                      <span className="font-semibold text-ink">{t('order.total')}</span>
                      <span className="font-display text-lg font-bold text-cobalt">
                        {formatPrice(cart.total, cafe.currency)}
                      </span>
                    </div>

                    <div>
                      <Label>{t('reservation.nameLabel')}</Label>
                      <Input value={name} onChange={(e) => setName(e.target.value)} required />
                    </div>
                    <div>
                      <Label>{t('reservation.phoneLabel')}</Label>
                      <Input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                        placeholder="05xx xxx xx xx"
                      />
                    </div>
                    <div>
                      <Label>{t('reservation.noteLabel')}</Label>
                      <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
                    </div>
                    <ErrorText>{error}</ErrorText>
                    <Button type="submit" disabled={state === 'sending'} className="w-full">
                      {state === 'sending' ? t('order.submitting') : t('order.submitButton')}
                    </Button>
                    {trackedOrders.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full"
                        onClick={() => setShowForm(false)}
                      >
                        {t('order.backToOrders')}
                      </Button>
                    )}
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
