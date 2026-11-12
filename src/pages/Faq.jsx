import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Search, X, Plus, Copy, Pencil, Archive, Send, Eye, Pin, ChevronDown, Trash2, ThumbsUp, ThumbsDown, Flame, Sparkles, MessageSquarePlus, Link2, ArrowUpRight, ClipboardCheck, MessageCircle, AlertTriangle } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { Button, cx } from '../components/ui.jsx'
import { FAQ_KATEGORI } from '../config/faqSeed.js'
import { tanggalJam } from '../lib/waktu.js'
import { scopeByBranch, invoiceLabel } from '../config/access.js'
import { statusOf } from '../lib/projectRow.js'
import { MODE } from '../lib/db.js'
import { sb } from '../lib/supabase.js'

// Live: staf tidak boleh mengubah baris F&Q langsung (RLS) — pemakaian, nilai & usulan lewat fungsi server.
const LIVE = MODE === 'supabase'
const rpc = async (fn, args) => { const { error } = await sb().rpc(fn, args); if (error) throw new Error(error.message) }

/** Peran yang boleh menambah, mengubah, menerbitkan, dan mengarsipkan. */
export const canEditFaq = (u) => ['superadmin', 'direktur', 'admin_pusat', 'supervisor'].includes(u?.base_role || u?.role)

const IKON_KAT = { 'Progres & Status': '📍', Pembayaran: '💳', 'Dokumen & Revisi': '📄', Pengiriman: '🚚', 'Portal Pelanggan': '🌐', Lainnya: '💬' }
const bulanIni = () => new Date().toISOString().slice(0, 7)
const pakaiBulan = (r) => Number(r.pakai?.[bulanIni()] || 0)
const kunciList = (r) => String(r.kata_kunci || '').split(',').map((x) => x.trim()).filter(Boolean)

const cocokkan = (r, s) =>
  [r.pertanyaan, r.panduan, r.balasan, r.balasan_en, r.kategori, r.kata_kunci, r.eskalasi]
    .filter(Boolean).some((v) => String(v).toLowerCase().includes(s))

