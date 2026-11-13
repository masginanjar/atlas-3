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
    <div className="w-full space-y-2">
      <div className="min-w-0">
        <h1 className="text-[17px] font-extrabold leading-tight tracking-tight" title="Data vendor, tarif layanan, termin pembayaran & rekening. Sama dengan Setting → Vendor.">Vendor</h1>
        
      </div>
      <Vendors keAtas />
    </div>
  )
}
