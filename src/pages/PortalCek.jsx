import { useCallback, useEffect, useState } from 'react'
import { Download, Eye, Loader2, Phone, Mail, CheckCircle2, FileText, Info, CalendarClock, Truck, PackageCheck, MessageCircle, Search, ChevronRight, ArrowLeft, Star, ReceiptText, StickyNote } from 'lucide-react'
import { cek, CEK_DEMO } from '../lib/custClient.js'
import { DRAFT_NOTE } from '../lib/portalCust.js'
import { saveBlob } from '../lib/download.js'
import { clock } from '../lib/performance.js'
import FilePreview from '../components/FilePreview.jsx'
import { cx } from '../components/ui.jsx'
import { tgl } from '../lib/format.js'

// ============================================================
//  PORTAL PELANGGAN — SATU LINK UMUM (#/cek)
//  Buka link → isi nomor HP → pilih invoice → lihat progres, dokumen,
//  dan konfirmasi penerimaan. Tanpa akun, tanpa password, tanpa OTP.
// ============================================================
const waktu = (iso) => (iso ? `${tgl(iso)} pukul ${clock(new Date(iso))} WIB` : '—')
const ERR = {
  expired: 'Masa akses pesanan ini sudah berakhir. Silakan hubungi admin kami untuk membuka kembali akses.',
  revoked: 'Akses pesanan ini sudah ditutup. Silakan hubungi admin kami.',
  off: 'Akses pelanggan untuk pesanan ini belum diaktifkan. Silakan hubungi admin kami.',
  session: 'Sesi Anda berakhir. Silakan masukkan nomor HP lagi.',
  forbidden: 'Pesanan ini tidak dapat dibuka dari halaman ini.',
  missing: 'Pesanan tidak ditemukan.',
}

export default function PortalCek() {
  const [step, setStep] = useState('phone') // phone | pick | order
  const [list, setList] = useState([])
  const [pid, setPid] = useState(null)

  const openOrder = (id) => { setPid(id); setStep('order'); window.scrollTo(0, 0) }
  const onFound = (rows) => { setList(rows); if (rows.length === 1) openOrder(rows[0].project_id); else { setStep('pick'); window.scrollTo(0, 0) } }
  const reset = () => { setStep('phone'); setList([]); setPid(null); window.scrollTo(0, 0) }

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-ink px-4 py-4 text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-lg font-extrabold text-ink">A</span>
          <div className="min-w-0 flex-1"><p className="text-lg font-extrabold leading-tight">247 Sworn Translator</p><p className="text-sm text-white/60">Cek Progres Pesanan</p></div>
          {step !== 'phone' && <button type="button" onClick={reset} className="rounded-xl px-3 py-2 text-sm font-semibold text-white/80 underline">Keluar</button>}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        {CEK_DEMO && <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">Mode demo — pemeriksaan berjalan di browser ini. Pada versi live semua pemeriksaan dilakukan di server.</p>}
        {step === 'phone' && <PhoneGate onFound={onFound} />}
        {step === 'pick' && <InvoicePick list={list} onPick={openOrder} onBack={reset} />}
        {step === 'order' && <Order pid={pid} onBack={() => (list.length > 1 ? setStep('pick') : reset())} back={list.length > 1} onLost={reset} />}
      </main>
      <footer className="mx-auto max-w-3xl px-4 pb-10 text-center text-xs text-ink-mute">
        Nomor HP digunakan untuk mencocokkan pesanan Anda, bukan sebagai verifikasi identitas.
      </footer>
    </div>
  )
}

