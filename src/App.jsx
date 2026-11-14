import { lazy, Suspense, useEffect, useState } from 'react'
import { Home, LayoutDashboard, FolderKanban, Settings as Cog, LogOut, Loader2, History, MonitorCheck, Wallet, Stamp, ReceiptText, StickyNote, AlarmClock, CalendarDays, Plus, Users, LayoutGrid, HardDrive, Tags, MessageCircle, BookOpen, FileStack, CalendarRange, Store, Handshake, Minimize2, Maximize2, Building2, Server, Rocket, Hash, ClipboardList, Truck } from 'lucide-react'
import PindahBooks from './components/PindahBooks.jsx'
import SidebarMenu from './components/SidebarMenu.jsx'
import PanelDummy from './components/PanelDummy.jsx'
import { useApp } from './lib/store.jsx'
import { MODE, storageError, db } from './lib/db.js'
import { AlertTriangle } from 'lucide-react'
import { BRANCHES, ROLES, can, branchesOf, isMultiBranch, roleLabel, rolesOf, isFreelance, placeOf } from './config/access.js'
import { go } from './lib/router.js'
import { Toast, Sheet, Button, Popover, cx } from './components/ui.jsx'
import Login from './pages/Login.jsx'
import { simpanCache, DEFAULT_LOGIN } from './config/loginTheme.js'
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const Projects = lazy(() => import('./pages/Projects.jsx'))
const ProjectDetail = lazy(() => import('./pages/ProjectDetail.jsx'))
import { canSeeAllActivity, canMonitor, canSeeKeuangan, canSeeApostille, canSeeInvoices, canSeeAffidavit, canSeePelanggan, canSeePenugasan, canSeeKatalog, canSeeVendor, canSeeMitra, canSeeBeranda, canSeeRegister, canSeeLaporanOto, menuBoleh } from './config/menuAccess.js'
import { needsAction } from './lib/badges.js'
import { ReminderWatcher } from './pages/Reminders.jsx'
// Halaman yang tidak dibuka tiap hari dimuat saat diklik → halaman pertama jauh lebih ringan
const Settings = lazy(() => import('./pages/Settings.jsx'))
const Beranda = lazy(() => import('./pages/Beranda.jsx'))
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
const Perusahaan = lazy(() => import('./pages/Perusahaan.jsx'))
const StatusServer = lazy(() => import('./pages/StatusServer.jsx'))
const Affidavit = lazy(() => import('./pages/Affidavit.jsx'))
const Register = lazy(() => import('./pages/Register.jsx'))
const LaporanOtorisasi = lazy(() => import('./pages/LaporanOtorisasi.jsx'))
const Jadwal = lazy(() => import('./pages/Jadwal.jsx'))
const ProjectForm = lazy(() => import('./pages/ProjectForm.jsx'))
const Pelanggan = lazy(() => import('./pages/Pelanggan.jsx'))
const Dokumen = lazy(() => import('./pages/Dokumen.jsx'))
const MitraPage = lazy(() => import('./pages/Mitra.jsx'))
const Penugasan = lazy(() => import('./pages/Penugasan.jsx'))
import GlobalSearch from './components/GlobalSearch.jsx'
import MenuHP, { catatKunjungan } from './components/MenuHP.jsx'
import YangBaru, { PanduanPasang } from './components/YangBaru.jsx'
import { SlotProvider, BarisAtas, KeAtas, KELAS_PLUS, IKON_ATAS } from './components/SlotAtas.jsx'
import { useFokus, toggleFokus } from './lib/fokus.js'
import NotificationBell from './components/NotificationBell.jsx'
import { TombolHantu, PitaHantu } from './components/ModeHantu.jsx'
import PengingatSholat from './components/PengingatSholat.jsx'
import ThemePicker, { readTheme, applyTheme } from './components/ThemePicker.jsx'
import TeamPresence from './components/TeamPresence.jsx'
import HeaderUser from './components/HeaderUser.jsx'
import { PanelProvider } from './components/WorkspacePanel.jsx'
import SessionGuard from './components/SessionGuard.jsx'
import ChatDock from './components/ChatDock.jsx'
import { CHAT_ENABLED } from './lib/flags.js'

