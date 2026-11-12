import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { cx } from './ui.jsx'

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
    <div className="min-w-0 flex-1 rounded-xl px-2.5 py-2 ring-1 ring-[#E7E8F0] dark:ring-white/10">
      <span className="block text-[11px] font-bold tracking-wide text-[#5E6380]">{label}</span>
      <span className="block text-lg font-bold tabular-nums">{t}</span>
    </div>
  )
}

export default function SidebarMenu({ menu, page, param, ctx, bawah }) {
  const grupAktif = menu.find((g) => (g.children || [g]).some((n) => aktifItem(n, page, param)))
  const [buka, setBuka] = useState(grupAktif?.id || 'utama')
  useEffect(() => { if (grupAktif) setBuka(grupAktif.id) }, [grupAktif?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const btn = 'flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-left text-sm'
  return (
    <aside data-sidebar className="sticky top-[var(--appbar)] hidden h-[calc(100dvh-var(--appbar))] w-[240px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-[#E7E8F0] bg-white px-3 py-4 text-[#141B34] lg:flex dark:border-white/10 dark:bg-[#121729] dark:text-slate-100">
      <nav aria-label="Menu ATLAS" className="flex flex-col gap-1">
        {menu.map((g) => {
          const anak = g.children || [g]
          if (anak.length === 1 && !anak[0].segera) {
            const n = anak[0]; const on = aktifItem(n, page, param); const b = badgeOf(n, ctx)
            const Ikon = g.icon || n.icon
            return (
              <a key={g.id || n.key} href={hrefOf(n)} aria-current={on ? 'page' : undefined} data-nav="samping" data-key={n.key}
                className={cx(btn, 'font-semibold', on ? 'bg-[var(--brand)] text-white' : 'hover:bg-[#F3F4F9] dark:hover:bg-white/5')}>
                <Ikon className="h-5 w-5 shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{n.label}</span>
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
                <g.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{g.label}</span>
                {!terbuka && totalB > 0 && <span className="rounded-full bg-rose-600 px-1.5 text-[11px] font-bold text-white">{totalB > 99 ? '99+' : totalB}</span>}
                <ChevronRight className={cx('h-4 w-4 text-[#5E6380] transition-transform', terbuka && 'rotate-90')} aria-hidden="true" />
              </button>
              {terbuka && (
                <div className="flex flex-col gap-0.5 pl-8">
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
      <div className="mt-auto flex flex-col gap-3">
        <div className="flex gap-2" role="group" aria-label="Jam"><Jam zona="Asia/Makassar" label="WITA" /><Jam zona="Asia/Jakarta" label="WIB" /></div>
        {bawah}
      </div>
    </aside>
  )
}
