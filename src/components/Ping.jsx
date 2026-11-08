import { useMemo, useState } from 'react'
import { InvoiceNo } from './badges.jsx'
import { BellRing, Send, CheckCircle2, Clock3 } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { activeClaim, branchesOf, ROLES, roleLabel, printBranchOf, invoiceLabel} from '../config/access.js'
import { DONE } from '../config/workflows.js'
import { Button, Sheet, Textarea, Select, cx } from './ui.jsx'
import Avatar from './Avatar.jsx'
import { tgl, daysLeft } from '../lib/format.js'

// ============================================================
//  PING — pengingat antar-role agar pekerjaan segera ditindaklanjuti.
//  Tidak mengubah status pekerjaan; hanya masuk ke tab "Ping" penerima.
// ============================================================

const LEAD = { pilih_penerjemah: 'supervisor', persetujuan: 'direktur', pembayaran: 'akunting', dibayar: 'akunting', registrasi: 'admin_pusat' }

/** Kandidat penerima ping untuk tahap saat ini: { pic: user|null, candidates: user[] } */
export function pingTargets(stage, sub, project, users, me) {
  const active = users.filter((u) => u.active !== false && u.id !== me?.id)
  const byId = (id) => active.find((u) => u.id === id) || null
  if (!stage) return { pic: null, candidates: [] }
  // 1) PIC eksplisit: penugasan (penerjemah/proofreader/staf apostille) atau klaim otorisator
  if (stage.assignee && sub?.data?.[stage.assignee]) { const u = byId(sub.data[stage.assignee]); if (u) return { pic: u, candidates: [u] } }
  if (stage.claimable) { const c = activeClaim(sub); if (c?.by) { const u = byId(c.by); if (u) return { pic: u, candidates: [u] } } }
  // 2) Role penanggung jawab tahap
  const roles = LEAD[stage.key] ? [LEAD[stage.key]] : stage.roles.filter((r) => r !== 'superadmin')
  let cands = active.filter((u) => roles.includes(u.role) || (u.extra_roles || []).some((r) => roles.includes(r)))
  // tahap cabang (CS / print): utamakan staf cabang terkait
  const place = stage.printBranch ? printBranchOf(project) : project.branch
  const local = cands.filter((u) => ['cs', 'supervisor', 'admin_pusat'].includes(u.role) ? branchesOf(u).includes(place) : true)
  if (local.length) cands = local
  // CS: pembuat project paling relevan
  const creator = cands.find((u) => u.id === project.created_by)
  if (creator) return { pic: creator, candidates: cands }
  if (cands.length === 1) return { pic: cands[0], candidates: cands }
  return { pic: null, candidates: cands }
}

const defaultMessage = (stage, sub) => `Mohon bantu tindak lanjuti tahap ${stage?.label || 'ini'} untuk ${sub?.title || 'dokumen ini'} agar proses bisa dilanjutkan. Terima kasih 🙏`

