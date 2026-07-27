import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Button, Card, ErrorText, Input, Label } from '../../components/ui'

export default function Dashboard() {
  const { cafe, refreshCafe } = useAuth()
  const [name, setName] = useState(cafe?.name ?? '')
  const [address, setAddress] = useState(cafe?.address ?? '')
  const [phone, setPhone] = useState(cafe?.phone ?? '')
  const [instagram, setInstagram] = useState(cafe?.instagram ?? '')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  if (!cafe) return null

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSaved(false)
    setBusy(true)
    const { error } = await supabase
      .from('cafes')
      .update({ name, address: address || null, phone: phone || null, instagram: instagram || null })
      .eq('id', cafe!.id)
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    setSaved(true)
    await refreshCafe()
  }

  return (
    <div className="max-w-xl">
      <h1 className="mb-4 text-xl font-bold">Kafe Bilgileri</h1>
      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label>Kafe Adı</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label>Adres</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Menü altında gösterilir" />
          </div>
          <div>
            <Label>Telefon</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label>Instagram</Label>
            <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@kullaniciadi" />
          </div>
          <ErrorText>{error}</ErrorText>
          {saved && <p className="text-sm text-teal-deep">Kaydedildi.</p>}
          <Button type="submit" disabled={busy}>
            {busy ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </form>
      </Card>

      <Card className="mt-4 border-line bg-cobalt-soft">
        <h2 className="mb-2 font-semibold text-cobalt-deep">Mevzuat Hatırlatması</h2>
        <p className="text-sm leading-relaxed text-cobalt-deep">
          Türk Gıda Kodeksi düzenlemesine göre menünüzdeki her ürün için <strong>14 majör alerjen</strong>,{' '}
          <strong>enerji değeri (kcal)</strong> ile <strong>alkol ve domuz içeriği</strong> beyanı
          zorunludur. Menü Yönetimi sayfasındaki <em>"AI ile Doldur"</em> özelliği bu alanları sizin
          için önerir; öneriler yapay zeka tahminidir, yayınlamadan önce kontrol edip onaylamanız
          gerekir. QR menü kullanan işletmelerin, QR koda erişemeyen müşteriler için yazılı bir
          alternatif bulundurması gerekir — bunun için QR Kod sayfasındaki yazdırılabilir menüyü
          kullanabilirsiniz.
        </p>
      </Card>
    </div>
  )
}
