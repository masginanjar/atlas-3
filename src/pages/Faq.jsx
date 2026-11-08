import { useMemo, useRef, useState } from 'react'
import { BookOpen, Search, X, Plus, Copy, Pencil, Archive, Send, Eye, Pin, ChevronDown, Trash2 } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { Button, Card, cx } from '../components/ui.jsx'
import { FAQ_KATEGORI } from '../config/faqSeed.js'
import { tanggalJam } from '../lib/waktu.js'

/** Peran yang boleh menambah, mengubah, menerbitkan, dan mengarsipkan. */
export const canEditFaq = (u) => ['superadmin', 'direktur', 'admin_pusat', 'supervisor'].includes(u?.base_role || u?.role)

const cocokkan = (r, s) =>
  [r.pertanyaan, r.panduan, r.balasan, r.kategori, r.kata_kunci, r.eskalasi]
    .filter(Boolean).some((v) => String(v).toLowerCase().includes(s))

/** Satu panduan — jawabannya dibuka tepat di bawah pertanyaan. */
function Panduan({ r, buka, onToggle, onSalin, bolehUbah, onSunting }) {
  return (
    <li className="min-w-0 border-t border-slate-100 first:border-0">
      <div className="flex min-w-0 items-start gap-1">
        <button type="button" onClick={onToggle} aria-expanded={buka}
          className="flex min-w-0 flex-1 items-start gap-2 px-1 py-3 text-left hover:bg-slate-50">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{r.pertanyaan}</span>
            <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-ink-soft">{r.kategori}</span>
              {r.status !== 'terbit' && (
                <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-semibold',
                  r.status === 'arsip' ? 'bg-slate-200 text-ink-soft' : 'bg-amber-100 text-amber-800')}>
                  {r.status === 'arsip' ? 'Diarsipkan' : 'Draf'}
                </span>
              )}
            </span>
          </span>
          <ChevronDown className={cx('mt-1 h-4 w-4 shrink-0 text-ink-mute transition', buka && 'rotate-180')} />
        </button>
        {bolehUbah && (
          <button type="button" onClick={onSunting} aria-label={`Ubah: ${r.pertanyaan}`} title="Ubah panduan"
            className="mt-2 grid h-11 w-11 shrink-0 place-items-center rounded-lg text-ink-mute hover:bg-slate-50 hover:text-brand md:h-8 md:w-8">
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>
      {buka && (
        <div className="space-y-2 pb-3 pl-1 pr-1">
          <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-mute">Panduan internal</p>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink">{r.panduan}</p>
          </div>
          {r.balasan && (
            <div className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 text-[11px] font-bold uppercase tracking-wide text-emerald-800">Contoh balasan pelanggan</p>
                <button type="button" onClick={onSalin} title="Salin hanya teks balasan, tanpa catatan internal"
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-300 hover:bg-emerald-100">
                  <Copy className="h-3 w-3" />Salin Balasan
                </button>
              </div>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-emerald-900">{r.balasan}</p>
            </div>
          )}
          {r.eskalasi && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900 ring-1 ring-amber-200">
              <b>Kapan minta bantuan Direktur:</b> {r.eskalasi}
            </p>
          )}
          {(r.updated_at || r.editor) && (
            <p className="text-[11px] text-ink-mute">
              Diperbarui {tanggalJam(r.updated_at)}{r.editor ? ` · ${r.editor}` : ''}
            </p>
          )}
        </div>
      )}
    </li>
  )
}

