import { useEffect, useState } from 'react'
import { Plus, Trash2, Pencil, Store, Phone, MapPin, Landmark, Tags, StickyNote, ArrowDownLeft, ArrowUpRight, CheckCircle2, CircleDashed, RotateCcw } from 'lucide-react'
import { PAYMENT_TERMS, termOf, SUMBER_DANA, sumberLabel } from '../config/workflows.js'
import { useApp } from '../lib/store.jsx'
import { db, MODE, storageUsage } from '../lib/db.js'
import { BRANCHES, PERSON_TYPES, ROLES, can, scopeByBranch, branchesOf, branchLabel, roleLabel, APOSTILLE_FUND, pettyLabel, pettyAccountsOf, isFreelance } from '../config/access.js'
import { Button, Card, Empty, Field, Input, Pill, Select, Sheet, Tabs, Textarea, cx } from '../components/ui.jsx'
import { jam, rupiah, tgl as tglShort } from '../lib/format.js'
import { drive } from '../lib/integrations.js'
import { DownloadBukti } from '../components/Pengajuan.jsx'
import { fileRulesOf } from '../components/UploadNamer.jsx'
import { COURIER_ICONS, COURIER_TYPES, CourierLogo } from '../components/Courier.jsx'
import AvatarEditor from '../components/AvatarEditor.jsx'
import Avatar from '../components/Avatar.jsx'

