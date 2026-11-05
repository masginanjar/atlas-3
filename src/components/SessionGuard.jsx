import { useEffect, useRef, useState } from 'react'
import { Clock, LogOut } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { IDLE_MS, WARN_MS, lastActivity, watchIdle } from '../lib/session.js'
import { Button } from './ui.jsx'

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/**
 * Penjaga sesi: keluar otomatis setelah 3 jam TANPA AKTIVITAS.
 * Peringatan muncul 5 menit sebelumnya dengan tombol "Lanjutkan Sesi".
 * Kartu peringatan tidak merebut fokus — pengguna boleh terus mengetik.
 */
export default function SessionGuard() {
  const { signOut } = useApp()
  const [left, setLeft] = useState(null) // detik tersisa saat peringatan tampil
  const ctl = useRef(null)

  useEffect(() => {
    ctl.current = watchIdle({
      onWarn: (s) => setLeft(s),
      onSafe: () => setLeft(null),
      onExpire: () => { setLeft(null); signOut('idle') },
      onSignOutElsewhere: () => signOut(),
    })
    return () => ctl.current?.stop()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // hitung mundur halus selama peringatan tampil
  useEffect(() => {
    if (left == null) return
    const t = setInterval(() => setLeft(Math.max(0, Math.round((IDLE_MS - (Date.now() - lastActivity())) / 1000))), 1000)
    return () => clearInterval(t)
  }, [left == null]) // eslint-disable-line react-hooks/exhaustive-deps

  if (left == null) return null
  return (
    <div aria-live="assertive" className="fixed bottom-24 right-3 z-[70] w-[min(340px,92vw)] md:bottom-6 md:right-6">
      <div className="rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-amber-200">
        <p className="flex items-center gap-2 text-sm font-bold text-ink"><Clock className="h-4 w-4 text-amber-600" />Sesi akan berakhir</p>
        <p className="mt-1 text-xs text-ink-soft">
          Tidak ada aktivitas selama hampir {IDLE_MS / 3600000} jam. Anda akan keluar otomatis dalam <b className="tabular-nums text-amber-700">{mmss(left)}</b>.
          Klik di mana saja atau tekan tombol di bawah untuk melanjutkan.
        </p>
        <div className="mt-3 flex gap-2">
          <Button size="sm" className="flex-1" onClick={() => ctl.current?.extend()}>Lanjutkan Sesi</Button>
          <Button size="sm" variant="outline" onClick={() => signOut()}><LogOut className="h-3.5 w-3.5" />Keluar</Button>
        </div>
        <p className="mt-2 text-[11px] text-ink-mute">Peringatan muncul {WARN_MS / 60000} menit sebelum sesi berakhir.</p>
      </div>
    </div>
  )
}
