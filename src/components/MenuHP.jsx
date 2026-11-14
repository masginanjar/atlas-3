import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { cx } from './ui.jsx'

// ============================================================
//  MENU HP (lembar "Menu" di tab bawah) — Opsi C:
//  "Sering dipakai" (4 tombol besar) + tab kelompok + daftar isi kelompok.
//  Kelompok sama dengan menu kiri di komputer, jadi staf tidak belajar 2 pola.
//  "Sering dipakai" = menu yang paling sering dibuka di perangkat ini
//  (dihitung otomatis); sebelum ada riwayat, pakai bawaan per peran.
// ============================================================

const KUNCI = 'atlas-menu-sering'
const bacaHitung = () => { try { return JSON.parse(localStorage.getItem(KUNCI) || '{}') || {} } catch { return {} } }
const BAWAAN = {
  superadmin: ['projects', 'faktur', 'agenda', 'keuangan'],
  direktur: ['projects', 'keuangan', 'faktur', 'penugasan'],
  supervisor: ['projects', 'penugasan', 'agenda', 'dokumen'],
  cs: ['projects', 'faktur', 'pelanggan', 'agenda'],
  akunting: ['keuangan', 'faktur', 'vendor', 'projects'],
  admin_pusat: ['projects', 'register', 'otorisasi', 'dokumen'],
}
const pendek = (label) => label.replace('Kantor & Sistem', 'Kantor')

/** Catat halaman yang dibuka (dipanggil saat rute berubah). */
export function catatKunjungan(key) {
  if (!key) return
  try { const h = bacaHitung(); h[key] = (h[key] || 0) + 1; localStorage.setItem(KUNCI, JSON.stringify(h)) } catch { /* abaikan */ }
}

