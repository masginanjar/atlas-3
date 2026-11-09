import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LayoutGrid, Plus, Search, X, Maximize2, Minimize2 } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { go } from '../lib/router.js'
import { cx, Sheet } from './ui.jsx'
import { usePanel, PANELS, PANEL_ORDER } from './WorkspacePanel.jsx'

// ============================================================
//  REL MENU (K2 · K3 · K7)
//  Menu samping 224 px diganti rel ikon 64 px: 5 tujuan utama + "Lainnya".
//  Semua halaman lain tetap bisa dibuka dari Lainnya (dengan pencarian),
//  dengan hak akses yang persis sama — yang tidak boleh tetap tidak tampil.
//  Rel ikon kanan dan tanda + di submenu dihapus: membuat sesuatu yang baru
//  hanya lewat tombol + (desktop) / tab Buat (HP).
// ============================================================

/** Halaman utama di rel, urut. Yang tidak boleh dibuka role ini otomatis dilewati. */
export const RAIL_KEYS = ['beranda', 'dashboard', 'projects', 'faktur', 'penugasan', 'keuangan', 'agenda', 'notes']
const RAIL_LABEL = { dashboard: 'Dasbor', projects: 'Project', faktur: 'Faktur', keuangan: 'Keuangan', agenda: 'Agenda', settings: 'Pengaturan' }

const badgeOf = (n, ctx) => (n.badge ? n.badge(ctx.user, ctx.data, ctx.branchFilter, ctx.extra) : 0)

/** Item rel: ikon + label kecil, tinggi 52 px, lebar penuh rel. */
/** Layar penuh (F11) — di rel kiri, di atas Pengaturan. */
function RelLayarPenuh() {
  const [full, setFull] = useState(() => !!document.fullscreenElement)
  useEffect(() => { const f = () => setFull(!!document.fullscreenElement); document.addEventListener('fullscreenchange', f); return () => document.removeEventListener('fullscreenchange', f) }, [])
  const ganti = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen() } catch { /* ditolak browser */ } }
  return <RelItem icon={full ? Minimize2 : Maximize2} label={full ? 'Keluar' : 'Penuh'} title={full ? 'Keluar layar penuh' : 'Layar penuh'} onClick={ganti} aktif={full} dataNav="layar-penuh" />
}

