import { useEffect, useMemo, useState } from 'react'
import { Share2, MessageCircle, Mail, Copy, ExternalLink, Link2, ShieldOff, CalendarPlus, RefreshCw, History, FileCheck2, AlertTriangle, Info } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { can, invoiceLabel} from '../config/access.js'
import { finalFilesOf, paymentOf, newLink, linkState, addMonth, normPhone, isEmail, randomToken } from '../lib/portalCore.js'
import { portalUrl, PORTAL_DEMO } from '../lib/portalClient.js'
import { copyText } from './CopyText.jsx'
import { Button, Field, Input, Sheet, Textarea, cx } from './ui.jsx'
import { rupiah, tgl, jam } from '../lib/format.js'
import { clock } from '../lib/performance.js'
const jamWita = (iso) => (iso ? `${clock(new Date(iso))} WITA` : '')

// ============================================================
//  BAGIKAN / KIRIM NOTIFIKASI (CS) — WhatsApp / email + tautan portal.
//  Tanpa layanan pengiriman terhubung: "Buka WhatsApp" / "Salin Pesan" / "Buka Email".
//  Riwayat membedakan: tautan WA dibuka · pesan disalin · draf email dibuka · terkirim (dikonfirmasi layanan) · diterima.
// ============================================================
export const RESULT = {
  wa_opened: ['Tautan WhatsApp dibuka', 'bg-amber-50 text-amber-800 ring-amber-200'],
  copied: ['Pesan disalin', 'bg-slate-100 text-ink-soft ring-slate-200'],
  email_draft_opened: ['Draf email dibuka', 'bg-amber-50 text-amber-800 ring-amber-200'],
  sent: ['Terkirim (dikonfirmasi layanan)', 'bg-sky-50 text-sky-700 ring-sky-200'],
  delivered: ['Diterima', 'bg-emerald-50 text-emerald-700 ring-emerald-200'],
  failed: ['Gagal', 'bg-rose-50 text-rose-700 ring-rose-200'],
  not_configured: ['Tidak terkirim — layanan email belum terhubung', 'bg-rose-50 text-rose-700 ring-rose-200'],
}
const KINDS = {
  tr_done: { label: 'Hasil terjemahan selesai', who: 'customer', types: ['terjemahan'] },
  ap_done: { label: 'Apostille / legalisasi selesai', who: 'customer', types: ['apostille', 'legalisasi'] },
  refund: { label: 'Bukti refund tersedia', who: 'customer', types: ['refund'] },
  reg_no: { label: 'Nomor registrasi tersedia', who: 'customer', types: [] },
  vendor_paid: { label: 'Pembayaran vendor + bukti transfer', who: 'vendor', types: [] },
}
const EMAIL_LIVE = import.meta.env.VITE_EMAIL_ENABLED === '1'
const toWa = (p) => { const d = normPhone(p); return d.startsWith('0') ? `62${d.slice(1)}` : d }
const sapa = (name) => { const n = String(name || '').trim() || 'Pelanggan'; return /^(bapak|ibu|pak|bu)\s/i.test(n) ? n : `Bapak/Ibu ${n}` }

function template(kind, v) {
  switch (kind) {
    case 'tr_done': return `Halo ${sapa(v.name)}, hasil terjemahan untuk proyek ${v.invoice} sudah selesai. Silakan lihat status dan unduh PDF melalui ${v.url}\nMasukkan nomor HP yang terdaftar untuk membuka halaman. Tautan aktif sampai ${v.until}. Terima kasih.`
    case 'ap_done': return `Halo ${sapa(v.name)}, proses ${v.service || 'apostille'} untuk proyek ${v.invoice} sudah selesai. Detail dan dokumen yang tersedia dapat dilihat melalui ${v.url}\nMasukkan nomor HP yang terdaftar untuk membuka halaman. Tautan aktif sampai ${v.until}. Terima kasih.`
    case 'refund': return `Halo ${sapa(v.name)}, refund sebesar ${v.amount} untuk proyek ${v.invoice} telah diproses pada ${v.date}. Bukti refund tersedia melalui ${v.url}\nMasukkan nomor HP yang terdaftar untuk membuka halaman. Terima kasih.`
    case 'reg_no': return `Halo ${sapa(v.name)}, nomor registrasi untuk ${v.service} pada proyek ${v.invoice} adalah ${v.reg}. Perkembangan dokumen dapat dilihat melalui ${v.url}\nTerima kasih.`
    case 'vendor_paid': return `${sapa(v.name)}, pembayaran untuk proyek ${v.invoice} sebesar ${v.amount} sudah kami transfer. Bukti transfer dapat dilihat dan diunduh di sini: ${v.url}\nMasukkan nomor HP yang terdaftar untuk membuka halaman. Terima kasih.`
    default: return ''
  }
}

