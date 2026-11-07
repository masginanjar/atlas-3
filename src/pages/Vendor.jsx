import { Store, Lock } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { Card, Empty } from '../components/ui.jsx'
import { canSeeVendor } from '../config/menuAccess.js'
import { Vendors } from './Settings.jsx'

/**
 * Submenu Project → Vendor.
 * Memakai data & formulir vendor yang sama dengan Setting → Vendor, jadi
 * perubahan di sini langsung terlihat di sana dan sebaliknya.
 */
export default function Vendor() {
  const { user } = useApp()
  if (!canSeeVendor(user)) {
    return <Card><Empty icon={Lock} title="Halaman Vendor hanya untuk Superadmin" /></Card>
  }
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-lg font-bold text-ink"><Store className="h-5 w-5 text-brand" />Vendor</h1>
        <p className="text-xs text-ink-soft">Data vendor, tarif layanan, termin pembayaran &amp; rekening. Sama dengan Setting → Vendor.</p>
      </div>
      <Vendors />
    </div>
  )
}
