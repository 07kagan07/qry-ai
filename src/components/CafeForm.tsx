import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import type { Cafe } from '../lib/types'
import { Button, ErrorText, Input, Label } from './ui'

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

interface Props {
  ownerId: string
  onCreated: (cafe: Cafe) => void | Promise<void>
  submitLabel?: string
}

// CreateCafe.tsx (ilk kurulum) ve AddBranchModal.tsx (yeni şube ekleme) arasında
// paylaşılan ad+slug formu — davranış ikisinde de aynı.
export default function CafeForm({ ownerId, onCreated, submitLabel = 'Kafeyi Oluştur' }: Props) {
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
    setError('')
    if (!/^[a-z0-9-]{3,60}$/.test(slug)) {
      setError('Menü adresi 3-60 karakter olmalı; sadece küçük harf, rakam ve tire içerebilir.')
      return
    }
    setBusy(true)
    const { data, error: insertErr } = await supabase
      .from('cafes')
      .insert({ owner_id: ownerId, name, slug })
      .select()
      .single()
    setBusy(false)
    if (insertErr) {
      setError(insertErr.code === '23505' ? 'Bu menü adresi alınmış, başka bir tane deneyin.' : insertErr.message)
      return
    }
    await onCreated(data as Cafe)
  }

  return (
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
        {busy ? 'Oluşturuluyor…' : submitLabel}
      </Button>
    </form>
  )
}