export default function Settings() {
  const { user } = useApp()
  const tabs = [
    { value: 'profil', label: 'Profil' },
    { value: 'petty', label: 'Petty Cash' },
    can.managePeople(user) && { value: 'people', label: 'Master Data' },
    can.manageVendors(user) && { value: 'vendor', label: 'Vendor' },
    can.managePeople(user) && { value: 'kurir', label: 'Kurir' },
    can.manageUsers(user) && { value: 'users', label: 'Pengguna' },
    ['superadmin', 'admin_pusat'].includes(user.role) && { value: 'file', label: 'File' },
    can.manageUsers(user) && { value: 'integrasi', label: 'Integrasi' },
  ].filter(Boolean)
  // tab awal bisa ditentukan lewat rute, mis. #/settings/petty (dari kartu Petty Cash di dashboard)
  const fromHash = () => { const t = window.location.hash.replace(/^#\/?/, '').split('/')[1]; return tabs.some((x) => x.value === t) ? t : 'profil' }
  const [tab, setTab] = useState(fromHash)
  useEffect(() => { const f = () => setTab(fromHash()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Setting</h1>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'profil' && <Profile />}
      {tab === 'petty' && <PettyCash />}
      {tab === 'people' && <People />}
      {tab === 'kurir' && <Couriers />}
      {tab === 'vendor' && <Vendors />}
      {tab === 'users' && <Users />}
      {tab === 'file' && <FileRules />}
      {tab === 'integrasi' && <Integrations />}
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

function Profile() {
  const { user, signOut } = useApp()
  return (
    <Card className="p-5">
      <div className="flex items-center gap-4">
        <Avatar user={user} size={56} />
        <div><p className="text-lg font-bold">{user.name}</p><p className="text-sm text-ink-mute">{user.email}</p>
          <div className="mt-1 flex gap-1.5"><Pill className="bg-brand-soft text-brand">{roleLabel(user)}</Pill><Pill>{branchLabel(user)}</Pill></div></div>
      </div>
      <div className="mt-5 border-t border-slate-100 pt-5"><AvatarEditor /></div>
      <Button variant="outline" className="mt-5" onClick={signOut}>Keluar</Button>
    </Card>
  )
}

const OUT_CATS = ['ATK & Alat Kantor', 'Materai', 'Fotokopi / Print', 'Ongkir / Kurir', 'Transport', 'Konsumsi', 'Biaya Instansi', 'Lainnya']
const dk = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(d)
const shift = (key, n) => dk(new Date(new Date(`${key}T12:00:00+08:00`).getTime() + n * 864e5))

function PettyCash() {
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

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {branches.map((b) => (
          <button key={b} onClick={() => setAcc(acc === b ? 'Semua' : b)} className={cx('rounded-2xl p-4 text-left shadow-sm ring-1 transition', b === APOSTILLE_FUND ? 'bg-emerald-50 ring-emerald-200' : 'bg-white ring-slate-200', acc === b && 'ring-2 ring-brand')}>
            <p className="text-xs text-ink-mute">{pettyLabel(b)}</p><p className={cx('text-lg font-extrabold', pettyBalance(b) < 500000 && 'text-rose-600')}>{rupiah(pettyBalance(b))}</p>
          </button>
        ))}
      </div>
      {branches.length > 0 && <div className="flex flex-wrap gap-2">
        <Button onClick={openOut} className="!bg-rose-600 hover:!bg-rose-700"><ArrowUpRight className="h-4 w-4" />Catat Pengeluaran / Dana Keluar</Button>
        {can.topUpPettyCash(user) && <Button onClick={() => setOpen(true)} className="!bg-emerald-600 hover:!bg-emerald-700"><ArrowDownLeft className="h-4 w-4" />Top Up / Dana Masuk</Button>}
      </div>}

      {branches.length > 0 && <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-4 py-2.5">
          <p className="mr-1 text-sm font-bold">{acc === 'Semua' ? 'Semua kas' : pettyLabel(acc)}</p>
          <button className={chip(range.from === today && range.to === today)} onClick={() => setRange({ from: today, to: today })}>Hari ini</button>
          <button className={chip(range.from === shift(today, -6) && range.to === today)} onClick={() => setRange({ from: shift(today, -6), to: today })}>7 hari</button>
          <button className={chip(range.from === `${today.slice(0, 8)}01` && range.to === today)} onClick={() => setRange({ from: `${today.slice(0, 8)}01`, to: today })}>Bulan ini</button>
          <button className={chip(!range.from && !range.to)} onClick={() => setRange({ from: '', to: '' })}>Semua</button>
          <span className="flex items-center gap-1.5 text-xs text-ink-mute">
            <Input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="!w-36 !py-1 text-xs" aria-label="Dari tanggal" />–
            <Input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="!w-36 !py-1 text-xs" aria-label="Sampai tanggal" />
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

      <Card className="divide-y divide-slate-100">
        {rows.length === 0 ? <Empty title="Belum ada mutasi pada rentang ini" /> : rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-3">
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
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sumber dana"><Select value={form.sumber} onChange={(e) => setForm({ ...form, sumber: e.target.value })}><option value="">— pilih —</option>{SUMBER_DANA.map((d) => <option key={d.code} value={d.code}>{sumberLabel(d.code)}</option>)}</Select></Field>
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

function CrudList({ table, rows, columns, empty, blank, renderForm, title, prepare, wide }) {
  const { save, remove, notify, ask } = useApp()
  const [edit, setEdit] = useState(null)
  const submit = async () => {
    try { await save(table, prepare ? prepare(edit) : edit); notify('Tersimpan'); setEdit(null) } catch (e) { notify(e.message, 'err') }
  }
  return (
    <div className="space-y-3">
      <Button onClick={() => setEdit(blank())}><Plus className="h-4 w-4" />Tambah {title}</Button>
      <Card className="divide-y divide-slate-100">
        {rows.length === 0 ? <Empty title={empty} /> : rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">{columns(r)}</div>
            <button onClick={() => setEdit(r)} className="rounded-lg p-2 text-ink-mute hover:bg-slate-100" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
            <button onClick={async () => { if (await ask('Hapus data ini?')) { await remove(table, r.id); notify('Dihapus') } }} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50" aria-label="Hapus"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </Card>
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
        blank={() => ({ name: '', type, branch: can.seeAllBranches(user) ? 'Semua' : user.branch, phone: '' })}
        columns={(r) => <><p className="text-sm font-semibold">{r.name}</p><p className="text-[11px] text-ink-mute">{r.branch === 'Semua' ? 'Semua cabang' : r.branch}{r.phone && ` · ${r.phone}`}</p></>}
        renderForm={(e, set) => (
          <div className="space-y-3">
            <Field label="Nama" required><Input value={e.name} onChange={(x) => set({ ...e, name: x.target.value })} /></Field>
            <Field label="Jenis"><Select value={e.type} onChange={(x) => set({ ...e, type: x.target.value })}>{Object.entries(PERSON_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
            <Field label="Cabang"><Select value={e.branch} disabled={!can.seeAllBranches(user)} onChange={(x) => set({ ...e, branch: x.target.value })}>{['Semua', ...BRANCHES].map((b) => <option key={b}>{b}</option>)}</Select></Field>
            <Field label="Kontak / No. Rekening / Alamat"><Input value={e.phone} onChange={(x) => set({ ...e, phone: x.target.value })} /></Field>
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

function Vendors() {
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
  return (
    <CrudList table="people" rows={rows} title="Vendor" empty="Belum ada vendor" wide
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

function Users() {
  const { data } = useApp()
  return (
    <CrudList table="users" rows={data.users} title="Pengguna" empty="Belum ada pengguna"
      blank={() => ({ name: '', email: '', role: 'cs', branch: BRANCHES[0], active: true })}
      columns={(r) => <><p className={cx('text-sm font-semibold', r.active === false && 'text-ink-mute line-through')}>{r.name}</p><p className="text-[11px] text-ink-mute">{r.email} · {roleLabel(r)}{r.extra_roles?.length ? ` + ${r.extra_roles.map((x) => roleLabel(r, x)).join(', ')}` : ''} · {isFreelance(r) ? 'Freelance' : r.branches?.length ? `${r.branch} + ${r.branches.filter((b) => b !== r.branch).join(', ')}` : r.branch}</p></>}
      renderForm={(e, set) => (
        <div className="space-y-3">
          <Field label="Nama" required><Input value={e.name} onChange={(x) => set({ ...e, name: x.target.value })} /></Field>
          <Field label="Email" required hint={MODE === 'live' ? 'Buat juga akun login dengan email yang sama di InsForge → Auth.' : undefined}><Input type="email" value={e.email} onChange={(x) => set({ ...e, email: x.target.value })} /></Field>
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
        </div>
      )} />
  )
}

function Integrations() {
  const { refresh, notify, ask, data, save } = useApp()
  const live = MODE === 'live'
  const demoRow = (data.app_settings || []).find((r) => r.key === 'demo')
  const perfOn = demoRow?.perf !== false
  const togglePerf = async () => { await save('app_settings', { ...(demoRow || { key: 'demo' }), perf: !perfOn }); await refresh(); notify(!perfOn ? 'Tugas contoh harian dinyalakan' : 'Tugas contoh harian dimatikan & dihapus') }
  const items = [
    { name: 'InsForge', desc: 'Login, role & database (users, people, projects, petty_cash)', env: 'VITE_INSFORGE_URL, VITE_INSFORGE_ANON_KEY' },
    { name: 'Zoho Books', desc: 'Cari pelanggan & tarik nomor invoice — via /api/zoho', env: 'ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_ORG_ID' },
    { name: 'Google Drive', desc: 'Penyimpanan file: ATLAS / Cabang / No. Invoice — via /api/drive', env: 'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_DRIVE_ROOT_FOLDER_ID' },
    { name: 'Vercel', desc: 'Hosting frontend + serverless functions', env: 'Environment Variables di dashboard Vercel' },
  ]
  return (
    <div className="space-y-3">
      <Card className={cx('p-4', live ? 'bg-emerald-50 ring-emerald-200' : 'bg-amber-50 ring-amber-200')}>
        <p className="text-sm font-bold">{live ? 'Mode LIVE — terhubung ke InsForge' : 'Mode DEMO — data tersimpan di browser ini'}</p>
        <p className="mt-0.5 text-xs text-ink-soft">{live ? 'Kunci Zoho & Google disimpan di server (Vercel), tidak pernah dikirim ke browser.' : 'Isi environment variables lalu deploy ke Vercel untuk beralih ke mode live. Lihat README.'}</p>
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
        <button type="button" role="switch" aria-checked={perfOn} onClick={togglePerf} className={cx('relative h-7 w-12 shrink-0 rounded-full transition', perfOn ? 'bg-brand' : 'bg-slate-300')}><span className={cx('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition', perfOn ? 'left-[22px]' : 'left-0.5')} /></button>
      </Card>}
      {!live && <Button variant="outline" onClick={async () => { if (await ask('Kembalikan data demo ke awal?')) { await db.reset(); await refresh(); notify('Data demo direset') } }}><RotateCcw className="h-4 w-4" />Reset data demo</Button>}
    </div>
  )
}
