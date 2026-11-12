// ============================================================
//  RILIS FITUR — Superadmin mengatur menu mana yang dibuka ke tim.
//  Tersembunyi · Uji coba (penguji terpilih) · Aktif (semua yang berhak).
//  Superadmin & Direktur selalu melihat semua fitur.
// ============================================================
import { useEffect, useMemo, useState } from 'react'
import { Rocket, Lock, Users, X, Save, RotateCcw } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { FITUR, STATUS_FITUR, rencanaTahap, bacaRilis } from '../config/rilis.js'
import { ROLES } from '../config/access.js'
import { Card, Button, cx } from '../components/ui.jsx'
import PanelDummy from '../components/PanelDummy.jsx'

const JUDUL_TAHAP = { 1: 'Tahap 1 · Inti', 2: 'Tahap 2 · Harian', 3: 'Tahap 3 · Pendukung', 4: 'Tahap 4 · Lengkap' }
const WARNA = { tersembunyi: 'bg-slate-700 text-white', uji: 'bg-amber-400 text-ink', aktif: 'bg-emerald-600 text-white' }

const dariRow = (row) => ({
  aktif: !!row?.aktif,
  kunci_klasik: row ? !!row.kunci_klasik : true,
  fitur: { ...rencanaTahap(1), ...(row?.fitur || {}) },
  penguji: row?.penguji || [],
})

