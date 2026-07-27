import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { Button, Card, ErrorText, Input, Label } from '../components/ui'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) {
      setError(error.message === 'Invalid login credentials' ? 'E-posta veya şifre hatalı.' : error.message)
      return
    }
    navigate('/panel')
  }

  return (
    <div className="mx-auto mt-16 max-w-md px-4">
      <h1 className="mb-6 text-center text-2xl font-bold">İşletme Girişi</h1>
      {!isSupabaseConfigured && (
        <Card className="mb-4 border-line bg-cobalt-soft">
          <p className="text-sm text-cobalt-deep">
            Supabase yapılandırılmamış. <code>.env</code> dosyasını README'deki adımlarla oluşturun.
          </p>
        </Card>
      )}
      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label>E-posta</Label>
            <Input type="email" name="email" autoComplete="email" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label>Şifre</Label>
            <Input type="password" name="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Giriş yapılıyor…' : 'Giriş Yap'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-ink-soft">
          Hesabınız yok mu?{' '}
          <Link to="/kayit" className="font-medium text-cobalt hover:underline">
            Kayıt olun
          </Link>
        </p>
      </Card>
    </div>
  )
}
