import { useMemo, useState } from 'react'
import { Megaphone, Pin, Check, X, BellRing, Users, Building2, UserRound, Shield } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { BRANCHES, ROLES, roleLabel } from '../config/access.js'
import { Button, Field, Input, Sheet, Textarea, cx } from './ui.jsx'
import { relTime } from '../lib/format.js'

// ============================================================
//  PENGUMUMAN — dari Direktur / Superadmin ke Semua atau orang tertentu.
//  Disimpan sebagai baris `pings` (kind: 'pengumuman'), SATU baris per
//  penerima, jadi ikut aturan akses ping yang sudah ada: tiap orang hanya
//  menerima barisnya sendiri. Tampil sebagai popup, di lonceng, dan
//  tersemat (bersama ping) sampai tanggal yang dipilih.
// ============================================================

export const bolehPengumuman = (u) => ['superadmin', 'direktur', 'supervisor'].includes(u?.role)
export const isPengumuman = (p) => p?.kind === 'pengumuman'
const hariIniWita = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date())
/** Masih disematkan? (tanpa tanggal = sampai dikonfirmasi/dibaca) */
export const masihTersemat = (p, uid) => isPengumuman(p) && (p.pin_until ? String(p.pin_until).slice(0, 10) >= hariIniWita() : !(p.read_by || []).includes(uid))
export const sudahKonfirmasi = (p, uid) => (p.read_by || []).includes(uid)
const tglPendek = (d) => { if (!d) return ''; const x = new Date(`${String(d).slice(0, 10)}T00:00:00+08:00`); return `${x.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][x.getMonth()]}` }

/** Lencana tingkat. */
export function TingkatBadge({ p, kecil }) {
  if (p.tingkat !== 'penting') return null
  return <span className={cx('rounded bg-rose-600 font-bold uppercase text-white', kecil ? 'px-1 text-[9px]' : 'px-1.5 py-px text-[10px]')}>Penting</span>
}

/** Kartu pengumuman di lonceng / sheet (warna amber). */
export function KartuPengumuman({ p, now, onKonfirmasi }) {
  const { user } = useApp()
  const ok = sudahKonfirmasi(p, user.id)
  return (
    <div className="rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200" data-pengumuman={p.id}>
      <p className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800"><Megaphone className="h-3.5 w-3.5" />Pengumuman <TingkatBadge p={p} kecil />
        <span className="ml-auto font-medium text-amber-700/70">{relTime(p.created_at, now)}</span></p>
      <p className="mt-1 text-[13.5px] font-bold text-ink">{p.judul}</p>
      {p.message && <p className="mt-0.5 whitespace-pre-line text-[12.5px] leading-snug text-ink-soft">{p.message}</p>}
      <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-ink-mute">
        <span>{p.from_name} · {roleLabel({ role: p.from_role })}</span>
        {p.pin_until && <span>· <Pin className="inline h-3 w-3" /> s/d {tglPendek(p.pin_until)}</span>}
        {ok ? <span className="font-semibold text-emerald-700">· <Check className="inline h-3 w-3" /> {p.wajib ? 'sudah dikonfirmasi' : 'sudah dibaca'}</span> : null}
      </p>
      {!ok && <button type="button" onClick={(e) => { e.stopPropagation(); onKonfirmasi(p) }}
        className="mt-2 h-9 rounded-lg bg-brand px-3 text-[12px] font-bold text-white hover:bg-brand-dark">{p.wajib ? 'Saya mengerti' : 'Tandai dibaca'}</button>}
    </div>
  )
}

