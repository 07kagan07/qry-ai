import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { UI_TEXT, type UIKey, type UILang } from '../lib/uiText'
import type { LocaleKey } from '../lib/locales'

const LocaleContext = createContext<LocaleKey | null>(null)

// CartContext.tsx ile aynı Provider deseni. PublicMenu.tsx, CartProvider ile
// aynı yerde bunu da sarar; ItemDetailModal, ReservationButton, CartButton vb.
// hiçbir prop almadan doğrudan useT() çağırır.
export function LocaleProvider({ locale, children }: { locale: LocaleKey | null; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
}

type TFunc = (key: UIKey, vars?: Record<string, string | number>) => string

// Sipariş gibi sunucuya gönderilen isteklerde, o an müşteriye gösterilen dilin
// ham kodu gerekir (create_order RPC'si ürün adını bu dile göre çevirir).
// eslint-disable-next-line react-refresh/only-export-components
export function useLocale(): LocaleKey | null {
  return useContext(LocaleContext)
}

// eslint-disable-next-line react-refresh/only-export-components
export function useT(): TFunc {
  const locale = useContext(LocaleContext)
  return (key: UIKey, vars) => {
    const entry = UI_TEXT[key]
    const lang: UILang = locale ?? 'tr'
    let text = entry[lang] ?? entry.tr
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replaceAll(`{${k}}`, String(v))
      }
    }
    return text
  }
}
