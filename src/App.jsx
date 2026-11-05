import { lazy, Suspense, useEffect, useState } from 'react'
import { LayoutDashboard, FolderKanban, Settings as Cog, LogOut, Loader2, History, MonitorCheck, Wallet, PanelLeftClose, PanelLeftOpen, Rows3, Rows2, Stamp, ReceiptText, StickyNote, AlarmClock, FilePlus2, MoreHorizontal, CalendarDays, ChevronDown } from 'lucide-react'
import { useApp } from './lib/store.jsx'
import Avatar from './components/Avatar.jsx'
import { MODE, storageError, db } from './lib/db.js'
import { AlertTriangle } from 'lucide-react'
import { BRANCHES, ROLES, can, branchesOf, isMultiBranch, roleLabel, rolesOf, isFreelance, placeOf } from './config/access.js'
import { Toast, Sheet, Button, cx } from './components/ui.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Projects from './pages/Projects.jsx'
import ProjectDetail from './pages/ProjectDetail.jsx'
import { canSeeAllActivity, canMonitor, canSeeKeuangan, canSeeApostille, canSeeInvoices } from './config/menuAccess.js'
import { needsAction } from './lib/badges.js'
import { ReminderWatcher } from './pages/Reminders.jsx'
// Halaman yang tidak dibuka tiap hari dimuat saat diklik → halaman pertama jauh lebih ringan
const Settings = lazy(() => import('./pages/Settings.jsx'))
const Portal = lazy(() => import('./pages/Portal.jsx'))
const Activity = lazy(() => import('./pages/Activity.jsx'))
const Monitoring = lazy(() => import('./pages/Monitoring.jsx'))
const Keuangan = lazy(() => import('./pages/Keuangan.jsx'))
const Apostille = lazy(() => import('./pages/Apostille.jsx'))
const Invoices = lazy(() => import('./pages/Invoices.jsx'))
const Notes = lazy(() => import('./pages/Notes.jsx'))
const MyReminders = lazy(() => import('./pages/MyReminders.jsx'))
const PengajuanPage = lazy(() => import('./pages/Pengajuan.jsx'))
const Calendar = lazy(() => import('./pages/Calendar.jsx'))
import GlobalSearch from './components/GlobalSearch.jsx'
import Chat from './components/Chat.jsx'
import NotificationBell from './components/NotificationBell.jsx'
import ThemePicker, { readTheme, applyTheme } from './components/ThemePicker.jsx'
import TeamPresence from './components/TeamPresence.jsx'
import HeaderUser from './components/HeaderUser.jsx'
import QuickActions from './components/QuickActions.jsx'
import { PanelProvider } from './components/WorkspacePanel.jsx'
import SessionGuard from './components/SessionGuard.jsx'

// Router sederhana berbasis hash: #/dashboard, #/projects, #/projects/<id>, #/settings
function useRoute() {
  const get = () => (window.location.hash.replace(/^#\/?/, '') || 'dashboard').split('/')
  const [r, setR] = useState(get)
  useEffect(() => { const f = () => { setR(get()); window.scrollTo(0, 0) }; window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f) }, [])
  return r
}

// Menu dikelompokkan: Workspace (pekerjaan bersama) · Personal (milik sendiri) · Manajemen · Pengaturan
const NAV = [
  { group: 'Workspace' },
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, bar: true },
  { key: 'faktur', label: 'Faktur', icon: ReceiptText, show: canSeeInvoices, badge: (u, d, bf, extra) => extra.unlinkedInvoices },
  { key: 'projects', label: 'My Project', icon: FolderKanban, bar: true },
  { key: 'apostille', label: 'My Apostille', icon: Stamp, show: canSeeApostille },
  { key: 'calendar', label: 'Calendar', icon: CalendarDays },
  { group: 'Personal' },
  { key: 'reminders', label: 'My Reminders', icon: AlarmClock, bar: true },
  { key: 'notes', label: 'Notes', icon: StickyNote, bar: true },
  { key: 'pengajuan', label: 'Pengajuan', icon: FilePlus2, badge: needsAction },
  { group: 'Manajemen' },
  { key: 'keuangan', label: 'Keuangan', icon: Wallet, show: canSeeKeuangan },
  { key: 'monitoring', label: 'Monitoring', icon: MonitorCheck, show: canMonitor },
  { key: 'aktivitas', label: 'Aktivitas', icon: History, show: canSeeAllActivity },
  { group: '' },
  { key: 'settings', label: 'Setting', icon: Cog },
]
const navItems = (user) => NAV.filter((n) => n.key && (!n.show || n.show(user)))
/** Nama kelompok untuk item NAV ke-i. */
const groupOf = (i) => { for (let k = i; k >= 0; k--) if (NAV[k].group !== undefined) return NAV[k].group; return '' }