// ---------------- 1. Nomor HP ----------------
function PhoneGate({ onFound }) {
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('')
    try {
      const r = await cek.lookup(phone)
      if (r.ok && r.invoices?.length) return onFound(r.invoices)
      setErr(r.error === 'blocked' ? 'Terlalu banyak percobaan. Silakan coba lagi beberapa saat lagi.'
        : 'Kami tidak menemukan pesanan aktif untuk nomor tersebut. Pastikan nomor HP sama dengan yang Anda berikan saat pesan, atau hubungi admin kami.')
    } catch { setErr('Terjadi kendala. Silakan coba lagi.') } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
      <Search className="mb-3 h-10 w-10 text-brand" />
      <h1 className="text-2xl font-extrabold">Cek progres pesanan Anda</h1>
      <p className="mt-1 text-lg text-ink-soft">Masukkan nomor HP yang Anda berikan saat memesan. Tidak perlu akun atau password.</p>
      <label className="mt-5 block text-base font-semibold" htmlFor="hp">Nomor HP</label>
      <div className="mt-1 flex items-center gap-2 rounded-2xl bg-white px-4 ring-2 ring-slate-300 focus-within:ring-brand">
        <Phone className="h-6 w-6 text-ink-mute" />
        <input id="hp" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0812xxxxxxx atau +62812xxxxxxx"
          className="h-14 w-full border-0 bg-transparent text-xl outline-none" />
      </div>
      {err && <p role="alert" className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-base font-semibold text-amber-900">{err}</p>}
      <button type="submit" disabled={busy || phone.replace(/\D/g, '').length < 9}
        className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-xl font-bold text-white disabled:opacity-40">
        {busy && <Loader2 className="h-6 w-6 animate-spin" />}Cari Pesanan
      </button>
      <p className="mt-3 text-sm text-ink-mute">Format 08…, 628…, maupun +628… sama-sama bisa dipakai.</p>
    </form>
  )
}

/** Tombol Hubungi Admin — hanya tampil bila nomor WhatsApp sudah diatur (Setting → File). */
const Contact = ({ className, invoice, wa }) => {
  if (!wa) return null
  return (
    <a href={`https://wa.me/${wa}${invoice ? `?text=${encodeURIComponent(`Halo, saya ingin bertanya tentang pesanan ${invoice}`)}` : ''}`} target="_blank" rel="noreferrer"
      className={cx('flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 text-base font-bold text-ink ring-2 ring-slate-300', className)}>
      <MessageCircle className="h-5 w-5 text-emerald-600" />Hubungi Admin{invoice ? ` · ${invoice}` : ''}
    </a>
  )
}

