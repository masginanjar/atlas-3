import { lazy, Suspense, useEffect, useState } from 'react'
import { LayoutDashboard, FolderKanban, Settings as Cog, LogOut, Loader2, History, MonitorCheck, Wallet, Stamp, ReceiptText, StickyNote, AlarmClock, CalendarDays, Plus, Users, LayoutGrid, HardDrive, Tags, MessageCircle, BookOpen, FileStack, CalendarRange, Store, Handshake, Minimize2, Maximize2 } from 'lucide-react'
import { useApp } from './lib/store.jsx'
import { MODE, storageError, db } from './lib/db.js'
import { AlertTriangle } from 'lucide-react'
import { BRANCHES, ROLES, can, branchesOf, isMultiBranch, roleLabel, rolesOf, isFreelance, placeOf } from './config/access.js'
import { go } from './lib/router.js'
import { Toast, Sheet, Button, Popover, cx } from './components/ui.jsx'
import Login from './pages/Login.jsx'
import { simpanCache, DEFAULT_LOGIN } from './config/loginTheme.js'
import Dashboard from './pages/Dashboard.jsx'
import Projects from './pages/Projects.jsx'
import ProjectDetail from './pages/ProjectDetail.jsx'
import { canSeeAllActivity, canMonitor, canSeeKeuangan, canSeeApostille, canSeeInvoices, canSeeAffidavit, canSeePelanggan, canSeePenugasan, canSeeKatalog, canSeeVendor, canSeeMitra, menuBoleh } from './config/menuAccess.js'
import { needsAction } from './lib/badges.js'
import { ReminderWatcher } from './pages/Reminders.jsx'
// Halaman yang tidak dibuka tiap hari dimuat saat diklik → halaman pertama jauh lebih ringan
const Settings = lazy(() => import('./pages/Settings.jsx'))
const Portal = lazy(() => import('./pages/Portal.jsx'))
const PortalCek = lazy(() => import('./pages/PortalCek.jsx'))
const Activity = lazy(() => import('./pages/Activity.jsx'))
const Monitoring = lazy(() => import('./pages/Monitoring.jsx'))
const Keuangan = lazy(() => import('./pages/Keuangan.jsx'))
const Invoices = lazy(() => import('./pages/Invoices.jsx'))
const Agenda = lazy(() => import('./pages/Agenda.jsx'))
const PengajuanPage = lazy(() => import('./pages/Pengajuan.jsx'))
const Pesan = lazy(() => import('./pages/Pesan.jsx'))
const DaftarHarga = lazy(() => import('./pages/DaftarHarga.jsx'))
const Faq = lazy(() => import('./pages/Faq.jsx'))
const Affidavit = lazy(() => import('./pages/Affidavit.jsx'))
const Jadwal = lazy(() => import('./pages/Jadwal.jsx'))
const ProjectForm = lazy(() => import('./pages/ProjectForm.jsx'))
const Pelanggan = lazy(() => import('./pages/Pelanggan.jsx'))
const Dokumen = lazy(() => import('./pages/Dokumen.jsx'))
const MitraPage = lazy(() => import('./pages/Mitra.jsx'))
const Penugasan = lazy(() => import('./pages/Penugasan.jsx'))
import GlobalSearch from './components/GlobalSearch.jsx'
import { useFokus, toggleFokus } from './lib/fokus.js'
import NotificationBell from './components/NotificationBell.jsx'
import ThemePicker, { readTheme, applyTheme } from './components/ThemePicker.jsx'
import TeamPresence from './components/TeamPresence.jsx'
import HeaderUser from './components/HeaderUser.jsx'
import { PanelProvider } from './components/WorkspacePanel.jsx'
import SessionGuard from './components/SessionGuard.jsx'
import ChatDock from './components/ChatDock.jsx'
import { CHAT_ENABLED } from './lib/flags.js'

import JamZona from './components/JamZona.jsx'
import NotifToast from './components/NotifToast.jsx'
import VendorPage from './pages/Vendor.jsx'
import { usePanel, PANELS, PANEL_ORDER } from './components/WorkspacePanel.jsx'
import { RelIkon, TabBawah } from './components/RelMenu.jsx'
import { tabAgendaDari } from './pages/Agenda.jsx'
import { useDensity } from './lib/density.js'