import JamZona from './components/JamZona.jsx'
import { jamKantor } from './lib/zona.js'
import NotifToast from './components/NotifToast.jsx'
const VendorPage = lazy(() => import('./pages/Vendor.jsx'))
import { usePanel, PANELS, PANEL_ORDER } from './components/WorkspacePanel.jsx'
import { RelIkon, TabBawah } from './components/RelMenu.jsx'
import { SaklarMode, useKlasik } from './components/klasikSaklar.jsx'
const KlasikApp = lazy(() => import('./components/ModeKlasik.jsx').then((m) => ({ default: m.KlasikApp })))
import { pasangPenangkapError } from './lib/monitor.js'
import { pasangRilis } from './config/rilis.js'
const Pengiriman = lazy(() => import('./pages/Pengiriman.jsx'))
const RilisFitur = lazy(() => import('./pages/RilisFitur.jsx'))
pasangPenangkapError()
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
const KANTOR_ROLES = ['superadmin', 'direktur', 'supervisor', 'admin_pusat', 'cs', 'akunting', 'helper', 'staf_apostille']
const peranDi = (roles) => (u) => roles.includes(u?.role)
// Susunan menu mengikuti CANVAS ATLAS. Item "segera" = bagian ATLAS Books yang belum jadi.
const MENU = [
  // Beranda & Dashboard berdiri sendiri (bukan submenu "Utama") — 13 Nov
  { id: 'beranda', label: 'Beranda', icon: Home, children: [
    { key: 'beranda', label: 'Beranda', icon: Home, show: canSeeBeranda },
  ] },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, children: [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, bar: true },
  ] },
  { id: 'penjualan', label: 'Penjualan', icon: ReceiptText, children: [
    { key: 'estimasi', label: 'Estimasi', segera: true, show: peranDi(KANTOR_ROLES) },
    { key: 'faktur', label: 'Faktur', icon: ReceiptText, show: canSeeInvoices, badge: (u, d, bf, extra) => extra.unlinkedInvoices },
    { key: 'terima-pembayaran', label: 'Terima Pembayaran', segera: true, show: peranDi(KANTOR_ROLES) },
    { key: 'pelanggan', label: 'Pelanggan', icon: Users, show: canSeePelanggan },
    { key: 'mitra', label: 'Mitra', icon: Handshake, show: canSeeMitra },
    { key: 'daftar-harga', label: 'Katalog', icon: Tags, show: canSeeKatalog },
  ] },
  { id: 'project', label: 'Project', icon: FolderKanban, children: [
    { key: 'projects', label: 'Project', icon: FolderKanban, bar: true },
    { key: 'penugasan', label: 'Penugasan', icon: Users, show: canSeePenugasan },
    { key: 'register', label: 'Nomor Register', icon: Hash, show: canSeeRegister },
    { key: 'otorisasi', label: 'Laporan Otorisasi', icon: ClipboardList, show: canSeeLaporanOto },
    { key: 'dokumen', label: 'Dokumen', icon: HardDrive },
    { key: 'affidavit', label: 'Affidavit', icon: FileStack, show: canSeeAffidavit },
  ] },
  { id: 'keuangan', label: 'Keuangan', icon: Wallet, children: [
    { key: 'keuangan', label: 'Ringkasan', icon: Wallet, badge: needsAction, subOnly: true },
    { id: 'keu-pengajuan', key: 'keuangan', sub: 'pengajuan', label: 'Pengajuan', samping: true },
    { id: 'keu-petty', key: 'keuangan', sub: 'petty', label: 'Petty Cash', samping: true, show: canSeeKeuangan },
    { key: 'kas-bank', label: 'Kas & Bank', segera: true, show: peranDi(['superadmin', 'direktur', 'akunting']) },
    { key: 'pengeluaran', label: 'Pengeluaran', segera: true, show: peranDi(['superadmin', 'akunting']) },
    { id: 'keu-tagihan', key: 'keuangan', sub: 'tagihan', label: 'Tagihan Vendor', samping: true, show: canSeeKeuangan },
    { key: 'vendor', label: 'Vendor', icon: Store, show: canSeeVendor },
    { key: 'laporan-keuangan', label: 'Laporan', segera: true, show: peranDi(['superadmin', 'akunting']) },
  ] },
  { id: 'pengiriman', label: 'Pengiriman', icon: Truck, children: [
    { key: 'pengiriman', label: 'Daftar Kiriman', icon: Truck, subOnly: true, show: peranDi(['superadmin', 'direktur', 'admin_pusat', 'akunting', 'supervisor']) },
    { id: 'kirim-alamat', key: 'pengiriman', sub: 'alamat', label: 'Alamat Pengirim', samping: true, show: peranDi(['superadmin', 'direktur', 'admin_pusat', 'supervisor']) },
    { id: 'kirim-kurir', key: 'pengiriman', sub: 'kurir', label: 'Kurir', samping: true, show: peranDi(['superadmin', 'direktur', 'admin_pusat', 'supervisor']) },
  ] },
  { id: 'agenda', label: 'Agenda', icon: CalendarRange, children: [
    ...(CHAT_ENABLED ? [{ key: 'pesan', label: 'Pesan Masuk', icon: MessageCircle, bar: true, badge: (u, d, bf, x) => x.chatTotals?.msg || 0 }] : []),
    { key: 'agenda', label: 'Agenda', icon: CalendarRange, bar: true },
    { key: 'jadwal', label: 'Jadwal Kerja', icon: CalendarRange },
    { key: 'notes', label: 'Catatan', icon: StickyNote },
  ] },
  { id: 'kantor', label: 'Kantor & Sistem', icon: Building2, children: [
    { key: 'perusahaan', label: 'Perusahaan', icon: Building2 },
    { key: 'faq', label: 'FAQ', icon: BookOpen },
    { key: 'settings', label: 'Pengaturan', icon: Cog },
    { key: 'rilis-fitur', label: 'Rilis Fitur', icon: Rocket, show: canMonitor },
    { key: 'status-server', label: 'Status Server', icon: Server, show: canMonitor },
    { key: 'monitoring', label: 'Monitoring', icon: MonitorCheck, show: canMonitor },
    { key: 'aktivitas', label: 'Aktivitas', icon: History, show: canSeeAllActivity },
  ] },
]