export default function RilisFitur() {
  const { user, data, save, notify, ask } = useApp()
  const row = bacaRilis(data.app_settings)
  const [v, setV] = useState(() => dariRow(row))
  const [busy, setBusy] = useState(false)
  const [cari, setCari] = useState('')
  // data server berubah (perangkat lain menyimpan) → ikut, selama belum ada ubahan lokal
  const asal = JSON.stringify(dariRow(row))
  const berubah = JSON.stringify(v) !== asal
  useEffect(() => { if (!berubah) setV(dariRow(row)) }, [asal]) // eslint-disable-line react-hooks/exhaustive-deps

  const staf = useMemo(() => (data.users || []).filter((u) => u.active !== false && !['superadmin', 'direktur'].includes(u.role)), [data.users])
  const nama = (id) => staf.find((u) => u.id === id)?.name || id
  const setFitur = (k, st) => setV((o) => ({ ...o, fitur: { ...o.fitur, [k]: st } }))
  const adaUji = Object.values(v.fitur).includes('uji')
  const dibuka = FITUR.filter((f) => v.fitur[f.key] === 'aktif')
  const diuji = FITUR.filter((f) => v.fitur[f.key] === 'uji')
  const tahapKini = [4, 3, 2, 1].find((n) => FITUR.every((f) => (f.tahap <= n) === (v.fitur[f.key] === 'aktif'))) || null

  const simpan = async () => {
    if (v.aktif && !v.fitur.projects?.match(/aktif|uji/)) return notify('Menu Project harus terbuka — tim butuh halaman utama', 'err')
    if (v.aktif && !row?.aktif && !(await ask('Aktifkan rilis bertahap sekarang? Tim langsung hanya melihat fitur yang dibuka.'))) return
    setBusy(true)
    try {
      await save('app_settings', { ...(row || {}), ...v, key: 'rilis_fitur', updated_by: user.name, updated_at_local: new Date().toISOString() })
      notify('Pengaturan rilis disimpan — berlaku untuk tim saat ini juga')
    } catch (e) { notify(e.message, 'err') }
    setBusy(false)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-28" data-rilis-fitur>
      <PanelDummy />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">Rilis Fitur</h1>
        <span className={cx('rounded-full px-2.5 py-1 text-xs font-bold', v.aktif ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-ink-soft')}>{v.aktif ? 'Rilis bertahap AKTIF' : 'Belum aktif — tim melihat semua fitur'}</span>
        {row?.updated_by && <span className="text-xs text-ink-mute">Terakhir diubah {row.updated_by}{row.updated_at_local ? ` · ${new Date(row.updated_at_local).toLocaleString('id-ID', { timeZone: 'Asia/Makassar', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}</span>}
      </div>

      {/* Saklar utama */}
      <Card className="grid gap-3 p-4 md:grid-cols-2">
        <Saklar on={v.aktif} onChange={(x) => setV((o) => ({ ...o, aktif: x }))} judul="Rilis bertahap" ket="Tim hanya melihat menu yang dibuka di bawah." data="aktif" />
        <Saklar on={v.kunci_klasik} onChange={(x) => setV((o) => ({ ...o, kunci_klasik: x }))} judul="Kunci tim di Mode Klasik" ket="Saklar Klasik/Baru disembunyikan untuk tim." ikon={Lock} data="kunci" />
      </Card>

      {/* Rencana tahap */}
      <Card className="p-4">
        <p className="text-sm font-bold">Terapkan rencana</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {[1, 2, 3, 4].map((n) => (
            <button key={n} type="button" onClick={() => setV((o) => ({ ...o, fitur: rencanaTahap(n) }))} aria-pressed={tahapKini === n} data-tahap={n}
              className={cx('min-h-[44px] rounded-xl px-4 text-sm font-semibold ring-1', tahapKini === n ? 'bg-ink text-white ring-ink' : 'bg-white ring-slate-200 hover:ring-slate-400')}>
              {JUDUL_TAHAP[n]}
            </button>
          ))}
        </div>
      </Card>

      {/* Daftar fitur per tahap */}
      {[1, 2, 3, 4].map((n) => (
        <Card key={n} className="overflow-hidden">
          <p className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-ink-mute">{JUDUL_TAHAP[n]}</p>
          <ul className="divide-y divide-slate-100">
            {FITUR.filter((f) => f.tahap === n).map((f) => (
              <li key={f.key} className="flex flex-wrap items-center gap-3 px-4 py-2.5" data-fitur={f.key}>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{f.label}</p>
                  {f.ket && <p className="text-xs text-ink-mute">{f.ket}</p>}
                </div>
                <span role="radiogroup" aria-label={`Status ${f.label}`} className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
                  {STATUS_FITUR.map(([k, l]) => (
                    <button key={k} type="button" role="radio" aria-checked={v.fitur[f.key] === k} onClick={() => setFitur(f.key, k)} data-status={k}
                      className={cx('min-h-[36px] rounded-lg px-3', v.fitur[f.key] === k ? WARNA[k] : 'text-ink-soft hover:text-ink')}>{l}</button>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ))}

      {/* Penguji */}
      {adaUji && (
        <Card className="p-4" data-penguji>
          <p className="flex items-center gap-2 text-sm font-bold"><Users className="h-4 w-4" aria-hidden="true" />Penguji ({v.penguji.length})</p>
          <p className="text-xs text-ink-mute">Hanya mereka yang melihat fitur berstatus Uji coba: {diuji.map((f) => f.label).join(', ')}.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {v.penguji.map((id) => (
              <span key={id} className="inline-flex items-center gap-1 rounded-full bg-amber-100 py-1 pl-3 pr-1 text-xs font-semibold text-amber-800">{nama(id)}
                <button type="button" aria-label={`Hapus ${nama(id)}`} onClick={() => setV((o) => ({ ...o, penguji: o.penguji.filter((x) => x !== id) }))} className="grid h-6 w-6 place-items-center rounded-full hover:bg-amber-200"><X className="h-3.5 w-3.5" /></button>
              </span>
            ))}
          </div>
          <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama staf untuk ditambahkan…" aria-label="Cari staf" autoComplete="off"
            className="mt-2 h-11 w-full rounded-xl border-0 px-3 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand" />
          {cari.trim() && (
            <ul className="mt-1 max-h-56 overflow-y-auto rounded-xl ring-1 ring-slate-200">
              {staf.filter((u) => !v.penguji.includes(u.id) && `${u.name} ${u.branch} ${ROLES[u.role]?.label || u.role}`.toLowerCase().includes(cari.toLowerCase())).slice(0, 12).map((u) => (
                <li key={u.id}><button type="button" onClick={() => { setV((o) => ({ ...o, penguji: [...o.penguji, u.id] })); setCari('') }} className="flex min-h-[44px] w-full items-center justify-between px-3 text-left text-sm hover:bg-slate-50">
                  <span className="font-semibold">{u.name}</span><span className="text-xs text-ink-mute">{ROLES[u.role]?.label || u.role} · {u.branch}</span></button></li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* Ringkasan + simpan */}
      <div className="fixed inset-x-0 bottom-16 z-30 px-3 md:bottom-4 md:left-auto md:right-6 md:max-w-xl md:px-0">
        <div className="flex items-center gap-3 rounded-2xl bg-ink p-3 text-white shadow-2xl">
          <p className="min-w-0 flex-1 text-xs leading-snug">
            {v.aktif ? <>Tim melihat: <b>{dibuka.map((f) => f.label).join(', ') || '—'}</b>{v.kunci_klasik ? ' · dikunci Mode Klasik' : ''}</> : 'Rilis bertahap belum aktif.'}
            {berubah && <span className="ml-1 text-amber-300">· belum disimpan</span>}
          </p>
          {berubah && <button type="button" onClick={() => setV(dariRow(row))} aria-label="Batalkan ubahan" className="grid h-11 w-11 place-items-center rounded-xl hover:bg-white/10"><RotateCcw className="h-4 w-4" /></button>}
          <Button variant="primary" className="!bg-emerald-500 !text-white disabled:!bg-white/15" onClick={simpan} loading={busy} disabled={!berubah || busy} data-aksi="simpan-rilis"><Save className="h-4 w-4" />Simpan</Button>
        </div>
      </div>
    </div>
  )
}

function Saklar({ on, onChange, judul, ket, ikon: I = Rocket, data }) {
  return (
    <div className="flex items-center gap-3">
      <I className="h-5 w-5 shrink-0 text-ink-mute" aria-hidden="true" />
      <div className="min-w-0 flex-1"><p className="font-semibold">{judul}</p><p className="text-xs text-ink-mute">{ket}</p></div>
      <button type="button" role="switch" aria-checked={on} aria-label={judul} onClick={() => onChange(!on)} data-saklar={data}
        className={cx('relative h-7 w-12 shrink-0 rounded-full transition-colors', on ? 'bg-emerald-600' : 'bg-slate-300')}>
        <span className={cx('absolute left-0 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform', on ? 'translate-x-[22px]' : 'translate-x-0.5')} />
      </button>
    </div>
  )
}
