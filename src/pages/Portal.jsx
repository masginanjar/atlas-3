import { useCallback, useEffect, useState } from 'react'
import { Download, Eye, Loader2, Lock, Phone, Mail, CheckCircle2, Clock, FileText, ShieldAlert, Info, CalendarClock } from 'lucide-react'
import { portal, PORTAL_DEMO } from '../lib/portalClient.js'
import { saveBlob } from '../lib/download.js'
import { clock } from '../lib/performance.js'
import FilePreview from '../components/FilePreview.jsx'
import { cx } from '../components/ui.jsx'
import { rupiah, tgl } from '../lib/format.js'

// ============================================================
//  PORTAL PELANGGAN & VENDOR — #/p/<token>, tanpa akun.
//  Masuk dengan nomor HP yang terdaftar. Hanya lihat & unduh.
// ============================================================
const waktu = (iso) => (iso ? `${tgl(iso)} pukul ${clock(new Date(iso))} WITA` : '—')
const INACTIVE = 'Tautan ini sudah tidak aktif. Silakan hubungi CS untuk mendapatkan akses kembali.'

export default function Portal({ token }) {
  const [state, setState] = useState({ loading: true })
  const [view, setView] = useState(null)

  const load = useCallback(async () => {
    const o = await portal.open(token)
    if (o.state === 'active' && o.verified) {
      const v = await portal.view(token)
      if (!v.error) { setView(v); setState({ loading: false, ...o }); return }
    }
    setView(null); setState({ loading: false, ...o })
  }, [token])
  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-ink px-4 py-4 text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-lg font-extrabold text-ink">A</span>
          <div><p className="text-lg font-extrabold leading-tight">247 Sworn Translator</p><p className="text-sm text-white/60">{state.kind === 'vendor' ? 'Portal Vendor' : 'Status Dokumen Anda'}</p></div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        {PORTAL_DEMO && <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">Mode demo — validasi berjalan di browser ini. Pada versi live, semua pemeriksaan dilakukan di server.</p>}
        {state.loading ? <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-brand" /></div>
          : ['expired', 'revoked', 'missing'].includes(state.state) ? <Notice icon={ShieldAlert} title={state.state === 'missing' ? 'Tautan tidak ditemukan' : 'Tautan tidak aktif'} text={INACTIVE} />
          : !view ? <PhoneGate token={token} kind={state.kind} locked={state.state === 'locked'} onOk={load} />
          : view.kind === 'vendor' ? <VendorView token={token} v={view} onExpired={load} />
          : <CustomerView token={token} v={view} onExpired={load} />}
      </main>
    </div>
  )
}

function Notice({ icon: Icon, title, text }) {
  return (
    <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
      <Icon className="mx-auto mb-3 h-12 w-12 text-rose-500" />
      <p className="text-xl font-extrabold">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-lg text-ink-soft">{text}</p>
    </div>
  )
}

function PhoneGate({ token, kind, locked, onOk }) {
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(locked ? 'Terlalu banyak percobaan. Silakan coba lagi 15 menit lagi.' : '')
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('')
    const r = await portal.verify(token, phone)
    setBusy(false)
    if (r.ok) return onOk()
    setErr(r.error === 'locked' ? 'Terlalu banyak percobaan. Silakan coba lagi 15 menit lagi.'
      : r.error === 'wrong' ? `Nomor HP tidak cocok dengan data kami.${r.left ? ` Sisa percobaan: ${r.left}.` : ''}`
      : r.error === 'no_phone' ? 'Nomor HP belum terdaftar untuk tautan ini. Silakan hubungi CS.'
      : ['expired', 'revoked'].includes(r.error) ? INACTIVE : 'Terjadi kendala. Silakan coba lagi.')
  }
  return (
    <form onSubmit={submit} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
      <Lock className="mb-3 h-10 w-10 text-brand" />
      <h1 className="text-2xl font-extrabold">Masukkan nomor HP Anda</h1>
      <p className="mt-1 text-lg text-ink-soft">Gunakan nomor HP yang terdaftar {kind === 'vendor' ? 'sebagai vendor' : 'pada pesanan'} untuk membuka halaman ini.</p>
      <label className="mt-5 block text-base font-semibold" htmlFor="hp">Nomor HP</label>
      <div className="mt-1 flex items-center gap-2 rounded-2xl bg-white px-4 ring-2 ring-slate-300 focus-within:ring-brand">
        <Phone className="h-6 w-6 text-ink-mute" />
        <input id="hp" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0812xxxxxxx atau +62812xxxxxxx"
          className="h-14 w-full border-0 bg-transparent text-xl outline-none" />
      </div>
      {err && <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-base font-semibold text-rose-700">{err}</p>}
      <button type="submit" disabled={busy || phone.replace(/\D/g, '').length < 9}
        className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-xl font-bold text-white disabled:opacity-40">
        {busy && <Loader2 className="h-6 w-6 animate-spin" />}Buka Halaman
      </button>
      <p className="mt-3 text-sm text-ink-mute">Format 08… maupun +62… sama-sama bisa dipakai.</p>
    </form>
  )
}