export default function ShareSheet({ project, open, onClose }) {
  const { user, data, save, notify, patchSubData } = useApp()
  const vendors = useMemo(() => {
    const ids = [...new Set((project.sub_projects || []).map((s) => s.data?.vendor).filter(Boolean))]
    return ids.map((id) => data.people.find((p) => p.id === id)).filter(Boolean)
  }, [project, data.people])
  const [to, setTo] = useState('customer') // 'customer' | vendor id
  const vendor = vendors.find((v) => v.id === to)
  const finals = useMemo(() => finalFilesOf(project, data.requests || []), [project, data.requests])
  const vendorPays = useMemo(() => (vendor ? (project.sub_projects || []).filter((s) => s.data?.vendor === vendor.id)
    .flatMap((s) => paymentOf(s).payments.map((p, i) => ({ ...p, ref: `pay:${s.id}:${i}`, sub: s }))).filter((p) => p.bukti) : []), [vendor, project])
  const regSubs = (project.sub_projects || []).filter((s) => ['apostille', 'legalisasi'].includes(s.type) || s.data?.registration_no)

  const kinds = Object.entries(KINDS).filter(([, k]) => (to === 'customer' ? k.who === 'customer' : k.who === 'vendor'))
  const availability = (k) => (k === 'vendor_paid' ? vendorPays.length > 0 : k === 'reg_no' ? regSubs.length > 0 : finals.some((f) => KINDS[k].types.includes(f.type)))
  const [kind, setKind] = useState('')
  const [channel, setChannel] = useState('wa')
  const [sel, setSel] = useState([])
  const [regs, setRegs] = useState({})
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [saveContact, setSaveContact] = useState(false)
  const [msg, setMsg] = useState('')
  const [edited, setEdited] = useState(false)
  const [pendingToken] = useState(() => randomToken())

  // tautan aktif (pelanggan per proyek, vendor per vendor)
  const links = data.share_links || []
  const link = to === 'customer'
    ? links.find((l) => l.kind === 'customer' && l.project_id === project.id && ['active', 'locked'].includes(linkState(l)))
    : links.find((l) => l.kind === 'vendor' && l.vendor_id === to && ['active', 'locked'].includes(linkState(l)))
  const token = link?.token ?? pendingToken
  const until = link?.expires_at ?? addMonth(new Date().toISOString())
  const url = portalUrl(token)

  useEffect(() => { // reset saat penerima berganti
    const k = (to === 'customer' ? ['tr_done', 'ap_done', 'refund', 'reg_no'] : ['vendor_paid']).find(availability) || ''
    setKind(k); setSel([]); setEdited(false)
    if (to === 'customer') { setPhone(project.customer?.ship?.phone || project.customer?.phone || ''); setEmail(project.customer?.email || '') }
    else { setPhone(vendor?.phone || ''); setEmail(vendor?.email || '') }
  }, [to, open]) // eslint-disable-line react-hooks/exhaustive-deps

  const options = kind === 'vendor_paid' ? vendorPays.map((p) => ({ ref: p.ref, name: p.bukti.name, label: `Bukti transfer · ${p.sub.title}`, amount: p.amount, date: p.date }))
    : kind === 'reg_no' ? [] : finals.filter((f) => (KINDS[kind]?.types || []).includes(f.type)).map((f) => ({ ref: f.ref, name: f.file.name, label: `${f.label} · ${f.title}`, amount: f.amount, date: f.date }))
  useEffect(() => { setSel(options.map((o) => o.ref)) }, [kind, to]) // eslint-disable-line react-hooks/exhaustive-deps
  const chosen = options.filter((o) => sel.includes(o.ref))
  const regChosen = regSubs.filter((s) => (regs[s.id] ?? s.data?.registration_no))

  const auto = useMemo(() => {
    const amount = rupiah(chosen.reduce((a, o) => a + (Number(o.amount) || 0), 0))
    const services = [...new Set((project.sub_projects || []).filter((s) => KINDS[kind]?.types.includes(s.type)).map((s) => (s.type === 'apostille' ? 'apostille' : 'legalisasi')))]
    const reg = regChosen.map((s) => `${regs[s.id] ?? s.data.registration_no}${regChosen.length > 1 ? ` (${s.title})` : ''}`).join(', ')
    return template(kind, { name: to === 'customer' ? project.customer?.name : vendor?.name, invoice: project.invoice_no, url, until: `${tgl(until)} pukul ${jamWita(until)}`,
      service: kind === 'reg_no' ? (regChosen[0]?.type === 'legalisasi' ? 'legalisasi' : 'apostille') : services.join(' & '), amount, date: tgl(chosen[0]?.date), reg })
  }, [kind, to, chosen.map((c) => c.ref).join(), url, until, JSON.stringify(regs)]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!edited) setMsg(auto) }, [auto, edited])

  const canEditContact = to === 'customer' ? can.editProject(user) : can.manageVendors(user)
  const registered = to === 'customer' ? [project.customer?.phone, project.customer?.ship?.phone].map(normPhone) : [normPhone(vendor?.phone)]
  const phoneUnregistered = normPhone(phone) && !registered.includes(normPhone(phone)) && !saveContact
  const ready = kind && (kind === 'reg_no' ? regChosen.length > 0 : chosen.length > 0) && (channel === 'wa' ? normPhone(phone).length >= 9 : isEmail(email))

  /** Simpan tautan (buat bila belum ada) + file yang dibagikan, kontak, nomor registrasi, lalu catat riwayat. */
  const persist = async (result, note) => {
    for (const s of regChosen) if (regs[s.id] !== undefined && regs[s.id] !== s.data?.registration_no) await patchSubData(project, s.id, { registration_no: regs[s.id] }, `Nomor registrasi: ${regs[s.id]}`)
    if (saveContact && canEditContact) {
      if (to === 'customer') await save('projects', { ...project, customer: { ...project.customer, phone: phone || project.customer?.phone, email: email || project.customer?.email } })
      else await save('people', { ...vendor, phone: phone || vendor.phone, email: email || vendor.email })
    }
    const refs = kind === 'reg_no' ? [] : chosen.map((c) => c.ref)
    const now = new Date().toISOString()
    let l = link
    if (!l) {
      l = { ...newLink({ kind: to === 'customer' ? 'customer' : 'vendor', project_id: to === 'customer' ? project.id : null, vendor_id: to === 'customer' ? null : to, by: user }), token }
      l.history = [{ at: now, by: user.name, action: `Tautan diaktifkan · berlaku s/d ${tgl(l.expires_at)} ${jamWita(l.expires_at)}` }]
    }
    l = { ...l, shared: [...new Set([...(l.shared || []), ...refs])], shared_regs: [...new Set([...(l.shared_regs || []), ...regChosen.map((s) => s.id)])] }
    l = await save('share_links', l)
    await save('share_log', { project_id: project.id, vendor_id: to === 'customer' ? null : to, link_id: l.id, recipient_type: to === 'customer' ? 'customer' : 'vendor',
      recipient_name: to === 'customer' ? project.customer?.name : vendor?.name, to: channel === 'wa' ? phone : email, channel: channel === 'wa' ? 'whatsapp' : 'email',
      kind, kind_label: KINDS[kind].label, files: kind === 'reg_no' ? regChosen.map((s) => `No. registrasi ${s.title}`) : chosen.map((c) => c.name), message: msg,
      sender: user.name, sender_id: user.id, result, note: note || '' })
    return l
  }
  const openWa = async () => {
    const w = window.open(`https://wa.me/${toWa(phone)}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener')
    await persist('wa_opened', w ? '' : 'Pop-up diblokir browser')
    notify('WhatsApp dibuka dengan pesan terisi — tekan Kirim di WhatsApp')
  }
  const copyMsg = async () => { const ok = await copyText(msg); if (!ok) return notify('Gagal menyalin', 'err'); await persist('copied'); notify('Pesan disalin — tempel di WhatsApp / email') }
  const openMail = async () => {
    const subject = `${KINDS[kind].label} — ${invoiceLabel(project.invoice_no)}`
    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(msg)}`
    await persist('email_draft_opened'); notify('Aplikasi email dibuka dengan draf pesan')
  }
  const sendMail = async () => { // hanya bila layanan email terhubung (mode live)
    try {
      const r = await fetch('/api/notify/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: email, subject: `${KINDS[kind].label} — ${invoiceLabel(project.invoice_no)}`, text: msg }) }).then((x) => x.json())
      await persist(r.id ? 'sent' : 'failed', r.id ? `ID layanan: ${r.id}` : r.error || '')
      notify(r.id ? 'Email diterima layanan pengirim' : `Email gagal: ${r.error || 'tidak diketahui'}`, r.id ? 'ok' : 'err')
    } catch (e) { await persist('failed', e.message); notify('Email gagal dikirim', 'err') }
  }

  // ---------- kelola tautan ----------
  const allLinks = links.filter((l) => (to === 'customer' ? l.kind === 'customer' && l.project_id === project.id : l.kind === 'vendor' && l.vendor_id === to))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  const canManage = can.editProject(user) || user.role === 'akunting'
  const hist = (l, action) => [...(l.history || []), { at: new Date().toISOString(), by: user.name, action }]
  const revoke = async (l) => { await save('share_links', { ...l, revoked_at: new Date().toISOString(), history: hist(l, 'Akses dicabut') }); notify('Akses tautan dicabut') }
  const extend = async (l) => { const nx = addMonth(l.expires_at); await save('share_links', { ...l, expires_at: nx, locked_until: null, history: hist(l, `Diperpanjang s/d ${tgl(nx)}`) }); notify(`Diperpanjang s/d ${tgl(nx)}`) }
  const reissue = async (l) => {
    if (l && !l.revoked_at) await save('share_links', { ...l, revoked_at: new Date().toISOString(), history: hist(l, 'Dicabut — diganti tautan baru') })
    const n = newLink({ kind: to === 'customer' ? 'customer' : 'vendor', project_id: to === 'customer' ? project.id : null, vendor_id: to === 'customer' ? null : to, by: user })
    n.history = [{ at: n.created_at, by: user.name, action: `Diterbitkan ulang · berlaku s/d ${tgl(n.expires_at)}` }]
    await save('share_links', { ...n, shared: l?.shared || [], shared_regs: l?.shared_regs || [] }); notify('Tautan baru diterbitkan — kirim ulang ke penerima')
  }
  const logs = (data.share_log || []).filter((x) => x.project_id === project.id || (vendor && x.vendor_id === vendor.id)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))

  const chip = (on) => cx('rounded-xl px-3 py-2 text-left text-sm ring-1 transition', on ? 'bg-brand text-white ring-brand' : 'bg-white text-ink ring-slate-300 hover:ring-brand')
  return (
    <Sheet open={open} onClose={onClose} title={<span className="inline-flex items-center gap-2"><Share2 className="h-4 w-4 text-brand" />Bagikan / Kirim Notifikasi · {invoiceLabel(project.invoice_no)}</span>} xwide>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ---- kiri: pilihan ---- */}
        <div className="space-y-4">
          <Field label="1. Penerima">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Penerima">
              <button type="button" role="radio" aria-checked={to === 'customer'} className={chip(to === 'customer')} onClick={() => setTo('customer')}>Pelanggan · <b>{project.customer?.name || '—'}</b></button>
              {vendors.map((v) => <button key={v.id} type="button" role="radio" aria-checked={to === v.id} className={chip(to === v.id)} onClick={() => setTo(v.id)}>Vendor · <b>{v.name}</b></button>)}
            </div>
          </Field>
          <Field label="2. Jenis notifikasi">
            <div className="grid gap-1.5" role="radiogroup" aria-label="Jenis notifikasi">
              {kinds.map(([k, x]) => {
                const ok = availability(k)
                return (
                  <button key={k} type="button" role="radio" aria-checked={kind === k} disabled={!ok} onClick={() => { setKind(k); setEdited(false) }}
                    className={cx(chip(kind === k), !ok && 'cursor-not-allowed opacity-50')}>
                    {x.label}{!ok && <span className="block text-[11px] font-normal">{k === 'vendor_paid' ? 'Belum ada pembayaran tercatat dengan bukti transfer' : k === 'refund' ? 'Belum ada refund yang dibayar dengan bukti' : k === 'reg_no' ? 'Tidak ada subproyek apostille/legalisasi' : 'Belum ada file final yang disetujui'}</span>}
                  </button>
                )
              })}
            </div>
          </Field>
          {kind === 'reg_no' ? (
            <Field label="3. Nomor registrasi">
              <div className="space-y-2">{regSubs.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm"><span className="w-40 truncate text-ink-soft">{s.title}</span>
                  <Input value={regs[s.id] ?? s.data?.registration_no ?? ''} onChange={(e) => setRegs((r) => ({ ...r, [s.id]: e.target.value }))} placeholder="mis. AHU-123456" aria-label={`Nomor registrasi ${s.title}`} /></label>
              ))}</div>
            </Field>
          ) : kind && (
            <Field label={`3. File yang dibagikan (${chosen.length})`} hint={to === 'customer' ? 'Hanya file final yang sudah disetujui. Draf & file internal tidak pernah tampil di portal.' : 'Bukti transfer dari pembayaran yang sudah tercatat.'}>
              <div className="space-y-1.5">{options.map((o) => (
                <label key={o.ref} className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm ring-1 ring-slate-200 hover:bg-slate-50">
                  <input type="checkbox" className="mt-1" checked={sel.includes(o.ref)} onChange={() => setSel((x) => (x.includes(o.ref) ? x.filter((y) => y !== o.ref) : [...x, o.ref]))} />
                  <span className="min-w-0"><span className="flex items-center gap-1.5 font-semibold"><FileCheck2 className="h-4 w-4 shrink-0 text-emerald-600" /><span className="truncate">{o.name}</span></span>
                    <span className="block truncate text-xs text-ink-mute">{o.label}{o.amount ? ` · ${rupiah(o.amount)}` : ''}{o.date ? ` · ${tgl(o.date)}` : ''}</span></span>
                </label>
              ))}</div>
            </Field>
          )}
          <Field label="4. Kanal">
            <div className="flex gap-2" role="radiogroup" aria-label="Kanal">
              <button type="button" role="radio" aria-checked={channel === 'wa'} className={chip(channel === 'wa')} onClick={() => setChannel('wa')}><MessageCircle className="mr-1 inline h-4 w-4" />WhatsApp</button>
              <button type="button" role="radio" aria-checked={channel === 'email'} className={chip(channel === 'email')} onClick={() => setChannel('email')}><Mail className="mr-1 inline h-4 w-4" />Email</button>
            </div>
          </Field>
          <Field label={channel === 'wa' ? 'Nomor WhatsApp tujuan' : 'Email tujuan'} hint={canEditContact ? 'Diambil dari kontak tersimpan — boleh dikoreksi.' : 'Diambil dari kontak tersimpan.'}>
            {channel === 'wa'
              ? <Input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!canEditContact} placeholder="08…" aria-label="Nomor WhatsApp tujuan" />
              : <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!canEditContact} placeholder="nama@email.com" aria-label="Email tujuan" />}
            {canEditContact && <label className="mt-1.5 flex items-center gap-2 text-xs text-ink-soft"><input type="checkbox" checked={saveContact} onChange={(e) => setSaveContact(e.target.checked)} />Simpan perubahan ke kontak {to === 'customer' ? 'pelanggan' : 'vendor'}</label>}
            {channel === 'wa' && phoneUnregistered && <p className="mt-1 flex items-start gap-1 text-[11px] text-amber-700"><AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />Nomor ini belum terdaftar — penerima tidak bisa membuka portal kecuali nomor disimpan ke kontak.</p>}
          </Field>
        </div>

        {/* ---- kanan: pratinjau ---- */}
        <div className="space-y-3">
          <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-mute">Pratinjau</p>
            <dl className="mb-2 grid grid-cols-[70px_1fr] gap-x-2 gap-y-1 text-xs">
              <dt className="text-ink-mute">Kepada</dt><dd className="font-semibold">{to === 'customer' ? project.customer?.name : vendor?.name} · {channel === 'wa' ? phone || '—' : email || '—'}</dd>
              <dt className="text-ink-mute">Kanal</dt><dd>{channel === 'wa' ? 'WhatsApp' : 'Email'}</dd>
              <dt className="text-ink-mute">File</dt><dd>{kind === 'reg_no' ? regChosen.map((s) => `No. registrasi · ${s.title}`).join(', ') || '—' : chosen.map((c) => c.name).join(', ') || '—'}</dd>
              <dt className="text-ink-mute">Tautan</dt><dd className="break-all">{url}<span className="block text-ink-mute">{link ? 'Tautan aktif' : 'Tautan baru (aktif saat dikirim)'} · berlaku s/d {tgl(until)} {jamWita(until)}</span></dd>
            </dl>
            <Textarea rows={7} value={msg} onChange={(e) => { setMsg(e.target.value); setEdited(true) }} aria-label="Isi pesan" className="text-sm" />
            {edited && <button type="button" onClick={() => setEdited(false)} className="mt-1 text-xs font-semibold text-brand underline">Kembalikan ke template</button>}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {channel === 'wa' ? <>
              <Button disabled={!ready} onClick={openWa} className="bg-emerald-600 hover:bg-emerald-700"><ExternalLink className="h-4 w-4" />Buka WhatsApp</Button>
              <Button variant="outline" disabled={!ready} onClick={copyMsg}><Copy className="h-4 w-4" />Salin Pesan</Button>
            </> : <>
              {EMAIL_LIVE && !PORTAL_DEMO ? <Button disabled={!ready} onClick={sendMail}><Mail className="h-4 w-4" />Kirim Email</Button>
                : <Button disabled={!ready} onClick={openMail}><ExternalLink className="h-4 w-4" />Buka Aplikasi Email</Button>}
              <Button variant="outline" disabled={!ready} onClick={copyMsg}><Copy className="h-4 w-4" />Salin Pesan</Button>
            </>}
          </div>
          <p className="flex items-start gap-1.5 text-[11px] text-ink-mute"><Info className="mt-px h-3.5 w-3.5 shrink-0" />
            {channel === 'wa' ? 'Pengiriman WhatsApp otomatis belum terhubung: tombol membuka WhatsApp dengan pesan terisi, lalu Anda menekan Kirim. Riwayat mencatat "Tautan WhatsApp dibuka", bukan "terkirim".'
              : EMAIL_LIVE && !PORTAL_DEMO ? 'Status "Terkirim" dicatat hanya bila layanan email mengonfirmasi.' : 'Layanan email belum terhubung: tombol membuka aplikasi email Anda dengan draf pesan. Riwayat mencatat "Draf email dibuka".'}</p>
        </div>
      </div>

      {/* ---- tautan portal ---- */}
      <div className="mt-6 rounded-2xl ring-1 ring-slate-200">
        <p className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5 text-sm font-bold"><Link2 className="h-4 w-4 text-brand" />Tautan portal {to === 'customer' ? 'pelanggan (proyek ini)' : `vendor · ${vendor?.name}`}</p>
        {allLinks.length === 0 ? <p className="px-4 py-3 text-sm text-ink-mute">Belum ada tautan. Tautan dibuat otomatis saat pesan pertama dikirim (berlaku 1 bulan kalender).</p> : (
          <ul className="divide-y divide-slate-100">{allLinks.map((l) => {
            const st = linkState(l)
            const stLabel = { active: ['Aktif', 'bg-emerald-50 text-emerald-700'], locked: ['Terkunci sementara (salah nomor HP)', 'bg-amber-50 text-amber-800'], expired: ['Kedaluwarsa', 'bg-slate-100 text-ink-mute'], revoked: ['Dicabut', 'bg-rose-50 text-rose-700'] }[st]
            return (
              <li key={l.id} className="px-4 py-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cx('rounded-full px-2 py-0.5 font-semibold', stLabel[1])}>{stLabel[0]}</span>
                  <span className="text-ink-soft">Aktif {tgl(l.activated_at)} · berlaku s/d <b>{tgl(l.expires_at)} {jamWita(l.expires_at)}</b> · dibuka {l.opens || 0}×{l.last_open_at ? ` (terakhir ${jam(l.last_open_at)})` : ''}</span>
                  {canManage && ['active', 'locked'].includes(st) && <span className="ml-auto flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => window.open(portalUrl(l.token), '_blank', 'noopener')}><ExternalLink className="h-3.5 w-3.5" />Buka portal</Button>
                    <Button size="sm" variant="outline" onClick={() => extend(l)}><CalendarPlus className="h-3.5 w-3.5" />Perpanjang 1 bulan</Button>
                    <Button size="sm" variant="outline" onClick={() => reissue(l)}><RefreshCw className="h-3.5 w-3.5" />Terbitkan ulang</Button>
                    <Button size="sm" variant="danger" onClick={() => revoke(l)}><ShieldOff className="h-3.5 w-3.5" />Cabut</Button>
                  </span>}
                </div>
                <p className="mt-1 text-ink-mute">Dibagikan: {(l.shared || []).length} file{(l.shared_regs || []).length ? ` · ${l.shared_regs.length} no. registrasi` : ''}</p>
                <details className="mt-1"><summary className="cursor-pointer text-ink-mute">Riwayat tautan ({(l.history || []).length})</summary>
                  <ul className="mt-1 space-y-0.5">{(l.history || []).map((h, i) => <li key={i} className="text-ink-soft">{jam(h.at)} · {h.by} · {h.action}</li>)}</ul></details>
              </li>
            )
          })}</ul>
        )}
        {canManage && allLinks.length > 0 && !allLinks.some((l) => ['active', 'locked'].includes(linkState(l))) && <div className="border-t border-slate-100 px-4 py-2"><Button size="sm" variant="outline" onClick={() => reissue(null)}><RefreshCw className="h-3.5 w-3.5" />Terbitkan tautan baru</Button></div>}
      </div>

      {/* ---- riwayat pengiriman ---- */}
      <div className="mt-4 rounded-2xl ring-1 ring-slate-200">
        <p className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5 text-sm font-bold"><History className="h-4 w-4 text-brand" />Riwayat pengiriman ({logs.length})</p>
        {logs.length === 0 ? <p className="px-4 py-3 text-sm text-ink-mute">Belum ada pengiriman.</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-xs">
            <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wide text-ink-mute"><tr><th className="px-4 py-2">Waktu</th><th className="px-2 py-2">Penerima</th><th className="px-2 py-2">Kanal</th><th className="px-2 py-2">Jenis</th><th className="px-2 py-2">Pengirim</th><th className="px-4 py-2">Hasil</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{logs.map((x) => {
              const [l, c] = RESULT[x.result] || [x.result, 'bg-slate-100']
              return (
                <tr key={x.id}><td className="whitespace-nowrap px-4 py-2">{jam(x.created_at)}</td><td className="px-2 py-2">{x.recipient_name}<span className="block text-ink-mute">{x.to}</span></td>
                  <td className="px-2 py-2">{x.channel === 'whatsapp' ? 'WhatsApp' : 'Email'}</td><td className="px-2 py-2">{x.kind_label || x.kind}<span className="block text-ink-mute">{(x.files || []).join(', ')}</span></td>
                  <td className="px-2 py-2">{x.sender}</td><td className="px-4 py-2"><span className={cx('rounded-full px-2 py-0.5 font-semibold ring-1', c)}>{l}</span>{x.note && <span className="block text-ink-mute">{x.note}</span>}</td></tr>
              )
            })}</tbody>
          </table></div>
        )}
      </div>
    </Sheet>
  )
}
