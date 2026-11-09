import { useEffect, useMemo, useRef, useState } from 'react'
import { Upload, Trash2, Eye, EyeOff, Save, ArrowUp, ArrowDown, Images } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { Button, Card, Field, Input, Select, cx } from './ui.jsx'
import { optimalkanGambar, kbDari } from '../config/loginTheme.js'
import { DEFAULT_BERANDA, MAKS_SLIDE, JEDA_PILIHAN, RASIO, pengaturanBeranda, slideAktif } from '../config/berandaSlide.js'
import SlideBeranda from './SlideBeranda.jsx'

const uid = () => (crypto.randomUUID?.() ?? String(Math.random()).slice(2))

/** Pengaturan → Slide Beranda. Hanya Superadmin. */
export default function SlideBerandaSettings() {
  const { data, save, notify } = useApp()
  const tersimpan = useMemo(() => pengaturanBeranda(data), [data])
  const [t, setT] = useState(tersimpan)
  const [busy, setBusy] = useState(false)
  const file = useRef(null)
  // ikut berubah hanya bila isi tersimpan benar-benar berganti (mis. disimpan dari perangkat lain),
  // bukan tiap kali objek data dibuat ulang — supaya foto yang baru diunggah tidak hilang
  const kunciTersimpan = JSON.stringify(tersimpan)
  useEffect(() => { setT(tersimpan) }, [kunciTersimpan]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (patch) => setT((x) => ({ ...x, ...patch }))
  const setSlide = (id, patch) => set({ slides: t.slides.map((g) => (g.id === id ? { ...g, ...patch } : g)) })
  const geser = (idx, arah) => { const a = [...t.slides]; const j = idx + arah; if (j < 0 || j >= a.length) return; [a[idx], a[j]] = [a[j], a[idx]]; set({ slides: a }) }
  const berubah = JSON.stringify(t) !== JSON.stringify(tersimpan)

  const unggah = async (e) => {
    const files = [...(e.target.files || [])]; e.target.value = ''
    if (!files.length) return
    const sisa = MAKS_SLIDE - t.slides.length
    if (sisa <= 0) return notify(`Maksimal ${MAKS_SLIDE} foto`, 'err')
    setBusy(true)
    try {
      const baru = []
      for (const f of files.slice(0, sisa)) {
        const { src } = await optimalkanGambar(f, { maks: 1600, mutu: 0.8 })
        baru.push({ id: uid(), name: f.name.replace(/\.[^.]+$/, ''), src, aktif: true, judul: '', ket: '' })
      }
      set({ slides: [...t.slides, ...baru] })
      notify(`${baru.length} foto ditambahkan — jangan lupa Simpan`)
    } catch (err) { notify(err.message, 'err') } finally { setBusy(false) }
  }
  const simpan = async () => {
    setBusy(true)
    try {
      const row = (data.app_settings || []).find((r) => r.key === 'beranda')
      await save('app_settings', { ...(row || { key: 'beranda' }), ...t, key: 'beranda' })
      notify('Slide Beranda disimpan — tampil untuk semua pengguna')
    } catch (err) { notify(err.message, 'err') } finally { setBusy(false) }
  }
  const totalKb = t.slides.reduce((a, g) => a + kbDari(g.src), 0)
  const nAktif = slideAktif(t).length

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold"><Images className="h-4 w-4 text-ink-mute" />Slide foto Beranda</h2>
          <span className="text-[11px] text-ink-mute">{nAktif} foto diputar · {totalKb} KB</span>
        </div>
        <p className="mb-3 text-xs text-ink-mute">Tampil di Beranda tepat di bawah sapaan. JPG/PNG/WebP, disarankan mendatar (16:9, ±1600×900 px); otomatis diperkecil ke maks. 1600 px.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Jeda per foto"><Select value={t.jeda} onChange={(e) => set({ jeda: Number(e.target.value) })}>{JEDA_PILIHAN.map((d) => <option key={d} value={d}>{d} detik</option>)}</Select></Field>
          <Field label="Jumlah foto diputar" hint={`dari ${t.slides.length} tersimpan`}><Select value={t.tampil} onChange={(e) => set({ tampil: Number(e.target.value) })}>{Array.from({ length: MAKS_SLIDE }, (_, k) => k + 1).map((d) => <option key={d} value={d}>{d} foto</option>)}</Select></Field>
          <Field label="Bentuk (rasio)"><Select value={t.rasio} onChange={(e) => set({ rasio: e.target.value })}>{Object.keys(RASIO).map((r) => <option key={r} value={r}>{r}{r === '16:9' ? ' · bawaan' : ''}</option>)}</Select></Field>
          <Field label="Lainnya">
            <div className="flex h-11 flex-wrap items-center gap-3 text-xs font-semibold">
              <label className="flex items-center gap-1.5"><input type="checkbox" className="h-4 w-4" checked={!!t.acak} onChange={(e) => set({ acak: e.target.checked })} />Urutan acak</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" className="h-4 w-4" checked={t.hp !== false} onChange={(e) => set({ hp: e.target.checked })} />Tampil di HP</label>
            </div>
          </Field>
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold">Foto ({t.slides.length}/{MAKS_SLIDE})</h2>
          <input ref={file} type="file" accept="image/*" multiple hidden onChange={unggah} />
          <Button size="sm" variant="secondary" onClick={() => file.current?.click()} disabled={busy || t.slides.length >= MAKS_SLIDE}><Upload className="h-4 w-4" />Tambah foto</Button>
        </div>
        {t.slides.length === 0 ? (
          <button type="button" onClick={() => file.current?.click()} className="grid w-full place-items-center rounded-2xl border-2 border-dashed border-slate-300 py-10 text-xs font-bold text-ink-mute hover:border-brand hover:text-brand">Belum ada foto — klik untuk mengunggah</button>
        ) : (
          <ul className="space-y-2">
            {t.slides.map((g, idx) => (
              <li key={g.id} className={cx('flex flex-col gap-2 rounded-xl border p-2 sm:flex-row sm:items-center', g.aktif === false ? 'border-slate-200 bg-slate-50 opacity-70' : 'border-slate-200 bg-white')}>
                <img src={g.src} alt="" className="h-20 w-full shrink-0 rounded-lg object-cover sm:w-36" />
                <div className="grid min-w-0 flex-1 gap-1.5 sm:grid-cols-2">
                  <Input value={g.judul || ''} onChange={(e) => setSlide(g.id, { judul: e.target.value })} placeholder="Judul (opsional)" className="!h-10" />
                  <Input value={g.ket || ''} onChange={(e) => setSlide(g.id, { ket: e.target.value })} placeholder="Keterangan singkat (opsional)" className="!h-10" />
                  <span className="truncate text-[11px] text-ink-mute sm:col-span-2">{g.name} · {kbDari(g.src)} KB · {idx < (t.tampil || 6) && g.aktif !== false ? 'ikut diputar' : 'tidak diputar'}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={() => geser(idx, -1)} disabled={idx === 0} aria-label="Naik" className="grid h-10 w-10 place-items-center rounded-lg text-ink-mute hover:bg-slate-100 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" onClick={() => geser(idx, 1)} disabled={idx === t.slides.length - 1} aria-label="Turun" className="grid h-10 w-10 place-items-center rounded-lg text-ink-mute hover:bg-slate-100 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                  <button type="button" onClick={() => setSlide(g.id, { aktif: g.aktif === false })} aria-label={g.aktif === false ? 'Tampilkan' : 'Sembunyikan'} title={g.aktif === false ? 'Tampilkan' : 'Sembunyikan'} className="grid h-10 w-10 place-items-center rounded-lg text-ink-mute hover:bg-slate-100">{g.aktif === false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                  <button type="button" onClick={() => set({ slides: t.slides.filter((x) => x.id !== g.id) })} aria-label="Hapus" className="grid h-10 w-10 place-items-center rounded-lg text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4 sm:p-5">
        <h2 className="mb-3 text-sm font-bold">Pratinjau</h2>
        <div className="mx-auto max-w-2xl"><PratinjauSlide t={t} /></div>
      </Card>

      <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] z-10 flex flex-wrap items-center justify-end gap-2 rounded-2xl bg-white/90 p-2 ring-1 ring-slate-200 backdrop-blur md:bottom-3">
        <Button variant="secondary" size="sm" onClick={() => setT({ ...DEFAULT_BERANDA })} disabled={busy}>Kosongkan</Button>
        <Button size="sm" onClick={simpan} loading={busy} disabled={!berubah}><Save className="h-4 w-4" />Simpan</Button>
      </div>
    </div>
  )
}

/** Pratinjau memakai pengaturan yang belum disimpan. */
function PratinjauSlide({ t }) {
  return <SlideBeranda override={t} key={JSON.stringify([t.rasio, t.tampil, t.acak, t.slides.map((s) => s.id + (s.aktif !== false))])} />
}
