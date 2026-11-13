import { useEffect, useMemo, useState } from 'react'
import { zonaPengguna } from '../lib/zona.js'
import { Plus, Trash2, Pencil, Store, Phone, MapPin, Landmark, Tags, StickyNote, ArrowDownLeft, ArrowUpRight, CheckCircle2, CircleDashed, RotateCcw, Eye, EyeOff } from 'lucide-react'
import { PAYMENT_TERMS, termOf, SUMBER_DANA, sumberLabel } from '../config/workflows.js'
import { useApp } from '../lib/store.jsx'
import { SubTabs, SubTabBtn } from '../components/SubTab.jsx'
import { db, MODE, storageUsage } from '../lib/db.js'
import { BRANCHES, PERSON_TYPES, ROLES, can, scopeByBranch, branchesOf, branchLabel, roleLabel, APOSTILLE_FUND, pettyLabel, pettyAccountsOf, isFreelance } from '../config/access.js'
import { Button, Card, Empty, Field, Input, Pill, Select, Sheet, Tabs, Textarea, cx } from '../components/ui.jsx'
import { UserRound, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { go } from '../lib/router.js'
import { readTheme, applyTheme, ACCENTS } from '../components/ThemePicker.jsx'
import { soundEnabled, setSoundEnabled, chatSoundEnabled, setChatSoundEnabled, chatVolume, setChatVolume } from '../lib/sounds.js'
import { jam, rupiah, tgl as tglShort } from '../lib/format.js'
import { drive } from '../lib/integrations.js'
import { DownloadBukti } from '../components/Pengajuan.jsx'
import { fileRulesOf } from '../components/UploadNamer.jsx'
import { cekUrl } from '../lib/custClient.js'
import { ACCESS_DAYS } from '../lib/portalCust.js'
import { COURIER_ICONS, COURIER_TYPES, CourierLogo } from '../components/Courier.jsx'
import AvatarEditor from '../components/AvatarEditor.jsx'
import Avatar from '../components/Avatar.jsx'
import { useTabel, Th, CariTabel } from '../components/TabelSortir.jsx'
import LoginSettings from '../components/LoginSettings.jsx'
import SlideBerandaSettings from '../components/SlideBerandaSettings.jsx'

/** Kartu pengalih untuk bagian yang sudah pindah menu (K4) — tidak ada fungsi yang hilang, hanya satu tempat. */
function Pindah({ ke, judul, teks, tombol }) {
  return (
    <Card className="p-6 text-center" data-pindah={ke}>
      <p className="text-base font-bold text-ink">{judul}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-mute">{teks}</p>
      <a href={ke} className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-ink px-5 text-sm font-bold text-white hover:bg-brand">{tombol} →</a>
    </Card>
  )
}

import { KeAtas, TombolTambah } from '../components/SlotAtas.jsx'
import { AksesApostilleSettings } from '../components/CentangApostille.jsx'

export default function Settings() {
  const { user } = useApp()
  const tabs = [
    { value: 'profil', label: 'Profil & kata sandi', grup: 'Saya' },
    can.manageUsers(user) && { value: 'users', label: 'Pengguna', grup: 'Perusahaan' },
    can.managePeople(user) && { value: 'people', label: 'Master data', grup: 'Perusahaan' },
    can.managePeople(user) && { value: 'kurir', label: 'Kurir', grup: 'Perusahaan' },
    ['superadmin', 'admin_pusat'].includes(user.role) && { value: 'file', label: 'File & portal', grup: 'Perusahaan' },
    can.manageUsers(user) && { value: 'integrasi', label: 'Integrasi', grup: 'Perusahaan' },
    user.role === 'superadmin' && { value: 'tampilan', label: 'Tampilan login', grup: 'Perusahaan' },
    user.role === 'superadmin' && { value: 'beranda', label: 'Slide Beranda', grup: 'Perusahaan' },
    user.role === 'superadmin' && { value: 'apostille', label: 'Tahapan Apostille', grup: 'Perusahaan' },
    // Sudah pindah menu (K4) — tetap bisa dibuka lewat alamat lama, tampil sebagai pengalih
    { value: 'petty', label: 'Petty Cash', grup: 'Pindah', sembunyi: true },
    can.manageVendors(user) && { value: 'vendor', label: 'Vendor', grup: 'Pindah', sembunyi: true },
  ].filter(Boolean)
  const grup = ['Saya', 'Perusahaan'].map((g) => [g, tabs.filter((t) => t.grup === g && !t.sembunyi)]).filter(([, l]) => l.length)
  // tab awal bisa ditentukan lewat rute, mis. #/settings/petty (dari kartu Petty Cash di dashboard)
  const fromHash = () => { const t = window.location.hash.replace(/^#\/?/, '').split('/')[1]; return tabs.some((x) => x.value === t) ? t : 'profil' }
  const [tab, setTab] = useState(fromHash)
  useEffect(() => { const f = () => setTab(fromHash()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-3">
      <h1 className="text-[17px] font-extrabold leading-tight tracking-tight">Pengaturan</h1>
      <div className="grid gap-3 md:grid-cols-[200px_minmax(0,1fr)] md:items-start">
        {/* Daftar kiri 2 kelompok (desktop) / baris chip geser (HP) */}
        <nav aria-label="Bagian pengaturan" data-nav-pengaturan className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] md:sticky md:top-[calc(var(--appbar)+8px)] md:mx-0 md:flex-col md:gap-0 md:overflow-visible md:rounded-2xl md:bg-white md:p-2 md:ring-1 md:ring-slate-200">
          {grup.map(([g, list]) => (
            <div key={g} className="contents md:block">
              <p className="hidden px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-ink-mute md:block">{g}</p>
              {list.map((t) => (
                <button key={t.value} type="button" onClick={() => { setTab(t.value); window.history.replaceState(null, '', `#/settings/${t.value}`) }} aria-current={tab === t.value ? 'page' : undefined} data-tab-pengaturan={t.value}
                  className={cx('flex h-9 shrink-0 items-center rounded-xl px-3 text-xs font-semibold ring-1 transition md:h-10 md:w-full md:rounded-lg md:text-left md:text-sm md:ring-0', tab === t.value ? 'bg-ink text-white ring-ink md:bg-brand-soft md:text-brand' : 'bg-white text-ink-soft ring-slate-200 hover:ring-brand md:text-ink md:hover:bg-slate-50')}>
                  {t.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="min-w-0 space-y-4">
      {tab === 'profil' && <Profile />}
      {tab === 'petty' && <Pindah ke="#/keuangan/petty" judul="Petty Cash sekarang ada di Keuangan" teks="Catat pengeluaran, lihat saldo, dan ajukan top up dari satu tempat: Keuangan → Petty Cash." tombol="Buka Keuangan → Petty Cash" />}
      {tab === 'people' && <People />}
      {tab === 'kurir' && <Couriers />}
      {tab === 'vendor' && <Pindah ke="#/vendor" judul="Data Vendor sekarang ada di Penjualan" teks="Daftar vendor, bahasa/layanan, termin, dan rekening dikelola di Penjualan → Vendor." tombol="Buka Penjualan → Vendor" />}
      {tab === 'users' && <Users />}
      {tab === 'file' && <><FileRules />{can.manageUsers(user) && <PortalSettings />}</>}
      {tab === 'integrasi' && <Integrations />}
      {tab === 'tampilan' && <LoginSettings />}
      {tab === 'beranda' && <SlideBerandaSettings />}
      {tab === 'apostille' && <AksesApostilleSettings />}
        </div>
      </div>
    </div>
  )
}

function FileRules() {
  const { data, save, notify } = useApp()
  const r = fileRulesOf(data)
  const row = (data.app_settings || []).find((x) => x.key === 'files')
  const set = async (patch) => { await save('app_settings', { ...(row || { key: 'files' }), ...r, ...patch }); notify('Pengaturan file disimpan') }
  const opt = (on) => cx('flex cursor-pointer gap-3 rounded-xl p-3 ring-1', on ? 'bg-brand-soft ring-brand' : 'bg-white ring-slate-200 hover:ring-brand')
  return (
    <Card className="space-y-4 p-5">
      <div><h2 className="font-bold">Penamaan File</h2><p className="text-sm text-ink-mute">Berlaku untuk semua role saat upload file project (File Project, tahap alur kerja, penerjemah, proofreader, otorisator). Sebelum upload, nama file selalu bisa diubah.</p></div>
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-mute">Bila nama file sudah ada di project</p>
        <label className={opt(r.dup_policy === 'suffix')}><input type="radio" name="dup" checked={r.dup_policy === 'suffix'} onChange={() => set({ dup_policy: 'suffix' })} />
          <span><b className="text-sm">Beri nomor otomatis</b><span className="block text-xs text-ink-mute">Contoh: Ijazah.pdf → Ijazah (2).pdf. Tetap bisa diubah sebelum upload.</span></span></label>
        <label className={opt(r.dup_policy === 'block')}><input type="radio" name="dup" checked={r.dup_policy === 'block'} onChange={() => set({ dup_policy: 'block' })} />
          <span><b className="text-sm">Wajib ganti nama</b><span className="block text-xs text-ink-mute">Upload ditahan sampai nama yang kembar diganti.</span></span></label>
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-white p-3 ring-1 ring-slate-200">
        <input type="checkbox" className="mt-1" checked={!!r.prefix_invoice} onChange={(e) => set({ prefix_invoice: e.target.checked })} />
        <span><b className="text-sm">Awali nama dengan no. invoice</b><span className="block text-xs text-ink-mute">Contoh: INV-000250_Ijazah.pdf — memudahkan pencarian di Google Drive.</span></span>
      </label>
      <p className="text-xs text-ink-mute">Ganti nama file yang sudah ada juga dicek: nama yang sudah dipakai dalam project yang sama ditolak.</p>
    </Card>
  )
}

/** Pengaturan portal pelanggan (#/cek) — berlaku untuk semua proyek. */
function PortalSettings() {
  const { data, save, notify } = useApp()
  const row = (data.app_settings || []).find((x) => x.key === 'portal')
  const [wa, setWa] = useState(row?.wa ?? '')
  useEffect(() => { setWa(row?.wa ?? '') }, [row?.wa])
  const simpan = async () => { await save('app_settings', { ...(row || { key: 'portal' }), wa: wa.trim() }); notify('Pengaturan portal disimpan') }
  return (
    <Card className="space-y-4 p-5">
      <div><h2 className="font-bold">Portal Pelanggan</h2><p className="text-sm text-ink-mute">Satu link umum yang dibagikan ke pelanggan: <code className="rounded bg-slate-100 px-1">{cekUrl()}</code> — pelanggan masuk dengan nomor HP, memilih invoice, lalu melihat progres & dokumennya. Akses tiap invoice diaktifkan per proyek (seksi “Akses Portal Pelanggan” di detail proyek) dan berlaku {ACCESS_DAYS} hari.</p></div>
      <Field label="Nomor WhatsApp admin" hint="Dipakai tombol “Hubungi Admin” di portal. Kosongkan bila belum ada — tombolnya tidak akan ditampilkan.">
        <Input value={wa} onChange={(e) => setWa(e.target.value)} placeholder="mis. 6281234567890" inputMode="tel" />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={simpan}>Simpan</Button>
        <Button size="sm" variant="outline" onClick={() => window.open(cekUrl(), '_blank', 'noopener')}>Buka Portal Pelanggan</Button>
        <Button size="sm" variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(cekUrl()); notify('Link portal disalin') } catch { notify('Gagal menyalin', 'err') } }}>Salin Link</Button>
      </div>
      <p className="text-xs text-ink-mute">Belum terhubung: pengiriman dokumen ke email pelanggan (butuh layanan email) dan status pelacakan otomatis dari kurir. Tombol “Lacak Kiriman” hanya muncul untuk kurir yang sudah diisi alamat lacaknya di menu Kurir.</p>
    </Card>
  )
}

function Profile() {
  const { user, signOut } = useApp()
  const SECTIONS = [['profil', 'Profil', UserRound], ['keamanan', 'Keamanan', ShieldCheck], ['preferensi', 'Preferensi', SlidersHorizontal]]
  const [sec, setSec] = useState('profil')
  return (
    <div className="space-y-3">
      <Card className="flex flex-wrap items-center gap-4 p-4">
        <Avatar user={user} size={52} />
        <div className="min-w-0">
          <p className="text-base font-bold">{user.display_name || user.name}</p>
          <p className="truncate text-sm text-ink-mute">{user.email}</p>
          <div className="mt-1 flex flex-wrap gap-1.5"><Pill className="bg-brand-soft text-brand">{roleLabel(user)}</Pill><Pill>{branchLabel(user)}</Pill></div>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => go('projects')}>Kembali ke Project</Button>
          <Button variant="outline" size="sm" onClick={signOut}>Keluar</Button>
        </div>
      </Card>

      {/* Navigasi bagian — satu halaman, tanpa modal per kolom */}
      <div className="flex flex-wrap gap-1.5">
        {SECTIONS.map(([k, label, Icon]) => (
          <button key={k} type="button" onClick={() => setSec(k)} aria-pressed={sec === k}
            className={cx('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition',
              sec === k ? 'bg-[var(--surface-3)] text-ink ring-[var(--line)]' : 'bg-white text-ink-mute ring-slate-200 hover:text-ink')}>
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>

      {sec === 'profil' && <ProfilData />}
      {sec === 'keamanan' && <Keamanan />}
      {sec === 'preferensi' && <Preferensi />}
    </div>
  )
}

const WORK_LANGS = ['Inggris', 'Mandarin', 'Jepang', 'Korea', 'Arab', 'Belanda', 'Jerman', 'Prancis', 'Spanyol', 'Rusia']

/** Data pribadi: yang boleh diubah sendiri vs yang dikunci admin. */
function ProfilData() {
  const { user, data, updateProfile, notify } = useApp()
  const row = data.users.find((u) => u.id === user.id) || user
  const [f, setF] = useState({ name: row.name || '', display_name: row.display_name || '', phone: row.phone || '', languages: row.languages || [] })
  const [busy, setBusy] = useState(false)
  const dirty = JSON.stringify(f) !== JSON.stringify({ name: row.name || '', display_name: row.display_name || '', phone: row.phone || '', languages: row.languages || [] })
  const isTr = ['penerjemah', 'proofreader'].includes(user.role) || (user.extra_roles || []).some((r) => ['penerjemah', 'proofreader'].includes(r))
  const save = async () => {
    if (!f.name.trim()) return notify('Nama lengkap wajib diisi', 'err')
    setBusy(true)
    try { await updateProfile({ ...f, name: f.name.trim(), display_name: f.display_name.trim(), phone: f.phone.trim() }); notify('Profil disimpan') }
    catch (e) { notify(e.message, 'err') } finally { setBusy(false) }
  }
  const toggleLang = (l) => setF((x) => ({ ...x, languages: x.languages.includes(l) ? x.languages.filter((y) => y !== l) : [...x.languages, l] }))

  return (
    <div className="space-y-3">
      <Card className="p-5"><AvatarEditor /></Card>

      <Card className="space-y-4 p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-mute">Data pribadi</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama lengkap" required><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></Field>
          <Field label="Nama tampilan" hint="Dipakai pada sapaan & daftar tugas. Kosongkan untuk memakai nama lengkap.">
            <Input value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} placeholder={f.name} autoComplete="nickname" />
          </Field>
          <Field label="No. telepon / WhatsApp"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" autoComplete="tel" placeholder="08xx…" /></Field>
          <Field label="Email akun" hint="Diubah lewat admin — email dipakai untuk login.">
            <Input value={user.email || ''} readOnly disabled tabIndex={-1} />
          </Field>
        </div>
        {isTr && (
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-ink-soft">Bahasa kerja</p>
            <div className="flex flex-wrap gap-1.5">
              {WORK_LANGS.map((l) => (
                <button key={l} type="button" onClick={() => toggleLang(l)} aria-pressed={f.languages.includes(l)}
                  className={cx('rounded-full px-2.5 py-1 text-xs font-semibold ring-1 transition', f.languages.includes(l) ? 'bg-brand-soft text-brand ring-brand/30' : 'bg-white text-ink-mute ring-slate-200 hover:text-ink')}>{l}</button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-ink-mute">Dipakai Direktur sebagai acuan saat membagi order. Penetapan tugas tetap di tangan Direktur.</p>
          </div>
        )}
        <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
          <Button size="sm" loading={busy} disabled={!dirty} onClick={save}>Simpan perubahan</Button>
          {dirty && <button type="button" onClick={() => setF({ name: row.name || '', display_name: row.display_name || '', phone: row.phone || '', languages: row.languages || [] })} className="text-xs font-semibold text-ink-mute hover:text-ink">Batalkan</button>}
        </div>
      </Card>

      <Card className="space-y-3 p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-mute">Data yang diatur admin</p>
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {[['Peran', roleLabel(user)], ['Cabang', branchLabel(user)], ['Status', user.active === false ? 'Nonaktif' : isFreelance(user) ? 'Freelance' : 'Aktif'],
            ['ID pegawai', user.id], ['Zona waktu', zonaPengguna(user).label]].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">{k}</p>
              <p className="truncate text-sm font-semibold text-ink">{v}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-ink-mute">Peran, hak akses, cabang, status kepegawaian, dan ID pegawai hanya bisa diubah Superadmin lewat Setting → Pengguna. Semua tenggat & notifikasi memakai zona waktu WITA.</p>
      </Card>
    </div>
  )
}

/** Keamanan: kata sandi + info kemampuan sistem (tanpa kontrol palsu). */
function Keamanan() {
  const { user } = useApp()
  return (
    <div className="space-y-3">
      <Card className="p-5">
        {db.updatePassword
          ? <GantiSandi />
          : (
            <>
              <p className="text-xs font-bold uppercase tracking-wide text-ink-mute">Kata sandi</p>
              <p className="mt-2 text-sm text-ink-soft">Di mode demo ini login memakai pilihan pengguna, bukan kata sandi — jadi tidak ada kata sandi untuk diganti. Pada aplikasi live, form ganti kata sandi muncul di sini.</p>
            </>
          )}
      </Card>
      <Card className="space-y-2 p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-mute">Email & pemulihan akun</p>
        <p className="text-sm text-ink-soft">Email akun <b>{user.email || '—'}</b> dipakai untuk login. Penggantian email dilakukan Superadmin lewat Setting → Pengguna agar akses tetap terjaga; lupa kata sandi ditangani lewat halaman login pada aplikasi live.</p>
      </Card>
      <Card className="space-y-2 p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-mute">Sesi & verifikasi dua langkah</p>
        <p className="text-sm text-ink-soft">Daftar perangkat yang sedang login dan verifikasi dua langkah belum tersedia di versi ini — akan muncul di sini kalau layanan autentikasinya sudah mendukung. Sementara itu, tombol <b>Keluar</b> di atas mengakhiri sesi di perangkat ini.</p>
      </Card>
    </div>
  )
}

/** Preferensi tampilan & notifikasi — tersambung ke pengaturan yang sudah ada. */
function Preferensi() {
  const { notify } = useApp()
  const [theme, setTheme] = useState(readTheme)
  const [density, setDensity] = useState(() => { try { return localStorage.getItem('atlas-density') || 'comfortable' } catch { return 'comfortable' } })
  const [sound, setSound] = useState(soundEnabled)
  const [chatOn, setChatOn] = useState(chatSoundEnabled)
  const [vol, setVol] = useState(chatVolume)
  const setT = (patch) => { const next = { ...theme, ...patch }; setTheme(next); applyTheme(next); try { localStorage.setItem('atlas-theme', JSON.stringify(next)) } catch { /* abaikan */ } }
  const setD = (v) => { setDensity(v); document.documentElement.dataset.density = v; try { localStorage.setItem('atlas-density', v) } catch { /* abaikan */ } }
  const chip = (on) => cx('rounded-xl px-3 py-2 text-xs font-semibold ring-1 transition', on ? 'bg-brand text-white ring-brand' : 'bg-white text-ink-soft ring-slate-200 hover:ring-brand')
  return (
    <div className="space-y-3">
      <Card className="space-y-4 p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-mute">Tampilan</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-ink-soft">Tema</p>
            <div className="flex gap-1.5">{[['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => <button key={v} type="button" onClick={() => setT({ mode: v })} aria-pressed={theme.mode === v} className={chip(theme.mode === v)}>{l}</button>)}</div>
          </div>
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-ink-soft">Kepadatan</p>
            <div className="flex gap-1.5">{[['comfortable', 'Comfortable'], ['compact', 'Compact']].map(([v, l]) => <button key={v} type="button" onClick={() => setD(v)} aria-pressed={density === v} className={chip(density === v)}>{l}</button>)}</div>
          </div>
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-ink-soft">Panel detail dari</p>
            <div className="flex gap-1.5">{[['right', 'Kanan'], ['left', 'Kiri']].map(([v, l]) => <button key={v} type="button" onClick={() => setT({ panel: v })} aria-pressed={(theme.panel || 'right') === v} className={chip((theme.panel || 'right') === v)}>{l}</button>)}</div>
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-ink-soft">Warna aksen</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {ACCENTS.map(([c, n]) => (
              <button key={c} type="button" onClick={() => setT({ accent: c })} title={n} aria-label={`Aksen ${n}`} aria-pressed={theme.accent === c}
                className="h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-[var(--surface)] transition hover:scale-110"
                style={{ backgroundColor: c, '--tw-ring-color': theme.accent === c ? c : 'transparent' }} />
            ))}
          </div>
          <label className="mt-2 flex w-fit cursor-pointer items-center gap-2 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-ink-soft ring-1 ring-slate-200 hover:ring-brand" title="Pilih warna bebas">
            <input type="color" value={theme.accent} onChange={(e) => setT({ accent: e.target.value })} aria-label="Warna aksen bebas" className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0" data-aksi="warna-bebas" />
            Warna lain… <span className="font-mono text-[11px] text-ink-mute">{theme.accent}</span>
          </label>
          <p className="mt-1.5 text-[11px] text-ink-mute">Tersimpan di perangkat ini saja — tidak mengubah tampilan pengguna lain. Pengaturan yang sama juga ada di ikon palet pada bar atas.</p>
        </div>
      </Card>

      <Card className="space-y-3 p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-mute">Notifikasi</p>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <input type="checkbox" checked={sound} onChange={(e) => { setSound(e.target.checked); setSoundEnabled(e.target.checked); notify(e.target.checked ? 'Suara notifikasi dinyalakan' : 'Suara notifikasi dimatikan') }} className="h-4 w-4 rounded border-slate-300 text-brand" />
          <span><span className="block text-sm font-semibold text-ink">Suara notifikasi</span><span className="block text-[11px] text-ink-mute">Bunyi saat pembayaran masuk, ping, dan permintaan penerjemah.</span></span>
        </label>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <input type="checkbox" checked={chatOn} onChange={(e) => { setChatOn(e.target.checked); setChatSoundEnabled(e.target.checked) }} className="h-4 w-4 rounded border-slate-300 text-brand" />
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ink">Suara chat</span>
            <span className="block text-[11px] text-ink-mute">Bunyi lembut saat ada pesan baru dari rekan; ping pakai nada berbeda.</span></span>
        </label>
        <label className={cx('flex items-center gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200', !chatOn && 'opacity-50')}>
          <span className="text-sm font-semibold text-ink">Volume chat</span>
          <input type="range" min="0" max="1" step="0.1" disabled={!chatOn} value={vol} onChange={(e) => { setVol(Number(e.target.value)); setChatVolume(Number(e.target.value)) }}
            aria-label="Volume suara chat" className="min-w-0 flex-1 accent-[var(--brand)]" />
          <span className="w-8 text-right text-xs tabular-nums text-ink-mute">{Math.round(vol * 100)}%</span>
        </label>
        <p className="text-[11px] text-ink-mute">Pesan di layar muncul satu per satu (tidak menumpuk), hilang sendiri dalam beberapa detik, dan bisa ditutup. Notifikasi kerja (tugas baru, pengajuan, revisi, perlu penerjemah) tetap tersimpan di ikon lonceng sesuai peran Anda. Email/WhatsApp belum tersambung di versi ini, jadi tidak ditampilkan sebagai pilihan.</p>
      </Card>

      <Availability />
    </div>
  )
}

/** Ketersediaan — khusus Direktur: tampil "Tersedia 24 jam" di Tim Aktif. */
function Availability() {
  const { user, data, updateProfile, notify } = useApp()
  const row = data.users.find((u) => u.id === user.id) || user
  const [busy, setBusy] = useState(false)
  if (user.role !== 'direktur') return null
  const toggle = async (on) => {
    setBusy(true)
    try { await updateProfile({ available_24h: on }); notify(on ? 'Ditandai tersedia 24 jam' : 'Tanda tersedia 24 jam dimatikan') }
    catch (e) { notify(e.message, 'err') } finally { setBusy(false) }
  }
  return (
    <Card className="space-y-3 p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-mute">Ketersediaan</p>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
        <input type="checkbox" disabled={busy} checked={row.available_24h !== false} onChange={(e) => toggle(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand" />
        <span>
          <span className="block text-sm font-semibold text-ink">Tampilkan "Tersedia 24 jam"</span>
          <span className="block text-[11px] text-ink-mute">Aktif secara bawaan: di daftar Tim Aktif Anda selalu berada di urutan pertama dan ditandai tersedia, meski tab ATLAS sedang tertutup — supaya tim tahu Anda bisa dihubungi untuk persetujuan mendesak. Matikan bila ingin status Anda mengikuti koneksi apa adanya.</span>
        </span>
      </label>
      <p className="text-[11px] text-ink-mute">Ini hanya penanda ketersediaan, bukan status koneksi: waktu aktif terakhir tetap ditampilkan apa adanya, dan sesi Anda tetap keluar otomatis setelah 3 jam tanpa aktivitas.</p>
    </Card>
  )
}

const OUT_CATS = ['ATK & Alat Kantor', 'Materai', 'Fotokopi / Print', 'Ongkir / Kurir', 'Transport', 'Konsumsi', 'Biaya Instansi', 'Lainnya']
const dk = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(d)
const shift = (key, n) => dk(new Date(new Date(`${key}T12:00:00+08:00`).getTime() + n * 864e5))

export function PettyCash({ intent, onIntentDone }) {
  const { user, data, save, notify, pettyBalance } = useApp()
  const branches = pettyAccountsOf(user)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ branch: APOSTILLE_FUND, amount: '', note: '', sumber: '', date: dk(new Date()) })
  const today = dk(new Date())
  const [out, setOut] = useState(null) // form pengeluaran
  const [up, setUp] = useState(false)
  const [acc, setAcc] = useState('Semua')
  const [range, setRange] = useState({ from: `${today.slice(0, 8)}01`, to: today })
  const dayOf = (r) => r.date || dk(new Date(r.created_at))
  const inAcc = data.petty_cash.filter((r) => branches.includes(r.branch) && (acc === 'Semua' || r.branch === acc))
  const rows = inAcc.filter((r) => (!range.from || dayOf(r) >= range.from) && (!range.to || dayOf(r) <= range.to)).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  const masuk = rows.filter((r) => r.type === 'in').reduce((a, r) => a + Number(r.amount), 0)
  const keluar = rows.filter((r) => r.type === 'out').reduce((a, r) => a + Number(r.amount), 0)
  const saldo = (acc === 'Semua' ? branches : [acc]).reduce((a, b) => a + pettyBalance(b), 0)
  const perCat = Object.entries(rows.filter((r) => r.type === 'out').reduce((m, r) => { const k = r.category || (r.project_id ? 'Biaya project' : 'Lainnya'); m[k] = (m[k] || 0) + Number(r.amount); return m }, {})).sort((a, b) => b[1] - a[1])
  const chip = (on) => cx('rounded-lg px-2.5 py-1 text-xs font-semibold ring-1', on ? 'bg-brand text-white ring-brand' : 'bg-white text-ink-soft ring-slate-200 hover:ring-brand')

  const topUp = async () => {
    if (!(Number(form.amount) > 0)) return notify('Nominal harus lebih dari 0', 'err')
    await save('petty_cash', { branch: form.branch, type: 'in', amount: Number(form.amount), note: form.note || 'Top up', sumber_dana: form.sumber || null, project_id: null, by: user.name, date: form.date || today })
    notify(`Top up ${rupiah(form.amount)} ke ${pettyLabel(form.branch)} tercatat`); setOpen(false); setForm({ ...form, amount: '', note: '' })
  }
  const openOut = () => setOut({ branch: acc !== 'Semua' ? acc : branches.find((b) => b !== APOSTILLE_FUND) || branches[0], amount: '', category: OUT_CATS[0], note: '', date: today, nota: null })
  const uploadNota = async (file) => {
    if (!file) return; setUp(true)
    try { const f = await drive.upload(file, { branch: 'Petty Cash', invoice: `NOTA-${out.branch}` }); setOut((o) => ({ ...o, nota: f })) } catch (e) { notify(e.message, 'err') }
    setUp(false)
  }
  const saveOut = async () => {
    const amt = Number(out.amount)
    if (!(amt > 0)) return notify('Nominal harus lebih dari 0', 'err')
    if (!out.note.trim()) return notify('Isi keterangan pengeluaran', 'err')
    if (!out.nota) return notify('Upload nota / struk dulu', 'err')
    if (amt > pettyBalance(out.branch)) return notify(`Saldo ${pettyLabel(out.branch)} tidak cukup (${rupiah(pettyBalance(out.branch))})`, 'err')
    await save('petty_cash', { branch: out.branch, type: 'out', amount: amt, category: out.category, note: out.note.trim(), nota: out.nota, date: out.date, project_id: null, by: user.name, by_id: user.id })
    notify(`Pengeluaran tercatat — sisa ${rupiah(pettyBalance(out.branch) - amt)}`); setOut(null)
  }
  const sisaSetelah = out ? pettyBalance(out.branch) - (Number(out.amount) || 0) : 0
  // Dibuka dari tombol + / "Top up" di Ringkasan: langsung buka formulirnya
  useEffect(() => {
    if (!intent) return
    if (intent.jenis === 'in') { setOpen(true); setForm((f) => ({ ...f, branch: intent.kas || f.branch, amount: intent.nominal ? String(intent.nominal) : f.amount, note: intent.kas ? `Top up ${pettyLabel(intent.kas)}` : f.note })) }
    else if (intent.jenis === 'out') openOut()
    onIntentDone?.()
  }, [intent]) // eslint-disable-line react-hooks/exhaustive-deps
  const kasUrut = [...branches].map((b) => ({ b, saldo: pettyBalance(b), batas: b === APOSTILLE_FUND ? 7_000_000 : 1_500_000, min: b === APOSTILLE_FUND ? 2_000_000 : 500_000 }))
    .sort((a, c) => ((a.saldo < a.min) - (c.saldo < c.min)) * -1 || (a.saldo / a.batas) - (c.saldo / c.batas))

  return (
    <div className="space-y-3">
      <SubTabs>
        <div className="-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
          <SubTabBtn on={range.from === `${today.slice(0, 8)}01` && range.to === today} onClick={() => setRange({ from: `${today.slice(0, 8)}01`, to: today })}>Bulan ini</SubTabBtn>
          <SubTabBtn on={range.from === shift(today, -6) && range.to === today} onClick={() => setRange({ from: shift(today, -6), to: today })}>7 hari</SubTabBtn>
          <SubTabBtn on={range.from === today && range.to === today} onClick={() => setRange({ from: today, to: today })}>Hari ini</SubTabBtn>
          <SubTabBtn on={!range.from && !range.to} onClick={() => setRange({ from: '', to: '' })}>Semua</SubTabBtn>
        </div>
        <span className="hidden items-center gap-1.5 text-xs text-ink-mute sm:flex">
          <Input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="!h-9 !w-36 !py-1 text-xs" aria-label="Dari tanggal" />–
          <Input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="!h-9 !w-36 !py-1 text-xs" aria-label="Sampai tanggal" />
        </span>
        <span className="inline-block w-auto"><Select value={acc} onChange={(e) => setAcc(e.target.value)} aria-label="Pilih kas" className="!h-9 !w-auto !py-0 text-xs">
          <option value="Semua">Semua kas</option>{branches.map((b) => <option key={b} value={b}>{pettyLabel(b)}</option>)}
        </Select></span>
      </SubTabs>

      {/* Saldo per kas sebagai bar terhadap batas (cabang 1,5 jt · Apostille 7 jt); yang menipis naik ke atas */}
      <Card className="overflow-hidden p-0" data-saldo-kas>
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
          <h2 className="flex-1 text-[13px] font-extrabold">Saldo per kas</h2>
          <span className="text-xs font-semibold text-ink-mute">urut: terendah</span>
        </div>
        <ul>
          {kasUrut.map(({ b, saldo, batas, min }, i) => {
            const menipis = saldo < min
            return (
              <li key={b}>
                <button type="button" onClick={() => setAcc(acc === b ? 'Semua' : b)} aria-pressed={acc === b} data-kas={b}
                  className={cx('flex min-h-[52px] w-full items-center gap-3 px-3 py-2 text-left', i > 0 && 'border-t border-slate-100', menipis ? 'bg-rose-50' : i % 2 ? 'bg-slate-50/70' : 'bg-white', acc === b && 'shadow-[inset_3px_0_0_theme(colors.brand.DEFAULT)]')}>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[13px] font-bold">{b === APOSTILLE_FUND ? 'Apostille (Direktur)' : b}{menipis && <span className="rounded-md bg-rose-100 px-1.5 py-px text-[9.5px] font-bold text-rose-700 ring-1 ring-rose-200">menipis</span>}</span>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-slate-200"><span className={cx('block h-full rounded-full', menipis ? 'bg-rose-500' : saldo < batas * 0.7 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${Math.min(100, (saldo / batas) * 100)}%` }} /></span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className={cx('block text-[13px] font-extrabold tabular-nums', menipis && 'text-rose-700')}>{rupiah(saldo)}</span>
                    <span className="block text-[10px] font-semibold text-ink-mute">{menipis ? `batas ${rupiah(min)}` : `dari ${rupiah(batas)}`}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </Card>

      {branches.length > 0 && <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-4 py-2.5">
          <p className="mr-1 text-sm font-bold">{acc === 'Semua' ? 'Semua kas' : pettyLabel(acc)}</p>
          <span className="text-xs text-ink-mute">{range.from || range.to ? `${range.from || '…'} – ${range.to || '…'}` : 'semua waktu'}</span>
          <span className="flex items-center gap-1.5 text-xs text-ink-mute sm:hidden">
            <Input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="!h-9 !w-32 !py-1 text-xs" aria-label="Dari tanggal" />–
            <Input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="!h-9 !w-32 !py-1 text-xs" aria-label="Sampai tanggal" />
          </span>
        </div>
        <div className="grid grid-cols-3 divide-x divide-slate-100 text-center">
          <div className="p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">Pemasukan</p><p className="text-lg font-extrabold text-emerald-600">+{rupiah(masuk)}</p></div>
          <div className="p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">Pengeluaran</p><p className="text-lg font-extrabold text-rose-600">−{rupiah(keluar)}</p></div>
          <div className="p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">Sisa saldo sekarang</p><p className={cx('text-lg font-extrabold', saldo < 500000 ? 'text-rose-600' : 'text-ink')}>{rupiah(saldo)}</p></div>
        </div>
        {perCat.length > 0 && <div className="flex flex-wrap gap-1.5 border-t border-slate-100 px-4 py-2.5 text-xs">
          <span className="font-semibold text-ink-mute">Pengeluaran per kategori:</span>
          {perCat.map(([k, v]) => <span key={k} className="rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-700 ring-1 ring-rose-100">{k} {rupiah(v)}</span>)}
        </div>}
      </Card>}

      <Card className="overflow-hidden p-0 lg:divide-y lg:divide-slate-100">
        {rows.length === 0 ? <Empty title="Belum ada mutasi pada rentang ini" /> : rows.map((r, i) => (
          <div key={r.id} className={cx('flex items-center gap-3 px-3 py-2.5 lg:px-4 lg:py-3', 'max-lg:mx-2.5 max-lg:my-2 max-lg:rounded-2xl max-lg:ring-1 max-lg:ring-slate-300', i % 2 ? 'bg-slate-100 lg:bg-slate-50/70' : 'bg-white')}>
            <div className={cx('rounded-xl p-2', r.type === 'in' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600')}>{r.type === 'in' ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{r.note}{r.category && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft">{r.category}</span>}</p><p className="text-[11px] text-ink-mute">{pettyLabel(r.branch)} · {r.by} · {r.date ? tglShort(r.date) : jam(r.created_at)}</p></div>
            {r.nota && <DownloadBukti file={r.nota} label="Nota" />}
            <p className={cx('text-sm font-bold', r.type === 'in' ? 'text-emerald-600' : 'text-rose-600')}>{r.type === 'in' ? '+' : '−'}{rupiah(r.amount)}</p>
          </div>
        ))}
      </Card>

      <Sheet open={open} onClose={() => setOpen(false)} title="Top Up Petty Cash"
        footer={<><Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Batal</Button><Button className="flex-1" onClick={topUp}>Simpan</Button></>}>
        <div className="space-y-3">
          <Field label="Kas"><Select value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}>{[APOSTILLE_FUND, ...BRANCHES].map((b) => <option key={b} value={b}>{pettyLabel(b)}</option>)}</Select></Field>
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800 ring-1 ring-emerald-200">Saldo saat ini <b>{rupiah(pettyBalance(form.branch))}</b>{Number(form.amount) > 0 && <> → setelah top up <b>{rupiah(pettyBalance(form.branch) + Number(form.amount))}</b></>}</p>
          <Field label="Nominal (Rp)" required hint={form.amount ? rupiah(form.amount) : undefined}><Input type="number" inputMode="numeric" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
          <div className="flex flex-wrap gap-1.5">{[500000, 1000000, 2000000, 5000000].map((n) => <button key={n} type="button" onClick={() => setForm({ ...form, amount: String(n) })} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-ink-soft ring-1 ring-slate-200 hover:ring-brand">{rupiah(n)}</button>)}</div>
          {/* Sumber dana hanya untuk yang memang memegang keuangan — staf cabang tidak perlu tahu
              uangnya keluar dari rekening mana. */}
          <div className={cx('grid gap-3', can.seeAllFinance(user) ? 'grid-cols-2' : 'grid-cols-1')}>
            {can.seeAllFinance(user) && (
              <Field label="Sumber dana"><Select value={form.sumber} onChange={(e) => setForm({ ...form, sumber: e.target.value })}><option value="">— pilih —</option>{SUMBER_DANA.map((d) => <option key={d.code} value={d.code}>{sumberLabel(d.code)}</option>)}</Select></Field>
            )}
            <Field label="Tanggal"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          </div>
          <Field label="Keterangan"><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Top up bulan November" /></Field>
        </div>
      </Sheet>

      <Sheet open={!!out} onClose={() => setOut(null)} title="Catat Pengeluaran / Dana Keluar"
        footer={<><Button variant="outline" className="flex-1" onClick={() => setOut(null)}>Batal</Button><Button className="flex-1" onClick={saveOut} disabled={up}>Simpan Pengeluaran</Button></>}>
        {out && <div className="space-y-3">
          <Field label="Dari kas"><Select value={out.branch} onChange={(e) => setOut({ ...out, branch: e.target.value })}>{branches.map((b) => <option key={b} value={b}>{pettyLabel(b)} · saldo {rupiah(pettyBalance(b))}</option>)}</Select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nominal (Rp)" required hint={out.amount ? rupiah(out.amount) : undefined}><Input type="number" inputMode="numeric" value={out.amount} onChange={(e) => setOut({ ...out, amount: e.target.value })} aria-label="Nominal pengeluaran" /></Field>
            <Field label="Tanggal"><Input type="date" value={out.date} max={today} onChange={(e) => setOut({ ...out, date: e.target.value })} /></Field>
          </div>
          <Field label="Kategori"><Select value={out.category} onChange={(e) => setOut({ ...out, category: e.target.value })} aria-label="Kategori pengeluaran">{OUT_CATS.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Keterangan" required><Input value={out.note} onChange={(e) => setOut({ ...out, note: e.target.value })} placeholder="Beli materai 10 lembar" aria-label="Keterangan pengeluaran" /></Field>
          <Field label="Nota / struk" required hint={up ? 'Mengunggah…' : out.nota ? `✓ ${out.nota.name}` : 'Foto atau PDF nota'}>
            <Input type="file" accept="image/*,application/pdf" capture="environment" onChange={(e) => uploadNota(e.target.files?.[0])} aria-label="Upload nota" />
          </Field>
          <div className={cx('flex items-center justify-between rounded-xl px-3 py-2.5 text-sm ring-1', sisaSetelah < 0 ? 'bg-rose-50 ring-rose-200' : 'bg-slate-50 ring-slate-200')}>
            <span className="text-ink-soft">Saldo {rupiah(pettyBalance(out.branch))} → sisa setelah pengeluaran</span>
            <b className={sisaSetelah < 0 ? 'text-rose-600' : 'text-ink'}>{rupiah(sisaSetelah)}</b>
          </div>
        </div>}
      </Sheet>
    </div>
  )
}

/**
 * Daftar data + formulir tambah/edit.
 *
 * Dua tampilan:
 *  - bawaan  : kartu per baris (dipakai Master Data & Kurir).
 *  - kolom[] : tabel kompak satu baris satu data, lengkap dengan pencarian,
 *              filter, dan pengurutan lewat klik judul kolom.
 * Pencarian, filter, dan urutan TIDAK hilang saat pop-up edit dibuka/ditutup,
 * karena keadaannya disimpan di komponen ini, bukan di dalam pop-up.
 */
function CrudList({ table, rows, columns, empty, blank, renderForm, title, prepare, wide, kolom, filter, cariLabel, aksiBaris, keAtas }) {
  const { save, remove, notify, ask } = useApp()
  const [edit, setEdit] = useState(null)
  const [pilihFilter, setPilihFilter] = useState({})
  const submit = async () => {
    try { await save(table, prepare ? prepare(edit) : edit); notify('Tersimpan'); setEdit(null) } catch (e) { notify(e.message, 'err') }
  }

  const tersaring = useMemo(() => {
    if (!filter?.length) return rows
    return rows.filter((r) => filter.every((f) => !pilihFilter[f.key] || f.cocok(r, pilihFilter[f.key])))
  }, [rows, filter, pilihFilter])
  const { rows: baris, sortKey, sortDir, klikJudul, cari, setCari } = useTabel(tersaring, kolom || [])

  const hapus = async (r) => { if (await ask('Hapus data ini?')) { await remove(table, r.id); notify('Dihapus') } }

  return (
    <div className="space-y-3">
      {kolom ? (
        <>
          {/* Toolbar: tambah · cari · filter — tinggi kontrol 34px */}
          <div className="flex flex-wrap items-center gap-2">
            {keAtas ? <KeAtas slot="tambah"><TombolTambah label={title} onClick={() => setEdit(blank())} /></KeAtas> : <Button onClick={() => setEdit(blank())}><Plus className="h-4 w-4" />Tambah {title}</Button>}
            <CariTabel atas={keAtas} value={cari} onChange={setCari} label={cariLabel || `Cari ${title.toLowerCase()}`} className="basis-56" />
            {(filter || []).map((f) => (
              <select key={f.key} value={pilihFilter[f.key] || ''} aria-label={f.aria || f.label}
                onChange={(e) => setPilihFilter((v) => ({ ...v, [f.key]: e.target.value }))}
                className="h-[34px] w-auto max-w-full rounded-lg border-0 bg-white pl-2.5 pr-7 text-[13px] font-semibold text-ink ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-brand">
                <option value="">{f.label}</option>
                {f.opsi(rows).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ))}
            <span className="ml-auto text-[11px] text-ink-mute">{baris.length} dari {rows.length}</span>
          </div>
          {baris.length === 0 ? <Card><Empty title={rows.length ? 'Tidak ada data yang cocok' : empty} /></Card> : (
            <Card className="overflow-hidden">
              <div className="min-w-0 max-w-full overflow-x-auto">
                <table className="tbl-rapat" style={{ minWidth: `${kolom.length * 110 + 110}px` }}>
                  <thead>
                    <tr>
                      {kolom.map((c) => <Th key={c.key} kolom={c} sortKey={sortKey} sortDir={sortDir} onKlik={klikJudul} />)}
                      <th style={{ width: aksiBaris ? '190px' : '96px' }} className="text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {baris.map((r) => (
                      <tr key={r.id}>
                        {kolom.map((c) => <td key={c.key} className={c.num ? 'num' : undefined}>{c.sel(r)}</td>)}
                        <td>
                          <span className="flex items-center justify-end gap-1.5">
                          {aksiBaris && aksiBaris(r)}
                          <span className="aksi">
                            <button onClick={() => setEdit(r)} title={`Edit ${title.toLowerCase()}`} aria-label={`Edit ${r.name || r.layanan || title}`}
                              className="text-ink-mute hover:bg-slate-100 hover:text-ink"><Pencil className="h-4 w-4" /></button>
                            <button onClick={() => hapus(r)} title={`Hapus ${title.toLowerCase()}`} aria-label={`Hapus ${r.name || r.layanan || title}`}
                              className="text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                          </span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      ) : (
        <>
      <Button onClick={() => setEdit(blank())}><Plus className="h-4 w-4" />Tambah {title}</Button>
      <Card className="divide-y divide-slate-100">
        {rows.length === 0 ? <Empty title={empty} /> : rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">{columns(r)}</div>
            <button onClick={() => setEdit(r)} className="rounded-lg p-2 text-ink-mute hover:bg-slate-100" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
            <button onClick={() => hapus(r)} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50" aria-label="Hapus"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </Card>
        </>
      )}
      <Sheet open={!!edit} wide={wide} onClose={() => setEdit(null)} title={edit?.id ? `Edit ${title}` : `Tambah ${title}`}
        footer={<><Button variant="outline" className="flex-1" onClick={() => setEdit(null)}>Batal</Button><Button className="flex-1" onClick={submit}>Simpan</Button></>}>
        {edit && renderForm(edit, setEdit)}
      </Sheet>
    </div>
  )
}

function People() {
  const { user, data } = useApp()
  const [type, setType] = useState('lembaga')
  const rows = data.people.filter((p) => p.type === type && (can.seeAllBranches(user) || p.branch === user.branch || p.branch === 'Semua'))
  return (
    <div className="space-y-3">
      <Tabs tabs={Object.entries(PERSON_TYPES).filter(([k]) => k !== 'vendor').map(([k, l]) => ({ value: k, label: l, count: data.people.filter((p) => p.type === k).length }))} value={type} onChange={setType} />
      <CrudList table="people" rows={rows} title={PERSON_TYPES[type]} empty={`Belum ada ${PERSON_TYPES[type]}`}
        blank={() => ({ name: '', type, branch: can.seeAllBranches(user) ? 'Semua' : user.branch, phone: '', note: '' })}
        columns={(r) => <><p className="text-sm font-semibold">{r.name}</p><p className="text-[11px] text-ink-mute">{r.branch === 'Semua' ? 'Semua cabang' : r.branch}{r.phone && ` · ${r.phone}`}</p>{r.note && <p className="mt-0.5 line-clamp-2 text-[11px] text-amber-800">{r.note}</p>}</>}
        renderForm={(e, set) => (
          <div className="space-y-3">
            <Field label="Nama" required><Input value={e.name} onChange={(x) => set({ ...e, name: x.target.value })} /></Field>
            <Field label="Jenis"><Select value={e.type} onChange={(x) => set({ ...e, type: x.target.value })}>{Object.entries(PERSON_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
            <Field label="Cabang"><Select value={e.branch} disabled={!can.seeAllBranches(user)} onChange={(x) => set({ ...e, branch: x.target.value })}>{['Semua', ...BRANCHES].map((b) => <option key={b}>{b}</option>)}</Select></Field>
            <Field label="Kontak / No. Rekening / Alamat"><Input value={e.phone} onChange={(x) => set({ ...e, phone: x.target.value })} /></Field>
            <Field label="Catatan / persyaratan" hint="Muncul sebagai catatan kecil saat lembaga ini dipilih di sub project">
              <textarea value={e.note || ''} onChange={(x) => set({ ...e, note: x.target.value })} rows={3}
                placeholder="mis. Wajib lampirkan fotokopi KTP pemohon dan surat kuasa bermaterai."
                className="w-full max-w-full rounded-xl border-0 bg-white px-3 py-2 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-brand" />
            </Field>
          </div>
        )} />
    </div>
  )
}

function Couriers() {
  const { data, notify } = useApp()
  const rows = [...(data.couriers || [])].sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
  const onLogo = (e, set, file) => {
    if (!file) return
    if (file.size > 300e3) return notify('Logo maks. 300 KB', 'err')
    const fr = new FileReader(); fr.onload = () => set({ ...e, logo: fr.result }); fr.readAsDataURL(file)
  }
  return (
    <CrudList table="couriers" rows={rows} title="Kurir" empty="Belum ada kurir"
      blank={() => ({ name: '', type: 'courier', icon: 'truck', color: '#1f4fd1', logo: '', order: rows.length + 1 })}
      columns={(r) => (
        <div className="flex items-center gap-3"><CourierLogo c={r} />
          <div className="min-w-0"><p className="text-sm font-semibold">{r.name}</p><p className="text-[11px] text-ink-mute">{COURIER_TYPES[r.type]} · urutan {r.order ?? '—'}</p></div></div>
      )}
      renderForm={(e, set) => (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><CourierLogo c={e} /><span className="text-sm font-semibold">{e.name || 'Pratinjau'}</span></div>
          <Field label="Nama" required><Input value={e.name} onChange={(x) => set({ ...e, name: x.target.value })} placeholder="mis. SiCepat" /></Field>
          <Field label="Jenis"><Select value={e.type} onChange={(x) => set({ ...e, type: x.target.value })}>{Object.entries(COURIER_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
          <Field label="Ikon" hint="Dipakai bila tidak ada logo">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(COURIER_ICONS).map(([k, Icon]) => (
                <button key={k} type="button" onClick={() => set({ ...e, icon: k })} aria-label={k}
                  className={cx('grid h-9 w-9 place-items-center rounded-lg ring-1', e.icon === k ? 'bg-ink text-white ring-ink' : 'bg-white text-ink-soft ring-slate-200')}><Icon className="h-4 w-4" /></button>
              ))}
              <input type="color" value={e.color || '#64748b'} onChange={(x) => set({ ...e, color: x.target.value })} className="h-9 w-12 cursor-pointer rounded-lg border-0 bg-white p-1 ring-1 ring-slate-200" aria-label="Warna ikon" />
            </div>
          </Field>
          <Field label="Logo (opsional)" hint="PNG/JPG/SVG maks. 300 KB">
            <div className="flex items-center gap-2">
              <input type="file" accept="image/*" onChange={(x) => onLogo(e, set, x.target.files?.[0])} className="text-xs" />
              {e.logo && <button type="button" onClick={() => set({ ...e, logo: '' })} className="text-xs font-semibold text-rose-500">Hapus logo</button>}
            </div>
          </Field>
          <Field label="Urutan tampil"><Input type="number" value={e.order ?? ''} onChange={(x) => set({ ...e, order: Number(x.target.value) })} /></Field>
        </div>
      )} />
  )
}

export function Vendors({ keAtas } = {}) {
  const { data } = useApp()
  const rows = data.people.filter((p) => p.type === 'vendor')
  const listEdit = (e, set, key, blank) => {
    const arr = e[key] || []
    return {
      arr,
      add: () => set({ ...e, [key]: [...arr, blank] }),
      upd: (i, patch) => set({ ...e, [key]: arr.map((x, j) => (j === i ? { ...x, ...patch } : x)) }),
      del: (i) => set({ ...e, [key]: arr.filter((_, j) => j !== i) }),
    }
  }
  const KOLOM_VENDOR_SET = [
    { key: 'nama', label: 'Vendor', sort: (r) => String(r.name || '').toLowerCase(),
      sel: (r) => <span className="font-semibold text-ink">{r.name}</span> },
    { key: 'bahasa', label: 'Bahasa / Layanan', sort: (r) => (r.languages || []).join(', ').toLowerCase(),
      cari: (r) => `${(r.languages || []).join(' ')} ${(r.services || []).map((x) => x.name).join(' ')}`,
      sel: (r) => <span className="text-ink-soft">{r.languages?.length ? r.languages.join(', ') : '—'}</span> },
    { key: 'kontak', label: 'Kontak', sort: (r) => `${r.contact || ''} ${r.phone || ''}`.toLowerCase(),
      sel: (r) => <span className="text-ink-soft">{[r.contact, r.phone].filter(Boolean).join(' · ') || '—'}</span> },
    { key: 'termin', label: 'Termin', sort: (r) => PAYMENT_TERMS[termOf(r)].short,
      sel: (r) => <span className="font-semibold text-violet-700">{PAYMENT_TERMS[termOf(r)].short}</span> },
    { key: 'layanan', label: 'Layanan', num: true, sort: (r) => (r.services || []).length,
      sel: (r) => (r.services || []).length },
    { key: 'rek', label: 'Rekening', num: true, sort: (r) => (r.accounts || []).length,
      sel: (r) => (r.accounts || []).length },
  ]
  const FILTER_VENDOR = [
    { key: 'bahasa', label: 'Semua bahasa', aria: 'Filter bahasa',
      opsi: (rs) => [...new Set(rs.flatMap((r) => r.languages || []))].sort((a, b) => a.localeCompare(b, 'id')),
      cocok: (r, v) => (r.languages || []).includes(v) },
    { key: 'termin', label: 'Semua termin', aria: 'Filter termin',
      opsi: (rs) => [...new Set(rs.map((r) => PAYMENT_TERMS[termOf(r)].short))].sort(),
      cocok: (r, v) => PAYMENT_TERMS[termOf(r)].short === v },
  ]
  return (
    <CrudList table="people" rows={rows} title="Vendor" empty="Belum ada vendor" wide keAtas={keAtas}
      kolom={KOLOM_VENDOR_SET} filter={FILTER_VENDOR} cariLabel="Cari vendor, bahasa, layanan…"
      prepare={(e) => ({
        ...e,
        services: (e.services || []).filter((x) => x.name.trim()).map((x) => ({ name: x.name.trim(), price: Number(x.price) || 0 })),
        accounts: (e.accounts || []).filter((x) => x.bank.trim() || x.number.trim()),
      })}
      blank={() => ({ name: '', type: 'vendor', branch: 'Semua', address: '', contact: '', phone: '', services: [{ name: '', price: '' }], accounts: [{ bank: '', number: '', holder: '' }], notes: '' })}
      columns={(r) => (
        <>
          <p className="text-sm font-semibold">{r.name}</p>
          <p className="text-[11px] text-ink-mute">{[r.languages?.length ? `Bahasa ${r.languages.join(', ')}` : '', r.contact, r.phone].filter(Boolean).join(' · ') || '—'} · <b className="text-violet-700">{PAYMENT_TERMS[termOf(r)].short}</b> · {(r.services || []).length} layanan · {(r.accounts || []).length} rekening</p>
        </>
      )}
      renderForm={(e, set) => {
        const sv = listEdit(e, set, 'services', { name: '', price: '' })
        const ac = listEdit(e, set, 'accounts', { bank: '', number: '', holder: '' })
        const H = ({ icon: I, children }) => <p className="flex items-center gap-1.5 border-b border-slate-100 pb-1.5 text-sm font-bold text-ink"><I className="h-4 w-4 text-brand" />{children}</p>
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <H icon={Store}>Identitas Vendor</H>
              <Field label="Nama Vendor" required><Input value={e.name} onChange={(x) => set({ ...e, name: x.target.value })} /></Field>
              <Field label="Alamat" icon={MapPin}><Input value={e.address || ''} onChange={(x) => set({ ...e, address: x.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Kontak (nama PIC)"><Input value={e.contact || ''} onChange={(x) => set({ ...e, contact: x.target.value })} /></Field>
                <Field label="No. HP" icon={Phone}><Input value={e.phone || ''} onChange={(x) => set({ ...e, phone: x.target.value })} /></Field>
              </div>
              <Field label="Termin pembayaran" hint={termOf(e) === 'immediate' ? 'CS mengajukan → Direktur ACC → Akunting langsung bayar per order.' : 'Order dicatat tanpa langsung dibayar; biaya dikumpulkan di Tagihan Vendor lalu dibayar sekaligus.'}>
                <Select value={termOf(e)} onChange={(x) => set({ ...e, payment_term: x.target.value })}>{Object.entries(PAYMENT_TERMS).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}</Select>
              </Field>
            </div>
            <div className="space-y-2">
              <H icon={Tags}>Layanan & Tarif</H>
              {sv.arr.map((x, i) => (
                <div key={i} className="grid grid-cols-[1fr_120px_auto] items-center gap-2">
                  <Input placeholder="Nama layanan, mis. Terjemahan JP–ID /dok" value={x.name} onChange={(ev) => sv.upd(i, { name: ev.target.value })} aria-label={`Layanan ${i + 1}`} />
                  <Input type="number" inputMode="numeric" placeholder="Tarif (Rp)" value={x.price} onChange={(ev) => sv.upd(i, { price: ev.target.value })} aria-label={`Tarif layanan ${i + 1}`} />
                  <button type="button" onClick={() => sv.del(i)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Hapus layanan"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={sv.add}><Plus className="h-3.5 w-3.5" />Tambah Layanan</Button>
            </div>
            <div className="space-y-2">
              <H icon={Landmark}>Rekening Penerima</H>
              <p className="-mt-1 text-xs text-ink-mute">Rekening <b>pertama</b> dipakai sebagai rekening penerima saat pembayaran.</p>
              {ac.arr.map((x, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 sm:grid-cols-[110px_1fr_1fr_auto]">
                  <Input placeholder="Bank" value={x.bank} onChange={(ev) => ac.upd(i, { bank: ev.target.value })} aria-label={`Bank ${i + 1}`} />
                  <Input placeholder="No. rekening" value={x.number} onChange={(ev) => ac.upd(i, { number: ev.target.value })} aria-label={`No rekening ${i + 1}`} />
                  <Input className="col-span-2 sm:col-span-1" placeholder="Nama pemilik" value={x.holder} onChange={(ev) => ac.upd(i, { holder: ev.target.value })} aria-label={`Pemilik rekening ${i + 1}`} />
                  <button type="button" onClick={() => ac.del(i)} className="row-start-1 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 col-start-3 sm:col-start-4" aria-label="Hapus rekening"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={ac.add}><Plus className="h-3.5 w-3.5" />Tambah Rekening</Button>
            </div>
            <div className="space-y-2">
              <H icon={StickyNote}>Catatan Tambahan</H>
              <Textarea value={e.notes || ''} onChange={(x) => set({ ...e, notes: x.target.value })} placeholder="Ketentuan vendor, jam operasional, termin pembayaran, dll." />
            </div>
          </div>
        )
      }} />
  )
}

/** Superadmin menetapkan kata sandi pengguna lain (dikerjakan di server). */
function SandiPengguna({ e, bukaAwal = false }) {
  const { user, notify } = useApp()
  const [buka, setBuka] = useState(bukaAwal)
  const [sandi, setSandi] = useState('')
  const [lihat, setLihat] = useState(false)
  const [busy, setBusy] = useState(false)
  if (user.role !== 'superadmin' || !e.email) return null

  const acak = () => {
    const huruf = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const n = new Uint32Array(12); crypto.getRandomValues(n)
    setSandi([...n].map((x) => huruf[x % huruf.length]).join(''))
    setLihat(true)
  }
  const simpan = async () => {
    setBusy(true)
    try {
      if (!db.setUserPassword) throw new Error('Fitur ini hanya tersedia di mode Supabase.')
      const r = await db.setUserPassword(e.email, sandi)
      notify(r.demo ? 'Mode demo — kata sandi tidak benar-benar disimpan'
        : r.dibuat ? `Akun login ${r.nama} dibuat & kata sandi ditetapkan`
        : `Kata sandi ${r.nama} berhasil diganti`)
      setSandi(''); setLihat(false); setBuka(false)
    } catch (err) { notify(err.message, 'err') } finally { setBusy(false) }
  }

  return (
    <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      {!buka ? (
        <button type="button" onClick={() => setBuka(true)}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand hover:underline">
          <ShieldCheck className="h-4 w-4" />Atur kata sandi pengguna ini
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-[13px] font-bold text-ink">Atur kata sandi — {e.name || e.email}</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="relative min-w-0 flex-1 basis-48">
              <Input type={lihat ? 'text' : 'password'} value={sandi} onChange={(x) => setSandi(x.target.value)}
                placeholder="Minimal 8 karakter" autoComplete="new-password" aria-label="Kata sandi baru" className="pr-10" />
              <button type="button" onClick={() => setLihat((v) => !v)} aria-label={lihat ? 'Sembunyikan' : 'Tampilkan'}
                className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink-mute hover:bg-white">
                {lihat ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </span>
            <Button type="button" size="sm" variant="outline" onClick={acak}>Acak</Button>
            <Button type="button" size="sm" aria-label="Simpan kata sandi pengguna" loading={busy} disabled={sandi.length < 8} onClick={simpan}>Simpan</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setBuka(false); setSandi(''); setLihat(false) }}>Batal</Button>
          </div>
          <p className="text-[11px] text-ink-mute">
            Kata sandi langsung berlaku. Sampaikan ke orangnya lewat jalur pribadi, bukan grup, dan minta diganti setelah berhasil masuk.
            Kalau akun login-nya belum ada, akan dibuatkan sekalian.
          </p>
        </div>
      )}
    </div>
  )
}

function Users() {
  const { data, user } = useApp()
  const [sandiUntuk, setSandiUntuk] = useState(null)
  const KOLOM_USER = [
    { key: 'nama', label: 'Nama', sort: (r) => String(r.name || '').toLowerCase(),
      sel: (r) => <><span className={cx('block text-sm font-semibold', r.active === false && 'text-ink-mute line-through')}>{r.name}</span><span className="block truncate text-[11px] text-ink-mute">{r.email}</span></> },
    { key: 'role', label: 'Role', sort: (r) => roleLabel(r).toLowerCase(), sel: (r) => <span className="text-sm">{roleLabel(r)}{(r.extra_roles || []).length ? <span className="text-ink-mute"> +{r.extra_roles.length}</span> : null}</span> },
    { key: 'cabang', label: 'Cabang', sort: (r) => String(isFreelance(r) ? 'zz' : r.branch || '').toLowerCase(), sel: (r) => <span className="text-sm">{isFreelance(r) ? 'Freelance' : [r.branch, ...(r.branches || [])].filter(Boolean).join(', ')}</span> },
    { key: 'status', label: 'Status', sort: (r) => (r.active === false ? 1 : 0), sel: (r) => <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1', r.active === false ? 'bg-slate-100 text-ink-mute ring-slate-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200')}>{r.active === false ? 'Nonaktif' : 'Aktif'}</span> },
  ]
  const FILTER_USER = [
    { key: 'role', label: 'Semua role', aria: 'Filter role', opsi: (rows) => [...new Set(rows.map((r) => roleLabel(r)))].sort(), cocok: (r, v) => roleLabel(r) === v },
    { key: 'cabang', label: 'Semua cabang', aria: 'Filter cabang', opsi: (rows) => [...new Set(rows.map((r) => (isFreelance(r) ? 'Freelance' : r.branch)).filter(Boolean))].sort(), cocok: (r, v) => (isFreelance(r) ? 'Freelance' : r.branch) === v },
    { key: 'aktif', label: 'Aktif & nonaktif', aria: 'Filter status', opsi: () => ['Aktif', 'Nonaktif'], cocok: (r, v) => (v === 'Aktif' ? r.active !== false : r.active === false) },
  ]
  return (
    <>
    <CrudList table="users" rows={data.users} title="Pengguna" empty="Belum ada pengguna" kolom={KOLOM_USER} filter={FILTER_USER} cariLabel="Cari nama / email…"
      aksiBaris={user.role === 'superadmin' ? (r) => (
        <button type="button" onClick={() => setSandiUntuk(r)} title="Atur kata sandi" data-aksi="atur-sandi"
          className="inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-lg px-2 text-[11px] font-semibold text-brand ring-1 ring-brand/30 hover:bg-brand hover:text-white"><ShieldCheck className="h-3.5 w-3.5" />Atur sandi</button>
      ) : undefined}
      blank={() => ({ name: '', email: '', role: 'cs', branch: BRANCHES[0], active: true })}
      renderForm={(e, set) => (
        <div className="space-y-3">
          <Field label="Nama" required><Input value={e.name} onChange={(x) => set({ ...e, name: x.target.value })} /></Field>
          <Field label="Email" required hint={MODE === 'supabase' ? 'Pengguna membuat kata sandinya sendiri lewat "Pertama kali? Buat kata sandi" di halaman masuk dengan email ini.' : MODE === 'live' ? 'Buat juga akun login dengan email yang sama di InsForge → Auth.' : undefined}><Input type="email" value={e.email} onChange={(x) => set({ ...e, email: x.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Role"><Select value={e.role} onChange={(x) => { const n = { ...e, role: x.target.value }; set(isFreelance(n) ? { ...n, branch: '', branches: [] } : { ...n, branch: n.branch || BRANCHES[0] }) }}>{Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}</Select></Field>
            {isFreelance(e)
              ? <Field label="Cabang"><p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-ink-soft ring-1 ring-slate-200">Freelance — tanpa cabang</p></Field>
              : <Field label="Cabang utama"><Select value={e.branch} onChange={(x) => set({ ...e, branch: x.target.value })}>{BRANCHES.map((b) => <option key={b}>{b}</option>)}</Select></Field>}
          </div>
          {isFreelance(e) && <p className="-mt-1 text-[11px] text-ink-mute">Penerjemah, Proofreader & Otorisator bekerja freelance dari mana saja — menerima tugas dari semua cabang.</p>}
          {!isFreelance(e) && !['superadmin', 'admin_pusat', 'supervisor', 'direktur', 'akunting'].includes(e.role) && (
            <Field label="Akses cabang tambahan" hint="Untuk CS multi cabang / backup — centang cabang lain yang boleh diakses.">
              <div className="flex flex-wrap gap-1.5">
                {BRANCHES.filter((b) => b !== e.branch).map((b) => {
                  const on = (e.branches || []).includes(b)
                  return (
                    <label key={b} className={cx('cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold ring-1', on ? 'bg-brand text-white ring-brand' : 'bg-white text-ink-soft ring-slate-300 hover:ring-brand')}>
                      <input type="checkbox" className="sr-only" checked={on} onChange={() => set({ ...e, branches: on ? e.branches.filter((x) => x !== b) : [...(e.branches || []), b] })} />{b}
                    </label>
                  )
                })}
              </div>
            </Field>
          )}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={e.active !== false} onChange={(x) => set({ ...e, active: x.target.checked })} />Aktif</label>
          {user.role === 'superadmin' && (
            <Field label="Jabatan tersembunyi — boleh bertindak sebagai" hint="Hanya Superadmin yang melihat pengaturan ini. Saat dipilih lewat 'Ganti peran', semua riwayat, ping, dan klaim tercatat atas nama akun persona itu — tim tidak melihat siapa yang sebenarnya login. Perpindahannya tercatat di log audit (Superadmin saja).">
              <div className="flex flex-wrap gap-1.5">
                {data.users.filter((u) => u.id !== e.id && u.active !== false && ['supervisor', 'direktur', 'admin_pusat', 'akunting'].includes(u.role)).map((u) => {
                  const on = (e.act_as || []).includes(u.id)
                  return (
                    <label key={u.id} className={cx('cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold ring-1', on ? 'bg-ink text-white ring-ink' : 'bg-white text-ink-soft ring-slate-300 hover:ring-brand')}>
                      <input type="checkbox" className="sr-only" checked={on} onChange={() => set({ ...e, act_as: on ? (e.act_as || []).filter((x) => x !== u.id) : [...(e.act_as || []), u.id] })} />{u.name} · {roleLabel(u)}
                    </label>
                  )
                })}
              </div>
              <label className="mt-2 flex items-center gap-2 text-xs text-ink-soft"><input type="checkbox" checked={!!e.persona} onChange={(x) => set({ ...e, persona: x.target.checked })} />Akun ini adalah <b>persona</b> (nama jabatan tanpa login sendiri)</label>
            </Field>
          )}
          <SandiPengguna e={e} />
        </div>
      )} />
      <Sheet open={!!sandiUntuk} onClose={() => setSandiUntuk(null)} title={`Atur kata sandi — ${sandiUntuk?.name || ''}`}>
        {sandiUntuk && <SandiPengguna e={sandiUntuk} bukaAwal />}
      </Sheet>
    </>
  )
}

function Integrations() {
  const { refresh, notify, ask, data, save, liveStatus } = useApp()
  const live = MODE !== 'demo'
  const demoRow = (data.app_settings || []).find((r) => r.key === 'demo')
  const perfOn = demoRow?.perf !== false
  const togglePerf = async () => { await save('app_settings', { ...(demoRow || { key: 'demo' }), perf: !perfOn }); await refresh(); notify(!perfOn ? 'Tugas contoh harian dinyalakan' : 'Tugas contoh harian dimatikan & dihapus') }
  const items = MODE === 'supabase' ? [
    { name: 'Supabase', desc: `Login, role, database (semua tabel), realtime & penyimpanan file (bucket files) · Realtime: ${liveStatus === 'SUBSCRIBED' ? 'tersambung ✅' : liveStatus === 'POLLING' ? 'cadangan polling tiap 20 dtk ⏱' : liveStatus ? `tidak tersambung (${liveStatus}) — pakai polling` : 'menyambung…'}`, env: 'VITE_SUPABASE_URL, VITE_SUPABASE_KEY' },
    { name: 'GitHub Pages', desc: 'Hosting aplikasi — deploy otomatis dari GitHub (branch main)', env: 'Workflow .github/workflows/deploy-pages.yml' },
    { name: 'Zoho Books', desc: 'Salinan pelanggan, invoice & item disinkron otomatis tiap 10 menit (Edge Function zoho-sync + pg_cron)', env: 'zoho_config (rahasia di database)' },
  ] : [
    { name: 'InsForge', desc: 'Login, role & database (users, people, projects, petty_cash)', env: 'VITE_INSFORGE_URL, VITE_INSFORGE_ANON_KEY' },
    { name: 'Zoho Books', desc: 'Cari pelanggan & tarik nomor invoice — via /api/zoho', env: 'ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_ORG_ID' },
    { name: 'Google Drive', desc: 'Penyimpanan file: ATLAS / Cabang / No. Invoice — via /api/drive', env: 'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_DRIVE_ROOT_FOLDER_ID' },
    { name: 'Vercel', desc: 'Hosting frontend + serverless functions', env: 'Environment Variables di dashboard Vercel' },
  ]
  return (
    <div className="space-y-3">
      <Card className={cx('p-4', live ? 'bg-emerald-50 ring-emerald-200' : 'bg-amber-50 ring-amber-200')}>
        <p className="text-sm font-bold">{MODE === 'supabase' ? 'Mode LIVE — terhubung ke Supabase' : live ? 'Mode LIVE — terhubung ke InsForge' : 'Mode DEMO — data tersimpan di browser ini'}</p>
        <p className="mt-0.5 text-xs text-ink-soft">{MODE === 'supabase' ? 'Kunci Zoho disimpan di database Supabase (hanya server yang bisa membaca), tidak pernah dikirim ke browser. Perubahan rekan kerja tampil otomatis lewat realtime; bila realtime terputus, aplikasi memuat ulang data tiap 20 detik dan setiap tab kembali aktif.' : live ? 'Kunci Zoho & Google disimpan di server (Vercel), tidak pernah dikirim ke browser.' : 'Isi environment variables lalu deploy ke Vercel untuk beralih ke mode live. Lihat README.'}</p>
      </Card>
      {items.map((i) => (
        <Card key={i.name} className="flex items-start gap-3 p-4">
          {live ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" /> : <CircleDashed className="mt-0.5 h-5 w-5 text-slate-300" />}
          <div className="min-w-0"><p className="text-sm font-bold">{i.name}</p><p className="text-xs text-ink-mute">{i.desc}</p><p className="mt-1 break-words font-mono text-[10px] text-ink-soft">{i.env}</p></div>
        </Card>
      ))}
      {!live && <Card className="flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1"><p className="text-sm font-bold">Penyimpanan browser</p><p className="text-xs text-ink-mute">Terpakai {Math.round(storageUsage() / 1024)} KB dari ±5.000 KB. Bila penuh, bersihkan sisa data lama (cadangan impor, versi sebelumnya) tanpa menghapus data saat ini.</p></div>
        <Button variant="outline" onClick={async () => { const f = await db.cleanup?.(); await refresh(); notify(f ? `Dibersihkan ${Math.round(f / 1024)} KB` : 'Tidak ada sisa data lama') }}>Bersihkan sisa data lama</Button>
      </Card>}
      {!live && <Card className="flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1"><p className="text-sm font-bold">Tugas contoh harian (TGS-…)</p><p className="text-xs text-ink-mute">Dibuat ulang tiap pagi agar setiap orang punya tugas berdeadline hari ini. Tidak dihitung dalam angka keuangan. Matikan sebelum dipakai sungguhan.</p></div>
        <button type="button" role="switch" aria-checked={perfOn} aria-label="Tugas contoh harian" onClick={togglePerf} className={cx('relative h-7 w-12 shrink-0 rounded-full transition', perfOn ? 'bg-brand' : 'bg-slate-300')}><span className={cx('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition', perfOn ? 'left-[22px]' : 'left-0.5')} /></button>
      </Card>}
      {!live && <Button variant="outline" onClick={async () => { if (await ask('Kembalikan data demo ke awal?')) { await db.reset(); await refresh(); notify('Data demo direset') } }}><RotateCcw className="h-4 w-4" />Reset data demo</Button>}
    </div>
  )
}


/** Ganti kata sandi (mode live). */
function GantiSandi() {
  const { notify } = useApp()
  const [p1, setP1] = useState(''); const [p2, setP2] = useState(''); const [busy, setBusy] = useState(false)
  const simpan = async (e) => {
    e.preventDefault()
    if (p1.length < 8) return notify('Kata sandi minimal 8 karakter', 'err')
    if (p1 !== p2) return notify('Ulangi kata sandi tidak sama', 'err')
    try { setBusy(true); await db.updatePassword(p1); notify('Kata sandi diperbarui'); setP1(''); setP2('') } catch (err) { notify(err.message, 'err') } finally { setBusy(false) }
  }
  return (
    <form onSubmit={simpan} className="max-w-sm space-y-3">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-mute">Kata Sandi</p>
      <Field label="Kata sandi baru (min. 8 karakter)"><Input type="password" value={p1} onChange={(e) => setP1(e.target.value)} autoComplete="new-password" /></Field>
      <Field label="Ulangi kata sandi baru"><Input type="password" value={p2} onChange={(e) => setP2(e.target.value)} autoComplete="new-password" /></Field>
      <Button size="sm" loading={busy} disabled={!p1 || !p2}>Simpan kata sandi</Button>
    </form>
  )
}