function RelItem({ icon: Icon, label, aktif, badge, onClick, href, title, dataNav = 'rel' }) {
  const inner = (
    <>
      <span className="relative grid h-6 w-6 place-items-center">
        <Icon className="h-5 w-5" />
        {badge > 0 && <span className="absolute -right-2 -top-1.5 min-w-[16px] rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold leading-4 text-white">{badge > 99 ? '99+' : badge}</span>}
      </span>
      <span className="max-w-full truncate text-[9px] font-semibold leading-tight tracking-tighter">{label}</span>
    </>
  )
  const cls = cx('flex h-[52px] w-full flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
    aktif ? 'bg-brand-soft text-brand' : 'text-[var(--nav-ink)] hover:bg-[var(--nav-hover)]')
  return href
    ? <a href={href} title={title || label} aria-current={aktif ? 'page' : undefined} data-nav={dataNav} data-key={href.replace(/^#\//, '')} className={cls}>{inner}</a>
    : <button type="button" onClick={onClick} title={title || label} aria-pressed={aktif} data-nav={dataNav} className={cls}>{inner}</button>
}

/**
 * Rel ikon desktop (≥768 px). `menu` = hasil menuTerlihat(user) dari App.jsx
 * (induk + anak yang boleh), `flat` = daftar ratanya.
 */
export function RelIkon({ menu, flat, page, ctx }) {
  const [lainnya, setLainnya] = useState(false)
  const utama = RAIL_KEYS.map((k) => flat.find((n) => n.key === k)).filter(Boolean)
  const sisa = flat.filter((n) => !RAIL_KEYS.includes(n.key) && n.key !== 'settings')
  const setting = flat.find((n) => n.key === 'settings')
  const diLainnya = sisa.some((n) => n.key === page)
  const badgeSisa = sisa.reduce((t, n) => t + badgeOf(n, ctx), 0)
  useEffect(() => { setLainnya(false) }, [page])
  return (
    <aside style={{ background: 'var(--nav)', color: 'var(--nav-ink)', borderRight: '1px solid var(--nav-line)' }}
      className="sticky top-[var(--appbar)] hidden h-[calc(100dvh-var(--appbar))] w-16 shrink-0 flex-col items-stretch gap-0.5 px-1.5 py-2 md:flex" data-rel-ikon>
      <nav className="flex flex-col gap-0.5" aria-label="Menu utama">
        {utama.map((n) => <RelItem key={n.key} icon={n.icon} label={RAIL_LABEL[n.key] || n.label} href={`#/${n.key}`} aktif={page === n.key} badge={badgeOf(n, ctx)} />)}
        {sisa.length > 0 && <RelItem icon={LayoutGrid} label="Lainnya" onClick={() => setLainnya((v) => !v)} aktif={lainnya || diLainnya} badge={badgeSisa} title="Menu lainnya" dataNav="lainnya" />}
      </nav>
      <div className="mt-auto flex flex-col items-center gap-1">
        <RelLayarPenuh />
        {setting && <RelItem icon={setting.icon} label="Pengaturan" href="#/settings" aktif={page === 'settings'} />}
      </div>
      {lainnya && <PanelLainnya menu={menu} page={page} ctx={ctx} onClose={() => setLainnya(false)} />}
    </aside>
  )
}

/** Panel "Lainnya": daftar menu yang tidak ada di rel, dikelompokkan, dengan pencarian. */
function PanelLainnya({ menu, page, ctx, onClose }) {
  const [q, setQ] = useState('')
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus() }, [])
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [onClose])
  const grup = useMemo(() => {
    const cocok = (n) => !q.trim() || n.label.toLowerCase().includes(q.trim().toLowerCase())
    const out = []
    const tunggal = []
    for (const n of menu) {
      if (n.children) {
        const anak = n.children.filter((c) => !RAIL_KEYS.includes(c.key) && cocok(c))
        if (anak.length) out.push({ id: n.id, label: n.label, items: anak })
      } else if (!RAIL_KEYS.includes(n.key) && n.key !== 'settings' && cocok(n)) tunggal.push(n)
    }
    if (tunggal.length) out.push({ id: 'lain', label: 'Lainnya', items: tunggal })
    return out
  }, [menu, q])
  const semua = grup.flatMap((g) => g.items)
  const enter = (e) => { if (e.key === 'Enter' && semua.length === 1) { onClose(); go(semua[0].key) } }
  return createPortal(
    <>
      <div className="fixed inset-0 z-[88] hidden md:block" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-label="Menu lainnya" data-panel-lainnya
        className="fixed left-16 top-[var(--appbar)] z-[89] hidden h-[calc(100dvh-var(--appbar))] w-[300px] flex-col border-r border-slate-200 bg-white shadow-[12px_0_40px_-20px_rgba(14,21,64,.35)] md:flex">
        <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-ink-mute" />
          <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={enter} placeholder="Cari menu…" aria-label="Cari menu"
            className="h-9 min-w-0 flex-1 border-0 bg-transparent text-sm focus:outline-none focus:ring-0" data-cari-menu />
          <button type="button" onClick={onClose} aria-label="Tutup" className="grid h-8 w-8 place-items-center rounded-lg text-ink-mute hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {grup.length === 0 && <p className="px-2 py-6 text-center text-sm text-ink-mute">Tidak ada menu yang cocok.</p>}
          {grup.map((g) => (
            <section key={g.id} className="mb-2">
              <p className="px-2 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-mute">{g.label}</p>
              <ul className="space-y-0.5">
                {g.items.map((n) => {
                  const b = badgeOf(n, ctx)
                  return (
                    <li key={n.key}>
                      <a href={`#/${n.key}`} onClick={onClose} data-nav="lainnya-item" data-key={n.key} aria-current={page === n.key ? 'page' : undefined}
                        className={cx('flex h-10 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-semibold transition',
                          page === n.key ? 'bg-brand-soft text-brand' : 'text-ink hover:bg-slate-50')}>
                        <n.icon className="h-4 w-4 shrink-0 text-ink-mute" />
                        <span className="min-w-0 flex-1 truncate">{n.label}</span>
                        {b > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{b}</span>}
                      </a>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </>, document.body)
}

/**
 * Tab bawah HP: Dasbor · Project · Buat · Pengingat · Menu.
 * "Buat" membuka lembar pilihan yang isinya sama dengan tombol + di desktop.
 */
export function TabBawah({ flat, page, ctx, onMenu, menuOpen }) {
  const { user } = useApp()
  const { open } = usePanel()
  const [buat, setBuat] = useState(false)
  const kiri = ['dashboard', 'projects'].map((k) => flat.find((n) => n.key === k)).filter(Boolean)
  const kanan = ['agenda'].map((k) => flat.find((n) => n.key === k)).filter(Boolean)
  const items = PANEL_ORDER.map((k) => [k, PANELS[k]]).filter(([, p]) => p.allow(user))
  const Tab = ({ n }) => (
    <a href={`#/${n.key}`} data-tab={n.key} className={cx('flex min-h-[56px] flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold', page === n.key ? 'text-brand' : 'text-ink-mute')}>
      <span className={cx('relative grid h-7 w-11 place-items-center rounded-full transition', page === n.key && 'bg-brand-soft')}>
        <n.icon className="h-5 w-5" />
        {badgeOf(n, ctx) > 0 && <span className="absolute right-0.5 top-0 h-2 w-2 rounded-full bg-rose-500" />}
      </span>
      <span className="max-w-full truncate px-0.5">{RAIL_LABEL[n.key] || n.label}</span>
    </a>
  )
  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t border-white/70 bg-white/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden" data-tab-bawah>
        {kiri.map((n) => <Tab key={n.key} n={n} />)}
        {items.length > 0 ? (
          <button type="button" onClick={() => setBuat(true)} data-tab="buat" aria-label="Buat baru"
            className="flex min-h-[56px] flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold text-ink-mute">
            <span className="grid h-8 w-11 place-items-center rounded-full bg-brand text-white shadow-md shadow-brand/30"><Plus className="h-5 w-5" /></span>Buat
          </button>
        ) : <span />}
        {kanan.map((n) => <Tab key={n.key} n={n} />)}
        <button type="button" onClick={onMenu} data-tab="menu" className={cx('flex min-h-[56px] flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold', menuOpen ? 'text-brand' : 'text-ink-mute')}>
          <span className="grid h-7 w-11 place-items-center rounded-full"><LayoutGrid className="h-5 w-5" /></span>Menu
        </button>
      </nav>
      <Sheet open={buat} onClose={() => setBuat(false)} title="Buat baru">
        <ul className="space-y-1" data-sheet-buat>
          {items.map(([k, p]) => (
            <li key={k}>
              <button type="button" onClick={() => { setBuat(false); if (k === 'project') go('projects/new'); else open(k) }}
                className="flex min-h-[48px] w-full items-center gap-3 rounded-xl bg-white px-3 text-left text-sm font-semibold text-ink ring-1 ring-slate-200 hover:ring-brand">
                <p.icon className="h-5 w-5 text-ink-mute" />{p.label}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  )
}