// ---------------- 2. Pilih invoice ----------------
function InvoicePick({ list, onPick, onBack }) {
  return (
    <div className="space-y-3">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-base font-semibold text-brand"><ArrowLeft className="h-4 w-4" />Ganti nomor HP</button>
      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
        <h1 className="text-2xl font-extrabold">Pilih pesanan</h1>
        <p className="mt-1 text-lg text-ink-soft">Kami menemukan {list.length} pesanan aktif untuk nomor Anda.</p>
        <ul className="mt-4 space-y-2">
          {list.map((r) => (
            <li key={r.project_id}>
              <button type="button" onClick={() => onPick(r.project_id)}
                className="flex w-full items-center gap-3 rounded-2xl bg-slate-50 p-4 text-left ring-1 ring-slate-200 hover:ring-brand">
                <ReceiptText className="h-7 w-7 shrink-0 text-brand" />
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-extrabold">{r.invoice}</span>
                  <span className="block text-base text-ink-soft">{r.service || 'Layanan'}{r.date ? ` · ${tgl(r.date)}` : ''}</span>
                </span>
                <ChevronRight className="h-6 w-6 shrink-0 text-ink-mute" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

// ---------------- 3. Detail pesanan ----------------
function Order({ pid, onBack, back, onLost }) {
  const [v, setV] = useState(null)
  const [err, setErr] = useState('')
  const [contact, setContact] = useState('') // nomor admin tetap dipakai saat akses sudah berakhir
  const load = useCallback(async () => {
    const r = await cek.order(pid)
    if (r.error) { setErr(ERR[r.error] || 'Terjadi kendala. Silakan coba lagi.'); setV(null); if (r.error === 'session') onLost() }
    else { setV(r); setContact(r.contact_wa || ''); setErr('') }
  }, [pid, onLost])
  useEffect(() => { load() }, [load])

  if (err) return (
    <div className="space-y-3">
      {back && <button type="button" onClick={onBack} className="flex items-center gap-1 text-base font-semibold text-brand"><ArrowLeft className="h-4 w-4" />Pesanan lain</button>}
      <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <CalendarClock className="mx-auto mb-3 h-12 w-12 text-amber-500" />
        <p className="text-xl font-extrabold">Akses tidak tersedia</p>
        <p className="mx-auto mt-2 max-w-md text-lg text-ink-soft">{err}</p>
        {contact ? <Contact className="mx-auto mt-5 max-w-xs" wa={contact} />
          : <p className="mt-4 text-base text-ink-mute">Silakan hubungi admin kami melalui kontak yang biasa Anda gunakan saat memesan.</p>}
      </div>
    </div>
  )
  if (!v) return <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-brand" /></div>

  return (
    <div className="space-y-4">
      {back && <button type="button" onClick={onBack} className="flex items-center gap-1 text-base font-semibold text-brand"><ArrowLeft className="h-4 w-4" />Pesanan lain</button>}

      {/* Sapaan & ringkasan */}
      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
        <p className="text-lg">{v.greeting}</p>
        <p className="mt-2 text-xl font-extrabold text-brand">{v.step_message}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-base font-bold">{v.invoice}</span>
          {v.service && <span className="rounded-full bg-brand-soft px-3 py-1 text-base font-semibold text-brand">{v.service}</span>}
          {v.pay && <span className={cx('rounded-full px-3 py-1 text-base font-bold',
            v.pay.key === 'paid' ? 'bg-emerald-100 text-emerald-800' : v.pay.key === 'partial' ? 'bg-amber-100 text-amber-900'
              : v.pay.key === 'unpaid' ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-ink-soft')}>{v.pay.label}</span>}
        </div>
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-ink-soft ring-1 ring-slate-200">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-brand" /><span>{v.access_message}</span>
        </p>
      </section>

      <Stepper v={v} />

      {/* Dokumen */}
      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
        <p className="flex items-center gap-2 text-lg font-bold"><FileText className="h-5 w-5 text-brand" />Dokumen Anda</p>
        {!v.has_docs ? <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-base text-ink-soft">Dokumen akan muncul di sini setelah tersedia.</p>
          : <Docs pid={pid} v={v} onLost={onLost} />}
      </section>

      {/* Pengiriman */}
      {v.courier && (
        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
          <p className="flex items-center gap-2 text-lg font-bold"><Truck className="h-5 w-5 text-brand" />Pengiriman</p>
          <dl className="mt-3 grid gap-2 text-base sm:grid-cols-2">
            <div><dt className="text-ink-mute">Kurir</dt><dd className="font-bold">{v.courier.name}</dd></div>
            {v.courier.resi && <div><dt className="text-ink-mute">Nomor resi</dt><dd className="font-mono font-bold">{v.courier.resi}</dd></div>}
            {v.courier.sent_at && <div><dt className="text-ink-mute">Diserahkan ke kurir</dt><dd className="font-bold">{waktu(v.courier.sent_at)}</dd></div>}
            {v.courier.status && <div><dt className="text-ink-mute">Status terakhir</dt><dd className="font-bold">{v.courier.status}</dd></div>}
          </dl>
          {v.courier.track && <a href={v.courier.track} target="_blank" rel="noreferrer" className="mt-3 flex h-12 items-center justify-center gap-2 rounded-xl bg-ink px-5 text-base font-bold text-white sm:inline-flex"><Truck className="h-5 w-5" />Lacak Kiriman</a>}
          <p className="mt-3 text-sm text-ink-soft">{v.pack_note}</p>
        </section>
      )}

      {/* Catatan untuk pelanggan */}
      {v.note && (
        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
          <p className="flex items-center gap-2 text-lg font-bold"><StickyNote className="h-5 w-5 text-brand" />Catatan untuk Anda</p>
          <p className="mt-2 whitespace-pre-wrap text-base">{v.note.text}</p>
          <p className="mt-2 text-sm text-ink-mute">Diperbarui {waktu(v.note.at)}</p>
        </section>
      )}

      <Receipts pid={pid} v={v} reload={load} />
      <Contact invoice={v.invoice} wa={v.contact_wa} />
      <p className="flex items-start gap-2 px-1 text-sm text-ink-mute"><Info className="mt-0.5 h-4 w-4 shrink-0" />Halaman ini menampilkan progres dan dokumen pesanan Anda. Simpan atau unduh dokumen sebelum masa akses berakhir.</p>
    </div>
  )
}

// ---------------- Stepper / timeline ----------------
function Stepper({ v }) {
  const i = v.step_index
  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
      <p className="text-lg font-bold">Perjalanan pesanan</p>
      {/* desktop: horizontal */}
      <ol className="mt-5 hidden items-start sm:flex" aria-label={`Progres: ${v.steps[i]?.label || ''}`}>
        {v.steps.map((st, n) => (
          <li key={st.key} className="flex flex-1 items-start last:flex-none">
            <span className="flex w-20 flex-col items-center text-center">
              <span className={cx('grid h-10 w-10 place-items-center rounded-full text-sm font-bold', n < i ? 'bg-emerald-500 text-white' : n === i ? 'bg-brand text-white ring-4 ring-brand-soft' : 'bg-slate-200 text-ink-mute')}>
                {n < i ? <CheckCircle2 className="h-5 w-5" /> : n + 1}
              </span>
              <span className={cx('mt-2 text-xs font-semibold leading-tight', n === i ? 'text-ink' : n < i ? 'text-emerald-700' : 'text-ink-mute')}>{st.label}</span>
              {v.stamps[st.key] && n <= i && <span className="mt-0.5 text-[10px] text-ink-mute">{tgl(v.stamps[st.key])}</span>}
            </span>
            {n < v.steps.length - 1 && <span className={cx('mt-5 h-1 flex-1 rounded', n < i ? 'bg-emerald-400' : 'bg-slate-200')} />}
          </li>
        ))}
      </ol>
      {/* ponsel: timeline vertikal */}
      <ol className="mt-4 sm:hidden" aria-label={`Progres: ${v.steps[i]?.label || ''}`}>
        {v.steps.map((st, n) => (
          <li key={st.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold', n < i ? 'bg-emerald-500 text-white' : n === i ? 'bg-brand text-white ring-4 ring-brand-soft' : 'bg-slate-200 text-ink-mute')}>
                {n < i ? <CheckCircle2 className="h-4 w-4" /> : n + 1}
              </span>
              {n < v.steps.length - 1 && <span className={cx('my-1 w-1 flex-1 rounded', n < i ? 'bg-emerald-400' : 'bg-slate-200')} />}
            </div>
            <div className="pb-4">
              <p className={cx('text-base font-bold', n === i ? 'text-ink' : n < i ? 'text-emerald-700' : 'text-ink-mute')}>{st.label}</p>
              {v.stamps[st.key] && n <= i && <p className="text-sm text-ink-mute">{waktu(v.stamps[st.key])}</p>}
              {n === i && <p className="text-sm font-semibold text-brand">Tahap saat ini</p>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

// ---------------- Dokumen ----------------
function Docs({ pid, v, onLost }) {
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState('')
  const [preview, setPreview] = useState(null)
  const [pick, setPick] = useState([])
  const [mail, setMail] = useState({ busy: false, msg: '', ok: false })

  const get = async (ref, name) => { const r = await cek.file(pid, ref); return { ...r, name: r.name || name } }
  const download = async (d) => {
    setBusy(d.ref); setMsg('')
    try { const r = await get(d.ref, d.name); if (r.blob) await saveBlob(r.name, r.blob); else if (r.url) window.open(r.url, '_blank', 'noopener') }
    catch (e) { setMsg(e.message); if (/Sesi/.test(e.message)) onLost() } finally { setBusy(null) }
  }
  const toggle = (ref) => setPick((p) => (p.includes(ref) ? p.filter((x) => x !== ref) : [...p, ref]))
  const sendMail = async () => {
    setMail({ busy: true, msg: '', ok: false })
    const r = await cek.email(pid, pick.length ? pick : v.docs.map((d) => d.ref))
    setMail({ busy: false, ok: !!r.ok, msg: r.ok ? `Permintaan terkirim ke layanan email untuk ${v.email_masked}. Status: diproses.`
      : r.error === 'not_configured' ? 'Layanan email belum terhubung, jadi tidak ada email yang dikirim. Silakan gunakan tombol Download.'
      : r.error === 'limit' ? 'Batas pengiriman email hari ini sudah tercapai. Silakan gunakan tombol Download.'
      : r.error === 'no_email' ? 'Alamat email belum tercatat pada pesanan Anda. Silakan hubungi admin untuk menambahkannya.'
      : ERR[r.error] || 'Email belum dapat dikirim. Silakan coba lagi.' })
    if (r.error === 'session') onLost()
  }

  return (
    <>
      <ul className="mt-3 space-y-2">
        {v.docs.map((d) => (
          <li key={d.ref} className={cx('rounded-2xl p-3 ring-1', d.kind === 'final' ? 'bg-emerald-50/60 ring-emerald-200' : 'bg-amber-50/60 ring-amber-200')}>
            <div className="flex flex-wrap items-center gap-3">
              <input type="checkbox" checked={pick.includes(d.ref)} onChange={() => toggle(d.ref)} aria-label={`Pilih ${d.name}`} className="h-5 w-5 shrink-0" />
              <FileText className={cx('h-8 w-8 shrink-0', d.kind === 'final' ? 'text-emerald-600' : 'text-amber-600')} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold">{d.name}</p>
                <p className="text-sm text-ink-soft">
                  <span className={cx('mr-1 rounded px-1.5 py-0.5 text-xs font-bold uppercase', d.kind === 'final' ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white')}>{d.kind === 'final' ? 'Final' : 'Draft'}</span>
                  {d.label} · versi {d.version}{d.at ? ` · ${tgl(d.at)}` : ''}
                </p>
              </div>
              <div className="flex w-full gap-2 sm:w-auto">
                <button type="button" onClick={() => setPreview(d)} className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-white px-4 text-base font-bold ring-2 ring-slate-300 sm:flex-none"><Eye className="h-5 w-5" />Lihat</button>
                <button type="button" onClick={() => download(d)} disabled={busy === d.ref} className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-base font-bold text-white disabled:opacity-60 sm:flex-none">
                  {busy === d.ref ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}Download
                </button>
              </div>
            </div>
            {d.kind === 'draft' && <p className="mt-2 text-sm font-semibold text-amber-900">{DRAFT_NOTE}</p>}
          </li>
        ))}
      </ul>
      {msg && <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-base font-semibold text-rose-700">{msg}</p>}
      <div className="mt-4 border-t border-slate-200 pt-4">
        <p className="flex items-center gap-2 text-base font-bold"><Mail className="h-5 w-5 text-brand" />Kirim ke Email Saya</p>
        {v.has_email
          ? <p className="mt-1 text-base text-ink-soft">Dokumen hanya dikirim ke email yang tercatat pada pesanan: <b>{v.email_masked}</b>. {pick.length ? `${pick.length} dokumen dipilih.` : 'Tanpa memilih, semua dokumen di atas dikirim.'}</p>
          : <p className="mt-1 text-base text-ink-soft">Email belum tercatat pada pesanan Anda. Silakan hubungi admin untuk menambahkannya.</p>}
        <button type="button" onClick={sendMail} disabled={!v.has_email || mail.busy}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 text-base font-bold text-white disabled:opacity-40 sm:w-auto">
          {mail.busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail className="h-5 w-5" />}Kirim ke Email Saya
        </button>
        {mail.msg && <p role="status" className={cx('mt-3 rounded-xl px-4 py-3 text-base', mail.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900')}>{mail.msg}</p>}
      </div>
      {preview && <FilePreview file={{ name: preview.name }} loader={async () => (await get(preview.ref, preview.name)).blob} onClose={() => setPreview(null)} />}
    </>
  )
}

// ---------------- Konfirmasi penerimaan ----------------
function Receipts({ pid, v, reload }) {
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState('')
  const [done, setDone] = useState(null)
  const groups = (v.receipts || []).filter((g) => g.can || g.confirmed_at)
  if (!groups.length) return null

  const confirm = async (g) => {
    setBusy(g.sub_id); setMsg('')
    const r = await cek.confirm(pid, g.sub_id)
    setBusy(null)
    if (r.ok) { setDone(g.sub_id); await reload(); setTimeout(() => { window.location.href = v.review_url }, 1200); return }
    setMsg(r.error === 'no_register' ? 'Nomor register dokumen Anda belum siap, jadi konfirmasi belum dapat diproses. Silakan hubungi admin kami.'
      : r.error === 'not_ready' ? 'Dokumen ini belum diserahkan, jadi konfirmasi belum dapat dilakukan.'
      : ERR[r.error] || 'Konfirmasi gagal diproses. Silakan coba lagi.')
  }

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
      <p className="flex items-center gap-2 text-lg font-bold"><PackageCheck className="h-5 w-5 text-brand" />Konfirmasi penerimaan</p>
      <div className="mt-3 space-y-4">
        {groups.map((g) => (
          <div key={g.sub_id} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <p className="text-base font-bold">{g.title}</p>
            <ul className="mt-1 list-inside list-disc text-sm text-ink-soft">{g.docs.map((d) => <li key={d.ref}>{d.name}</li>)}</ul>
            {g.confirmed_at ? (
              <div className="mt-3">
                <p className="flex items-center gap-2 text-base font-bold text-emerald-700"><CheckCircle2 className="h-5 w-5" />Penerimaan Dikonfirmasi</p>
                <p className="text-sm text-ink-soft">{waktu(g.confirmed_at)}</p>
                {g.reg_active && <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-base ring-1 ring-emerald-200">Status register: <b className="text-emerald-800">Aktif</b>{g.reg_numbers.length ? <> · <span className="font-mono">{g.reg_numbers.join(', ')}</span></> : null}</p>}
                <a href={v.review_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-5 text-base font-bold text-ink ring-2 ring-slate-300"><Star className="h-5 w-5 text-amber-500" />Beri Ulasan</a>
              </div>
            ) : (
              <div className="mt-3">
                {!g.reg_ready && <p className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">Nomor register dokumen ini belum siap. Silakan hubungi admin kami sebelum mengonfirmasi.</p>}
                <p className="text-sm text-ink-soft">Klik untuk mengonfirmasi penerimaan dan mengaktifkan nomor register dokumen Anda. Setelah berhasil, Anda akan diarahkan ke halaman ulasan Google. Memberikan ulasan bersifat opsional.</p>
                <button type="button" onClick={() => confirm(g)} disabled={busy === g.sub_id || !g.reg_ready || done === g.sub_id}
                  className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-lg font-bold text-white disabled:opacity-40">
                  {busy === g.sub_id ? <Loader2 className="h-6 w-6 animate-spin" /> : <PackageCheck className="h-6 w-6" />}Dokumen Sudah Saya Terima
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {msg && <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-base font-semibold text-rose-700">{msg}</p>}
      {done && <p role="status" className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-base text-emerald-800">Terima kasih. Kami mengarahkan Anda ke halaman ulasan Google…</p>}
    </section>
  )
}
