import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Button, Card, ErrorText, Input, Label } from '../../components/ui'

function slugify(name: string): string {
  const map: Record<string, string> = {
    ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u',
    Ç: 'c', Ğ: 'g', İ: 'i', I: 'i', Ö: 'o', Ş: 's', Ü: 'u',
  }
  return name
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export default function CreateCafe() {
  const { user, refreshCafe } = useAuth()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function onNameChange(v: string) {
    setName(v)
    if (!slugTouched) setSlug(slugify(v))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setError('')
    if (!/^[a-z0-9-]{3,60}$/.test(slug)) {
      setError('Menü adresi 3-60 karakter olmalı; sadece küçük harf, rakam ve tire içerebilir.')
      return
    }
    setBusy(true)
    const { error } = await supabase
      .from('cafes')
      .insert({ owner_id: user.id, name, slug })
    setBusy(false)
    if (error) {
      setError(error.code === '23505' ? 'Bu menü adresi alınmış, başka bir tane deneyin.' : error.message)
      return
    }
    await refreshCafe()
  }

  return (
    <div className="mx-auto mt-16 max-w-md px-4">
      <h1 className="mb-2 text-center text-2xl font-bold">Kafenizi Oluşturun</h1>
      <p className="mb-6 text-center text-sm text-ink-soft">
        Son bir adım: kafenizin adını ve menü adresini belirleyin.
      </p>
      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label>Kafe Adı</Label>
            <Input value={name} onChange={(e) => onNameChange(e.target.value)} required placeholder="Örn: Keyif Kahve" />
          </div>
          <div>
            <Label>Menü Adresi</Label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-ink-soft">/menu/</span>
              <Input
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true)
                  setSlug(e.target.value)
                }}
                required
                placeholder="keyif-kahve"
              />
            </div>
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Oluşturuluyor…' : 'Kafeyi Oluştur'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
