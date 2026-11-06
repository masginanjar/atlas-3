import { useMemo, useState } from 'react'
import { Globe, Copy, Check, Clock, Ban, RotateCcw, Eye, FileText, StickyNote, BadgeCheck, History, ExternalLink } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { can, invoiceLabel} from '../config/access.js'
import { randomToken } from '../lib/portalCore.js'
import { ACCESS_DAYS, addDays, accessState, publishableOf, receiptGroups, orderStep, isDigital, phonesOf, DRAFT_NOTE } from '../lib/portalCust.js'
import { cekUrl } from '../lib/custClient.js'
import { Button, SectionCard, Textarea, Pill, cx } from './ui.jsx'
import { tgl } from '../lib/format.js'
import { clock } from '../lib/performance.js'

// ============================================================
//  AKSES PORTAL PELANGGAN — kontrol admin di detail proyek.
//  Satu link umum (#/cek): pelanggan masuk dengan nomor HP lalu memilih invoice.
//  Yang diatur di sini: aktif/nonaktif, masa 14 hari, dokumen yang dipublikasikan,
//  catatan untuk pelanggan, nomor register, dan riwayat konfirmasi penerimaan.
// ============================================================
const waktu = (iso) => (iso ? `${tgl(iso)} ${clock(new Date(iso))}` : '—')
const STEP_TXT = { invoice: 'Invoice Dibuat', work: 'Proyek Dikerjakan', review: 'Pengecekan Supervisi', ready: 'Dokumen Selesai', sent: 'Dokumen Dikirim', arrived: 'Dokumen Tiba' }