/** Sidebar ramping (ikon saja) — pilihan disimpan per browser. */
const useSidebar = () => {
  const [mini, setMini] = useState(() => { try { return localStorage.getItem('atlas-sidebar') === 'mini' } catch { return false } })
  return [mini, () => setMini((v) => { const n = !v; try { localStorage.setItem('atlas-sidebar', n ? 'mini' : 'full') } catch { /* abaikan */ } return n })]
}
/** Kepadatan tampilan: comfortable (default) / compact. */
export const useDensity = () => {
  const [d, setD] = useState(() => { try { return localStorage.getItem('atlas-density') || 'comfortable' } catch { return 'comfortable' } })
  useEffect(() => { document.documentElement.dataset.density = d; try { localStorage.setItem('atlas-density', d) } catch { /* abaikan */ } }, [d])
  return [d, setD]
}

export default function App() {
  const { user, data, setActiveRole, booting, signOut, toast, dismissToast, notify, branchFilter, setBranchFilter, confirmState, setConfirmState, unlinkedInvoices } = useApp()
  const [page, param] = useRoute()
  const [mini, toggleMini] = useSidebar()
  useEffect(() => { applyTheme(readTheme()) }, []) // tema tersimpan diterapkan saat aplikasi dibuka
  const [density, setDensity] = useDensity()
  const [more, setMore] = useState(false)
  // kelompok sidebar yang sedang diciutkan (disimpan per browser)
  const [shut, setShut] = useState(() => { try { return JSON.parse(localStorage.getItem('atlas-nav-shut') || '[]') } catch { return [] } })
  const toggleGroup = (g) => setShut((v) => { const n = v.includes(g) ? v.filter((x) => x !== g) : [...v, g]; try { localStorage.setItem('atlas-nav-shut', JSON.stringify(n)) } catch { /* abaikan */ } return n })
  const [storeErr, setStoreErr] = useState(storageError)
  useEffect(() => { const f = (e) => setStoreErr(e.detail); window.addEventListener('atlas-storage', f); return () => window.removeEventListener('atlas-storage', f) }, [])

  if (page === 'p' && param) return <><Suspense fallback={null}><Portal token={param} /></Suspense><Toast toast={toast} onClose={dismissToast} /></> // portal pelanggan/vendor — tanpa login
  if (booting) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-brand" /></div>
  if (!user) return <><Login /><Toast toast={toast} onClose={dismissToast} /></>

  const view = page === 'projects' && param ? <ProjectDetail id={param} />
    : page === 'projects' ? <Projects />
    : page === 'settings' ? <Settings />
    : page === 'aktivitas' ? <Activity />
    : page === 'monitoring' ? <Monitoring />
    : page === 'keuangan' ? <Keuangan />
    : page === 'apostille' ? <Apostille />
    : page === 'faktur' ? <Invoices />
    : page === 'notes' ? <Notes />
    : page === 'reminders' || page === 'todo' ? <MyReminders />
    : page === 'pengajuan' ? <PengajuanPage />
    : page === 'calendar' ? <Calendar />
    : <Dashboard />

  return (
    <PanelProvider>
    <div className="min-h-screen md:flex">
      {/* Sidebar desktop */}
      <aside style={{ background: 'var(--nav)', color: 'var(--nav-ink)', borderRight: '1px solid var(--nav-line)' }}
        className={cx('sticky top-0 hidden h-screen shrink-0 flex-col py-5 transition-[width] duration-200 md:flex', mini ? 'w-[68px] px-2.5' : 'w-56 px-3.5')}>
        <div className={cx('flex items-center', mini ? 'justify-center' : 'gap-2')}>
          {!mini && <Brand />}
          <button onClick={toggleMini} aria-label={mini ? 'Lebarkan menu' : 'Ciutkan menu jadi ikon'} title={mini ? 'Lebarkan menu' : 'Ciutkan menu jadi ikon'} aria-expanded={!mini}
            className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--nav-mute)] transition hover:bg-[var(--nav-hover)] hover:text-[var(--nav-ink)]">
            {mini ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
        <nav className="mt-5 space-y-0.5 overflow-y-auto">
          {NAV.map((n, i) => {
            if (n.group !== undefined) {
              // judul kelompok bisa diciutkan (panah) supaya menu tetap fokus
              const next = NAV.slice(i + 1).find((x) => x.key)
              if (!next || (next.show && !next.show(user))) return null
              if (mini || !n.group) return <div key={`g${i}`} className="mx-2 my-2 border-t" style={{ borderColor: 'var(--nav-line)' }} />
              const on = !shut.includes(n.group)
              return (
                <button key={`g${i}`} type="button" onClick={() => toggleGroup(n.group)} aria-expanded={on}
                  className="mt-3 flex w-full items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--nav-mute)] transition hover:text-[var(--nav-ink)]">
                  <ChevronDown className={cx('h-3 w-3 transition-transform', !on && '-rotate-90')} />{n.group}
                </button>
              )
            }
            if (n.show && !n.show(user)) return null
            if (!mini && shut.includes(groupOf(i))) return null
            const b = n.badge ? n.badge(user, data, branchFilter, { unlinkedInvoices }) : 0
            return (
              <a key={n.key} href={`#/${n.key}`} title={n.label} aria-label={n.label} aria-current={page === n.key ? 'page' : undefined}
                className={cx('group flex items-center rounded-xl text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
                  mini ? 'justify-center p-2' : 'gap-3 px-2.5 py-2',
                  page === n.key ? 'bg-brand-soft text-brand' : 'text-[var(--nav-mute)] hover:bg-[var(--nav-hover)] hover:text-[var(--nav-ink)]')}>
                <span className={cx('relative grid h-7 w-7 shrink-0 place-items-center rounded-lg transition', page === n.key ? 'bg-white/70 text-brand shadow-sm' : '')}>
                  <n.icon className="h-4 w-4" />
                  {b > 0 && mini && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-rose-500" />}
                </span>
                {!mini && <span className="min-w-0 flex-1 truncate">{n.label}</span>}
                {!mini && b > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{b}</span>}
              </a>
            )
          })}
        </nav>
        {/* Profil utama ada di pojok kanan atas — di sini cukup pintasan kecil */}
        <a href="#/settings" title="Profil & akun" aria-label="Profil & akun"
          className={cx('mt-auto flex items-center rounded-xl p-2 text-[11px] font-semibold text-[var(--nav-mute)] transition hover:bg-[var(--nav-hover)] hover:text-[var(--nav-ink)]', mini ? 'justify-center' : 'gap-2')}>
          <Avatar user={user} size={mini ? 26 : 24} ring={false} className="ring-1 ring-[var(--nav-line)]" />
          {!mini && <span className="truncate">Profil &amp; akun</span>}
        </a>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/60 bg-white/70 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-[0_1px_0_rgba(79,70,229,0.06)] backdrop-blur-md md:px-8">
          <div className="md:hidden"><Brand dark compact /></div>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {rolesOf(user).length > 1 && (
              <select value={user.role} onChange={(e) => { setActiveRole(e.target.value); window.location.hash = '/dashboard' }} aria-label="Ganti peran"
                className="rounded-lg border-0 bg-violet-50 py-1.5 pl-2.5 pr-7 text-xs font-bold text-violet-800 ring-1 ring-violet-200 focus:ring-2 focus:ring-brand">
                {rolesOf(user).map((r) => <option key={r} value={r}>Peran: {roleLabel(user, r)}</option>)}
              </select>
            )}
            <button onClick={() => setDensity(density === 'compact' ? 'comfortable' : 'compact')} aria-pressed={density === 'compact'}
              title={density === 'compact' ? 'Kepadatan: Compact — klik untuk Comfortable' : 'Kepadatan: Comfortable — klik untuk Compact'} aria-label="Ganti kepadatan tampilan"
              className="hidden rounded-lg p-1.5 text-ink-mute ring-1 ring-slate-200 hover:bg-white hover:text-brand sm:block">
              {density === 'compact' ? <Rows3 className="h-4 w-4" /> : <Rows2 className="h-4 w-4" />}
            </button>
            {/* di layar kecil header hanya: + Buat, lonceng, profil — sisanya lewat menu & Setting */}
            <span className="hidden sm:block"><GlobalSearch /></span>
            <QuickActions />
            <span className="mx-0.5 hidden h-5 w-px bg-slate-200 md:block" />
            <Chat />
            <span className="hidden sm:block"><TeamPresence /></span>
            <span className="hidden sm:block"><ThemePicker /></span>
            <NotificationBell />
            {MODE === 'demo' && <span className="hidden rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 sm:inline">Demo</span>}
            {can.seeAllBranches(user) || isMultiBranch(user) ? (
              <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}
                className="max-w-[118px] truncate rounded-lg border-0 bg-white py-1.5 pl-2 pr-6 text-xs font-semibold ring-1 ring-slate-200 focus:ring-2 focus:ring-brand sm:max-w-none sm:pl-2.5 sm:pr-7" title="Filter cabang">
                {['Semua', ...(can.seeAllBranches(user) ? BRANCHES : branchesOf(user))].map((b) => <option key={b} value={b}>{b === 'Semua' ? (can.seeAllBranches(user) ? 'Semua Cabang' : 'Semua cabang saya') : b}</option>)}
              </select>
            ) : <span className="hidden rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold ring-1 ring-slate-200 sm:inline">{placeOf(user)}</span>}
            <span className="mx-0.5 h-5 w-px bg-slate-200" />
            <HeaderUser />
          </div>
        </header>
        {storeErr && <div role="alert" className="flex flex-wrap items-center gap-2 bg-rose-600 px-4 py-2 text-xs font-semibold text-white md:px-8"><AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">{storeErr === 'quota' ? 'Penyimpanan browser penuh — perubahan terakhir TIDAK tersimpan.' : 'Penyimpanan browser diblokir — perubahan tidak tersimpan. Periksa pengaturan privasi browser (mode privat / cookie diblokir).'}</span>
          {storeErr === 'quota' && <button type="button" onClick={async () => { const f = await db.cleanup?.(); notify(f ? `Dibersihkan ${Math.round(f / 1024)} KB — coba simpan lagi` : 'Tidak ada sisa data lama; gunakan Reset data demo di Setting → Integrasi') }} className="rounded-lg bg-white/15 px-2.5 py-1 ring-1 ring-white/40 hover:bg-white/25">Bersihkan penyimpanan</button>}
          <a href="#/settings" className="rounded-lg bg-white/15 px-2.5 py-1 ring-1 ring-white/40 hover:bg-white/25">Setting</a>
        </div>}

        <main className="mx-auto w-full max-w-5xl px-3 pb-28 pt-4 sm:px-4 md:px-6 md:pb-12 md:pt-5 xl:max-w-[1180px] xl:px-8 2xl:max-w-[1320px]">
          <Suspense fallback={<div className="grid place-items-center py-24"><Loader2 className="h-5 w-5 animate-spin text-brand" /></div>}>{view}</Suspense>
        </main>
      </div>

      {/* Bottom nav mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/70 bg-white/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
        {navItems(user).filter((n) => n.bar).slice(0, 4).map((n) => (
          <a key={n.key} href={`#/${n.key}`} className={cx('flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold', page === n.key ? 'text-brand' : 'text-ink-mute')}>
            <span className={cx('grid h-7 w-11 place-items-center rounded-full transition', page === n.key && 'bg-brand-soft')}><n.icon className="h-5 w-5" /></span>
            <span className="max-w-full truncate px-0.5">{n.label}</span>
          </a>
        ))}
        <button type="button" onClick={() => setMore(true)} className={cx('flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold', more ? 'text-brand' : 'text-ink-mute')}>
          <span className="grid h-7 w-11 place-items-center rounded-full"><MoreHorizontal className="h-5 w-5" /></span>Menu
        </button>
      </nav>
      <Sheet open={more} onClose={() => setMore(false)} title="Menu">
        <ul className="grid grid-cols-2 gap-2">
          {navItems(user).map((n) => {
            const b = n.badge ? n.badge(user, data, branchFilter, { unlinkedInvoices }) : 0
            return (
              <li key={n.key}>
                <a href={`#/${n.key}`} onClick={() => setMore(false)}
                  className={cx('flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-semibold ring-1 transition', page === n.key ? 'bg-brand-soft text-brand ring-brand/30' : 'bg-white text-ink ring-slate-200')}>
                  <n.icon className="h-4 w-4 text-ink-mute" /><span className="min-w-0 flex-1 truncate">{n.label}</span>
                  {b > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{b}</span>}
                </a>
              </li>
            )
          })}
        </ul>
      </Sheet>
      <Toast toast={toast} onClose={dismissToast} />
      <SessionGuard />
      <ReminderWatcher />
      <Sheet open={!!confirmState} title="Konfirmasi" onClose={() => { confirmState?.resolve(false); setConfirmState(null) }}
        footer={<><Button variant="outline" className="flex-1" onClick={() => { confirmState.resolve(false); setConfirmState(null) }}>Batal</Button>
          <Button variant="dark" className="flex-1" onClick={() => { confirmState.resolve(true); setConfirmState(null) }}>Ya, lanjutkan</Button></>}>
        <p className="text-sm text-ink-soft">{confirmState?.msg}</p>
      </Sheet>
    </div>
    </PanelProvider>
  )
}

function Brand({ dark, compact }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--brand)] text-sm font-black text-white">A</div>
      <div className="leading-tight">
        <p className="whitespace-nowrap font-display text-sm font-extrabold tracking-wide text-[var(--nav-ink)]">ATLAS <span className="text-[var(--nav-mute)]">Alfa</span></p>
        {!compact && <p className="whitespace-nowrap text-[10px] text-[var(--nav-mute)]">Manajemen Project</p>}
      </div>
    </div>
  )
}