// Router sederhana berbasis hash: #/dashboard, #/projects, #/projects/<id>, #/settings
function useRoute() {
  const get = () => (window.location.hash.replace(/^#\/?/, '') || 'dashboard').split('/')
  const [r, setR] = useState(get)
  useEffect(() => { const f = () => { setR(get()); window.scrollTo(0, 0) }; window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f) }, [])
  return r
}

// ============================================================
//  STRUKTUR MENU — dipakai rel ikon (RelMenu.jsx), panel "Lainnya",
//  tab bawah HP, dan Sheet Menu. Induk hanya untuk pengelompokan di
//  panel Lainnya; hak akses per item lewat show/menuBoleh.
// ============================================================
const MENU = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, bar: true },
  { id: 'penjualan', label: 'Penjualan', icon: ReceiptText, children: [
    { key: 'faktur', label: 'Faktur', icon: ReceiptText, show: canSeeInvoices, badge: (u, d, bf, extra) => extra.unlinkedInvoices },
    { key: 'daftar-harga', label: 'Katalog', icon: Tags, show: canSeeKatalog },
    { key: 'pelanggan', label: 'Pelanggan', icon: Users, show: canSeePelanggan },
    { key: 'vendor', label: 'Vendor', icon: Store, show: canSeeVendor },
    { key: 'mitra', label: 'Mitra', icon: Handshake, show: canSeeMitra },
  ] },
  { id: 'project', label: 'Project', icon: FolderKanban, children: [
    { key: 'penugasan', label: 'Penugasan', icon: Users, show: canSeePenugasan },
    { key: 'projects', label: 'Project', icon: FolderKanban, bar: true },
    { key: 'dokumen', label: 'Dokumen', icon: HardDrive },
    { key: 'keuangan', label: 'Keuangan', icon: Wallet, badge: needsAction },
  ] },
  // Personal digabung ke Manajemen — satu induk saja, urutan sesuai permintaan.
  { id: 'manajemen', label: 'Manajemen', icon: FileStack, children: [
    ...(CHAT_ENABLED ? [{ key: 'pesan', label: 'Pesan Masuk', icon: MessageCircle, bar: true, badge: (u, d, bf, x) => x.chatTotals?.msg || 0 }] : []),
    { key: 'agenda', label: 'Agenda', icon: CalendarRange, bar: true },
    { key: 'jadwal', label: 'Jadwal', icon: CalendarRange },
    { key: 'affidavit', label: 'Affidavit', icon: FileStack, show: canSeeAffidavit },
  ] },
  { key: 'faq', label: 'FAQ', icon: BookOpen },
  { key: 'monitoring', label: 'Monitoring', icon: MonitorCheck, show: canMonitor },
  { key: 'aktivitas', label: 'Aktivitas', icon: History, show: canSeeAllActivity },
  { key: 'settings', label: 'Pengaturan', icon: Cog },
]

/** Boleh tampil untuk pengguna ini? Hak akses persis seperti sebelumnya. */
const bolehItem = (user, n) => menuBoleh(user, n.key) && (!n.show || n.show(user))
/** Submenu yang terlihat; induk tanpa submenu terlihat ikut disembunyikan. */
const anakTerlihat = (user, n) => (n.children || []).filter((c) => bolehItem(user, c))
/** Menu yang benar-benar tampil, induk beserta submenunya. */
const menuTerlihat = (user) => MENU
  .map((n) => (n.children ? { ...n, children: anakTerlihat(user, n) } : n))
  .filter((n) => (n.children ? n.children.length > 0 : bolehItem(user, n)))
/** Daftar rata semua halaman yang boleh dibuka — dipakai bilah bawah di HP. */
const navItems = (user) => menuTerlihat(user).flatMap((n) => (n.children ? n.children : [n]))