/** Popup layar penerima untuk pengumuman. */
export function PopupPengumuman({ p, sisa, onKonfirmasi, onTutup }) {
  return (
    <div className="w-full max-w-[400px] overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200">
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 text-white">
        <p className="flex items-center gap-2 text-sm font-extrabold"><Megaphone className="h-5 w-5" />Pengumuman
          {p.tingkat === 'penting' && <span className="rounded bg-white/25 px-1.5 text-[10px]">PENTING</span>}
          {sisa > 1 && <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-[11px]">{sisa} baru</span>}</p>
        <p className="mt-0.5 text-[11px] text-white/85">{p.from_name} · {roleLabel({ role: p.from_role })}</p>
      </div>
      <div className="max-h-[50vh] overflow-y-auto px-4 py-4">
        <p className="text-[16px] font-extrabold leading-snug text-ink">{p.judul}</p>
        {p.message && <p className="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-soft">{p.message}</p>}
        {p.pin_until && <p className="mt-3 text-[11px] text-ink-mute"><Pin className="mr-1 inline h-3 w-3" />Tersemat sampai {tglPendek(p.pin_until)}</p>}
      </div>
      <div className="border-t border-slate-100 p-3">
        {p.wajib ? (
          <>
            <button type="button" onClick={() => onKonfirmasi(p)} className="h-12 w-full rounded-xl bg-brand text-sm font-bold text-white hover:bg-brand-dark" data-aksi="saya-mengerti"><Check className="mr-1 inline h-4 w-4" />Saya mengerti</button>
            <p className="mt-2 text-center text-[11px] text-ink-mute">Tidak bisa ditutup sebelum dikonfirmasi</p>
          </>
        ) : (
          <div className="flex gap-2">
            <button type="button" onClick={() => onKonfirmasi(p)} className="h-11 flex-1 rounded-xl bg-brand text-sm font-bold text-white hover:bg-brand-dark">Sudah dibaca</button>
            <button type="button" onClick={onTutup} className="h-11 rounded-xl px-4 text-sm font-semibold text-ink-mute hover:bg-slate-100">Nanti</button>
          </div>
        )}
      </div>
    </div>
  )
}

/** Strip tersemat untuk Beranda / Dasbor: pengumuman aktif + ping belum dibaca. */
export function StripTersemat({ tanpaPing }) {
  const { user, myPings, markPingRead } = useApp()
  const [buka, setBuka] = useState(null)
  const umum = myPings.filter((p) => masihTersemat(p, user.id))
  const ping = tanpaPing ? [] : myPings.filter((p) => !isPengumuman(p) && !(p.read_by || []).includes(user.id))
  if (!umum.length && !ping.length) return null
  return (
    <section aria-label="Tersemat" className="overflow-hidden rounded-2xl ring-1 ring-amber-200" data-strip-tersemat>
      {umum.map((p) => (
        <div key={p.id} className="border-b border-amber-200/70 bg-amber-50 last:border-0">
          <button type="button" onClick={() => setBuka(buka === p.id ? null : p.id)} className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left">
            <Pin className="h-4 w-4 shrink-0 text-amber-700" />
            <span className="min-w-0 flex-1 truncate text-[13px] text-ink"><b>{p.judul}</b>{p.message ? <span className="text-ink-soft"> — {p.message}</span> : null}</span>
            <TingkatBadge p={p} kecil />
            <span className="shrink-0 rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200">{buka === p.id ? 'Tutup' : 'Baca'}</span>
          </button>
          {buka === p.id && (
            <div className="px-3 pb-3">
              <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink-soft">{p.message}</p>
              <p className="mt-1.5 text-[11px] text-ink-mute">{p.from_name} · {roleLabel({ role: p.from_role })}{p.pin_until ? ` · tersemat s/d ${tglPendek(p.pin_until)}` : ''}</p>
              {!sudahKonfirmasi(p, user.id) && <button type="button" onClick={() => markPingRead([p])} className="mt-2 h-9 rounded-lg bg-brand px-3 text-[12px] font-bold text-white">{p.wajib ? 'Saya mengerti' : 'Tandai dibaca'}</button>}
            </div>
          )}
        </div>
      ))}
      {ping.length > 0 && (
        <div className="flex min-h-11 items-center gap-2 bg-rose-50 px-3 py-2">
          <BellRing className="h-4 w-4 shrink-0 text-rose-600" />
          <span className="min-w-0 flex-1 truncate text-[13px] text-rose-900"><b>{ping.length} ping</b> · {ping[0].message}</span>
          <span className="shrink-0 text-[11px] font-semibold text-rose-700">di lonceng 🔔</span>
        </div>
      )}
    </section>
  )
}

const MODE = [['semua', 'Semua tim', Users], ['cabang', 'Per cabang', Building2], ['peran', 'Per peran', Shield], ['orang', 'Pilih orang', UserRound]]

/** Form kirim pengumuman + daftar terkirim (status konfirmasi). */
export function PengumumanForm({ onClose }) {
  const { user, data, save, notify } = useApp()
  const [tab, setTab] = useState('buat')
  const [mode, setMode] = useState('semua')
  const [cabang, setCabang] = useState([])
  const [peran, setPeran] = useState([])
  const [orang, setOrang] = useState([])
  const [cari, setCari] = useState('')
  const [judul, setJudul] = useState('')
  const [isi, setIsi] = useState('')
  const [tingkat, setTingkat] = useState('info')
  const [pin, setPin] = useState(() => { const d = new Date(Date.now() + 3 * 864e5); return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(d) })
  const [wajib, setWajib] = useState(true)
  const [sibuk, setSibuk] = useState(false)

  const aktif = useMemo(() => (data.users || []).filter((u) => u.id !== user.id && u.active !== false && u.role), [data.users, user.id])
  const penerima = useMemo(() => {
    if (mode === 'semua') return aktif
    if (mode === 'cabang') return aktif.filter((u) => cabang.includes(u.branch) || (u.branches || []).some((b) => cabang.includes(b)))
    if (mode === 'peran') return aktif.filter((u) => peran.includes(u.role))
    return aktif.filter((u) => orang.includes(u.id))
  }, [mode, aktif, cabang, peran, orang])
  const toggle = (arr, set, v) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])
  const hasilCari = cari.trim() ? aktif.filter((u) => !orang.includes(u.id) && `${u.name} ${roleLabel(u)} ${u.branch}`.toLowerCase().includes(cari.trim().toLowerCase())).slice(0, 8) : []
  const label = mode === 'semua' ? 'Semua tim' : mode === 'cabang' ? `Cabang ${cabang.join(', ')}` : mode === 'peran' ? peran.map((r) => ROLES[r]?.label || r).join(', ') : `${orang.length} orang`

  const kirim = async () => {
    if (!judul.trim()) return notify('Judul pengumuman wajib diisi', 'error')
    if (!penerima.length) return notify('Pilih penerima dulu', 'error')
    setSibuk(true)
    const group_id = `pg-${Date.now().toString(36)}`
    try {
      for (const u of penerima) {
        await save('pings', { kind: 'pengumuman', group_id, from_user: user.id, from_name: user.name, from_role: user.role, to_user: u.id, to_name: u.name,
          judul: judul.trim(), message: isi.trim(), tingkat, pin_until: pin || null, wajib, target_label: label, read_by: [] })
      }
      notify(`Pengumuman terkirim ke ${penerima.length} orang`)
      setJudul(''); setIsi(''); setTab('terkirim')
    } catch (e) { notify(e.message || 'Gagal mengirim pengumuman', 'error') } finally { setSibuk(false) }
  }

  // Terkirim: kelompokkan per group_id
  const grup = useMemo(() => {
    const m = new Map()
    for (const p of (data.pings || []).filter((x) => isPengumuman(x) && x.from_user === user.id)) {
      const g = m.get(p.group_id) || { ...p, rows: [] }; g.rows.push(p); m.set(p.group_id, g)
    }
    return [...m.values()].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  }, [data.pings, user.id])
  const pingUlang = async (g) => {
    const belum = g.rows.filter((r) => !(r.read_by || []).includes(r.to_user))
    for (const r of belum) await save('pings', { ...r, ulang_at: new Date().toISOString() })
    notify(`Diingatkan ulang ke ${belum.length} orang`)
  }

  const chip = (on) => cx('h-10 rounded-xl px-3 text-[13px] font-semibold ring-1 transition', on ? 'bg-ink text-white ring-ink' : 'bg-white text-ink-soft ring-slate-200 hover:bg-slate-50')

  return (
    <Sheet open side onClose={onClose} title="Pengumuman" subtitle={`Dari: ${user.name} · ${roleLabel(user)}`}
      footer={tab === 'buat' ? (
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-ink-mute sm:inline">Popup di layar · lonceng · tersemat</span>
          <Button variant="outline" className="ml-auto" onClick={onClose}>Batal</Button>
          <Button loading={sibuk} onClick={kirim} data-aksi="kirim-pengumuman"><Megaphone className="h-4 w-4" />Kirim ke {penerima.length} orang</Button>
        </div>
      ) : null}>
      <div className="mb-4 flex gap-1.5" role="tablist">
        {[['buat', 'Buat baru'], ['terkirim', `Terkirim (${grup.length})`]].map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={chip(tab === k)}>{l}</button>
        ))}
      </div>

      {tab === 'buat' ? (
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-bold text-ink-soft">Kirim ke</p>
            <div className="flex flex-wrap gap-1.5">
              {MODE.map(([k, l, I]) => <button key={k} type="button" onClick={() => setMode(k)} className={chip(mode === k)} data-mode={k}><I className="mr-1 inline h-4 w-4" />{l}</button>)}
            </div>
            {mode === 'cabang' && <div className="mt-2 flex flex-wrap gap-1.5">{BRANCHES.map((b) => <button key={b} type="button" onClick={() => toggle(cabang, setCabang, b)} className={chip(cabang.includes(b))}>{b}</button>)}</div>}
            {mode === 'peran' && <div className="mt-2 flex flex-wrap gap-1.5">{Object.entries(ROLES).filter(([k]) => k !== 'direktur').map(([k, r]) => <button key={k} type="button" onClick={() => toggle(peran, setPeran, k)} className={chip(peran.includes(k))}>{r.label}</button>)}</div>}
            {mode === 'orang' && (
              <div className="mt-2 rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200">
                <div className="flex flex-wrap gap-1.5">
                  {orang.map((id) => { const u = aktif.find((x) => x.id === id); return u && (
                    <button key={id} type="button" onClick={() => toggle(orang, setOrang, id)} className="inline-flex h-8 items-center gap-1 rounded-lg bg-white px-2 text-xs font-semibold ring-1 ring-slate-200">
                      {u.name} <span className="text-ink-mute">· {roleLabel(u)} {u.branch}</span><X className="h-3 w-3" /></button>) })}
                </div>
                <Input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Ketik nama, peran, atau cabang…" className="mt-1.5 !h-10" />
                {hasilCari.length > 0 && <div className="mt-1 divide-y divide-slate-100 rounded-lg bg-white ring-1 ring-slate-200">
                  {hasilCari.map((u) => <button key={u.id} type="button" onClick={() => { toggle(orang, setOrang, u.id); setCari('') }} className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm hover:bg-slate-50">
                    <b>{u.name}</b><span className="text-xs text-ink-mute">{roleLabel(u)} · {u.branch}</span></button>)}
                </div>}
              </div>
            )}
            <p className="mt-1.5 text-[11px] text-ink-mute">{penerima.length} penerima{mode === 'semua' ? ' (semua akun aktif, kecuali Anda)' : ''}</p>
          </div>
          <Field label="Judul"><Input value={judul} onChange={(e) => setJudul(e.target.value)} placeholder="Mis. Libur Maulid Nabi — kantor tutup 15 Nov" maxLength={120} /></Field>
          <Field label="Isi pesan"><Textarea rows={4} value={isi} onChange={(e) => setIsi(e.target.value)} placeholder="Tulis pengumuman…" /></Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="mb-1.5 text-xs font-bold text-ink-soft">Tingkat</p>
              <div className="flex gap-1">
                <button type="button" onClick={() => setTingkat('info')} className={cx('h-10 flex-1 rounded-lg text-xs font-bold ring-1', tingkat === 'info' ? 'bg-ink text-white ring-ink' : 'bg-white ring-slate-200')}>Info</button>
                <button type="button" onClick={() => setTingkat('penting')} className={cx('h-10 flex-1 rounded-lg text-xs font-bold ring-1', tingkat === 'penting' ? 'bg-rose-600 text-white ring-rose-600' : 'bg-white ring-slate-200')}>Penting</button>
              </div>
            </div>
            <Field label="Sematkan sampai"><Input type="date" value={pin} onChange={(e) => setPin(e.target.value)} className="!h-10" /></Field>
            <div>
              <p className="mb-1.5 text-xs font-bold text-ink-soft">Wajib konfirmasi</p>
              <button type="button" onClick={() => setWajib((v) => !v)} aria-pressed={wajib} className="flex h-10 w-full items-center gap-2 rounded-lg px-3 ring-1 ring-slate-200">
                <span className={cx('relative h-5 w-9 rounded-full transition', wajib ? 'bg-brand' : 'bg-slate-300')}><span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all', wajib ? 'right-0.5' : 'left-0.5')} /></span>
                <span className="text-xs font-semibold">“Saya mengerti”</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {grup.length === 0 && <p className="py-8 text-center text-sm text-ink-mute">Belum ada pengumuman yang Anda kirim.</p>}
          {grup.map((g) => {
            const ok = g.rows.filter((r) => (r.read_by || []).includes(r.to_user))
            const belum = g.rows.filter((r) => !(r.read_by || []).includes(r.to_user))
            const pct = Math.round((ok.length / g.rows.length) * 100)
            return (
              <div key={g.group_id} className="rounded-2xl bg-white p-3 ring-1 ring-slate-200" data-terkirim={g.group_id}>
                <p className="flex items-center gap-2"><TingkatBadge p={g} /><b className="min-w-0 flex-1 truncate text-sm">{g.judul}</b><span className="shrink-0 text-[11px] text-ink-mute">{relTime(g.created_at)}</span></p>
                <p className="mt-0.5 text-[11px] text-ink-mute">Ke: {g.target_label}</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
                <p className="mt-1 text-xs text-ink-soft"><b className="text-emerald-700">{ok.length} dari {g.rows.length}</b> sudah {g.wajib ? 'konfirmasi' : 'baca'} · {belum.length} belum</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {ok.slice(0, 12).map((r) => <span key={r.id} className="rounded-lg bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">✓ {r.to_name}</span>)}
                  {belum.slice(0, 12).map((r) => <span key={r.id} className="rounded-lg bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">● {r.to_name}</span>)}
                  {g.rows.length > 24 && <span className="text-[11px] text-ink-mute">+{g.rows.length - 24} lagi</span>}
                </div>
                {belum.length > 0 && <button type="button" onClick={() => pingUlang(g)} className="mt-2 inline-flex h-9 items-center gap-1 rounded-lg bg-white px-3 text-xs font-bold text-brand ring-1 ring-slate-200 hover:bg-slate-50"><BellRing className="h-3.5 w-3.5" />Ingatkan ulang yang belum ({belum.length})</button>}
              </div>
            )
          })}
        </div>
      )}
    </Sheet>
  )
}
