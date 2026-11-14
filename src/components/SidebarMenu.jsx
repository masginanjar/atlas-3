import { useEffect, useState } from 'react'
import { ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { cx } from './ui.jsx'
import { jamKantor } from '../lib/zona.js'

// ============================================================
//  MENU SAMPING (desain CANVAS ATLAS · "Kerangka komputer")
//  Sidebar putih 240 px berlabel, dikelompokkan (Utama, Penjualan,
//  Project, Keuangan, Agenda, Kantor & Sistem). Grup berisi 1 menu
//  tampil sebagai tombol langsung. Menu bagian Keuangan/ATLAS Books
//  yang belum jadi tampil dengan tanda "Segera" dan tidak bisa diklik.
// ============================================================

const badgeOf = (n, ctx) => (n.badge ? n.badge(ctx.user, ctx.data, ctx.branchFilter, ctx.extra) : 0)
const hrefOf = (n) => `#/${n.key}${n.sub ? `/${n.sub}` : ''}`
const aktifItem = (n, page, param) => !n.segera && page === n.key && (n.sub ? param === n.sub : !n.subOnly || !param)

function Jam({ zona, label }) {
  const f = () => { try { return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: zona }).format(new Date()).replace(':', '.') } catch { return '--.--' } }
  const [t, setT] = useState(f)
  useEffect(() => { const id = setInterval(() => setT(f()), 30000); return () => clearInterval(id) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="min-w-0 flex-1 rounded-lg px-2 py-1.5 ring-1 ring-[#E7E8F0] dark:ring-white/10">
      <span className="block truncate text-[10px] font-bold tracking-wide text-[#5E6380]">{label}</span>
      <span className="block text-base font-bold leading-tight tabular-nums">{t}</span>
    </div>
  )
}

const KUNCI_SEMBUNYI = 'atlas-sidebar-sembunyi'
const bacaSembunyi = () => { try { return localStorage.getItem(KUNCI_SEMBUNYI) === '1' } catch { return false } }