export default function App() {
  const { user, data, setActiveRole, booting, signOut, toast, dismissToast, notify, branchFilter, setBranchFilter, confirmState, setConfirmState, unlinkedInvoices, chatTotals } = useApp()
  const [rawPage, param, param2] = useRoute()
  useEffect(() => { applyTheme(readTheme()) }, []) // tema tersimpan diterapkan saat aplikasi dibuka
  // Salin pengaturan Halaman Login ke perangkat ini, supaya halaman login
  // (yang terbuka sebelum masuk) tetap memakai tampilan terbaru.
  const setLogin = (data.app_settings || []).find((r) => r.key === 'login')
  useEffect(() => { if (setLogin) simpanCache({ ...DEFAULT_LOGIN, ...setLogin }) }, [setLogin])
  useDensity() // menerapkan kepadatan tersimpan ke seluruh aplikasi
  const [more, setMore] = useState(false)
  // pemilih cabang hanya untuk yang memang punya lebih dari satu cabang
  const branchPicker = !!user && (can.seeAllBranches(user) || isMultiBranch(user))
  const branchOptions = user ? ['Semua', ...(can.seeAllBranches(user) ? BRANCHES : branchesOf(user))] : []
  const [storeErr, setStoreErr] = useState(storageError)
  useEffect(() => { const f = (e) => setStoreErr(e.detail); window.addEventListener('atlas-storage', f); return () => window.removeEventListener('atlas-storage', f) }, [])

  if (rawPage === 'p' && param) return <><Suspense fallback={null}><Portal token={param} /></Suspense><Toast toast={toast} onClose={dismissToast} /></> // tautan khusus (vendor / pelanggan lama) — tanpa login
  if (rawPage === 'cek') return <Suspense fallback={null}><PortalCek /></Suspense> // portal pelanggan — satu link umum, tanpa login
  if (booting) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-brand" /></div>
  if (!user) return <><Login /><Toast toast={toast} onClose={dismissToast} /></>

  // Halaman yang tidak boleh dibuka peran ini dialihkan ke Dashboard,
  // supaya alamat langsung (#/keuangan dsb.) juga tertutup.
  const page = menuBoleh(user, rawPage) ? rawPage : 'dashboard'
  // Halaman Project & Faktur punya pencarian + filter cabang sendiri → alat header disembunyikan agar tidak dobel (Ctrl K tetap jalan)
  const alatSendiri = ['projects', 'faktur', 'apostille'].includes(page) && !param
  // Project Baru dari Faktur: isiannya dititipkan halaman Faktur lewat
  // sessionStorage, karena alamat hanya memuat nomor invoicenya.
  const presetBaru = (() => {
    if (!param2) return undefined
    try { const v = sessionStorage.getItem(`atlas-preset:${param2}`); return v ? JSON.parse(v) : undefined } catch { return undefined }
  })()
  const view = page === 'projects' && param === 'new'
    ? <ProjectForm page key={param2 || 'kosong'} preset={presetBaru} onClose={() => go(param2 ? 'faktur' : 'projects')} />
    : page === 'projects' && param ? <ProjectDetail id={param} focusSub={param2} />
    : page === 'projects' ? <Projects />
    : page === 'apostille' ? <Projects tabAwal="apostille" />
    : page === 'settings' ? <Settings />
    : page === 'aktivitas' ? <Activity />
    : page === 'monitoring' ? <Monitoring />
    : page === 'keuangan' ? <Keuangan tab={param} />
    : page === 'faktur' ? <Invoices />
    : ['agenda', 'notes', 'reminders', 'todo', 'calendar'].includes(page) ? <Agenda tab={tabAgendaDari(page, param)} />
    : page === 'pengajuan' ? <Keuangan tab="pengajuan" />
    : page === 'daftar-harga' ? <DaftarHarga />
    : page === 'faq' ? <Faq />
    : page === 'pelanggan' ? <Pelanggan />
    : page === 'dokumen' ? <Dokumen />
    : page === 'vendor' ? <VendorPage />
    : page === 'mitra' ? <MitraPage />
    : page === 'penugasan' ? <Penugasan />
    : page === 'affidavit' ? <Affidavit />
    : page === 'jadwal' ? <Jadwal />
    : page === 'pesan' && CHAT_ENABLED ? <Pesan peerParam={param} />
    : <Dashboard />

  return (
    <PanelProvider>
    <div className="min-h-screen">
        {/* ============================================================
            HEADER ATAS — susunan mengikuti pola Zoho Books:
            logo selebar sidebar · pemisah · riwayat · pencarian ·
            ruang · cabang aktif · pemisah · tambah · tim · notifikasi ·
            pengaturan · profil · menu aplikasi.
            Warnanya memakai variabel tema (--head*), jadi ikut berubah
            saat pengguna mengganti Light / Dark / warna sendiri.
           ============================================================ */}
        <header className="app-head sticky top-0 z-30 flex h-[var(--appbar)] items-center gap-1.5 border-b px-2 sm:gap-2 sm:px-3 md:px-4"
          style={{ background: 'var(--head)', color: 'var(--head-ink)', borderColor: 'var(--head-line)' }}>
          {/* Logo + nama aplikasi, sejajar lebar sidebar */}
          <a href="#/dashboard" aria-label="Atlas Alfa 5.0 — ke Dashboard"
            className="flex h-11 min-w-11 shrink-0 items-center gap-2.5 rounded-lg md:pr-1">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--brand)] text-sm font-black text-white">A</span>
            <span className="hidden whitespace-nowrap font-display text-[17px] font-bold tracking-tight lg:inline"
              style={{ color: 'var(--head-ink)' }}>Atlas Alfa <span style={{ color: 'var(--head-mute)' }}>5.0</span></span>
          </a>

          <span className="hidden h-6 w-px shrink-0 md:block" style={{ background: 'var(--head-line)' }} />

          {/* Pencarian — melebar mengikuti ruang yang tersisa */}
          {alatSendiri ? <span className="flex-1" /> : (
            <div className="min-w-[132px] max-w-[420px] flex-1 basis-[132px] sm:basis-[180px]" data-headbtn>
              <GlobalSearch pill />
            </div>
          )}

          <span className="hidden flex-1 xl:block" />
          <JamZona className="hidden shrink-0 md:flex" />

          {/* Cabang / organisasi aktif */}
          {branchPicker && !alatSendiri ? (
            <label className="relative hidden shrink-0 items-center xl:flex">
              <span className="sr-only">Filter cabang</span>
              <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} aria-label="Filter cabang" title="Filter cabang"
                className="h-11 max-w-[160px] cursor-pointer truncate rounded-lg border-0 bg-transparent pl-2 pr-7 text-sm font-semibold focus:ring-2 focus:ring-[var(--brand)] md:h-9"
                style={{ color: 'var(--head-ink)' }}>
                {branchOptions.map((b) => <option key={b} value={b} className="text-ink">{b === 'Semua' ? (can.seeAllBranches(user) ? 'Semua Cabang' : 'Semua cabang saya') : b}</option>)}
              </select>
            </label>
          ) : (
            <span className="hidden shrink-0 px-2 text-sm font-semibold xl:inline" style={{ color: 'var(--head-ink)' }}>{placeOf(user)}</span>
          )}

          <span className="hidden h-6 w-px shrink-0 xl:block" style={{ background: 'var(--head-line)' }} />

          {/* Tombol tambah — satu-satunya pintu "buat baru" di desktop; di HP lewat tab Buat */}
          <span className="hidden shrink-0 md:block"><HeadAdd /></span>
          {/* Mode fokus dihapus atas permintaan Pak (9 Nov) */}

          <span data-headbtn className="hidden shrink-0 xl:block"><TeamPresence /></span>
          <span data-headbtn className="shrink-0"><NotificationBell /></span>
          <span data-headbtn className="min-w-0 shrink-0"><HeaderUser /></span>
          <span data-headbtn className="hidden shrink-0 sm:block"><AppsMenu user={user} /></span>

          {MODE === 'demo' && (
            <span className="hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide 2xl:inline"
              style={{ background: 'var(--head-hover)', color: 'var(--head-mute)' }}>Demo</span>
          )}
        </header>
      <div className="md:flex">
      {/* Rel ikon 64 px (K3) — menu lengkap ada di "Lainnya" */}
      <RelIkon menu={menuTerlihat(user)} flat={navItems(user)} page={page} ctx={{ user, data, branchFilter, extra: { unlinkedInvoices, chatTotals } }} />

      <div className="min-w-0 flex-1">
        {/* Top bar */}
        {/* Baris kedua (di bawah lg): filter cabang & peran */}
        {((branchPicker && !alatSendiri) || rolesOf(user).length > 1) && (
          <div className="flex min-w-0 items-center gap-2 px-3 pt-2 xl:hidden md:px-4">
            {branchPicker && !alatSendiri && (
              <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} aria-label="Filter cabang"
                className="h-11 min-w-0 flex-1 truncate rounded-lg border-0 bg-white pl-3 pr-8 text-sm font-semibold ring-1 ring-slate-200 focus:ring-2 focus:ring-brand">
                {branchOptions.map((b) => <option key={b} value={b}>{b === 'Semua' ? (can.seeAllBranches(user) ? 'Semua Cabang' : 'Semua cabang saya') : b}</option>)}
              </select>
            )}
            {rolesOf(user).length > 1 && (
              <select value={user.role} onChange={(e) => { setActiveRole(e.target.value); window.location.hash = '/dashboard' }} aria-label="Ganti peran"
                className="h-11 min-w-0 flex-1 truncate rounded-lg border-0 bg-violet-50 pl-3 pr-8 text-sm font-bold text-violet-800 ring-1 ring-violet-200 focus:ring-2 focus:ring-brand">
                {rolesOf(user).map((r) => <option key={r} value={r}>Peran: {roleLabel(user, r)}</option>)}
              </select>
            )}
          </div>
        )}
        {storeErr && <div role="alert" className="flex flex-wrap items-center gap-2 bg-rose-600 px-4 py-2 text-xs font-semibold text-white md:px-8"><AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">{storeErr === 'quota' ? 'Penyimpanan browser penuh — perubahan terakhir TIDAK tersimpan.' : 'Penyimpanan browser diblokir — perubahan tidak tersimpan. Periksa pengaturan privasi browser (mode privat / cookie diblokir).'}</span>
          {storeErr === 'quota' && <button type="button" onClick={async () => { const f = await db.cleanup?.(); notify(f ? `Dibersihkan ${Math.round(f / 1024)} KB — coba simpan lagi` : 'Tidak ada sisa data lama; gunakan Reset data demo di Setting → Integrasi') }} className="rounded-lg bg-white/15 px-2.5 py-1 ring-1 ring-white/40 hover:bg-white/25">Bersihkan penyimpanan</button>}
          <a href="#/settings" className="rounded-lg bg-white/15 px-2.5 py-1 ring-1 ring-white/40 hover:bg-white/25">Setting</a>
        </div>}

        <main className="mx-auto w-full max-w-5xl px-3 pb-28 pt-4 sm:px-4 md:px-6 md:pb-12 md:pt-5 xl:max-w-[1280px] xl:px-8 2xl:max-w-[1440px]">

          <Suspense fallback={<div className="grid place-items-center py-24"><Loader2 className="h-5 w-5 animate-spin text-brand" /></div>}>{view}</Suspense>
        </main>
      </div>

      </div>

      {/* Chat menempel di bawah — tidak muncul di halaman Pesan Masuk (sudah ada di sana) */}
      {CHAT_ENABLED && <ChatDock hidden={page === 'pesan'} />}
      <NotifToast />

      {/* Tab bawah HP: Dasbor · Project · Buat · Pengingat · Menu */}
      <TabBawah flat={navItems(user)} page={page} ctx={{ user, data, branchFilter, extra: { unlinkedInvoices, chatTotals } }} onMenu={() => setMore(true)} menuOpen={more} />
      <Sheet open={more} onClose={() => setMore(false)} title="Menu">
        {/* Jam WIB & WITA — di layar kecil header tidak muat, jadi ditaruh di sini */}
        <JamZona tema="kartu" className="mb-3 flex justify-center rounded-xl bg-slate-50 py-2 ring-1 ring-slate-200" />
        <ul className="grid grid-cols-2 gap-2">
          {navItems(user).map((n) => {
            const b = n.badge ? n.badge(user, data, branchFilter, { unlinkedInvoices, chatTotals }) : 0
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

/** Tombol tambah di header — satu-satunya pintu membuat project/catatan/to-do/pengingat/pengajuan (K7). */
/** Mode fokus: sembunyikan semua toolbar halaman (judul, tab, pencarian, filter) agar data memenuhi layar. */
function TombolFokus() {
  const fokus = useFokus()
  const Icon = fokus ? Maximize2 : Minimize2
  return (
    <button type="button" onClick={toggleFokus} aria-pressed={fokus} data-aksi="mode-fokus" title={fokus ? 'Tampilkan kembali toolbar' : 'Mode fokus — sembunyikan toolbar, fokus ke data'}
      className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-xl ring-1 transition md:h-9 md:w-9', fokus ? 'bg-brand text-white ring-brand' : 'ring-white/15 hover:bg-white/10')} style={fokus ? undefined : { color: 'var(--head-ink)' }}>
      <Icon className="h-4 w-4" />
    </button>
  )
}
/** Pil kecil di atas isi halaman saat mode fokus aktif — satu klik untuk kembali. */
function PilFokus() {
  const fokus = useFokus()
  if (!fokus) return null
  return (
    <button type="button" onClick={toggleFokus} data-aksi="keluar-fokus" className="mb-2 inline-flex h-8 items-center gap-1.5 rounded-full bg-ink px-3 text-xs font-semibold text-white shadow-sm hover:bg-brand">
      <Maximize2 className="h-3.5 w-3.5" />Mode fokus aktif · tampilkan toolbar
    </button>
  )
}
function HeadAdd() {
  const { user } = useApp()
  const { open } = usePanel()
  const items = PANEL_ORDER.map((k) => [k, PANELS[k]]).filter(([, p]) => p.allow(user))
  if (!items.length) return null
  return (
    <Popover label="Buat baru" align="right" width="min-w-[220px]"
      button={({ open: o, toggle }) => (
        <button type="button" onClick={toggle} aria-expanded={o} aria-label="Buat baru" title="Buat baru"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[var(--brand)] text-white transition hover:opacity-90 md:h-9 md:w-9">
          <Plus className="h-[18px] w-[18px]" />
        </button>
      )}>
      {({ close }) => (
        <div className="space-y-0.5">
          {items.map(([k, p]) => (
            <button key={k} type="button"
              onClick={() => { close(); if (k === 'project') go('projects/new'); else open(k) }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-semibold text-ink-soft hover:bg-slate-50 hover:text-ink">
              <p.icon className="h-4 w-4 text-ink-mute" />{p.label}
            </button>
          ))}
        </div>
      )}
    </Popover>
  )
}

/** Menu aplikasi (ikon kisi) — pintasan ke halaman utama sesuai hak akses. */
function AppsMenu({ user }) {
  const items = navItems(user).slice(0, 12)
  return (
    <Popover label="Menu aplikasi" align="right" width="min-w-[260px]"
      button={({ open: o, toggle }) => (
        <button type="button" onClick={toggle} aria-expanded={o} aria-label="Menu aplikasi" title="Menu aplikasi"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg transition hover:bg-[var(--head-hover)] md:h-9 md:w-9"
          style={{ color: 'var(--head-mute)' }}>
          <LayoutGrid className="h-[18px] w-[18px]" />
        </button>
      )}>
      {({ close }) => (
        <div className="grid grid-cols-3 gap-1">
          {items.map((n) => (
            <a key={n.key} href={`#/${n.key}`} onClick={close}
              className="flex flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-center text-[11px] font-semibold text-ink-soft hover:bg-slate-50 hover:text-brand">
              <n.icon className="h-5 w-5 text-ink-mute" />
              <span className="line-clamp-2 leading-tight">{n.label}</span>
            </a>
          ))}
        </div>
      )}
    </Popover>
  )
}

