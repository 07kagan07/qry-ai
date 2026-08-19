import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export interface CartItem {
  lineId: string
  menuItemId: string
  name: string
  price: number
  quantity: number
  /** Müşterinin ürüne özel isteği (ör. "soğansız"). Aynı ürün farklı notlarla
   * ayrı sepet satırı olarak tutulur — bkz. addItem. */
  note: string | null
}

interface CartState {
  items: CartItem[]
  addItem: (item: { id: string; name: string; price: number }, quantity: number, note?: string) => void
  updateQuantity: (lineId: string, quantity: number) => void
  removeItem: (lineId: string) => void
  clear: () => void
  total: number
  count: number
}

const CartContext = createContext<CartState | null>(null)

function storageKey(cafeSlug: string) {
  return `qr-menu:cart:${cafeSlug}`
}

function readCart(cafeSlug: string): CartItem[] {
  try {
    const raw = localStorage.getItem(storageKey(cafeSlug))
    return raw ? (JSON.parse(raw) as CartItem[]) : []
  } catch {
    return []
  }
}

function writeCart(cafeSlug: string, items: CartItem[]) {
  try {
    localStorage.setItem(storageKey(cafeSlug), JSON.stringify(items))
  } catch {
    // localStorage kullanılamıyorsa (gizli sekme vb.) sessizce yoksay.
  }
}

// AuthContext ile aynı Context+Provider deseni. 4 tema dosyasına prop drilling
// yapmamak için PublicMenu.tsx render ağacını sarar; ItemDetailModal ve
// CartButton doğrudan useCart() çağırır. Sepet, sayfa yenilense de kaybolmasın
// diye localStorage'da kafe slug'ına göre saklanır.
export function CartProvider({ cafeSlug, children }: { cafeSlug: string; children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => readCart(cafeSlug))

  useEffect(() => {
    writeCart(cafeSlug, items)
  }, [cafeSlug, items])

  const addItem = useCallback(
    (item: { id: string; name: string; price: number }, quantity: number, note?: string) => {
      const normalizedNote = note?.trim() || null
      setItems((prev) => {
        // Aynı ürün + aynı not zaten sepetteyse miktarı artır; notu farklıysa
        // (ör. biri soğansız, biri normal) ayrı bir satır olarak eklenir.
        const existing = prev.find((i) => i.menuItemId === item.id && i.note === normalizedNote)
        if (existing) {
          return prev.map((i) =>
            i.lineId === existing.lineId ? { ...i, quantity: i.quantity + quantity } : i,
          )
        }
        return [
          ...prev,
          {
            lineId: crypto.randomUUID(),
            menuItemId: item.id,
            name: item.name,
            price: item.price,
            quantity,
            note: normalizedNote,
          },
        ]
      })
    },
    [],
  )

  const updateQuantity = useCallback((lineId: string, quantity: number) => {
    setItems((prev) => {
      if (quantity < 1) return prev.filter((i) => i.lineId !== lineId)
      return prev.map((i) => (i.lineId === lineId ? { ...i, quantity } : i))
    })
  }, [])

  const removeItem = useCallback((lineId: string) => {
    setItems((prev) => prev.filter((i) => i.lineId !== lineId))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const total = useMemo(() => items.reduce((sum, i) => sum + i.price * i.quantity, 0), [items])
  const count = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items])

  const value = useMemo<CartState>(
    () => ({ items, addItem, updateQuantity, removeItem, clear, total, count }),
    [items, addItem, updateQuantity, removeItem, clear, total, count],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart(): CartState {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart, CartProvider içinde kullanılmalı.')
  return ctx
}
