import { useEffect, useMemo, useRef, useState } from 'react'
import { Upload, Trash2, Eye, EyeOff, RotateCcw, Save, Monitor, Smartphone, ImageOff, Shuffle } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { Button, Card, Field, Input, Select, Textarea, cx } from './ui.jsx'
import LoginVisual from './LoginVisual.jsx'
import { DEFAULT_LOGIN, MAKS_GAMBAR, SARAN_UKURAN, temaLogin, simpanCache, gambarAktif, pilihGambar, optimalkanGambar, kbDari } from '../config/loginTheme.js'

const uid = () => (crypto.randomUUID?.() ?? String(Math.random()).slice(2))

/** Setting → Tampilan → Halaman Login. Hanya untuk Superadmin. */
export default function LoginSettings() {
  const { data, save, notify } = useApp()
  const tersimpan = useMemo(() => temaLogin(data), [data])
  const [t, setT] = useState(tersimpan)
  const [perangkat, setPerangkat] = useState('desktop')
  const [pratinjau, setPratinjau] = useState(null) // gambar yang sedang dipratinjau
  const [busy, setBusy] = useState(false)
  const file = useRef(null)

  // ikut berubah bila pengaturan disimpan dari perangkat lain
  useEffect(() => { setT(tersimpan) }, [tersimpan])
  useEffect(() => { setPratinjau((g) => (g && gambarAktif(t).some((x) => x.id === g.id) ? g : pilihGambar(t))) }, [t])

  const set = (patch) => setT((x) => ({ ...x, ...patch }))
  const setGambar = (id, patch) => set({ images: (t.images || []).map((g) => (g.id === id ? { ...g, ...patch } : g)) })
  const berubah = JSON.stringify(t) !== JSON.stringify(tersimpan)

  const unggah = async (e) => {
    const files = [...(e.target.files || [])]; e.target.value = ''
    if (!files.length) return
    const sisa = MAKS_GAMBAR - (t.images || []).length
    if (sisa <= 0) return notify(`Maksimal ${MAKS_GAMBAR} gambar`, 'err')
    setBusy(true)
    try {
      const baru = []
      for (const f of files.slice(0, sisa)) {
        const { src } = await optimalkanGambar(f)
        baru.push({ id: uid(), name: f.name.replace(/\.[^.]+$/, ''), src, aktif: true, posX: 50, posY: 50, zoom: 1 })
      }
      set({ images: [...(t.images || []), ...baru] })
      notify(`${baru.length} gambar ditambahkan — jangan lupa Simpan & Terapkan`)
    } catch (err) { notify(err.message, 'err') } finally { setBusy(false) }
  }

  const simpan = async () => {
    setBusy(true)
    try {
      const row = (data.app_settings || []).find((r) => r.key === 'login')
      const bersih = { ...t, key: 'login' }
      await save('app_settings', { ...(row || { key: 'login' }), ...bersih })
      simpanCache(bersih)
      notify('Tampilan halaman login disimpan & diterapkan')
    } catch (err) { notify(err.message, 'err') } finally { setBusy(false) }
  }

  const kembalikan = async () => {
    setBusy(true)
    try {
      const row = (data.app_settings || []).find((r) => r.key === 'login')
      await save('app_settings', { ...(row || { key: 'login' }), ...DEFAULT_LOGIN })
      simpanCache(DEFAULT_LOGIN)
      setT({ ...DEFAULT_LOGIN })
      notify('Dikembalikan ke tampilan bawaan')
    } catch (err) { notify(err.message, 'err') } finally { setBusy(false) }
  }

  const totalKb = (t.images || []).reduce((a, g) => a + kbDari(g.src), 0)

  return (
    <div className="space-y-4">
      {/* ---------- Pratinjau ---------- */}
      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold">Pratinjau</h2>
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
            {[['desktop', Monitor, 'Desktop'], ['mobile', Smartphone, 'Mobile']].map(([k, Icon, label]) => (
              <button key={k} type="button" onClick={() => setPerangkat(k)} aria-pressed={perangkat === k}
                className={cx('flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition', perangkat === k ? 'bg-white text-brand shadow-sm' : 'text-ink-soft hover:text-ink')}>
                <Icon className="h-3.5 w-3.5" />{label}
              </button>
            ))}
            {gambarAktif(t).length > 1 && (
              <button type="button" onClick={() => setPratinjau(pilihGambar(t))} title="Acak gambar"
                className="flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold text-ink-soft hover:text-ink">
                <Shuffle className="h-3.5 w-3.5" />Acak
              </button>
            )}
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl p-3 ring-1 ring-slate-200" style={{ background: t.bg }}>
          <div className={cx('mx-auto rounded-2xl bg-white p-2 shadow-sm', perangkat === 'desktop' ? 'max-w-[560px]' : 'max-w-[240px]')}>
            <div className={cx('grid gap-2', perangkat === 'desktop' && 'grid-cols-2')}>
              <div className={cx('flex flex-col items-center justify-center gap-1.5 px-2 py-3', perangkat === 'mobile' && 'order-2')}>
                <div className="grid h-6 w-6 place-items-center rounded-lg bg-[var(--brand)] text-[10px] font-black text-white">A</div>
                <p className="text-[8px] font-extrabold tracking-wide text-ink">Atlas Alfa 5.0</p>
                <p className="text-center text-[9px] font-extrabold leading-tight text-ink">{t.judul}</p>
                <p className="text-center text-[7px] leading-snug text-ink-mute">{t.sub}</p>
                <div className="mt-1 w-full space-y-1">
                  <div className="h-3.5 rounded bg-slate-100 ring-1 ring-slate-200" />
                  <div className="h-3.5 rounded bg-slate-100 ring-1 ring-slate-200" />
                  <div className="h-3.5 rounded bg-[var(--brand)]" />
                </div>
              </div>
              <div className={cx(perangkat === 'mobile' ? 'order-1 h-[76px]' : 'h-[182px]')}>
                <LoginVisual tema={t} gambar={pratinjau} mini />
              </div>
            </div>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-ink-mute">
          {gambarAktif(t).length === 0
            ? 'Belum ada gambar aktif — halaman login memakai ilustrasi bawaan.'
            : `${gambarAktif(t).length} gambar aktif — satu dipilih acak tiap halaman login dibuka, lalu dipertahankan selama pengguna mengisi formulir.`}
        </p>
      </Card>

      {/* ---------- Gambar panel kanan ---------- */}
      <Card className="p-4 sm:p-5">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold">Gambar panel kanan</h2>
          <Button variant="outline" onClick={() => file.current?.click()} disabled={busy || (t.images || []).length >= MAKS_GAMBAR}>
            <Upload className="h-4 w-4" />Unggah gambar
          </Button>
          <input ref={file} type="file" accept="image/*" multiple className="hidden" onChange={unggah} aria-label="Unggah gambar panel login" />
        </div>
        <p className="mb-3 text-[11px] text-ink-mute">{SARAN_UKURAN} · maks. {MAKS_GAMBAR} gambar{totalKb > 0 && ` · terpakai ±${totalKb} KB`}</p>

        {(t.images || []).length === 0 ? (
          <div className="grid place-items-center gap-2 rounded-xl bg-slate-50 py-8 text-center ring-1 ring-slate-200">
            <ImageOff className="h-6 w-6 text-ink-mute" />
            <p className="text-[13px] text-ink-soft">Belum ada gambar. Halaman login memakai ilustrasi bawaan.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {(t.images || []).map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-2.5 ring-1 ring-slate-200">
                <span className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                  <img src={g.src} alt={g.name} className="h-full w-full" style={{ objectFit: t.fit === 'fit' ? 'contain' : 'cover', objectPosition: `${g.posX ?? 50}% ${g.posY ?? 50}%` }} />
                </span>
                <span className="min-w-0 flex-1">
                  <input value={g.name} onChange={(e) => setGambar(g.id, { name: e.target.value })} aria-label="Nama gambar"
                    className="h-8 w-full min-w-0 rounded-lg border-0 bg-slate-50 px-2 text-[13px] font-semibold text-ink ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-brand" />
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-mute">
                    <span>±{kbDari(g.src)} KB</span>
                    <label className="flex items-center gap-1">Posisi X
                      <input type="range" min="0" max="100" value={g.posX ?? 50} onChange={(e) => setGambar(g.id, { posX: Number(e.target.value) })} aria-label={`Posisi X ${g.name}`} className="w-20" />
                    </label>
                    <label className="flex items-center gap-1">Y
                      <input type="range" min="0" max="100" value={g.posY ?? 50} onChange={(e) => setGambar(g.id, { posY: Number(e.target.value) })} aria-label={`Posisi Y ${g.name}`} className="w-20" />
                    </label>
                    <label className="flex items-center gap-1">Zoom
                      <input type="range" min="1" max="2" step="0.05" value={g.zoom ?? 1} onChange={(e) => setGambar(g.id, { zoom: Number(e.target.value) })} aria-label={`Zoom ${g.name}`} className="w-20" />
                    </label>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={() => setGambar(g.id, { aktif: g.aktif === false })} aria-pressed={g.aktif !== false}
                    title={g.aktif !== false ? 'Aktif — klik untuk nonaktifkan' : 'Nonaktif — klik untuk aktifkan'}
                    className={cx('grid h-10 w-10 place-items-center rounded-lg ring-1 transition', g.aktif !== false ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-50 text-ink-mute ring-slate-200')}>
                    {g.aktif !== false ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <button type="button" onClick={() => set({ images: (t.images || []).filter((x) => x.id !== g.id) })} title={`Hapus ${g.name}`} aria-label={`Hapus ${g.name}`}
                    className="grid h-10 w-10 place-items-center rounded-lg text-slate-400 ring-1 ring-slate-200 transition hover:bg-rose-50 hover:text-rose-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Mode tampilan gambar" hint="Cover = penuh (terpotong) · Fit = seluruh gambar terlihat">
            <Select value={t.fit} onChange={(e) => set({ fit: e.target.value })}>
              <option value="cover">Cover — penuhi panel</option>
              <option value="fit">Fit — tampilkan seluruh gambar</option>
            </Select>
          </Field>
          <Field label={`Overlay gelap — ${t.overlay}%`} hint="Naikkan bila teks sulit terbaca di atas gambar">
            <input type="range" min="0" max="60" value={t.overlay} onChange={(e) => set({ overlay: Number(e.target.value) })} aria-label="Overlay gelap" className="h-10 w-full" />
          </Field>
        </div>
      </Card>

      {/* ---------- Teks & warna ---------- */}
      <Card className="p-4 sm:p-5">
        <h2 className="mb-3 text-sm font-bold">Teks & warna</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Judul sambutan"><Input value={t.judul} onChange={(e) => set({ judul: e.target.value })} /></Field>
          <Field label="Teks pendukung formulir"><Input value={t.sub} onChange={(e) => set({ sub: e.target.value })} /></Field>
          <Field label="Judul panel kanan"><Input value={t.panelJudul} onChange={(e) => set({ panelJudul: e.target.value })} /></Field>
          <Field label="Pesan motivasi panel kanan"><Textarea rows={2} value={t.panelPesan} onChange={(e) => set({ panelPesan: e.target.value })} /></Field>
          <Field label="Latar halaman" hint="Biru sangat muda disarankan">
            <span className="flex items-center gap-2">
              <input type="color" value={t.bg} onChange={(e) => set({ bg: e.target.value })} aria-label="Warna latar halaman" className="h-10 w-14 cursor-pointer rounded-lg ring-1 ring-slate-200" />
              <Input value={t.bg} onChange={(e) => set({ bg: e.target.value })} />
            </span>
          </Field>
          <Field label="Latar panel kanan">
            <span className="flex items-center gap-2">
              <input type="color" value={t.panelBg} onChange={(e) => set({ panelBg: e.target.value })} aria-label="Warna latar panel kanan" className="h-10 w-14 cursor-pointer rounded-lg ring-1 ring-slate-200" />
              <Input value={t.panelBg} onChange={(e) => set({ panelBg: e.target.value })} />
            </span>
          </Field>
        </div>
      </Card>

      <div className="sticky bottom-2 z-10 flex flex-wrap items-center gap-2 rounded-2xl bg-white/95 p-2.5 shadow-lg ring-1 ring-slate-200 backdrop-blur">
        <Button onClick={simpan} loading={busy} disabled={!berubah}><Save className="h-4 w-4" />Simpan & Terapkan</Button>
        <Button variant="outline" onClick={() => setT(tersimpan)} disabled={!berubah}>Batalkan perubahan</Button>
        <Button variant="outline" onClick={kembalikan} disabled={busy} className="!text-rose-600 !ring-rose-200 hover:!bg-rose-50"><RotateCcw className="h-4 w-4" />Kembalikan ke Default</Button>
        <span className="ml-auto text-[11px] text-ink-mute">{berubah ? 'Ada perubahan yang belum disimpan' : 'Tersimpan'}</span>
      </div>
    </div>
  )
}