export default function SidebarMenu({ menu, page, param, ctx, bawah, alatBawah, atas, profil }) {
  // Menu kiri bisa disembunyikan (ikon di pojok atas); pilihan diingat di browser ini
  const [sembunyi, setSembunyi] = useState(bacaSembunyi)
  const [layang, setLayang] = useState('') // grup yang daftar menunya sedang terbuka di samping rel ikon
  const tukar = () => setSembunyi((v) => { try { localStorage.setItem(KUNCI_SEMBUNYI, v ? '0' : '1') } catch { /* abaikan */ } return !v })
  const grupAktif = menu.find((g) => (g.children || [g]).some((n) => aktifItem(n, page, param)))
  const [buka, setBuka] = useState(grupAktif?.id || 'utama')
  useEffect(() => { if (grupAktif) setBuka(grupAktif.id) }, [grupAktif?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const btn = 'flex min-h-[38px] w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px]'
  if (sembunyi) return (
    <aside data-sidebar data-sidebar-sembunyi className="sticky top-0 z-30 hidden h-[100dvh] w-[64px] shrink-0 flex-col items-center gap-1 border-r border-[#E7E8F0] bg-white py-3 text-[#141B34] lg:flex dark:border-white/10 dark:bg-[#121729] dark:text-slate-100">
      {atas && <div className="mb-1 flex flex-col items-center">{atas(true)}</div>}
      <nav aria-label="Menu ATLAS (ringkas)" className="flex flex-col items-center gap-1">
        {menu.map((g) => {
          const anak = (g.children || [g]).filter((n) => !n.segera)
          if (!anak.length) return null
          const Ikon = g.icon || anak[0].icon
          const on = anak.some((n) => aktifItem(n, page, param))
          const b = anak.reduce((t, n) => t + badgeOf(n, ctx), 0)
          const kls = cx('relative grid h-11 w-11 place-items-center rounded-xl', on ? 'bg-[var(--brand)] text-white' : 'text-[#141B34] hover:bg-[#F3F4F9] dark:text-slate-100 dark:hover:bg-white/10')
          const lencana = b > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-rose-600 px-1 text-center text-[10px] font-bold leading-[18px] text-white">{b > 99 ? '99+' : b}</span>
          if (anak.length === 1) return (
            <a key={g.id || anak[0].key} href={hrefOf(anak[0])} title={anak[0].label} aria-label={anak[0].label} aria-current={on ? 'page' : undefined} data-nav="rel" className={kls}><Ikon className="h-5 w-5" aria-hidden="true" />{lencana}</a>
          )
          const terbuka = layang === g.id
          return (
            <div key={g.id} className="relative">
              <button type="button" onClick={() => setLayang(terbuka ? '' : g.id)} title={g.label} aria-label={g.label} aria-expanded={terbuka} data-grup-rel={g.id} className={kls}><Ikon className="h-5 w-5" aria-hidden="true" />{lencana}</button>
              {terbuka && (
                <div className="absolute left-[52px] top-0 z-40 flex w-52 flex-col gap-0.5 rounded-xl border border-[#DADDE8] bg-white p-1.5 shadow-xl dark:border-white/10 dark:bg-[#1A2033]" role="menu" aria-label={g.label}>
                  <span className="px-2.5 pb-1 pt-1 text-[11px] font-bold uppercase tracking-wide text-[#5E6380]">{g.label}</span>
                  {anak.map((n) => { const a = aktifItem(n, page, param); const bb = badgeOf(n, ctx); return (
                    <a key={n.key + (n.sub || '')} href={hrefOf(n)} role="menuitem" onClick={() => setLayang('')} aria-current={a ? 'page' : undefined}
                      className={cx('flex min-h-[40px] items-center gap-2 rounded-lg px-2.5 text-sm', a ? 'bg-[#F3F4F9] font-bold dark:bg-white/10' : 'hover:bg-[#F3F4F9] dark:hover:bg-white/5')}>
                      <span className="min-w-0 flex-1 truncate">{n.label}</span>{bb > 0 && <span className="rounded-full bg-rose-600 px-1.5 text-[11px] font-bold text-white">{bb > 99 ? '99+' : bb}</span>}
                    </a>
                  ) })}
                </div>
              )}
            </div>
          )
        })}
      </nav>
      <div className="mt-auto flex flex-col items-center gap-1.5" data-alat-bawah>
        {alatBawah?.(true)}
        {profil && <div className="flex flex-col items-center gap-1.5 border-t border-[#E7E8F0] pt-1.5 dark:border-white/10" data-profil-bawah>{profil(true)}</div>}
      </div>
      {layang && <button type="button" aria-label="Tutup menu" tabIndex={-1} onClick={() => setLayang('')} className="fixed inset-0 z-30 cursor-default" />}
      <button type="button" onClick={tukar} title="Tampilkan menu" aria-label="Tampilkan menu" aria-expanded="false" data-aksi="tampilkan-menu"
        className="relative z-40 grid h-11 w-11 place-items-center rounded-xl text-[#5E6380] hover:bg-[#F3F4F9] hover:text-[#141B34] dark:hover:bg-white/10"><PanelLeftOpen className="h-5 w-5" /></button>
    </aside>
  )
  return (
    <aside data-sidebar className="sticky top-0 hidden h-[100dvh] max-h-[100dvh] w-[212px] shrink-0 flex-col overflow-hidden border-r border-[#E7E8F0] bg-white py-4 text-[#141B34] lg:flex dark:border-white/10 dark:bg-[#121729] dark:text-slate-100">
      {/* 1) Atas — tetap */}
      {atas && <div className="shrink-0 px-3 pb-3" data-sidebar-bagian="atas">{atas(false)}</div>}
      {/* 2) Tengah — hanya bagian ini yang bergulir; overscroll-contain: tidak ikut menggulir halaman */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 [scrollbar-width:thin]" data-sidebar-bagian="menu">
      <nav aria-label="Menu ATLAS" className="flex flex-col gap-1 pb-2">
        {menu.map((g) => {
          const anak = g.children || [g]
          if (anak.length === 1 && !anak[0].segera) {
            const n = anak[0]; const on = aktifItem(n, page, param); const b = badgeOf(n, ctx)
            const Ikon = g.icon || n.icon
            return (
              <a key={g.id || n.key} href={hrefOf(n)} aria-current={on ? 'page' : undefined} data-nav="samping" data-key={n.key}
                className={cx(btn, 'font-semibold', on ? 'bg-[var(--brand)] text-white' : 'hover:bg-[#F3F4F9] dark:hover:bg-white/5')}>
                <Ikon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{n.label}</span>
                {b > 0 && <span className="rounded-full bg-rose-600 px-1.5 text-[11px] font-bold text-white">{b > 99 ? '99+' : b}</span>}
              </a>
            )
          }
          const isi = anak.some((n) => aktifItem(n, page, param))
          const terbuka = buka === g.id
          const totalB = anak.reduce((t, n) => t + badgeOf(n, ctx), 0)
          return (
            <div key={g.id} className="flex flex-col gap-0.5">
              <button type="button" onClick={() => setBuka(terbuka ? '' : g.id)} aria-expanded={terbuka} data-grup={g.id}
                className={cx(btn, 'font-semibold', isi && !terbuka ? 'bg-[#F3F4F9] dark:bg-white/5' : 'hover:bg-[#F3F4F9] dark:hover:bg-white/5')}>
                <g.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{g.label}</span>
                {!terbuka && totalB > 0 && <span className="rounded-full bg-rose-600 px-1.5 text-[11px] font-bold text-white">{totalB > 99 ? '99+' : totalB}</span>}
                <ChevronRight className={cx('h-4 w-4 text-[#5E6380] transition-transform', terbuka && 'rotate-90')} aria-hidden="true" />
              </button>
              {terbuka && (
                <div className="flex flex-col gap-0.5 pl-7">
                  {anak.map((n) => {
                    const on = aktifItem(n, page, param); const b = badgeOf(n, ctx)
                    if (n.segera) return (
                      <span key={n.id || n.key} aria-disabled="true" title="Bagian ATLAS Books — sedang disiapkan" data-segera={n.key}
                        className={cx(btn, 'cursor-default font-medium text-[#8A8FA8]')}>
                        <span className="min-w-0 flex-1 truncate">{n.label}</span>
                        <span className="rounded-full bg-[#EEF0F5] px-2 py-0.5 text-[10.5px] font-bold text-[#4A4F6A]">Segera</span>
                      </span>
                    )
                    return (
                      <a key={n.id || n.key} href={hrefOf(n)} aria-current={on ? 'page' : undefined} data-nav="samping" data-key={n.key}
                        className={cx(btn, on ? 'bg-[var(--brand)] font-semibold text-white' : 'font-medium hover:bg-[#F3F4F9] dark:hover:bg-white/5')}>
                        <span className="min-w-0 flex-1 truncate">{n.label}</span>
                        {b > 0 && <span className={cx('rounded-full px-1.5 text-[11px] font-bold', on ? 'bg-white text-rose-700' : 'bg-rose-600 text-white')}>{b > 99 ? '99+' : b}</span>}
                      </a>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>
      </div>
      {/* 3) Bawah — tetap, ruang nyata di layout (bukan fixed) */}
      <div className="flex shrink-0 flex-col gap-3 border-t border-[#E7E8F0] px-3 pt-3 dark:border-white/10" data-sidebar-bagian="bawah">
        {alatBawah && <div className="flex items-center gap-2 [&>*:first-child]:min-w-0 [&>*:first-child]:flex-1" data-alat-bawah>{alatBawah(false)}</div>}
        {profil && <div className="flex flex-col gap-1 border-t border-[#E7E8F0] pt-3 dark:border-white/10" data-profil-bawah>{profil(false)}</div>}
        <div className="flex gap-2" role="group" aria-label="Jam">{jamKantor(ctx?.user, ctx?.branchFilter).map((j) => <Jam key={j.label} zona={j.tz} label={j.label.toUpperCase()} />)}</div>
        <button type="button" onClick={tukar} title="Sembunyikan menu" aria-label="Sembunyikan menu" aria-expanded="true" data-aksi="sembunyikan-menu"
          className="flex min-h-[36px] w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[12.5px] font-semibold text-[#5E6380] hover:bg-[#F3F4F9] hover:text-[#141B34] dark:hover:bg-white/10"><PanelLeftClose className="h-[18px] w-[18px]" />Sembunyikan menu</button>
        {bawah}
      </div>
    </aside>
  )
}