function useDownload(token, onExpired) {
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState('')
  const [preview, setPreview] = useState(null)
  const get = async (ref, name) => {
    const r = await portal.file(token, ref)
    return { blob: r.blob, name: r.name || name }
  }
  const download = async (ref, name) => {
    setBusy(ref); setMsg('')
    try { const r = await get(ref, name); await saveBlob(r.name, r.blob) } catch (e) { setMsg(e.message); if (/tidak aktif|Sesi/.test(e.message)) onExpired() } finally { setBusy(null) }
  }
  const view = (ref, name) => setPreview({ ref, name })
  const previewEl = preview && <FilePreview file={{ name: preview.name }} loader={async () => (await get(preview.ref, preview.name)).blob} onClose={() => setPreview(null)} />
  return { busy, msg, download, view, previewEl }
}

const ExpiryNote = ({ at }) => (
  <p className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-ink-soft ring-1 ring-slate-200">
    <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
    <span>Akses halaman ini aktif sampai <b className="text-ink">{waktu(at)}</b>. Masa aktif berlaku untuk akses portal; file yang sudah Anda unduh atau terima lewat email tetap tersimpan pada Anda.</span>
  </p>
)

function CustomerView({ token, v, onExpired }) {
  const dl = useDownload(token, onExpired)
  const [mail, setMail] = useState({ open: false, email: '', busy: false, msg: '', ok: false })
  const sendMail = async () => {
    setMail((m) => ({ ...m, busy: true, msg: '' }))
    const r = await portal.email(token, mail.open && mail.email ? { email: mail.email } : {})
    const msg = r.ok ? `Dokumen dikirim ke ${r.to}. Periksa kotak masuk Anda.`
      : r.error === 'verify_sent' ? 'Kami mengirim kode verifikasi ke email baru tersebut. Masukkan kodenya untuk melanjutkan.'
      : r.error === 'limit' ? 'Batas pengiriman email hari ini sudah tercapai (3x). Silakan unduh PDF langsung.'
      : r.error === 'invalid_email' ? 'Alamat email tidak valid.'
      : r.error === 'not_configured' ? 'Layanan email belum aktif, jadi email tidak dikirim. Silakan gunakan tombol Download PDF.'
      : ['expired', 'revoked'].includes(r.error) ? INACTIVE : 'Email belum dapat dikirim. Silakan coba lagi.'
    setMail((m) => ({ ...m, busy: false, msg, ok: !!r.ok }))
    if (['expired', 'revoked', 'session'].includes(r.error)) onExpired()
  }
  const anyFile = v.services.some((s) => s.files.length) || v.refunds.length
  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
        <p className="text-base text-ink-mute">Halo,</p>
        <h1 className="text-2xl font-extrabold">{v.name}</h1>
        <div className="mt-3 grid gap-2 text-base sm:grid-cols-2">
          <p><span className="text-ink-mute">No. invoice/proyek</span><br /><b className="text-lg">{v.invoice}</b></p>
          <p><span className="text-ink-mute">Perkiraan selesai</span><br /><b className="text-lg">{v.deadline ? `${tgl(v.deadline)}${v.deadline_time ? `, ${v.deadline_time} WITA` : ''}` : 'Belum ditentukan'}</b></p>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-mute"><Clock className="h-4 w-4" />Diperbarui terakhir {waktu(v.updated_at)}</p>
        <ExpiryNote at={v.expires_at} />
      </section>

      {v.services.map((s) => (
        <section key={s.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-brand-soft px-3 py-1 text-sm font-bold text-brand">{s.type}</span>
            <span className={cx('rounded-full px-3 py-1 text-sm font-bold', s.index >= s.steps.length - 1 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800')}>Status: {s.status}</span>
          </div>
          <p className="mt-2 text-lg font-bold">{s.title}</p>
          <ol className="mt-4 flex items-center" aria-label={`Progres ${s.type}: ${s.status}`}>
            {s.steps.map((st, i) => (
              <li key={st} className="flex flex-1 items-center last:flex-none">
                <span className="flex flex-col items-center text-center">
                  <span className={cx('grid h-9 w-9 place-items-center rounded-full text-sm font-bold', i <= s.index ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-ink-mute')}>{i < s.index || (i === s.index && i === s.steps.length - 1) ? <CheckCircle2 className="h-5 w-5" /> : i + 1}</span>
                  <span className={cx('mt-1 text-xs font-semibold sm:text-sm', i === s.index ? 'text-ink' : 'text-ink-mute')}>{st}</span>
                </span>
                {i < s.steps.length - 1 && <span className={cx('mx-1 mb-5 h-1 flex-1 rounded', i < s.index ? 'bg-emerald-400' : 'bg-slate-200')} />}
              </li>
            ))}
          </ol>
          {s.registration_no && <p className="mt-4 rounded-xl bg-sky-50 px-4 py-3 text-base ring-1 ring-sky-200">Nomor registrasi: <b className="text-lg tracking-wide">{s.registration_no}</b></p>}
          <div className="mt-4 space-y-2">
            {s.files.length === 0 ? <p className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-base text-ink-soft"><Loader2 className="h-5 w-5" />Dokumen sedang diproses</p>
              : s.files.map((f) => <FileRow key={f.ref} f={f} dl={dl} />)}
          </div>
        </section>
      ))}

      {v.refunds.length > 0 && (
        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
          <p className="text-lg font-bold">Bukti refund</p>
          <div className="mt-3 space-y-2">{v.refunds.map((f) => <FileRow key={f.ref} f={{ ...f, label: `${f.label} · ${rupiah(f.amount)} · ${tgl(f.date)}` }} dl={dl} />)}</div>
        </section>
      )}
      {dl.msg && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-base font-semibold text-rose-700">{dl.msg}</p>}

      {anyFile && (
        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
          <p className="flex items-center gap-2 text-lg font-bold"><Mail className="h-5 w-5 text-brand" />Kirim ke email</p>
          {v.has_email && !mail.open && <p className="mt-1 text-base text-ink-soft">File akan dikirim ke <b>{v.email_masked}</b>.</p>}
          {(!v.has_email || mail.open) && (
            <div className="mt-2">
              <label className="text-sm font-semibold" htmlFor="em">Email baru</label>
              <input id="em" type="email" value={mail.email} onChange={(e) => setMail((m) => ({ ...m, email: e.target.value }))} placeholder="nama@email.com"
                className="mt-1 h-12 w-full rounded-xl px-3 text-base ring-2 ring-slate-300 focus:outline-none focus:ring-brand" />
              <p className="mt-1 text-sm text-ink-mute">Email baru akan diverifikasi dulu sebelum dokumen dikirim.</p>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={sendMail} disabled={mail.busy || ((!v.has_email || mail.open) && !mail.email)}
              className="flex h-12 items-center gap-2 rounded-xl bg-brand px-5 text-base font-bold text-white disabled:opacity-40">{mail.busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail className="h-5 w-5" />}Kirim ke Email Saya</button>
            {v.has_email && <button type="button" onClick={() => setMail((m) => ({ ...m, open: !m.open }))} className="h-12 rounded-xl px-4 text-base font-semibold text-brand underline">{mail.open ? 'Pakai email tersimpan' : 'Ganti email'}</button>}
          </div>
          {mail.msg && <p role="status" className={cx('mt-3 rounded-xl px-4 py-3 text-base', mail.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900')}>{mail.msg}</p>}
        </section>
      )}
      <p className="flex items-start gap-2 px-1 text-sm text-ink-mute"><Info className="mt-0.5 h-4 w-4 shrink-0" />Halaman ini hanya untuk melihat & mengunduh dokumen pesanan Anda. Ada pertanyaan? Balas pesan WhatsApp dari CS kami.</p>
      {dl.previewEl}
    </div>
  )
}

function FileRow({ f, dl }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-emerald-50/60 p-3 ring-1 ring-emerald-200">
      <FileText className="h-8 w-8 shrink-0 text-emerald-600" />
      <div className="min-w-0 flex-1"><p className="truncate text-base font-bold">{f.name}</p><p className="text-sm text-ink-soft">{f.label}</p></div>
      <button type="button" onClick={() => dl.download(f.ref, f.name)} disabled={dl.busy === f.ref}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-base font-bold text-white hover:bg-emerald-700 disabled:opacity-60 sm:w-auto">
        {dl.busy === f.ref ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}Download PDF
      </button>
    </div>
  )
}

const PAY_STYLE = { 'Lunas': 'bg-emerald-100 text-emerald-800', 'Sebagian': 'bg-amber-100 text-amber-900', 'Belum Dibayar': 'bg-slate-200 text-ink' }
function VendorView({ token, v, onExpired }) {
  const dl = useDownload(token, onExpired)
  const [f, setF] = useState('semua')
  const list = v.jobs.filter((j) => (f === 'semua' ? true : f === 'selesai' ? j.done : !j.done))
  const count = (k) => v.jobs.filter((j) => (k === 'semua' ? true : k === 'selesai' ? j.done : !j.done)).length
  const Pay = ({ j }) => (
    <div className="space-y-2">
      <span className={cx('inline-block rounded-full px-3 py-1 text-base font-bold', PAY_STYLE[j.pay_status])}>{j.pay_status}</span>
      <p className="text-base">Dibayar <b>{rupiah(j.paid)}</b> dari {rupiah(j.fee)}</p>
      {j.payments.map((p, i) => (
        <div key={i} className="rounded-xl bg-slate-50 p-2 text-sm ring-1 ring-slate-200">
          <p>{rupiah(p.amount)} · {tgl(p.date)}</p>
          {p.allocation && <p className="text-ink-soft">Satu transfer untuk {p.allocation.length} pekerjaan: {p.allocation.map((a) => `${a.ref} ${rupiah(a.amount)}`).join(' · ')}</p>}
          {p.ref && <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => dl.view(p.ref, p.name)} className="flex h-11 items-center gap-1.5 rounded-xl bg-white px-4 text-base font-bold ring-2 ring-slate-300"><Eye className="h-5 w-5" />Lihat Bukti</button>
            <button type="button" onClick={() => dl.download(p.ref, p.name)} disabled={dl.busy === p.ref} className="flex h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-base font-bold text-white disabled:opacity-60">{dl.busy === p.ref ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}Download</button>
          </div>}
        </div>
      ))}
    </div>
  )
  return (
    <div className="space-y-4 text-lg">
      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
        <p className="text-lg text-ink-mute">Halo,</p>
        <h1 className="text-3xl font-extrabold">{v.name}</h1>
        <p className="mt-1 text-lg text-ink-soft">Daftar pekerjaan & pembayaran Anda.</p>
        <ExpiryNote at={v.expires_at} />
      </section>
      <div className="flex gap-2" role="tablist">
        {[['semua', 'Semua'], ['berjalan', 'Berjalan'], ['selesai', 'Selesai']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={f === k} onClick={() => setF(k)} className={cx('h-12 flex-1 rounded-xl text-lg font-bold ring-2', f === k ? 'bg-ink text-white ring-ink' : 'bg-white text-ink ring-slate-300')}>{l} ({count(k)})</button>
        ))}
      </div>
      {list.length === 0 && <Notice icon={FileText} title="Belum ada pekerjaan" text="Tidak ada pekerjaan pada pilihan ini." />}
      {/* Tabel (layar lebar) */}
      {list.length > 0 && <div className="hidden overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 lg:block">
        <table className="w-full text-base">
          <thead className="bg-slate-100 text-left text-sm font-bold uppercase text-ink"><tr><th className="px-4 py-3">Proyek</th><th className="px-3 py-3">Pekerjaan</th><th className="px-3 py-3">Deadline</th><th className="px-3 py-3">Status Dokumen</th><th className="px-4 py-3">Pembayaran & Bukti Transfer</th></tr></thead>
          <tbody className="divide-y divide-slate-200">{list.map((j) => (
            <tr key={j.id} className="align-top"><td className="px-4 py-4 font-bold">{j.ref}</td><td className="px-3 py-4">{j.work}{j.lang && <span className="block text-sm text-ink-soft">{j.lang}</span>}{j.service && <span className="block text-sm text-ink-soft">{j.service}</span>}</td>
              <td className="px-3 py-4">{tgl(j.deadline)}</td><td className="px-3 py-4"><b className={j.doc_status === 'Selesai' ? 'text-emerald-700' : 'text-amber-800'}>{j.doc_status}</b></td><td className="px-4 py-4"><Pay j={j} /></td></tr>
          ))}</tbody>
        </table>
      </div>}
      {/* Kartu (ponsel) */}
      <div className="space-y-3 lg:hidden">{list.map((j) => (
        <section key={j.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-semibold uppercase text-ink-mute">Proyek</p><p className="text-xl font-extrabold">{j.ref}</p>
          <p className="mt-2 font-bold">{j.work}</p>{j.lang && <p className="text-base text-ink-soft">{j.lang}</p>}
          <div className="mt-3 grid grid-cols-2 gap-2 text-base"><p><span className="text-ink-mute">Deadline</span><br /><b>{tgl(j.deadline)}</b></p><p><span className="text-ink-mute">Dokumen</span><br /><b className={j.doc_status === 'Selesai' ? 'text-emerald-700' : 'text-amber-800'}>{j.doc_status}</b></p></div>
          <div className="mt-3 border-t border-slate-200 pt-3"><Pay j={j} /></div>
        </section>
      ))}</div>
      {dl.msg && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-base font-semibold text-rose-700">{dl.msg}</p>}
      {dl.previewEl}
    </div>
  )
}