/** Tandai kata yang dicari dengan kuning. */
function Sorot({ teks, cari }) {
  const kata = String(cari || '').trim().toLowerCase().split(/\s+/).filter((k) => k.length > 1)
  if (!kata.length) return teks
  const re = new RegExp(`(${kata.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  return String(teks).split(re).map((b, i) => (kata.includes(b.toLowerCase())
    ? <mark key={i} className="rounded bg-yellow-200 px-0.5 text-ink">{b}</mark> : b))
}

/** Isi placeholder [nomor invoice] dsb dari proyek terpilih. */
function nilaiPlaceholder(kunci, p) {
  if (!p) return null
  const k = kunci.toLowerCase()
  if (k.includes('invoice')) return invoiceLabel(p.invoice_no)
  if (k.includes('tahap') || k.includes('status')) return statusOf(p)
  if (k.includes('nama') || k.includes('pelanggan')) return p.customer?.name || null
  if (k.includes('deadline') || k.includes('tanggal selesai') || k.includes('tenggat')) return p.about?.deadline ? new Date(p.about.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' }) : null
  return null
}
const isiTeks = (teks, p) => String(teks || '').replace(/\[([^\]]+)\]/g, (m, k) => nilaiPlaceholder(k, p) ?? m)

function BalasanTampil({ teks, p }) {
  return String(teks || '').split(/(\[[^\]]+\])/).map((b, i) => {
    const m = b.match(/^\[([^\]]+)\]$/)
    if (!m) return b
    const v = nilaiPlaceholder(m[1], p)
    return v
      ? <span key={i} className="rounded bg-emerald-100 px-1 font-bold text-emerald-800">{v}</span>
      : <span key={i} className="rounded bg-amber-100 px-1 font-semibold text-amber-800">{b}</span>
  })
}

const digitsWa = (t) => { let d = String(t || '').replace(/\D/g, ''); if (d.startsWith('0')) d = `62${d.slice(1)}`; return d }

/** Isi lengkap satu panduan — dipakai di kartu (PC) maupun lembar bawah (HP). */
function IsiPanduan({ r, cari, proyek, setProyekId, daftarProyek, onSalin, onNilai, nilaiSaya, onPingDirektur, lebar }) {
  const [bhs, setBhs] = useState('id')
  const adaEn = !!r.balasan_en
  const teks = bhs === 'en' && adaEn ? r.balasan_en : r.balasan
  const adaPh = /\[[^\]]+\]/.test(r.balasan || '') || /\[[^\]]+\]/.test(r.balasan_en || '')
  const wa = proyek ? digitsWa(proyek.customer?.phone || proyek.customer?.ship?.phone) : ''
  return (
    <div className="min-w-0 space-y-3">
      <div className={cx('grid min-w-0 gap-3', lebar && 'lg:grid-cols-[1fr_1.15fr]')}>
        {r.balasan && (
          <div className={cx('min-w-0 rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200 sm:p-4', lebar && 'lg:order-2')} data-faq-balasan>
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 text-[11px] font-bold uppercase tracking-wide text-emerald-800">Balasan siap kirim</p>
              {adaEn && (
                <span className="flex rounded-lg bg-white p-0.5 text-[11px] font-semibold ring-1 ring-emerald-200" role="group" aria-label="Bahasa balasan">
                  {[['id', 'Bapak/Ibu'], ['en', 'English']].map(([k, l]) => (
                    <button key={k} type="button" onClick={() => setBhs(k)} aria-pressed={bhs === k}
                      className={cx('rounded-md px-2 py-1', bhs === k ? 'bg-emerald-600 text-white' : 'text-ink-soft')}>{l}</button>
                  ))}
                </span>
              )}
            </div>
            <p className="mt-2 whitespace-pre-line rounded-lg bg-white p-3 text-sm leading-relaxed text-ink ring-1 ring-emerald-100">
              <BalasanTampil teks={teks} p={proyek} />
            </p>
            {adaPh && (
              <label className="mt-2 flex min-w-0 items-center gap-2 rounded-lg bg-white/70 px-2.5 py-1.5 text-xs text-ink-soft ring-1 ring-emerald-100">
                <Link2 className="h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden="true" />
                <span className="shrink-0">Isi otomatis dari proyek:</span>
                <select value={proyek?.id || ''} onChange={(e) => setProyekId(e.target.value)} aria-label="Pilih proyek untuk isi otomatis"
                  className="w-0 min-w-0 flex-1 truncate rounded-md border-0 bg-transparent py-1 pl-1 pr-6 text-xs font-semibold text-ink focus:ring-2 focus:ring-emerald-500">
                  <option value="">— pilih proyek —</option>
                  {daftarProyek.map((p) => <option key={p.id} value={p.id}>{invoiceLabel(p.invoice_no)} · {p.customer?.name || '—'}</option>)}
                </select>
              </label>
            )}
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => onSalin(isiTeks(teks, proyek))} data-aksi="salin-balasan"
                className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-sm hover:bg-emerald-700">
                <Copy className="h-4 w-4" />Salin balasan
              </button>
              <a href={`https://wa.me/${wa}?text=${encodeURIComponent(isiTeks(teks, proyek))}`} target="_blank" rel="noreferrer"
                onClick={() => onSalin(null)}
                className="flex h-11 items-center gap-1 rounded-xl bg-white px-4 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-300 hover:bg-emerald-50">
                <MessageCircle className="h-4 w-4" />WhatsApp<ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>
            <p className="mt-2 text-[11px] text-ink-mute">Yang disalin hanya teks balasan — catatan internal tidak ikut.</p>
          </div>
        )}
        <div className={cx('min-w-0 space-y-3', lebar && 'lg:order-1')}>
          <div className="rounded-xl bg-sky-50 p-3 ring-1 ring-sky-100 sm:p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-sky-700"><ClipboardCheck className="h-3.5 w-3.5" />Cek dulu (internal)</p>
            <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink"><Sorot teks={r.panduan} cari={cari} /></p>
          </div>
          {r.eskalasi && (
            <div className="rounded-xl bg-rose-50 p-3 ring-1 ring-rose-100 sm:p-4">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-rose-700"><AlertTriangle className="h-3.5 w-3.5" />Kapan lempar ke Direktur</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink">{r.eskalasi}</p>
              {onPingDirektur && (
                <button type="button" onClick={onPingDirektur} disabled={!proyek}
                  title={proyek ? 'Kirim ping ke Direktur beserta proyek terpilih' : 'Pilih proyek dulu di kotak balasan'}
                  className="mt-2 inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-white px-3 text-xs font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-50">
                  <ArrowUpRight className="h-3.5 w-3.5" />Ping Direktur dengan konteks
                </button>
              )}
            </div>
          )}
          {kunciList(r).length > 0 && (
            <p className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-ink-mute">Kata kunci:</span>
              {kunciList(r).map((k) => <span key={k} className="rounded bg-slate-100 px-1.5 py-0.5 text-ink-soft">{k}</span>)}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs text-ink-mute">
        <span>Panduan ini membantu?</span>
        <button type="button" onClick={() => onNilai('suka')} aria-pressed={nilaiSaya === 'suka'}
          className={cx('flex min-h-[32px] items-center gap-1 rounded-full px-3', nilaiSaya === 'suka' ? 'bg-emerald-100 font-semibold text-emerald-800' : 'bg-slate-100 text-ink-soft hover:bg-slate-200')}>
          <ThumbsUp className="h-3.5 w-3.5" />Ya{r.nilai?.suka ? ` · ${r.nilai.suka}` : ''}
        </button>
        <button type="button" onClick={() => onNilai('kurang')} aria-pressed={nilaiSaya === 'kurang'}
          className={cx('flex min-h-[32px] items-center gap-1 rounded-full px-3', nilaiSaya === 'kurang' ? 'bg-rose-100 font-semibold text-rose-700' : 'bg-slate-100 text-ink-soft hover:bg-slate-200')}>
          <ThumbsDown className="h-3.5 w-3.5" />Kurang{r.nilai?.kurang ? ` · ${r.nilai.kurang}` : ''}
        </button>
        {(r.updated_at || r.editor) && <span className="ml-auto">Diperbarui {r.editor ? `${r.editor} · ` : ''}{tanggalJam(r.updated_at)}</span>}
      </div>
    </div>
  )
}