/** Tombol "Kirim Ping" + lembar kirim. Ditampilkan pada pekerjaan yang menunggu role lain. */
export function PingButton({ project, sub, stage, size = 'sm', className }) {
  const { user, data, sendPing, lastPingTo, notify, PING_COOLDOWN_MS, PING_DAILY_MAX } = useApp()
  const [open, setOpen] = useState(false)
  const [to, setTo] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const done = sub?.stage === DONE
  const { pic, candidates } = useMemo(() => pingTargets(stage, sub, project, data.users, user), [stage, sub, project, data.users, user])
  const target = data.users.find((u) => u.id === (to || pic?.id)) || null
  const last = target ? lastPingTo(target.id, project.id, sub?.id) : null
  const waitMs = last ? PING_COOLDOWN_MS - (Date.now() - new Date(last.created_at)) : 0
  const cooling = waitMs > 0
  const todayKey = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Makassar' })
  const todayN = target ? (data.pings || []).filter((p) => p.from_user === user.id && p.to_user === target.id && p.project_id === project.id && (p.sub_id || null) === (sub?.id || null) && new Date(p.created_at).toLocaleDateString('sv-SE', { timeZone: 'Asia/Makassar' }) === todayKey).length : 0
  const maxed = todayN >= PING_DAILY_MAX
  const start = () => { setTo(pic?.id || ''); setMsg(defaultMessage(stage, sub)); setOpen(true) }
  const send = async () => {
    if (!target) return notify('Pilih penerima ping', 'err')
    try { setBusy(true); await sendPing({ to_user: target.id, project, sub, stage, message: msg }); notify(`Ping terkirim ke ${target.name}`); setOpen(false) }
    catch (e) { notify(e.message, 'err') } finally { setBusy(false) }
  }
  if (done) return <span className={cx('inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200', className)}><CheckCircle2 className="h-3.5 w-3.5" />Sudah Selesai</span>
  const d = daysLeft(project.about?.deadline)
  return (
    <>
      <Button size={size} variant="outline" className={className} onClick={start} title="Kirim pengingat ke PIC tahap ini"><BellRing className="h-3.5 w-3.5 text-brand" />Kirim Ping</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Kirim Ping"
        footer={<><Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Batal</Button>
          <Button className="flex-[2]" disabled={busy || !target || cooling || maxed} onClick={send}><Send className="h-4 w-4" />{maxed ? 'Batas harian tercapai' : cooling ? `Tunggu ${Math.ceil(waitMs / 60000)} mnt` : 'Kirim Ping'}</Button></>}>
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink-mute">Pekerjaan</p>
            <p className="text-sm font-bold text-ink"><InvoiceNo project={project} /> <span className="font-normal text-ink-mute">· {project.customer?.name}</span></p>
            <p className="text-sm text-ink-soft">{sub?.title}{stage ? <> · tahap <b>{stage.label}</b></> : null}</p>
            {project.about?.deadline && <p className={cx('mt-0.5 text-xs', d !== null && d <= 0 ? 'font-semibold text-rose-600' : 'text-ink-mute')}>Deadline {tgl(project.about.deadline)}{d === 0 ? ' · Hari ini' : d === 1 ? ' · Besok' : d < 0 ? ` · Terlambat ${-d} hr` : ''}</p>}
          </div>
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-ink-mute">Penerima</p>
            {pic ? (
              <div className="flex items-center gap-3 rounded-xl bg-white p-2.5 ring-1 ring-slate-200">
                <Avatar user={target || pic} size={40} />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{(target || pic).name}</p><p className="text-xs text-ink-mute">{roleLabel(target || pic)} · PIC tahap {stage?.label}</p></div>
                {candidates.length > 1 && <Select value={to || pic.id} onChange={(e) => setTo(e.target.value)} className="!w-auto text-xs">{candidates.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>}
              </div>
            ) : candidates.length ? (
              <div className="space-y-1.5">
                <p className="text-xs text-amber-800">Belum ada PIC untuk tahap ini — pilih penerima yang berwenang:</p>
                <Select value={to} onChange={(e) => setTo(e.target.value)}><option value="">— pilih penerima —</option>{candidates.map((u) => <option key={u.id} value={u.id}>{u.name} · {roleLabel(u)}</option>)}</Select>
              </div>
            ) : <p className="text-xs text-rose-600">Tidak ada pengguna aktif dengan peran {stage?.roles?.filter((r) => r !== 'superadmin').map((r) => ROLES[r]?.label).join(' / ')}.</p>}
          </div>
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-ink-mute">Pesan pengingat (bisa diedit)</p>
            <Textarea rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} />
          </div>
          {cooling && <p className="flex items-center gap-1 text-xs text-amber-800"><Clock3 className="h-3.5 w-3.5" />Ping untuk pekerjaan & penerima yang sama sudah dikirim — bisa diulang {Math.ceil(waitMs / 60000)} menit lagi.</p>}
          <p className="text-[11px] text-ink-mute">Ping hanya pengingat; tidak mengubah status pekerjaan. Batas: maks. {PING_DAILY_MAX}× per hari & jeda 15 menit untuk pekerjaan + penerima yang sama{target ? ` (hari ini ${todayN}/${PING_DAILY_MAX})` : ''}.</p>
        </div>
      </Sheet>
    </>
  )
}