export default function MenuHP({ grup, user, page, badgeOf, onPilih }) {
  // semua item yang boleh dibuka, dengan nama kelompoknya
  const semua = useMemo(() => grup.flatMap((g) => (g.children || [g]).filter((n) => !n.segera && !n.samping).map((n) => ({ ...n, grup: g.id, grupLabel: g.label }))), [grup])
  const kelompok = grup.filter((g) => (g.children || []).filter((n) => !n.segera && !n.samping).length > 1)
  const tunggal = semua.filter((n) => !kelompok.some((g) => g.id === n.grup)) // Beranda, Dashboard
  const grupAktif = semua.find((n) => n.key === page)?.grup
  const [tab, setTab] = useState(() => (kelompok.some((g) => g.id === grupAktif) ? grupAktif : 'semua'))
  useEffect(() => { if (kelompok.some((g) => g.id === grupAktif)) setTab(grupAktif) }, [grupAktif]) // eslint-disable-line react-hooks/exhaustive-deps

  const barisTab = useRef(null)
  useEffect(() => { // tab terpilih digeser ke tengah supaya terlihat
    const el = barisTab.current?.querySelector('[aria-selected="true"]')
    if (el && barisTab.current) barisTab.current.scrollLeft = el.offsetLeft - (barisTab.current.clientWidth - el.offsetWidth) / 2
  }, [tab])
  const sering = useMemo(() => {
    const h = bacaHitung()
    // Beranda & Dashboard = halaman awal (terbuka otomatis saat login) → tidak dihitung sebagai "sering dipakai"
    const ada = (k) => !['beranda', 'dashboard'].includes(k) && semua.find((n) => n.key === k)
    const urut = Object.entries(h).sort((a, b) => b[1] - a[1]).map(([k]) => k).filter(ada)
    const isi = [...urut, ...(BAWAAN[user.role] || BAWAAN.cs), ...semua.map((n) => n.key)]
    return [...new Set(isi)].filter(ada).slice(0, 4).map(ada)
  }, [semua, user.role])

  const daftar = tab === 'semua' ? null : semua.filter((n) => n.grup === tab)
  const Baris = ({ n }) => {
    const b = badgeOf(n)
    const aktif = page === n.key
    return (
      <li>
        <a href={`#/${n.key}`} onClick={onPilih} aria-current={aktif ? 'page' : undefined} data-menu-item={n.key}
          className={cx('flex min-h-[52px] items-center gap-3 rounded-2xl px-3.5 text-[15px] font-semibold ring-1 transition', aktif ? 'bg-brand-soft text-brand ring-brand/30' : 'bg-white text-ink ring-slate-200 active:bg-slate-50 dark:bg-white/5 dark:ring-white/10')}>
          <span className={cx('grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px]', aktif ? 'bg-white text-brand' : 'bg-slate-100 text-ink-soft dark:bg-white/10')}>{n.icon && <n.icon className="h-[19px] w-[19px]" aria-hidden="true" />}</span>
          <span className="min-w-0 flex-1 truncate">{n.label}</span>
          {b > 0 && <span className="rounded-full bg-rose-600 px-2 text-[11px] font-bold leading-5 text-white">{b > 999 ? '999+' : b}</span>}
          <ChevronRight className="h-[18px] w-[18px] shrink-0 text-ink-mute/60" aria-hidden="true" />
        </a>
      </li>
    )
  }
  return (
    <div data-menu-hp>
      {/* Sering dipakai */}
      <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-ink-mute">Sering dipakai</p>
      <ul className="mt-1 grid grid-cols-4 gap-1" data-menu-sering>
        {sering.map((n) => {
          const b = badgeOf(n)
          return (
            <li key={n.key}>
              <a href={`#/${n.key}`} onClick={onPilih} className="relative flex flex-col items-center gap-1.5 rounded-2xl py-2 text-center active:bg-slate-50" data-menu-item={n.key}>
                <span className={cx('grid h-[52px] w-[52px] place-items-center rounded-2xl', page === n.key ? 'bg-brand text-white' : 'bg-[#141B34] text-white dark:bg-white/15')}>{n.icon && <n.icon className="h-[22px] w-[22px]" aria-hidden="true" />}</span>
                <span className="w-full truncate px-0.5 text-[12px] font-semibold text-ink">{n.label}</span>
                {b > 0 && <span className="absolute right-1.5 top-0.5 rounded-full bg-rose-600 px-1.5 text-[10.5px] font-bold leading-[18px] text-white ring-2 ring-white">{b > 999 ? '999+' : b}</span>}
              </a>
            </li>
          )
        })}
      </ul>
      <div className="my-3 h-px bg-slate-100 dark:bg-white/10" />

      {/* Tab kelompok */}
      <div ref={barisTab} role="tablist" aria-label="Kelompok menu" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-tab-menu>
        {[{ id: 'semua', label: 'Semua' }, ...kelompok].map((g) => (
          <button key={g.id} type="button" role="tab" aria-selected={tab === g.id} onClick={() => setTab(g.id)} data-tab={g.id}
            className={cx('h-10 shrink-0 whitespace-nowrap rounded-full border px-4 text-[13px] font-semibold transition', tab === g.id ? 'border-[#141B34] bg-[#141B34] text-white dark:border-white dark:bg-white dark:text-[#141B34]' : 'border-slate-200 bg-white text-ink-soft dark:border-white/15 dark:bg-white/5')}>
            {pendek(g.label)}
          </button>
        ))}
      </div>

      {/* Isi kelompok */}
      {daftar ? (
        <ul className="flex flex-col gap-2" role="tabpanel" aria-label={kelompok.find((g) => g.id === tab)?.label}>
          {daftar.map((n) => <Baris key={n.key + (n.sub || '')} n={n} />)}
        </ul>
      ) : (
        <div className="space-y-4" role="tabpanel" aria-label="Semua menu">
          {tunggal.length > 0 && <ul className="flex flex-col gap-2">{tunggal.map((n) => <Baris key={n.key} n={n} />)}</ul>}
          {kelompok.map((g) => (
            <section key={g.id}>
              <h3 className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-ink-mute">{g.label}</h3>
              <ul className="flex flex-col gap-2">{semua.filter((n) => n.grup === g.id).map((n) => <Baris key={n.key + (n.sub || '')} n={n} />)}</ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