function Lencana({ r }) {
  return (
    <>
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-ink-soft">{r.kategori}</span>
      {r.mulai_di_sini && r.status === 'terbit' && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">⭐ Mulai di sini</span>}
      {r.status === 'draf' && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Draf</span>}
      {r.status === 'arsip' && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-ink-soft">Diarsipkan</span>}
    </>
  )
}

export default function Faq() {
  const { user, data, save, remove, notify, sendPing, refreshTables } = useApp()
  const bolehUbah = canEditFaq(user)
  const [q, setQ] = useState('')
  const [kat, setKat] = useState('') // '' | '__mulai' | kategori
  const [buka, setBuka] = useState(null)
  const [lembar, setLembar] = useState(null) // id panduan di lembar bawah (HP)
  const [edit, setEdit] = useState(null)
  const [pratinjau, setPratinjau] = useState(false)
  const [usul, setUsul] = useState(null)
  const [proyekId, setProyekId] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    const k = (e) => {
      if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement?.tagName || '')) { e.preventDefault(); inputRef.current?.focus() }
    }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [])

  const semua = data.faq || []
  const usulan = useMemo(() => semua.filter((r) => r.status === 'usulan'), [semua])
  const terlihat = useMemo(() => semua.filter((r) => r.status !== 'usulan' && (bolehUbah || r.status === 'terbit')), [semua, bolehUbah])
  const daftarProyek = useMemo(() => scopeByBranch(user, data.projects || [])
    .filter((p) => statusOf(p) !== 'Selesai')
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))).slice(0, 80), [user, data.projects])
  const proyek = daftarProyek.find((p) => p.id === proyekId) || null

  const cari = q.trim().toLowerCase()
  const hasil = useMemo(() => {
    let r = terlihat
    if (kat === '__mulai') r = r.filter((x) => x.mulai_di_sini && x.status === 'terbit')
    else if (kat) r = r.filter((x) => x.kategori === kat)
    if (cari) r = r.filter((x) => cari.split(/\s+/).every((k) => cocokkan(x, k)) || cocokkan(x, cari))
    return [...r].sort((a, b) => (cari ? pakaiBulan(b) - pakaiBulan(a) : 0) || (a.urutan ?? 0) - (b.urutan ?? 0))
  }, [terlihat, cari, kat])

  const hitungKat = (k) => terlihat.filter((x) => x.kategori === k).length
  const nMulai = terlihat.filter((x) => x.mulai_di_sini && x.status === 'terbit').length
  const terbit = terlihat.filter((x) => x.status === 'terbit')
  const populer = [...terbit].sort((a, b) => pakaiBulan(b) - pakaiBulan(a)).slice(0, 4).filter((r) => pakaiBulan(r) > 0)
  const seringDicari = populer.map((r) => kunciList(r)[0]).filter(Boolean)
  const baru = [...terbit].sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || ''))).slice(0, 3)
  const terakhirUbah = terbit.reduce((m, r) => (String(r.updated_at || '') > m ? String(r.updated_at) : m), '')
  const hariLalu = terakhirUbah ? Math.max(0, Math.floor((Date.now() - new Date(terakhirUbah)) / 864e5)) : null

  const catatPakai = (r) => (LIVE ? rpc('faq_catat', { row_id: r.id, jenis: 'pakai' }).then(() => refreshTables?.(['faq'])) : save('faq', { ...r, pakai: { ...(r.pakai || {}), [bulanIni()]: pakaiBulan(r) + 1 } })).catch(() => {})
  const salin = async (r, teks) => {
    if (teks === null) { catatPakai(r); return } // dibuka lewat WhatsApp
    try { await navigator.clipboard.writeText(teks ?? r.balasan ?? ''); notify('Balasan disalin — catatan internal tidak ikut'); catatPakai(r) }
    catch { notify('Tidak bisa menyalin di perangkat ini', 'err') }
  }
  const nilaiSaya = (r) => r.nilai?.by?.[user.id] || null
  const beriNilai = async (r, jenis) => {
    const by = { ...(r.nilai?.by || {}) }; const n = { suka: r.nilai?.suka || 0, kurang: r.nilai?.kurang || 0 }
    const lama = by[user.id]
    if (LIVE) { try { await rpc('faq_catat', { row_id: r.id, jenis: 'nilai', nilai: jenis }); await refreshTables?.(['faq']); if (lama !== jenis) notify(jenis === 'suka' ? 'Terima kasih 👍' : 'Dicatat — Direktur akan memperbaiki panduan ini') } catch (e) { notify(e.message, 'err') } return }
    if (lama) n[lama] = Math.max(0, n[lama] - 1)
    if (lama === jenis) delete by[user.id]; else { by[user.id] = jenis; n[jenis] += 1 }
    await save('faq', { ...r, nilai: { ...n, by } }).catch(() => {})
    if (lama !== jenis) notify(jenis === 'suka' ? 'Terima kasih 👍' : 'Dicatat — Direktur akan memperbaiki panduan ini')
  }
  const direktur = (data.users || []).find((u) => u.role === 'direktur')
  const pingDirektur = async (r) => {
    if (!proyek || !direktur) return
    try { await sendPing({ to_user: direktur.id, project: proyek, message: `F&Q: ${r.pertanyaan}` }); notify(`Ping terkirim ke ${direktur.name}`) }
    catch (e) { notify(e.message || 'Gagal mengirim ping', 'err') }
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
  const kirimUsul = async () => {
    if (!usul?.pertanyaan?.trim()) return notify('Tulis pertanyaannya dulu', 'err')
    try {
      if (LIVE) { await rpc('faq_usul', { pertanyaan: usul.pertanyaan.trim(), catatan: usul.catatan || '' }); if (bolehUbah) await refreshTables?.(['faq']) }
      else await save('faq', { status: 'usulan', kategori: 'Lainnya', pertanyaan: usul.pertanyaan.trim(), catatan_usul: usul.catatan || '', panduan: '', balasan: '', pengusul: user.name, pengusul_id: user.id })
      notify('Usulan terkirim — Direktur akan membuatkan panduan'); setUsul(null)
    } catch (e) { notify(e.message || 'Gagal mengirim usulan', 'err') }
  }
  const kosong = { pertanyaan: '', kategori: FAQ_KATEGORI[0], panduan: '', balasan: '', balasan_en: '', kata_kunci: '', eskalasi: '', mulai_di_sini: false, status: 'draf' }

  const propsIsi = (r) => ({ r, cari, proyek, setProyekId, daftarProyek, onSalin: (t) => salin(r, t), onNilai: (j) => beriNilai(r, j), nilaiSaya: nilaiSaya(r), onPingDirektur: direktur && direktur.id !== user.id ? () => pingDirektur(r) : null })
  const rLembar = lembar && terlihat.find((x) => x.id === lembar)

  const TombolKat = ({ k, label, n, chip }) => (
    <button type="button" onClick={() => setKat(k)} aria-pressed={kat === k}
      className={chip
        ? cx('shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold', kat === k ? 'bg-ink text-white' : 'bg-white text-ink-soft ring-1 ring-slate-200')
        : cx('flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 text-left text-[13px]', kat === k ? 'bg-white font-bold text-ink shadow-sm ring-1 ring-slate-200' : 'text-ink-soft hover:bg-white/60')}>
      <span className="min-w-0 flex-1 truncate">{label}</span>{!chip && <span className="text-xs text-ink-mute">{n}</span>}
    </button>
  )

  return (
    <div className="min-w-0 space-y-4" data-faq-v2>
      {/* ---------- Kepala + cari ---------- */}
      <div className="-mx-1 rounded-2xl bg-ink px-4 pb-4 pt-4 text-white sm:mx-0 sm:px-6 sm:pb-5 sm:pt-5">
        <div className="flex flex-wrap items-center gap-2">
          <BookOpen className="h-5 w-5 shrink-0 text-white/70" aria-hidden="true" />
          <h1 className="min-w-0 text-2xl font-extrabold tracking-tight">F&amp;Q · Panduan menjawab pelanggan</h1>
          <span className="ml-auto hidden rounded-full bg-white/10 px-3 py-1 text-xs sm:inline">{terbit.length} panduan{hariLalu !== null ? ` · diperbarui ${hariLalu === 0 ? 'hari ini' : `${hariLalu} hari lalu`}` : ''}</span>
          {bolehUbah && (
            <button type="button" onClick={() => { setEdit(kosong); setPratinjau(false) }}
              className="flex min-h-[40px] items-center gap-1 rounded-lg bg-white px-3 text-xs font-bold text-ink hover:bg-slate-100">
              <Plus className="h-3.5 w-3.5" />Panduan baru
            </button>
          )}
        </div>
        <label className="relative mt-3 block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" aria-hidden="true" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari: resi, transfer, revisi…" aria-label="Cari panduan"
            className="h-12 w-full rounded-xl border-0 bg-white pl-10 pr-10 text-[15px] text-ink shadow-lg placeholder:text-ink-mute focus:ring-2 focus:ring-amber-400" />
          {q
            ? <button type="button" onClick={() => { setQ(''); inputRef.current?.focus() }} aria-label="Hapus pencarian" className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center text-ink-mute"><X className="h-4 w-4" /></button>
            : <span className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 px-1.5 text-[11px] text-ink-mute sm:block">/</span>}
        </label>
        {seringDicari.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-white/60">Sering dicari:</span>
            {seringDicari.map((k) => <button key={k} type="button" onClick={() => setQ(k)} className="rounded-full bg-white/10 px-2.5 py-1 hover:bg-white/20">{k}</button>)}
          </div>
        )}
      </div>

      {/* ---------- Kategori chip (HP) ---------- */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden" role="group" aria-label="Kategori">
        <TombolKat chip k="" label="Semua" />
        <TombolKat chip k="__mulai" label="⭐ Mulai di sini" />
        {FAQ_KATEGORI.map((k) => <TombolKat chip key={k} k={k} label={`${IKON_KAT[k] || ''} ${k}`} />)}
      </div>

      <div className="flex min-w-0 items-start gap-5">
        {/* ---------- Kategori kiri (PC) ---------- */}
        <aside className="hidden w-[210px] shrink-0 space-y-1 lg:block" aria-label="Kategori">
          <p className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-ink-mute">Kategori</p>
          <TombolKat k="" label="📚 Semua" n={terlihat.length} />
          <TombolKat k="__mulai" label="⭐ Mulai di sini" n={nMulai} />
          {FAQ_KATEGORI.map((k) => <TombolKat key={k} k={k} label={`${IKON_KAT[k] || ''} ${k}`} n={hitungKat(k)} />)}
          <div className="!mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-3 text-xs text-ink-soft">
            <p className="font-bold text-ink">Tidak ketemu jawabannya?</p>
            <p className="mt-1">Kirim pertanyaan pelanggan — Direktur akan membuatkan panduan.</p>
            <button type="button" onClick={() => setUsul({ pertanyaan: q })} className="mt-2 flex min-h-[40px] w-full items-center justify-center gap-1 rounded-lg bg-slate-100 font-semibold text-ink hover:bg-slate-200">
              <MessageSquarePlus className="h-3.5 w-3.5" />Usulkan pertanyaan
            </button>
          </div>
        </aside>

        {/* ---------- Hasil ---------- */}
        <div className="min-w-0 flex-1 space-y-3">
          {cari && <p className="text-xs text-ink-mute">{hasil.length} hasil untuk <b className="text-ink">“{q.trim()}”</b> · kata yang cocok ditandai</p>}
          {hasil.length === 0 && (
            <div className="rounded-2xl bg-white p-8 text-center text-sm text-ink-mute ring-1 ring-slate-200">
              Panduan tidak ditemukan.
              <button type="button" onClick={() => setUsul({ pertanyaan: q })} className="mx-auto mt-3 flex min-h-[44px] items-center gap-1 rounded-xl bg-ink px-4 font-semibold text-white">
                <MessageSquarePlus className="h-4 w-4" />Usulkan pertanyaan ini
              </button>
            </div>
          )}
          {hasil.map((r) => {
            const terbuka = buka === r.id
            return (
              <div key={r.id} data-faq-item className={cx('min-w-0 overflow-hidden rounded-2xl bg-white shadow-sm', terbuka ? 'ring-2 ring-ink' : 'ring-1 ring-slate-200')}>
                {/* PC: baris bisa dibuka */}
                <div className="hidden items-start gap-3 px-5 py-4 md:flex">
                  <button type="button" onClick={() => setBuka(terbuka ? null : r.id)} aria-expanded={terbuka} className="min-w-0 flex-1 text-left">
                    <span className="flex flex-wrap items-center gap-1.5"><Lencana r={r} />{pakaiBulan(r) > 0 && <span className="text-xs text-ink-mute">dipakai {pakaiBulan(r)}× bulan ini</span>}</span>
                    <span className={cx('mt-1 block font-bold text-ink', terbuka ? 'text-[17px]' : 'text-[15px]')}><Sorot teks={r.pertanyaan} cari={cari} /></span>
                  </button>
                  {!terbuka && r.balasan && (
                    <button type="button" onClick={() => salin(r, isiTeks(r.balasan, proyek))} className="flex min-h-[36px] shrink-0 items-center gap-1 rounded-lg bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
                      <Copy className="h-3.5 w-3.5" />Salin cepat
                    </button>
                  )}
                  {bolehUbah && (
                    <button type="button" onClick={() => { setEdit(r); setPratinjau(false) }} aria-label={`Ubah: ${r.pertanyaan}`} title="Ubah panduan"
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-mute hover:bg-slate-50 hover:text-brand"><Pencil className="h-4 w-4" /></button>
                  )}
                  <button type="button" onClick={() => setBuka(terbuka ? null : r.id)} aria-label={terbuka ? 'Tutup' : 'Buka'} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-mute hover:bg-slate-50">
                    <ChevronDown className={cx('h-4 w-4 transition', terbuka && 'rotate-180')} />
                  </button>
                </div>
                {terbuka && <div className="hidden px-5 pb-4 md:block"><IsiPanduan {...propsIsi(r)} lebar /></div>}
                {/* HP: kartu ringkas */}
                <div className="p-3.5 md:hidden">
                  <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-ink-mute"><Lencana r={r} /></p>
                  <p className="mt-1 text-[14px] font-bold text-ink"><Sorot teks={r.pertanyaan} cari={cari} /></p>
                  <div className="mt-2 flex gap-2">
                    {r.balasan && (
                      <button type="button" onClick={() => salin(r, isiTeks(r.balasan, proyek))} className="flex h-11 flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 text-xs font-bold text-white">
                        <Copy className="h-3.5 w-3.5" />Salin balasan
                      </button>
                    )}
                    <button type="button" onClick={() => setLembar(r.id)} className={cx('flex h-11 items-center justify-center rounded-lg bg-slate-100 px-4 text-xs font-semibold text-ink-soft', !r.balasan && 'flex-1')}>Detail</button>
                    {bolehUbah && <button type="button" onClick={() => { setEdit(r); setPratinjau(false) }} aria-label={`Ubah: ${r.pertanyaan}`} className="grid h-11 w-11 place-items-center rounded-lg bg-slate-100 text-ink-soft"><Pencil className="h-4 w-4" /></button>}
                  </div>
                </div>
              </div>
            )
          })}
          <button type="button" onClick={() => setUsul({ pertanyaan: q })} className="flex min-h-[44px] w-full items-center justify-center gap-1 rounded-2xl border border-dashed border-slate-300 text-xs text-ink-soft lg:hidden">
            Tidak ketemu? <b className="text-ink">Usulkan pertanyaan</b>
          </button>
        </div>

        {/* ---------- Samping (PC lebar) ---------- */}
        <aside className="hidden w-[230px] shrink-0 space-y-3 text-[12.5px] xl:block">
          {populer.length > 0 && (
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-ink-mute"><Flame className="h-3.5 w-3.5 text-orange-500" />Paling sering dipakai</p>
              <ol className="mt-2 space-y-1">
                {populer.map((r, i) => <li key={r.id}><button type="button" onClick={() => { setQ(''); setKat(''); setBuka(r.id) }} className="w-full rounded px-1 py-1 text-left text-ink-soft hover:bg-slate-50 hover:text-ink">{i + 1}. {r.pertanyaan}</button></li>)}
              </ol>
            </div>
          )}
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-ink-mute"><Sparkles className="h-3.5 w-3.5 text-sky-500" />Baru / diperbarui</p>
            {baru.map((r) => (
              <button key={r.id} type="button" onClick={() => { setQ(''); setKat(''); setBuka(r.id) }} className="mt-1.5 block w-full rounded px-1 py-1 text-left text-ink-soft hover:bg-slate-50 hover:text-ink">
                {r.pertanyaan}{Date.now() - new Date(r.updated_at) < 7 * 864e5 && <span className="ml-1 rounded bg-sky-100 px-1 text-[10px] font-bold text-sky-700">BARU</span>}
              </button>
            ))}
          </div>
          {bolehUbah && usulan.length > 0 && (
            <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200" data-faq-usulan>
              <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Usulan dari CS · {usulan.length}</p>
              {usulan.slice(0, 3).map((u) => (
                <div key={u.id} className="mt-2 border-t border-amber-200/60 pt-2 first:border-0 first:pt-0">
                  <p className="text-ink">“{u.pertanyaan}” <span className="text-ink-mute">— {u.pengusul}</span></p>
                  <div className="mt-1.5 flex gap-1.5">
                    <button type="button" onClick={() => { setEdit({ ...kosong, ...u, status: 'draf' }); setPratinjau(false) }} className="flex min-h-[32px] flex-1 items-center justify-center rounded-lg bg-white text-xs font-semibold text-amber-800 ring-1 ring-amber-200">Jawab &amp; jadikan panduan</button>
                    <button type="button" onClick={() => remove('faq', u.id)} aria-label="Abaikan usulan" className="grid h-8 w-8 place-items-center rounded-lg text-amber-700 hover:bg-white"><X className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      {/* Usulan untuk pengelola di layar yang lebih kecil */}
      {bolehUbah && usulan.length > 0 && (
        <div className="rounded-2xl bg-amber-50 p-3 text-xs ring-1 ring-amber-200 xl:hidden">
          <p className="font-bold text-amber-800">Usulan dari CS · {usulan.length}</p>
          {usulan.map((u) => (
            <button key={u.id} type="button" onClick={() => { setEdit({ ...kosong, ...u, status: 'draf' }); setPratinjau(false) }} className="mt-1.5 flex min-h-[40px] w-full items-center rounded-lg bg-white px-3 text-left ring-1 ring-amber-100">
              “{u.pertanyaan}” <span className="ml-1 text-ink-mute">— {u.pengusul}</span><span className="ml-auto font-semibold text-amber-800">Jawab</span>
            </button>
          ))}
        </div>
      )}

      {/* ---------- Lembar detail (HP) ---------- */}
      {rLembar && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-ink/50 md:hidden" role="dialog" aria-modal="true" aria-label={rLembar.pertanyaan} onClick={() => setLembar(null)}>
          <div className="max-h-[90vh] overflow-y-auto rounded-t-3xl bg-white px-4 pb-6 pt-2" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-slate-300" />
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap gap-1.5"><Lencana r={rLembar} /></p>
                <p className="mt-1 text-[17px] font-bold leading-snug text-ink">{rLembar.pertanyaan}</p>
              </div>
              <button type="button" onClick={() => setLembar(null)} aria-label="Tutup" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-ink-mute"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-3"><IsiPanduan {...propsIsi(rLembar)} /></div>
          </div>
        </div>
      )}

      {/* ---------- Usulkan pertanyaan ---------- */}
      {usul && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-ink/40 sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Usulkan pertanyaan">
          <div className="w-full max-w-md rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl sm:p-6">
            <div className="flex items-center gap-2"><h2 className="flex-1 font-bold">Usulkan pertanyaan</h2>
              <button type="button" onClick={() => setUsul(null)} aria-label="Tutup" className="grid h-11 w-11 place-items-center rounded-lg text-ink-mute hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
            <p className="mt-1 text-xs text-ink-mute">Tulis pertanyaan pelanggan yang belum ada jawabannya. Direktur akan membuatkan panduan.</p>
            <textarea rows={3} value={usul.pertanyaan} onChange={(e) => setUsul({ ...usul, pertanyaan: e.target.value })} placeholder="Mis. Bisa terjemah dokumen tulisan tangan?"
              className="mt-3 w-full rounded-xl border-0 px-3 py-2.5 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-brand" />
            <input value={usul.catatan || ''} onChange={(e) => setUsul({ ...usul, catatan: e.target.value })} placeholder="Catatan (opsional)"
              className="mt-2 w-full rounded-xl border-0 px-3 py-2.5 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-brand" />
            <div className="mt-4 flex gap-2"><Button className="flex-1" onClick={kirimUsul}><Send className="h-4 w-4" />Kirim usulan</Button><Button variant="outline" onClick={() => setUsul(null)}>Batal</Button></div>
          </div>
        </div>
      )}

      {/* ---------- Panel tambah / ubah ---------- */}
      {edit && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-ink/40 p-0 backdrop-blur-[2px] sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Formulir panduan">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl sm:p-6">
            <div className="flex items-center gap-2">
              <h2 className="min-w-0 flex-1 text-base font-bold">{edit.id && edit.status !== 'usulan' && edit.panduan ? 'Ubah panduan' : edit.pengusul ? `Jawab usulan ${edit.pengusul}` : 'Panduan baru'}</h2>
              <button type="button" onClick={() => { setEdit(null); setPratinjau(false) }} aria-label="Tutup"
                className="grid h-11 w-11 place-items-center rounded-lg text-ink-mute hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>

            {pratinjau ? (
              <div className="mt-3 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-ink-mute">Pratinjau</p>
                <div className="rounded-xl p-3 ring-1 ring-slate-200">
                  <p className="mb-2 font-bold">{edit.pertanyaan}</p>
                  <IsiPanduan {...propsIsi({ ...edit, updated_at: new Date().toISOString(), editor: user.name })} onNilai={() => {}} onPingDirektur={null} />
                </div>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {edit.catatan_usul && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Catatan pengusul: {edit.catatan_usul}</p>}
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
                  <span className="mb-1 block text-xs font-bold text-sky-700">① Cek dulu — panduan internal <span className="text-rose-500">*</span></span>
                  <textarea rows={3} value={edit.panduan} onChange={(e) => setEdit({ ...edit, panduan: e.target.value })}
                    placeholder="Apa yang perlu dicek sebelum menjawab."
                    className="w-full max-w-full rounded-xl border-0 bg-white px-3 py-2.5 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-brand" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-emerald-700">② Balasan siap kirim <span className="font-medium text-ink-mute">(opsional)</span></span>
                  <textarea rows={3} value={edit.balasan} onChange={(e) => setEdit({ ...edit, balasan: e.target.value })}
                    placeholder="Kalimat yang boleh langsung dikirim ke pelanggan."
                    className="w-full max-w-full rounded-xl border-0 bg-white px-3 py-2.5 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-brand" />
                  <span className="mt-1 block text-[11px] text-ink-mute">Bisa isi otomatis: [nomor invoice], [tahap terakhir], [nama pelanggan], [deadline]</span>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-emerald-700">Balasan English <span className="font-medium text-ink-mute">(opsional)</span></span>
                  <textarea rows={2} value={edit.balasan_en || ''} onChange={(e) => setEdit({ ...edit, balasan_en: e.target.value })}
                    className="w-full max-w-full rounded-xl border-0 bg-white px-3 py-2.5 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-brand" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-rose-700">③ Kapan lempar ke Direktur <span className="font-medium text-ink-mute">(opsional)</span></span>
                  <input value={edit.eskalasi} onChange={(e) => setEdit({ ...edit, eskalasi: e.target.value })}
                    className="w-full max-w-full rounded-xl border-0 bg-white px-3 py-2.5 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-brand" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-ink-soft">Kata kunci pencarian <span className="font-medium text-ink-mute">(pisahkan dengan koma)</span></span>
                  <input value={edit.kata_kunci} onChange={(e) => setEdit({ ...edit, kata_kunci: e.target.value })}
                    placeholder="resi, lacak, tracking"
                    className="w-full max-w-full rounded-xl border-0 bg-white px-3 py-2.5 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-brand" />
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!edit.mulai_di_sini} onChange={(e) => setEdit({ ...edit, mulai_di_sini: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-brand" /><Pin className="h-3.5 w-3.5 text-ink-mute" />Sematkan ke “Mulai di sini”
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <span className="text-ink-soft">Urutan</span>
                    <input type="number" value={edit.urutan ?? ''} onChange={(e) => setEdit({ ...edit, urutan: e.target.value === '' ? null : Number(e.target.value) })}
                      aria-label="Urutan tampil" className="w-20 rounded-lg border-0 bg-white px-2 py-1.5 text-sm tabular-nums ring-1 ring-slate-300 focus:ring-2 focus:ring-brand" />
                  </label>
                </div>
                {edit.nilai && <p className="text-xs text-ink-mute">Dipakai {pakaiBulan(edit)}× bulan ini · 👍 {edit.nilai.suka || 0} · 👎 {edit.nilai.kurang || 0}</p>}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setPratinjau((v) => !v)}><Eye className="h-4 w-4" />{pratinjau ? 'Kembali menyunting' : 'Pratinjau'}</Button>
              <Button variant="outline" onClick={() => simpan('draf')}>Simpan Draf</Button>
              <Button onClick={() => simpan('terbit')}><Send className="h-4 w-4" />Terbitkan</Button>
              {edit.id && edit.status === 'terbit' && (
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
