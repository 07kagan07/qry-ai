import type { MenuTheme } from './types'

export interface ThemeMeta {
  id: MenuTheme
  name: string
  description: string
}

export const MENU_THEMES: ThemeMeta[] = [
  {
    id: 'classic',
    name: 'Klasik Liste',
    description: 'Küçük görsel, ürün adı ve fiyat yan yana. Dengeli ve tanıdık.',
  },
  {
    id: 'grid',
    name: 'Görsel Izgara',
    description: '2 sütunlu, büyük fotoğraflı kartlar. Görselleri öne çıkarır.',
  },
  {
    id: 'elegant',
    name: 'Zarif Menü',
    description: 'Görselsiz, ortalanmış, tipografi odaklı — restoran menüsü hissi.',
  },
  {
    id: 'compact',
    name: 'Kompakt Liste',
    description: 'Görselsiz, sık aralıklı. Çok ürünlü menüler için en yoğun görünüm.',
  },
]
