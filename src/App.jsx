import { useEffect, useState } from 'react'
import { LayoutDashboard, FolderKanban, Settings as Cog, LogOut, Loader2, History, MonitorCheck, Wallet } from 'lucide-react'
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
import Settings from './pages/Settings.jsx'
import Portal from './pages/Portal.jsx'
import Activity, { canSeeAllActivity } from './pages/Activity.jsx'
import Monitoring, { canMonitor } from './pages/Monitoring.jsx'
import Keuangan, { canSeeKeuangan } from './pages/Keuangan.jsx'
import NotificationBell from './components/NotificationBell.jsx'

// Router sederhana berbasis hash: #/dashboard, #/projects, #/projects/<id>, #/settings
function useRoute() {
  const get = () => (window.location.hash.replace(/^#\/?/, '') || 'dashboard').split('/')
  const [r, setR] = useState(get)
  useEffect(() => { const f = () => { setR(get()); window.scrollTo(0, 0) }; window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f) }, [])
  return r
}

const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'projects', label: 'My Project', icon: FolderKanban },
  { key: 'keuangan', label: 'Keuangan', icon: Wallet, show: canSeeKeuangan },
  { key: 'monitoring', label: 'Monitoring', icon: MonitorCheck, show: canMonitor },
  { key: 'aktivitas', label: 'Aktivitas', icon: History, show: canSeeAllActivity },
  { key: 'settings', label: 'Setting', icon: Cog },
]