/** Boleh tampil untuk pengguna ini? Hak akses persis seperti sebelumnya. */
const bolehItem = (user, n) => (n.segera || menuBoleh(user, n.key)) && (!n.show || n.show(user))
/** Submenu yang terlihat; induk tanpa submenu terlihat ikut disembunyikan. */
const anakTerlihat = (user, n) => (n.children || []).filter((c) => bolehItem(user, c))
/** Menu yang benar-benar tampil, induk beserta submenunya. */
const menuTerlihat = (user) => MENU
  .map((n) => (n.children ? { ...n, children: anakTerlihat(user, n) } : n))
  .filter((n) => (n.children ? n.children.length > 0 : bolehItem(user, n)))
/** Daftar rata semua halaman yang boleh dibuka — dipakai bilah bawah di HP. */
const navItems = (user) => menuTerlihat(user).flatMap((n) => (n.children ? n.children : [n])).filter((n) => !n.segera && !n.samping)

export default function App() {
  const { user, data, setActiveRole, personaList, booting, signOut, toast, dismissToast, notify, branchFilter, setBranchFilter, confirmState, setConfirmState, unlinkedInvoices, chatTotals } = useApp()
  const [rawPage, param, param2] = useRoute()
  useEffect(() => { applyTheme(readTheme()) }, []) // tema tersimpan diterapkan saat aplikasi dibuka
  // Salin pengaturan Halaman Login ke perangkat ini, supaya halaman login
  // (yang terbuka sebelum masuk) tetap memakai tampilan terbaru.
  const setLogin = (data.app_settings || []).find((r) => r.key === 'login')
  useEffect(() => { if (setLogin) simpanCache({ ...DEFAULT_LOGIN, ...setLogin }) }, [setLogin])
  useDensity() // menerapkan kepadatan tersimpan ke seluruh aplikasi
  const [more, setMore] = useState(false)
  useEffect(() => { if (user && rawPage && menuBoleh(user, rawPage)) catatKunjungan(rawPage) }, [rawPage, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps -- untuk "Sering dipakai" di menu HP
  // pemilih cabang hanya untuk yang memang punya lebih dari satu cabang
  const branchPicker = !!user && (can.seeAllBranches(user) || isMultiBranch(user))
  const branchOptions = user ? ['Semua', ...(can.seeAllBranches(user) ? BRANCHES : branchesOf(user))] : []
  const [storeErr, setStoreErr] = useState(storageError)
  pasangRilis(data.app_settings) // saklar Rilis Fitur berlaku untuk menu & rute di render ini
  const klasik = useKlasik(user, data)
  useEffect(() => { const f = (e) => setStoreErr(e.detail); window.addEventListener('atlas-storage', f); return () => window.removeEventListener('atlas-storage', f) }, [])

  if (rawPage === 'p' && param) return <><Suspense fallback={null}><Portal token={param} /></Suspense><Toast toast={toast} onClose={dismissToast} /></> // tautan khusus (vendor / pelanggan lama) — tanpa login
  if (rawPage === 'cek') return <Suspense fallback={null}><PortalCek /></Suspense> // portal pelanggan — satu link umum, tanpa login
  if (booting) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-brand" /></div>
  if (!user) return <><Login /><Toast toast={toast} onClose={dismissToast} /></>

  // Halaman yang tidak boleh dibuka peran ini dialihkan ke Dashboard,
  // supaya alamat langsung (#/keuangan dsb.) juga tertutup.
  const awal = menuBoleh(user, 'dashboard') ? 'dashboard' : 'projects' // halaman utama ikut saklar Rilis Fitur
  const page = menuBoleh(user, rawPage) && (!['status-server', 'rilis-fitur'].includes(rawPage) || canMonitor(user)) ? rawPage : awal
  // Halaman Project & Faktur punya pencarian + filter cabang sendiri → alat header disembunyikan agar tidak dobel (Ctrl K tetap jalan)
  const alatSendiri = ['projects', 'faktur', 'apostille'].includes(page) && !param
  // Ganti peran / persona (jabatan tersembunyi). Di PC tampil di bar atas, di HP di baris kedua.
  const gantiPeran = (mode) => {
    if (!user || user._hantu || !(rolesOf(user).length > 1 || personaList.length > 0 || user._actor)) return null
    const asli = user._actor ? data.users.find((u) => u.id === user._actor) : user
    const peranAsli = rolesOf(asli)
    const daftarPersona = user._actor ? (asli?.act_as || []).map((id) => data.users.find((u) => u.id === id)).filter(Boolean) : personaList
    const nilai = user._actor ? `as:${user.id}` : user.role
    return (
      <select value={nilai} onChange={(e) => { setActiveRole(e.target.value); window.location.hash = '/dashboard' }} aria-label="Ganti peran" title="Ganti peran" data-ganti-peran={mode}
        className={cx('min-w-0 cursor-pointer truncate rounded-lg border-0 pl-3 pr-8 text-sm font-bold ring-1 focus:ring-2 focus:ring-brand',
          mode === 'sb' ? 'h-10 w-full' : 'h-11 flex-1',
          user._actor ? 'bg-amber-400 text-ink ring-amber-400' : 'bg-violet-50 text-violet-800 ring-violet-200')}>
        {peranAsli.map((r) => <option key={r} value={r}>Peran: {roleLabel(asli, r)}</option>)}
        {daftarPersona.map((p) => <option key={p.id} value={`as:${p.id}`}>Sebagai: {p.name} · {roleLabel(p)}</option>)}
      </select>
    )
  }
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
    : page === 'beranda' && canSeeBeranda(user) ? <Beranda />
    : page === 'settings' ? <Settings />
    : page === 'aktivitas' ? <Activity />
    : page === 'monitoring' ? <Monitoring />
    : page === 'keuangan' ? <Keuangan tab={param} />
    : page === 'faktur' ? <Invoices />
    : ['agenda', 'notes', 'reminders', 'todo', 'calendar'].includes(page) ? <Agenda tab={tabAgendaDari(page, param)} />
    : page === 'pengajuan' ? <Keuangan tab="pengajuan" />
    : page === 'daftar-harga' ? <DaftarHarga />
    : page === 'faq' ? <Faq />
    : page === 'perusahaan' ? <Perusahaan tab={param} />
    : page === 'status-server' && canMonitor(user) ? <StatusServer />
    : page === 'rilis-fitur' && canMonitor(user) ? <RilisFitur />
    : page === 'pelanggan' ? <Pelanggan />
    : page === 'dokumen' ? <Dokumen />
    : page === 'pengiriman' ? <Pengiriman tab={param} />
    : page === 'vendor' ? <VendorPage />
    : page === 'mitra' ? <MitraPage />
    : page === 'penugasan' ? <Penugasan />
    : page === 'affidavit' ? <Affidavit />
    : page === 'register' && canSeeRegister(user) ? <Register />
    : page === 'otorisasi' && canSeeLaporanOto(user) ? <LaporanOtorisasi />
    : page === 'jadwal' ? <Jadwal />
    : page === 'pesan' && CHAT_ENABLED ? <Pesan peerParam={param} />
    : menuBoleh(user, 'dashboard') ? <Dashboard />
    : <Projects />

  const konfirmasi = (
    <Sheet open={!!confirmState} title="Konfirmasi" onClose={() => { confirmState?.resolve(false); setConfirmState(null) }}
      footer={<><Button variant="outline" className="flex-1" onClick={() => { confirmState.resolve(false); setConfirmState(null) }}>Batal</Button>
        <Button variant="dark" className="flex-1" onClick={() => { confirmState.resolve(true); setConfirmState(null) }}>Ya, lanjutkan</Button></>}>
      <p className="text-sm text-ink-soft">{confirmState?.msg}</p>
    </Sheet>
  )
  // Mode Klasik (komputer): layar penuh, hanya Project & Keuangan
  if (klasik) {
    const detail = (page === 'projects' && param) ? view : null
    return (
      <PanelProvider>
        <PitaHantu />
        <PengingatSholat />
        <Suspense fallback={<div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-brand" /></div>}><KlasikApp page={page} param={param} detail={detail && <Suspense fallback={<div className="grid place-items-center py-24"><Loader2 className="h-5 w-5 animate-spin text-brand" /></div>}>{detail}</Suspense>} /></Suspense>
        <NotifToast />
        <Toast toast={toast} onClose={dismissToast} />
        <SessionGuard />
        <ReminderWatcher />
        {konfirmasi}
      </PanelProvider>
    )
  }

  return (
    <PanelProvider>
    <SlotProvider>
    <div className="min-h-screen">
        {/* ============================================================
            HEADER ATAS — susunan mengikuti pola Zoho Books:
            logo selebar sidebar · pemisah · riwayat · pencarian ·
            ruang · cabang aktif · pemisah · tambah · tim · notifikasi ·
            pengaturan · profil · menu aplikasi.
            Warnanya memakai variabel tema (--head*), jadi ikut berubah
            saat pengguna mengganti Light / Dark / warna sendiri.
           ============================================================ */}
        <PitaHantu />
        <PengingatSholat />
      <div className="md:flex">
      {/* Rel ikon 64 px (K3) — menu lengkap ada di "Lainnya" */}
      <RelIkon menu={menuTerlihat(user).map((g) => (g.children ? { ...g, children: g.children.filter((n) => !n.segera && !n.samping) } : g))} flat={navItems(user)} page={page} ctx={{ user, data, branchFilter, extra: { unlinkedInvoices, chatTotals } }}
        atas={<LogoAtlas ringkas />} profil={<HeaderUser atas rel />} />
      <SidebarMenu menu={menuTerlihat(user)} page={page} param={param} ctx={{ user, data, branchFilter, extra: { unlinkedInvoices, chatTotals } }}
        atas={(rel) => rel ? <LogoAtlas ringkas /> : (
          <div className="flex flex-col gap-2" data-sidebar-atas>
            <LogoAtlas />
            {branchPicker && !alatSendiri ? (
              <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} aria-label="Filter cabang" title="Filter cabang"
                className="h-9 w-full cursor-pointer truncate rounded-lg border-0 bg-[#F3F4F9] pl-2.5 pr-8 text-[13px] font-semibold text-[#141B34] focus:ring-2 focus:ring-brand dark:bg-white/5 dark:text-slate-100">
                {branchOptions.map((b) => <option key={b} value={b}>{b === 'Semua' ? (can.seeAllBranches(user) ? 'Semua Cabang' : 'Semua cabang saya') : b}</option>)}
              </select>
            ) : <span className="px-2 text-[13px] font-semibold text-[#5E6380]" data-tempat>{placeOf(user)}</span>}
            {gantiPeran('sb')}
          </div>
        )}
        profil={(rel) => rel ? <HeaderUser atas rel /> : <HeaderUser atas lebar />}
        />

      <div className="min-w-0 flex-1">
        {storeErr && <div role="alert" className="flex flex-wrap items-center gap-2 bg-rose-600 px-4 py-2 text-xs font-semibold text-white md:px-8"><AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">{storeErr === 'quota' ? 'Penyimpanan browser penuh — perubahan terakhir TIDAK tersimpan.' : 'Penyimpanan browser diblokir — perubahan tidak tersimpan. Periksa pengaturan privasi browser (mode privat / cookie diblokir).'}</span>
          {storeErr === 'quota' && <button type="button" onClick={async () => { const f = await db.cleanup?.(); notify(f ? `Dibersihkan ${Math.round(f / 1024)} KB — coba simpan lagi` : 'Tidak ada sisa data lama; gunakan Reset data demo di Setting → Integrasi') }} className="rounded-lg bg-white/15 px-2.5 py-1 ring-1 ring-white/40 hover:bg-white/25">Bersihkan penyimpanan</button>}
          <a href="#/settings" className="rounded-lg bg-white/15 px-2.5 py-1 ring-1 ring-white/40 hover:bg-white/25">Setting</a>
        </div>}

        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-4 md:px-6 md:pb-12 md:pt-6 xl:max-w-[1280px] 2xl:max-w-[1440px]">
          {/* Baris atas isi halaman: pencarian (kiri) · tombol tambah (kanan) — bukan top bar global */}
          <BarisAtas cariBawaan={<GlobalSearch ikon placeholder={CARI_HALAMAN[page] || 'Cari invoice, pelanggan, menu…'} />} tambahBawaan={<HeadAdd />} ikonLain={<><PintasAtas page={page} /><TeamPresence ikon /><NotificationBell ikon /><TombolHantu ikon /></>} />
          {((branchPicker && !alatSendiri) || (!user._hantu && (rolesOf(user).length > 1 || personaList.length > 0 || user._actor))) && (
          <KeAtas slot="sesudah"><div className="flex min-w-0 items-center gap-2 lg:hidden" data-baris-cabang>
            {branchPicker && !alatSendiri && (
              <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} aria-label="Filter cabang"
                className="h-11 min-w-0 max-w-[220px] flex-1 truncate rounded-xl border-0 bg-white pl-3 pr-8 text-sm font-semibold ring-1 ring-slate-200 focus:ring-2 focus:ring-brand">
                {branchOptions.map((b) => <option key={b} value={b}>{b === 'Semua' ? (can.seeAllBranches(user) ? 'Semua Cabang' : 'Semua cabang saya') : b}</option>)}
              </select>
            )}
            {gantiPeran('hp')}
          </div></KeAtas>
          )}

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
        {/* Profil · jam · mode hantu dalam satu baris */}
        <div className="mb-4 flex items-center gap-2 rounded-2xl bg-slate-50 p-1.5 pr-2 dark:bg-white/5" data-menu-profil>
          <div className="min-w-0 flex-1"><HeaderUser lebar /></div>
          <JamZona tema="kartu" daftar={jamKantor(user, branchFilter)} className="flex flex-col !gap-0 text-right [&_[data-jam-zona]]:justify-end [&_[data-jam-zona]_span:last-child]:text-[13px]" />
        </div>
        <MenuHP grup={menuTerlihat(user)} user={user} page={page} onPilih={() => setMore(false)}
          badgeOf={(n) => (n.badge ? n.badge(user, data, branchFilter, { unlinkedInvoices, chatTotals }) : 0)} />
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
      <YangBaru />
      <PanduanPasang />
    </SlotProvider>
    </PanelProvider>
  )
}

/** Pintasan halaman di kumpulan ikon kanan atas: Project & Pengajuan (setelah ikon cari). */
function PintasAtas({ page }) {
  const item = [
    { href: '#/projects', label: 'Project', icon: FolderKanban, aktif: page === 'projects' },
    { href: '#/pengajuan', label: 'Pengajuan', icon: Wallet, aktif: page === 'pengajuan' },
  ]
  return item.map(({ href, label, icon: Ikon, aktif }) => (
    <a key={href} href={href} aria-label={label} title={label} aria-current={aktif ? 'page' : undefined} data-pintas={label}
      className={IKON_ATAS + (aktif ? ' bg-[#E9EBF3] text-[#141B34] dark:bg-white/10 dark:text-white' : '')}>
      <Ikon className="h-[17px] w-[17px]" aria-hidden="true" />
    </a>
  ))
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
/** Logo + nama aplikasi (di bagian atas menu samping). */
function LogoAtlas({ ringkas }) {
  return (
    <a href="#/dashboard" aria-label="ATLAS 5.0 — ke Dashboard" title="ATLAS 5.0" data-logo
      className={cx('flex h-11 shrink-0 items-center rounded-xl font-display font-extrabold tracking-tight text-[#141B34] dark:text-white', ringkas ? 'w-11 justify-center text-[11px] leading-none' : 'gap-1.5 px-1.5 text-[15px]')}>
      {ringkas ? <span className="text-center">ATLAS<br /><span className="text-[#5E6380]">5.0</span></span> : <>ATLAS <span className="text-[#5E6380]">5.0</span></>}
      {!ringkas && MODE === 'demo' && <span className="ml-auto rounded-full bg-[#F3F4F9] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#5E6380] dark:bg-white/10">Demo</span>}
    </a>
  )
}
/** Placeholder pencarian bawaan per halaman (halaman dengan pencarian sendiri memakai miliknya). */
const CARI_HALAMAN = { dashboard: 'Cari invoice, pelanggan, menu…', keuangan: 'Cari invoice, pengajuan, vendor…', agenda: 'Cari invoice, catatan, pengingat…', settings: 'Cari menu atau pengaturan…', penugasan: 'Cari invoice atau penerjemah…' }
function HeadAdd() {
  const { user } = useApp()
  const { open } = usePanel()
  const items = PANEL_ORDER.map((k) => [k, PANELS[k]]).filter(([, p]) => p.allow(user))
  if (!items.length) return null
  return (
    <Popover label="Buat baru" align="right" width="w-[260px]"
      button={({ open: o, toggle }) => (
        <button type="button" onClick={toggle} aria-expanded={o} aria-haspopup="menu" aria-label="Buat…" title="Buat…" data-aksi="buat-baru" className={KELAS_PLUS}>
          <Plus className="h-[17px] w-[17px]" aria-hidden="true" />
        </button>
      )}>
      {({ close }) => (
        <div className="space-y-0.5">
          {items.map(([k, p]) => (
            <button key={k} type="button"
              onClick={() => { close(); open(k) }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-semibold text-ink-soft hover:bg-slate-50 hover:text-ink">
              <p.icon className="h-4 w-4 text-ink-mute" />{p.label}
            </button>
          ))}
          {/* Tambah Dummy (Superadmin, hanya di demo) */}
          <div className="border-t border-slate-200 pt-1"><PanelDummy ringkas /></div>
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
          <div className="col-span-3 mt-1 border-t border-slate-100 pt-1"><PindahBooks onPilih={close} /></div>
        </div>
      )}
    </Popover>
  )
}

