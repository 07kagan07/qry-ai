import { useAuth } from '../context/AuthContext'
import CafeForm from './CafeForm'

interface Props {
  onClose: () => void
}

// ItemFormModal.tsx ile aynı modal kabuğu. Yeni şube oluşturulunca otomatik
// olarak ona geçilir (switchCafe) — kullanıcı elle seçmek zorunda kalmaz.
export default function AddBranchModal({ onClose }: Props) {
  const { user, refreshCafe, switchCafe } = useAuth()
  if (!user) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4"
      onClick={onClose}
      style={{ overscrollBehavior: 'contain' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl sm:p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Yeni Şube Ekle</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-lg text-ink-soft hover:bg-porcelain hover:text-ink active:bg-porcelain"
          >
            ✕
          </button>
        </div>
        <CafeForm
          ownerId={user.id}
          submitLabel="Şubeyi Oluştur"
          onCreated={async (newCafe) => {
            await refreshCafe()
            switchCafe(newCafe.id)
            onClose()
          }}
        />
      </div>
    </div>
  )
}
