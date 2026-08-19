import { useAuth } from '../../context/AuthContext'
import { Card } from '../../components/ui'
import CafeForm from '../../components/CafeForm'

export default function CreateCafe() {
  const { user, refreshCafe } = useAuth()
  if (!user) return null

  return (
    <div className="mx-auto mt-16 max-w-md px-4">
      <h1 className="mb-2 text-center text-2xl font-bold">Kafenizi Oluşturun</h1>
      <p className="mb-6 text-center text-sm text-ink-soft">
        Son bir adım: kafenizin adını ve menü adresini belirleyin.
      </p>
      <Card>
        <CafeForm ownerId={user.id} onCreated={refreshCafe} />
      </Card>
    </div>
  )
}
