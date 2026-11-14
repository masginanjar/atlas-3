import { useEffect, useRef, useState } from 'react'
import { FileText, Store, Bike, Truck, Package, Plane, Ship, Car, ChevronDown, Check, MapPin, Send, Search } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { cx, Sheet } from './ui.jsx'

// Ikon bawaan yang bisa dipilih di Pengaturan Kurir (logo asli bisa diunggah sendiri)
export const COURIER_ICONS = { file: FileText, store: Store, bike: Bike, truck: Truck, package: Package, plane: Plane, ship: Ship, car: Car, send: Send }
export const COURIER_TYPES = { softcopy: 'Softcopy (tanpa kirim fisik)', pickup: 'Diambil di kantor', courier: 'Kurir / ekspedisi', vendor: 'Dikirim dari penerjemah/vendor' }

/** Logo kurir: gambar yang diunggah, atau ikon berwarna. */
export function CourierLogo({ c, size = 'md' }) {
  const box = size === 'sm' ? 'h-6 w-6 rounded-md' : 'h-8 w-8 rounded-lg'
  if (c?.logo) return <img src={c.logo} alt="" className={cx(box, 'shrink-0 bg-white object-contain ring-1 ring-slate-200')} />
  const Icon = COURIER_ICONS[c?.icon] ?? Package
  return (
    <span className={cx(box, 'grid shrink-0 place-items-center text-white')} style={{ background: c?.color || '#64748b' }} data-ikon-kurir>
      <Icon className={cx('shrink-0', size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
    </span>
  )
}

const sorted = (list) => [...list].sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name))

/** Dropdown "Pilih Kurir" dengan logo — dibuat kontras agar mudah terlihat. */
export function CourierSelect({ value, onChange, printLocation, disabled }) {
  const { data } = useApp()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const [q, setQ] = useState('')
  const boxRef = useRef(null)
  const list = sorted(data.couriers || [])
  const cur = list.find((c) => c.id === value)
  // Daftar ekspedisi kini panjang, jadi bisa dicari. Tidak peduli huruf besar/kecil.
  const cocok = q.trim()
    ? list.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()))
    : list

  // Buka → kosongkan pencarian lama dan arahkan kursor ke kolom cari.
  useEffect(() => {
    if (!open) { setQ(''); return }
    const t = setTimeout(() => boxRef.current?.focus(), 30)
    return () => clearTimeout(t)
  }, [open])

  // Esc menutup; Enter memilih satu-satunya hasil.
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false) }
    if (e.key === 'Enter' && cocok.length === 1) { e.preventDefault(); onChange(cocok[0].id); setOpen(false) }
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" disabled={disabled} onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}
        className={cx('flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition',
          cur ? 'border-l-4 border-orange-500 bg-white ring-1 ring-orange-300 hover:ring-orange-400'
            : 'bg-amber-100 ring-2 ring-orange-500 hover:bg-amber-200', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600', disabled && 'opacity-60')}>
        {cur ? <CourierLogo c={cur} /> : <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-orange-500 text-white" data-ikon-kurir><Truck className="h-4 w-4 shrink-0" /></span>}
        <span className="min-w-0 flex-1">
          <span className={cx('block text-[10px] font-bold uppercase tracking-wide', cur ? 'text-amber-600' : 'text-amber-800')}>Pilih Kurir</span>
          <span className={cx('block truncate text-sm', cur ? 'font-semibold text-ink' : 'font-semibold text-amber-900')}>{cur?.name ?? 'Belum dipilih'}</span>
        </span>
        <ChevronDown className={cx('h-4 w-4 transition', cur ? 'text-ink-mute' : 'text-amber-800', open && 'rotate-180')} />
      </button>
      {cur?.type === 'pickup' && (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-ink-mute"><MapPin className="h-3 w-3" />Ambil di Kantor {printLocation || '—'}</p>
      )}
      {open && (
        <Sheet open onClose={() => setOpen(false)} title="Pilih kurir / metode pengiriman" subtitle={cur ? `Sekarang: ${cur.name}` : 'Syarat "Selesai" mengikuti metode yang dipilih'}>
          <div className="space-y-3" data-popup-kurir>
            <label className="relative block min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" aria-hidden="true" />
              <input ref={boxRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
                placeholder="Cari kurir / ekspedisi…" aria-label="Cari kurir"
                className="h-11 w-full rounded-xl border-0 bg-slate-50 pl-9 pr-3 text-sm ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-brand" />
            </label>
            <ul role="listbox" className="grid gap-1.5 sm:grid-cols-2">
              {cocok.map((c) => (
                <li key={c.id}>
                  <button type="button" role="option" aria-selected={c.id === value} onClick={() => { onChange(c.id); setOpen(false) }}
                    className={cx('flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left ring-1 transition', c.id === value ? 'bg-brand-soft ring-brand' : 'ring-slate-200 hover:ring-brand')}>
                    <CourierLogo c={c} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{c.name}</span>
                      <span className="block truncate text-[11px] text-ink-mute">{c.type === 'pickup' ? `Diambil di kantor ${printLocation || ''}` : c.type === 'softcopy' ? 'Tanpa pengiriman fisik' : c.type === 'vendor' ? 'Penerjemah/vendor kirim langsung' : 'Kurir / ekspedisi'}</span>
                    </span>
                    {c.id === value && <Check className="h-4 w-4 shrink-0 text-brand" />}
                  </button>
                </li>
              ))}
              {!list.length && <li className="col-span-full px-3 py-4 text-center text-xs text-ink-mute">Belum ada kurir — tambahkan di Setting → Kurir</li>}
              {!!list.length && !cocok.length && <li className="col-span-full px-3 py-4 text-center text-xs text-ink-mute">Kurir tidak ditemukan</li>}
            </ul>
          </div>
        </Sheet>
      )}
    </div>
  )
}