export default function App() {
  const { user, setActiveRole, booting, signOut, toast, notify, branchFilter, setBranchFilter, confirmState, setConfirmState } = useApp()
  const [page, param] = useRoute()
  const [storeErr, setStoreErr] = useState(storageError)
  useEffect(() => { const f = (e) => setStoreErr(e.detail); window.addEventListener('atlas-storage', f); return () => window.removeEventListener('atlas-storage', f) }, [])

  if (page === 'p' && param) return <><Portal token={param} /><Toast toast={toast} /></> // portal pelanggan/vendor — tanpa login
  if (booting) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-brand" /></div>
  if (!user) return <><Login /><Toast toast={toast} /></>

  const view = page === 'projects' && param ? <ProjectDetail id={param} />
    : page === 'projects' ? <Projects />
    : page === 'settings' ? <Settings />
    : page === 'aktivitas' ? <Activity />
    : page === 'monitoring' ? <Monitoring />
    : page === 'keuangan' ? <Keuangan />
    : <Dashboard />

  return (
    <div className="min-h-screen md:flex">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-gradient-to-b from-[#0e1540] via-[#1b1f66] to-[#2a1a6e] px-4 py-6 text-white md:flex">
        <Brand />
        <nav className="mt-8 space-y-1">
          {NAV.filter((n) => !n.show || n.show(user)).map((n) => (
            <a key={n.key} href={`#/${n.key}`}
              className={cx('group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition',
                page === n.key ? 'bg-gradient-to-r from-brand to-[#6d5cf6] text-white shadow-glow' : 'text-white/60 hover:bg-white/10 hover:text-white')}>
              <span className={cx('grid h-7 w-7 place-items-center rounded-lg transition', page === n.key ? 'bg-white/15' : 'bg-white/5 group-hover:bg-white/10')}><n.icon className="h-4 w-4" /></span>{n.label}
            </a>
          ))}
        </nav>
        <div className="mt-auto rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
          <div className="flex items-center gap-2.5">
            <Avatar user={user} size={36} ring={false} className="ring-1 ring-white/20" />
            <div className="min-w-0"><p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-white/50">{roleLabel(user)} · {isFreelance(user) ? 'Freelance' : isMultiBranch(user) ? `${branchesOf(user).length} cabang` : user.branch}</p></div>
          </div>
          <button onClick={signOut} className="mt-3 flex items-center gap-2 text-xs font-semibold text-white/60 hover:text-white"><LogOut className="h-3.5 w-3.5" />Keluar</button>
        </div>
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
            <NotificationBell />
            {MODE === 'demo' && <span className="hidden rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 sm:inline">Demo</span>}
            {can.seeAllBranches(user) || isMultiBranch(user) ? (
              <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}
                className="max-w-[118px] truncate rounded-lg border-0 bg-white py-1.5 pl-2 pr-6 text-xs font-semibold ring-1 ring-slate-200 focus:ring-2 focus:ring-brand sm:max-w-none sm:pl-2.5 sm:pr-7" title="Filter cabang">
                {['Semua', ...(can.seeAllBranches(user) ? BRANCHES : branchesOf(user))].map((b) => <option key={b} value={b}>{b === 'Semua' ? (can.seeAllBranches(user) ? 'Semua Cabang' : 'Semua cabang saya') : b}</option>)}
              </select>
            ) : <span className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold ring-1 ring-slate-200">{placeOf(user)}</span>}
            <button onClick={signOut} className="hidden rounded-lg p-1.5 text-ink-mute hover:bg-white min-[400px]:block md:hidden" aria-label="Keluar"><LogOut className="h-4 w-4" /></button>
          </div>
        </header>
        {storeErr && <div role="alert" className="flex flex-wrap items-center gap-2 bg-rose-600 px-4 py-2 text-xs font-semibold text-white md:px-8"><AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">{storeErr === 'quota' ? 'Penyimpanan browser penuh — perubahan terakhir TIDAK tersimpan.' : 'Penyimpanan browser diblokir — perubahan tidak tersimpan. Periksa pengaturan privasi browser (mode privat / cookie diblokir).'}</span>
          {storeErr === 'quota' && <button type="button" onClick={async () => { const f = await db.cleanup?.(); notify(f ? `Dibersihkan ${Math.round(f / 1024)} KB — coba simpan lagi` : 'Tidak ada sisa data lama; gunakan Reset data demo di Setting → Integrasi') }} className="rounded-lg bg-white/15 px-2.5 py-1 ring-1 ring-white/40 hover:bg-white/25">Bersihkan penyimpanan</button>}
          <a href="#/settings" className="rounded-lg bg-white/15 px-2.5 py-1 ring-1 ring-white/40 hover:bg-white/25">Setting</a>
        </div>}

        <main className="mx-auto w-full max-w-6xl px-3 pb-28 pt-4 sm:px-4 md:px-6 md:pb-12 md:pt-5 xl:max-w-7xl xl:px-8 2xl:max-w-[1600px]">{view}</main>
      </div>

      {/* Bottom nav mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid auto-cols-fr grid-flow-col border-t border-white/70 bg-white/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
        {NAV.filter((n) => !n.show || n.show(user)).map((n) => (
          <a key={n.key} href={`#/${n.key}`} className={cx('flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold', page === n.key ? 'text-brand' : 'text-ink-mute')}>
            <span className={cx('grid h-7 w-11 place-items-center rounded-full transition', page === n.key && 'bg-brand-soft')}><n.icon className="h-5 w-5" /></span>{n.label}
          </a>
        ))}
      </nav>
      <Toast toast={toast} />
      <Sheet open={!!confirmState} title="Konfirmasi" onClose={() => { confirmState?.resolve(false); setConfirmState(null) }}
        footer={<><Button variant="outline" className="flex-1" onClick={() => { confirmState.resolve(false); setConfirmState(null) }}>Batal</Button>
          <Button variant="dark" className="flex-1" onClick={() => { confirmState.resolve(true); setConfirmState(null) }}>Ya, lanjutkan</Button></>}>
        <p className="text-sm text-ink-soft">{confirmState?.msg}</p>
      </Sheet>
    </div>
  )
}

function Brand({ dark, compact }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={cx('grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand via-accent to-pop text-sm font-black text-white shadow-glow')}>A</div>
      <div className="leading-tight">
        <p className={cx('whitespace-nowrap font-display text-sm font-extrabold tracking-wide', dark ? 'text-ink' : 'text-white')}>ATLAS <span className={dark ? 'text-gradient' : 'text-accent'}>Alfa</span></p>
        {!compact && <p className={cx('whitespace-nowrap text-[10px]', dark ? 'text-ink-mute' : 'text-white/50')}>Manajemen Project</p>}
      </div>
    </div>
  )
}