export default function Faq() {
  const { user, data, save, remove, notify } = useApp()
  const bolehUbah = canEditFaq(user)
  const [q, setQ] = useState('')
  const [dicari, setDicari] = useState('')
  const [kat, setKat] = useState('')
  const [buka, setBuka] = useState(() => new Set())
  const [edit, setEdit] = useState(null) // objek yang sedang disunting
  const [pratinjau, setPratinjau] = useState(false)
  const inputRef = useRef(null)

  const semua = data.faq || []
  // Staf biasa tidak boleh melihat draf maupun arsip.
  const terlihat = useMemo(
    () => (bolehUbah ? semua : semua.filter((r) => r.status === 'terbit')),
    [semua, bolehUbah])

  const hasil = useMemo(() => {
    const s = dicari.trim().toLowerCase()
    let r = terlihat
    // Arsip tidak pernah ikut hasil pencarian staf.
    if (!bolehUbah) r = r.filter((x) => x.status === 'terbit')
    if (kat) r = r.filter((x) => x.kategori === kat)
    if (s) r = r.filter((x) => cocokkan(x, s))
    return [...r].sort((a, b) => (a.urutan ?? 0) - (b.urutan ?? 0))
  }, [terlihat, dicari, kat, bolehUbah])

  const mulai = useMemo(
    () => terlihat.filter((r) => r.mulai_di_sini && r.status === 'terbit').sort((a, b) => (a.urutan ?? 0) - (b.urutan ?? 0)),
    [terlihat])

  const sedangCari = !!dicari.trim() || !!kat
  const toggle = (id) => setBuka((v) => { const n = new Set(v); n.has(id) ? n.delete(id) : n.add(id); return n })
  const cari = () => setDicari(q)
  const reset = () => { setQ(''); setDicari(''); setKat(''); inputRef.current?.focus() }

  const salin = async (r) => {
    try { await navigator.clipboard.writeText(r.balasan || ''); notify('Balasan disalin — catatan internal tidak ikut') }
    catch { notify('Tidak bisa menyalin di perangkat ini', 'err') }
  }

  const simpan = async (status) => {
    if (!edit.pertanyaan?.trim()) return notify('Pertanyaan wajib diisi', 'err')
    if (!edit.kategori) return notify('Kategori wajib dipilih', 'err')
    if (!edit.panduan?.trim()) return notify('Panduan internal wajib diisi', 'err')
    const urut = edit.urutan ?? (Math.max(0, ...semua.map((x) => Number(x.urutan) || 0)) + 1)
    try {
      await save('faq', { ...edit, status, urutan: urut, editor: user.name })
      notify(status === 'terbit' ? 'Panduan diterbitkan' : status === 'arsip' ? 'Panduan diarsipkan' : 'Draf disimpan')
      setEdit(null); setPratinjau(false)
    } catch (e) { notify(e.message || 'Gagal menyimpan', 'err') }
  }

  return (
    <div className="min-w-0 space-y-4">
      <header className="flex min-w-0 flex-wrap items-center gap-2">
        <BookOpen className="h-5 w-5 shrink-0 text-ink-mute" aria-hidden="true" />
        <h1 className="min-w-0 text-lg font-bold">FAQ &amp; Panduan CS</h1>
        {bolehUbah && (
          <Button size="sm" className="ml-auto" onClick={() => { setEdit({ pertanyaan: '', kategori: FAQ_KATEGORI[0], panduan: '', balasan: '', kata_kunci: '', eskalasi: '', mulai_di_sini: false, status: 'draf' }); setPratinjau(false) }}>
            <Plus className="h-3.5 w-3.5" />Tambah FAQ
          </Button>
        )}
      </header>

      {/* ---------- Pencarian ---------- */}
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <label className="relative block min-w-0 flex-1 basis-full sm:basis-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" aria-hidden="true" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); cari() } }}
            placeholder="Cari panduan — mis. resi, transfer, revisi…" aria-label="Cari panduan"
            className="w-full max-w-full rounded-xl border-0 bg-white py-2.5 pl-9 pr-3 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand" />
        </label>
        <Button onClick={cari}><Search className="h-4 w-4" />Cari</Button>
        <select value={kat} onChange={(e) => setKat(e.target.value)} aria-label="Filter kategori"
          className="min-w-0 rounded-xl border-0 bg-white py-2.5 pl-3 pr-8 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand">
          <option value="">Semua kategori</option>
          {FAQ_KATEGORI.map((k) => <option key={k}>{k}</option>)}
        </select>
        {sedangCari && <Button variant="outline" onClick={reset}><X className="h-4 w-4" />Reset</Button>}
      </div>

      {/* ---------- Mulai di Sini ---------- */}
      {!sedangCari && mulai.length > 0 && (
        <Card className="min-w-0 p-4 md:p-6">
          <h2 className="flex items-center gap-2 text-sm font-bold"><Pin className="h-4 w-4 shrink-0 text-ink-mute" aria-hidden="true" />Mulai di Sini</h2>
          <p className="mt-1 text-xs text-ink-mute">Panduan yang paling sering dipakai staf baru.</p>
          <ul className="mt-2">
            {mulai.map((r) => (
              <Panduan key={r.id} r={r} buka={buka.has(r.id)} onToggle={() => toggle(r.id)} onSalin={() => salin(r)}
                bolehUbah={bolehUbah} onSunting={() => { setEdit(r); setPratinjau(false) }} />
            ))}
          </ul>
        </Card>
      )}

      {/* ---------- Hasil ---------- */}
      <Card className="min-w-0 p-4 md:p-6">
        <h2 className="text-sm font-bold">{sedangCari ? `Hasil (${hasil.length})` : 'Semua panduan'}</h2>
        {hasil.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-mute">Panduan tidak ditemukan. Coba kata lain atau hubungi Direktur.</p>
        ) : (
          <ul className="mt-2">
            {hasil.map((r) => (
              <Panduan key={r.id} r={r} buka={buka.has(r.id)} onToggle={() => toggle(r.id)} onSalin={() => salin(r)}
                bolehUbah={bolehUbah} onSunting={() => { setEdit(r); setPratinjau(false) }} />
            ))}
          </ul>
        )}
      </Card>

      {/* ---------- Panel tambah / ubah ---------- */}
      {edit && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-ink/40 p-0 backdrop-blur-[2px] sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Formulir panduan">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl sm:p-6">
            <div className="flex items-center gap-2">
              <h2 className="min-w-0 flex-1 text-base font-bold">{edit.id ? 'Ubah panduan' : 'Tambah FAQ'}</h2>
              <button type="button" onClick={() => { setEdit(null); setPratinjau(false) }} aria-label="Tutup"
                className="grid h-11 w-11 place-items-center rounded-lg text-ink-mute hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>

            {pratinjau ? (
              <div className="mt-3 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-ink-mute">Pratinjau</p>
                <ul className="rounded-xl ring-1 ring-slate-200">
                  <Panduan r={{ ...edit, updated_at: new Date().toISOString(), editor: user.name }} buka onToggle={() => {}}
                    onSalin={() => salin(edit)} bolehUbah={false} onSunting={() => {}} />
                </ul>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-ink-soft">Pertanyaan <span className="text-rose-500">*</span></span>
                  <input value={edit.pertanyaan} onChange={(e) => setEdit({ ...edit, pertanyaan: e.target.value })}
                    className="w-full max-w-full rounded-xl border-0 bg-white px-3 py-2.5 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-brand" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-ink-soft">Kategori <span className="text-rose-500">*</span></span>
                  <select value={edit.kategori} onChange={(e) => setEdit({ ...edit, kategori: e.target.value })}
                    className="w-full max-w-full rounded-xl border-0 bg-white py-2.5 pl-3 pr-8 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-brand">
                    {FAQ_KATEGORI.map((k) => <option key={k}>{k}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-ink-soft">Panduan internal <span className="text-rose-500">*</span></span>
                  <textarea rows={3} value={edit.panduan} onChange={(e) => setEdit({ ...edit, panduan: e.target.value })}
                    placeholder="Apa yang perlu dicek sebelum menjawab."
                    className="w-full max-w-full rounded-xl border-0 bg-white px-3 py-2.5 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-brand" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-ink-soft">Contoh balasan pelanggan <span className="font-medium text-ink-mute">(opsional)</span></span>
                  <textarea rows={3} value={edit.balasan} onChange={(e) => setEdit({ ...edit, balasan: e.target.value })}
                    placeholder="Kalimat yang boleh langsung dikirim ke pelanggan."
                    className="w-full max-w-full rounded-xl border-0 bg-white px-3 py-2.5 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-brand" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-ink-soft">Kata kunci pencarian <span className="font-medium text-ink-mute">(opsional)</span></span>
                  <input value={edit.kata_kunci} onChange={(e) => setEdit({ ...edit, kata_kunci: e.target.value })}
                    placeholder="resi, lacak, tracking"
                    className="w-full max-w-full rounded-xl border-0 bg-white px-3 py-2.5 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-brand" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-ink-soft">Kapan minta bantuan Direktur <span className="font-medium text-ink-mute">(opsional)</span></span>
                  <input value={edit.eskalasi} onChange={(e) => setEdit({ ...edit, eskalasi: e.target.value })}
                    className="w-full max-w-full rounded-xl border-0 bg-white px-3 py-2.5 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-brand" />
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!edit.mulai_di_sini} onChange={(e) => setEdit({ ...edit, mulai_di_sini: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-brand" />Sematkan ke “Mulai di Sini”
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <span className="text-ink-soft">Urutan</span>
                    <input type="number" value={edit.urutan ?? ''} onChange={(e) => setEdit({ ...edit, urutan: e.target.value === '' ? null : Number(e.target.value) })}
                      aria-label="Urutan tampil" className="w-20 rounded-lg border-0 bg-white px-2 py-1.5 text-sm tabular-nums ring-1 ring-slate-300 focus:ring-2 focus:ring-brand" />
                  </label>
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setPratinjau((v) => !v)}><Eye className="h-4 w-4" />{pratinjau ? 'Kembali menyunting' : 'Pratinjau'}</Button>
              <Button variant="outline" onClick={() => simpan('draf')}>Simpan Draf</Button>
              <Button onClick={() => simpan('terbit')}><Send className="h-4 w-4" />Terbitkan</Button>
              {edit.id && edit.status !== 'arsip' && (
                <Button variant="outline" onClick={() => simpan('arsip')}><Archive className="h-4 w-4" />Arsipkan</Button>
              )}
              {edit.id && (
                <button type="button" onClick={async () => { await remove('faq', edit.id); setEdit(null); notify('Panduan dihapus') }}
                  className="ml-auto flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50">
                  <Trash2 className="h-4 w-4" />Hapus
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
