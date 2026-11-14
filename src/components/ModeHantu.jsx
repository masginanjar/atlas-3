import { useMemo, useState } from 'react'
import { Ghost, X, Search, Eye } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { roleLabel, ROLES } from '../config/access.js'
import { Popover, cx } from './ui.jsx'
import Avatar from './Avatar.jsx'

// ============================================================
//  MODE HANTU — Superadmin melihat aplikasi sebagai pengguna lain
//  tanpa login sebagai orang itu. Hanya melihat: semua penyimpanan
//  ditolak di store (tolakHantu), dan masuk/keluar tercatat di log.
// ============================================================

/** Daftar pengguna untuk dipilih (dipakai di tombol header & di Pengaturan). */
export function DaftarHantu({ onPilih, close }) {
  const { data, user, hantu } = useApp()
  const [q, setQ] = useState('')
  const urut = Object.keys(ROLES)
  const list = useMemo(() => (data.users || [])
    .filter((u) => u.active !== false && u.id !== (user._hantu_by || user._actor || user.id))
    .filter((u) => !q.trim() || `${u.name} ${roleLabel(u)} ${u.branch} ${(u.branches || []).join(' ')}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => urut.indexOf(a.role) - urut.indexOf(b.role) || String(a.name).localeCompare(String(b.name))), [data.users, q, user]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="w-[min(92vw,340px)]">
      <p className="px-1 pb-1 text-[11px] font-bold uppercase tracking-wider text-ink-mute">Lihat sebagai…</p>
      <label className="relative mb-1.5 block">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama, peran, atau cabang…"
          className="h-10 w-full rounded-lg bg-slate-50 pl-8 pr-2 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-brand" />
      </label>
      <ul className="max-h-[50vh] overflow-y-auto">
        {list.map((u) => (
          <li key={u.id}>
            <button type="button" onClick={() => { close?.(); onPilih(u.id) }} data-hantu-pilih={u.id}
              className={cx('flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50', hantu === u.id && 'bg-violet-50')}>
              <Avatar user={u} size={30} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{u.name}</span>
                <span className="block truncate text-[11px] text-ink-mute">{roleLabel(u)} · {u.branch}{u.branches?.length ? ` +${u.branches.length}` : ''}</span>
              </span>
              {hantu === u.id && <Eye className="h-4 w-4 text-violet-600" />}
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="px-2 py-6 text-center text-xs text-ink-mute">Tidak ditemukan.</li>}
      </ul>
    </div>
  )
}

/** Tombol hantu di header — hanya untuk Superadmin. */
export function TombolHantu({ kiriBawah, rel, ikon } = {}) {
  const { bolehHantu, setHantu, user } = useApp()
  if (!bolehHantu) return null
  return (
    <Popover label="Mode hantu" align={kiriBawah ? 'left' : 'right'} atas={kiriBawah} width="min-w-[300px]" panelClass={kiriBawah ? cx('bottom-4 max-h-[80vh] overflow-y-auto', rel ? 'left-[72px]' : 'left-[220px]') : ''}
      button={({ open, toggle }) => (
        <button type="button" onClick={toggle} aria-expanded={open} aria-label="Mode hantu — lihat sebagai pengguna lain" title="Mode hantu — lihat sebagai pengguna lain"
          data-aksi="mode-hantu"
          className={ikon ? cx('relative grid h-11 w-11 shrink-0 place-items-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand md:h-8 md:w-8', user._hantu ? 'bg-violet-600 text-white' : open ? 'bg-[#E9EBF3] text-[#141B34] dark:bg-white/10' : 'text-[#4A4F6A] hover:bg-[#E9EBF3] hover:text-[#141B34] dark:text-slate-300 dark:hover:bg-white/10')
            : cx('grid h-11 w-11 shrink-0 place-items-center rounded-lg transition', !kiriBawah && 'md:h-9 md:w-9', user._hantu ? 'bg-violet-600 text-white' : kiriBawah ? 'text-[#5E6380] ring-1 ring-[#E7E8F0] hover:bg-[#F3F4F9] dark:ring-white/10' : 'hover:bg-white/10')}
          style={user._hantu || kiriBawah || ikon ? undefined : { color: 'var(--head-mute)' }}>
          <Ghost className={ikon ? 'h-[17px] w-[17px]' : 'h-[18px] w-[18px]'} aria-hidden="true" />
        </button>
      )}>
      {({ close }) => <DaftarHantu onPilih={setHantu} close={close} />}
    </Popover>
  )
}

/** Pita ungu di atas layar selama mode hantu aktif. */
export function PitaHantu() {
  const { user, setHantu } = useApp()
  if (!user?._hantu) return null
  return (
    <div className="relative z-[31] flex min-h-11 items-center gap-2 bg-violet-600 px-3 py-1.5 text-white shadow" role="status" data-pita-hantu>
      <Ghost className="h-4 w-4 shrink-0" />
      <p className="min-w-0 flex-1 truncate text-[12.5px]">
        <b>Mode hantu</b> · melihat sebagai <b>{user.name}</b> <span className="text-white/80">({roleLabel(user)}{user.branch ? ` · ${user.branch}` : ""})</span>
        <span className="hidden text-white/80 sm:inline"> — hanya melihat, data tidak bisa diubah</span>
      </p>
      <Popover label="Ganti akun" align="right" width="min-w-[300px]"
        button={({ toggle }) => <button type="button" onClick={toggle} className="h-8 shrink-0 rounded-lg bg-white/15 px-2.5 text-xs font-bold hover:bg-white/25">Ganti</button>}>
        {({ close }) => <DaftarHantu onPilih={setHantu} close={close} />}
      </Popover>
      <button type="button" onClick={() => setHantu('')} data-aksi="keluar-hantu" className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 text-xs font-bold text-violet-700 hover:bg-violet-50">
        <X className="h-3.5 w-3.5" />Keluar
      </button>
    </div>
  )
}
