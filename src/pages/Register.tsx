import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button, Card, ErrorText, Input, Label } from '../components/ui'

export default function Register() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { data, error } = await supabase.auth.signUp({ email, password })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    // E-posta doğrulaması kapalıysa session hemen gelir
    if (data.session) {
      navigate('/panel')
    } else {
      setInfo('Kayıt alındı. E-postanıza gelen doğrulama bağlantısına tıklayın, sonra giriş yapın.')
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-md px-4">
      <h1 className="mb-6 text-center text-2xl font-bold">İşletme Kaydı</h1>
      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label>E-posta</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label>Şifre (en az 6 karakter)</Label>
            <Input
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <ErrorText>{error}</ErrorText>
          {info && <p className="text-sm text-teal-deep">{info}</p>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Kayıt yapılıyor…' : 'Kayıt Ol'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-ink-soft">
          Zaten hesabınız var mı?{' '}
          <Link to="/giris" className="font-medium text-cobalt hover:underline">
            Giriş yapın
          </Link>
        </p>
      </Card>
    </div>
  )
}