export default function CustomerAccess({ project }) {
  const { data, user, save, notify } = useApp()
  const [busy, setBusy] = useState('')
  const [copied, setCopied] = useState(false)
  const [note, setNote] = useState(null)

  const link = useMemo(() => (data.share_links || []).find((l) => l.kind === 'customer' && l.project_id === project.id) || null, [data.share_links, project.id])
  const st = accessState(link)
  const pubs = useMemo(() => publishableOf(project), [project])
  const shared = new Set(link?.shared || [])
  const regsShared = new Set(link?.shared_regs || [])
  const groups = useMemo(() => receiptGroups(project, link, data.couriers || []), [project, link, data.couriers])
  const step = orderStep(project, data.couriers || [], link)
  const mayEdit = can.editProject(user) || user.role === 'akunting'
  const phones = phonesOf(project)

  const hist = (l, action) => [...(l?.history || []), { at: new Date().toISOString(), by: user.name, action }]
  const put = async (patch, action, msg) => {
    setBusy(action); try {
      const base = link || { kind: 'customer', project_id: project.id, token: randomToken(), shared: [], shared_regs: [], receipts: [], fails: [], opens: 0, created_by: user.id, created_at: new Date().toISOString() }
      await save('share_links', { ...base, ...patch, history: hist(base, action) })
      notify(msg || action)
    } catch (e) { notify(e.message, 'err') } finally { setBusy('') }
  }

  const activate = () => { const at = new Date().toISOString(); return put({ activated_at: at, expires_at: addDays(at, ACCESS_DAYS), revoked_at: null }, `Akses pelanggan diaktifkan · ${ACCESS_DAYS} hari`, `Akses pelanggan aktif sampai ${tgl(addDays(at, ACCESS_DAYS))}`) }
  const extend = () => { const nx = addDays(new Date().toISOString(), ACCESS_DAYS); return put({ expires_at: nx, revoked_at: null }, `Akses diperpanjang s/d ${tgl(nx)}`, `Diperpanjang sampai ${tgl(nx)}`) }
  const revoke = () => put({ revoked_at: new Date().toISOString() }, 'Akses pelanggan dicabut', 'Akses pelanggan dicabut')
  const toggleDoc = (ref) => { const n = shared.has(ref) ? [...shared].filter((x) => x !== ref) : [...shared, ref]; return put({ shared: n }, shared.has(ref) ? 'Dokumen ditarik dari pelanggan' : 'Dokumen dibagikan ke pelanggan') }
  const toggleReg = (id) => { const n = regsShared.has(id) ? [...regsShared].filter((x) => x !== id) : [...regsShared, id]; return put({ shared_regs: n }, regsShared.has(id) ? 'Nomor register disembunyikan' : 'Nomor register ditampilkan ke pelanggan') }
  const saveNote = () => put({ cust_note: { text: note.trim(), at: new Date().toISOString(), by: user.name } }, 'Catatan untuk pelanggan diperbarui').then(() => setNote(null))

  const copy = async () => { try { await navigator.clipboard.writeText(cekUrl()); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { notify('Gagal menyalin', 'err') } }

  const tone = st === 'active' ? 'mint' : st === 'expired' || st === 'revoked' ? 'peach' : 'sky'
  const label = { active: 'Aktif', expired: 'Kedaluwarsa', revoked: 'Dicabut', off: 'Belum diaktifkan', missing: 'Belum diaktifkan' }[st]

  return (
    <SectionCard tone={tone} icon={Globe} title="Akses Portal Pelanggan" foldKey="cust-access" defaultOpen={false}
      summary={`${label}${link?.expires_at && st === 'active' ? ` s/d ${tgl(link.expires_at)}` : ''} · ${shared.size} dokumen dibagikan`}>
      <div className="space-y-5">
        {/* status & tombol */}
        <div className="flex flex-wrap items-center gap-2">
          <Pill className={cx('text-xs', st === 'active' ? 'bg-emerald-100 text-emerald-800' : st === 'off' || st === 'missing' ? 'bg-slate-100' : 'bg-amber-100 text-amber-900')}>
            <BadgeCheck className="h-3 w-3" />Akses {label}
          </Pill>
          {link?.expires_at && st !== 'off' && <Pill className="text-xs"><Clock className="h-3 w-3" />Berlaku s/d {waktu(link.expires_at)}</Pill>}
          <Pill className="text-xs">Tahap pelanggan: {STEP_TXT[step.key]}</Pill>
          {isDigital(project, data.couriers) && <Pill className="text-xs bg-sky-100 text-sky-800">Digital saja</Pill>}
        </div>

        {!phones.length && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">Nomor HP pelanggan belum tercatat — pelanggan tidak akan bisa menemukan pesanan ini di portal. Lengkapi dulu di Data Pelanggan.</p>}

        {mayEdit && (
          <div className="flex flex-wrap gap-2">
            {st !== 'active' && <Button size="sm" loading={busy.startsWith('Akses pelanggan diaktifkan')} onClick={activate}><Globe className="h-3.5 w-3.5" />{st === 'off' || st === 'missing' ? 'Aktifkan Akses Pelanggan' : `Aktifkan Ulang (${ACCESS_DAYS} hari)`}</Button>}
            {st === 'active' && <Button size="sm" variant="outline" loading={busy.startsWith('Akses diperpanjang')} onClick={extend}><RotateCcw className="h-3.5 w-3.5" />Perpanjang {ACCESS_DAYS} hari</Button>}
            {st === 'active' && <Button size="sm" variant="danger" loading={busy === 'Akses pelanggan dicabut'} onClick={revoke}><Ban className="h-3.5 w-3.5" />Cabut Akses</Button>}
          </div>
        )}

        {/* link umum */}
        <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink-mute">Link portal (sama untuk semua pelanggan)</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-slate-50 px-2 py-1.5 text-xs">{cekUrl()}</code>
            <Button size="sm" variant="outline" onClick={copy}>{copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Tersalin' : 'Salin'}</Button>
            <Button size="sm" variant="outline" onClick={() => window.open(cekUrl(), '_blank', 'noopener')}><Eye className="h-3.5 w-3.5" />Pratinjau</Button>
          </div>
          <p className="mt-1.5 text-[11px] text-ink-mute">Pelanggan membuka link ini, mengisi nomor HP ({phones.map((p) => p.replace(/^(\d{4})\d+(\d{3})$/, '$1••••$2')).join(' / ') || 'belum ada'}), lalu memilih invoice {invoiceLabel(project.invoice_no)}.</p>
        </div>

        {/* dokumen yang dipublikasikan */}
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-mute"><FileText className="h-3.5 w-3.5" />Dokumen untuk pelanggan</p>
          {!pubs.length ? <p className="mt-1.5 rounded-xl bg-slate-50 px-3 py-2 text-xs text-ink-soft">Belum ada PDF draft / final yang bisa dibagikan. Dokumen muncul di sini setelah diunggah pada tahap kerja.</p> : (
            <ul className="mt-1.5 space-y-1.5">
              {pubs.map((d) => (
                <li key={d.ref} className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-2.5 ring-1 ring-slate-200">
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={shared.has(d.ref)} disabled={!mayEdit} onChange={() => toggleDoc(d.ref)} className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{d.name}</span>
                      <span className="block text-[11px] text-ink-mute">{d.label} · {d.title}</span>
                    </span>
                  </label>
                  <span className={cx('rounded px-1.5 py-0.5 text-[10px] font-bold uppercase', d.kind === 'final' ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white')}>{d.kind === 'final' ? 'Final' : 'Draft'}</span>
                  {shared.has(d.ref) && <Pill className="bg-emerald-50 text-[10px] text-emerald-700">Dibagikan</Pill>}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1.5 text-[11px] text-ink-mute">Persetujuan internal tidak otomatis memublikasikan dokumen — centang untuk membagikan. Draft diberi keterangan: “{DRAFT_NOTE}”</p>
        </div>

        {/* catatan pelanggan */}
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-mute"><StickyNote className="h-3.5 w-3.5" />Catatan untuk Pelanggan</p>
          {note === null ? (
            <div className="mt-1.5 rounded-xl bg-white p-3 ring-1 ring-slate-200">
              {link?.cust_note?.text ? <>
                <p className="whitespace-pre-wrap text-sm">{link.cust_note.text}</p>
                <p className="mt-1 text-[11px] text-ink-mute">Diperbarui {waktu(link.cust_note.at)} · {link.cust_note.by}</p>
              </> : <p className="text-xs text-ink-soft">Belum ada catatan. Catatan ini tampil di portal pelanggan — terpisah dari catatan internal.</p>}
              {mayEdit && <Button size="sm" variant="outline" className="mt-2" onClick={() => setNote(link?.cust_note?.text || '')}>{link?.cust_note?.text ? 'Ubah catatan' : 'Tulis catatan'}</Button>}
            </div>
          ) : (
            <div className="mt-1.5 space-y-2">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. Mohon periksa draft terjemahan, jika sudah sesuai kami lanjutkan ke otorisasi." />
              <div className="flex gap-2">
                <Button size="sm" loading={busy === 'Catatan untuk pelanggan diperbarui'} onClick={saveNote}>Simpan</Button>
                <Button size="sm" variant="ghost" onClick={() => setNote(null)}>Batal</Button>
              </div>
            </div>
          )}
        </div>

        {/* register & konfirmasi penerimaan */}
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-mute"><BadgeCheck className="h-3.5 w-3.5" />Nomor Register & Konfirmasi Penerimaan</p>
          {!groups.length ? <p className="mt-1.5 rounded-xl bg-slate-50 px-3 py-2 text-xs text-ink-soft">Konfirmasi penerimaan muncul setelah ada dokumen final yang dibagikan ke pelanggan.</p> : (
            <ul className="mt-1.5 space-y-1.5">
              {groups.map((g) => (
                <li key={g.sub_id} className="rounded-xl bg-white p-2.5 ring-1 ring-slate-200">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{g.title}</span>
                    {g.reg_ready ? <Pill className="bg-sky-50 text-[10px] text-sky-800">{g.reg_count} nomor register siap</Pill> : <Pill className="bg-amber-50 text-[10px] text-amber-900">Register belum ada</Pill>}
                    {g.reg_active ? <Pill className="bg-emerald-50 text-[10px] text-emerald-700">Register aktif {tgl(g.reg_active_at)}</Pill> : <Pill className="text-[10px]">Register belum aktif</Pill>}
                  </div>
                  <p className="mt-1 text-[11px] text-ink-mute">{g.docs.length} dokumen final dibagikan · {g.doc_count} dokumen dalam sub project</p>
                  {g.confirmed_at && <p className="mt-1 text-[11px] font-semibold text-emerald-700">Pelanggan konfirmasi terima {waktu(g.confirmed_at)} (melalui portal pelanggan, bukan bukti identitas terverifikasi)</p>}
                  {mayEdit && <label className="mt-1.5 flex cursor-pointer items-center gap-2 text-[11px]">
                    <input type="checkbox" checked={regsShared.has(g.sub_id)} onChange={() => toggleReg(g.sub_id)} className="h-3.5 w-3.5" />Tampilkan nomor register ke pelanggan
                  </label>}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* riwayat */}
        {!!link?.history?.length && (
          <details className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
            <summary className="flex cursor-pointer items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-mute"><History className="h-3.5 w-3.5" />Riwayat akses ({link.history.length})</summary>
            <ul className="mt-2 space-y-1 text-[11px] text-ink-soft">
              {[...link.history].reverse().slice(0, 20).map((h, i) => <li key={i}>{waktu(h.at)} · <b className="text-ink">{h.by}</b> — {h.action}</li>)}
            </ul>
          </details>
        )}

        <p className="flex items-start gap-1.5 text-[11px] text-ink-mute">
          <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
          Setelah pelanggan menekan “Dokumen Sudah Saya Terima”, nomor register yang sudah disiapkan menjadi aktif dan pelanggan diarahkan ke halaman ulasan Google. Ulasan bersifat opsional dan tidak memengaruhi aktivasi.
        </p>
      </div>
    </SectionCard>
  )
}
