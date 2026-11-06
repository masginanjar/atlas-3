import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bell, BellRing, CheckCheck, X, ArrowRight, Inbox, CalendarClock, Banknote, Volume2, VolumeX, Languages } from 'lucide-react'
import { playCashRegister, playPing, playNeedTranslator, soundEnabled, setSoundEnabled } from '../lib/sounds.js'
import { useApp } from '../lib/store.jsx'
import { go } from '../lib/router.js'
import { cx } from './ui.jsx'
import { relTime, tgl, daysLeft } from '../lib/format.js'
import { scopeByBranch, roleLabel, invoiceLabel} from '../config/access.js'
import { DONE } from '../config/workflows.js'
import Avatar from './Avatar.jsx'
import { useNow } from './TimeAgo.jsx'

// ============================================================
//  LONCENG NOTIFIKASI — panel dua tab: Notifikasi (sistem) & Ping (antar-role).
// ============================================================

export default function NotificationBell() {
  const { user, data, myNotifications, markRead, myPings, markPingRead } = useApp()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('notif')
  const btnRef = useRef(null)
  const panelRef = useRef(null)
  const now = useNow()
  // notifikasi pembayaran berhasil dipisah ke tab sendiri
  const isPay = (n) => n.kind === 'payment' || /sudah dibayar|sudah ditransfer|dibayar —|lunas|saldo .* bertambah/i.test(n.text || '')
  // tab "Perlu Penerjemah" khusus pimpinan: terjemahan baru yang belum dibagi ke penerjemah/vendor
  const LEAD = user.role === 'supervisor' || user.role === 'superadmin' || user.role === 'direktur'
  const isTr = (n) => n.kind === 'need_translator'
  const payList = myNotifications.filter(isPay)
  const trList = LEAD ? myNotifications.filter(isTr) : []
  const notifList = myNotifications.filter((n) => !isPay(n) && !(LEAD && isTr(n)))
  const unreadN = notifList.filter((n) => !(n.read_by || []).includes(user.id))
  const unreadPay = payList.filter((n) => !(n.read_by || []).includes(user.id))
  const unreadTr = trList.filter((n) => !(n.read_by || []).includes(user.id))
  const unreadP = myPings.filter((p) => !(p.read_by || []).includes(user.id))
  const total = unreadN.length + unreadP.length + unreadPay.length + unreadTr.length
  const [sound, setSound] = useState(soundEnabled)
  // suara: mesin kasir saat ada pembayaran berhasil baru, "ping" saat ada ping baru (sekali per item, per sesi)
  useEffect(() => {
    const newest = (list, k) => { const id = list[0]?.id; if (!id) return; const key = `atlas-snd-${k}-${user.id}`; try { if (sessionStorage.getItem(key) === id) return; sessionStorage.setItem(key, id) } catch { /* abaikan */ } return id }
    if (newest(unreadPay, 'pay')) playCashRegister()
    if (newest(unreadTr, 'tr')) setTimeout(playNeedTranslator, unreadPay.length ? 900 : 0)
    if (newest(unreadP, 'ping')) setTimeout(playPing, (unreadPay.length ? 900 : 0) + (unreadTr.length ? 800 : 0))
  }, [unreadPay[0]?.id, unreadP[0]?.id, unreadTr[0]?.id, user.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const userOf = (id) => data.users.find((u) => u.id === id)

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (!panelRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) setOpen(false) }
    const esc = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', close); window.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', close); window.removeEventListener('keydown', esc) }
  }, [open])
  // buka tab yang punya item belum dibaca
  useEffect(() => { if (open) setTab(unreadTr.length > 0 ? 'tr' : unreadN.length > 0 ? 'notif' : unreadPay.length > 0 ? 'pay' : unreadP.length > 0 ? 'ping' : 'notif') }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const canOpen = (projectId) => { const p = data.projects.find((x) => x.id === projectId); return !!p && scopeByBranch(user, [p], 'Semua').length > 0 }
  const openProject = async (projectId, markFn, item) => { await markFn([item]); setOpen(false); go(`projects/${projectId}`) }
  const markAll = () => (tab === 'notif' ? markRead(unreadN) : tab === 'pay' ? markRead(unreadPay) : tab === 'tr' ? markRead(unreadTr) : markPingRead(unreadP))
  const unreadActive = tab === 'notif' ? unreadN.length : tab === 'pay' ? unreadPay.length : tab === 'tr' ? unreadTr.length : unreadP.length
  const toggleSound = () => { const on = !sound; setSound(on); setSoundEnabled(on); if (on) (tab === 'ping' ? playPing : tab === 'tr' ? playNeedTranslator : playCashRegister)() }
  const listOf = (t) => (t === 'pay' ? payList : t === 'tr' ? trList : notifList)

  const panel = open && createPortal(
    <div ref={panelRef} role="dialog" aria-label="Notifikasi" className="fixed inset-x-2 top-[3.5rem] z-[85] flex max-h-[min(80vh,640px)] flex-col overflow-hidden rounded-3xl bg-white shadow-[0_24px_60px_-20px_rgba(14,21,64,0.35)] ring-1 ring-slate-200/80 sm:inset-x-auto sm:right-4 sm:w-[440px]">
      {/* Baris judul: tombol suara & tutup ikut di sini supaya baris tab tidak sesak di HP */}
      <div className="flex items-center gap-2 px-4 pt-3">
        <h3 className="text-base font-bold text-ink">Notifikasi</h3>
        {total > 0 && <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white">{total} baru</span>}
        <button type="button" onClick={toggleSound} aria-pressed={sound} aria-label={sound ? 'Matikan suara notifikasi' : 'Aktifkan suara notifikasi'}
          title={sound ? 'Suara notifikasi: aktif (klik untuk mematikan)' : 'Suara notifikasi: mati (klik untuk mengaktifkan & uji)'}
          className={cx('ml-auto grid h-11 w-11 place-items-center rounded-xl ring-1', sound ? 'bg-white text-brand ring-slate-200' : 'bg-slate-100 text-ink-mute ring-slate-200')}>{sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button>
        <button type="button" onClick={() => setOpen(false)} className="grid h-11 w-11 place-items-center rounded-xl text-ink-mute hover:bg-slate-100" aria-label="Tutup"><X className="h-4 w-4" /></button>
      </div>
      {/* Tab: di HP hanya ikon & bisa digeser; label muncul mulai sm */}
      <div className="flex items-center gap-1.5 overflow-x-auto px-4 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist">
        {[['notif', 'Notifikasi', unreadN.length, Bell], ...(LEAD ? [['tr', 'Perlu Penerjemah', unreadTr.length, Languages]] : []), ['pay', 'Pembayaran', unreadPay.length, Banknote], ['ping', 'Ping', unreadP.length, BellRing]].map(([k, label, n, Icon]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} aria-label={label} title={label}
            className={cx('relative inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-semibold transition', tab === k ? 'bg-gradient-to-r from-brand to-[#6d5cf6] text-white shadow-glow' : 'bg-slate-100 text-ink-soft hover:bg-slate-200')}>
            <Icon className="h-4 w-4" /><span className="hidden sm:inline">{label}</span>
            {n > 0 && <span className={cx('grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold', tab === k ? 'bg-white text-brand' : 'bg-rose-600 text-white')}>{n}</span>}
          </button>
        ))}
        {unreadActive > 0 && <button type="button" onClick={markAll} title="Tandai Semua Dibaca"
          className="ml-auto inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-1 whitespace-nowrap px-2 text-xs font-semibold text-brand hover:underline"><CheckCheck className="h-4 w-4" /><span className="hidden min-[420px]:inline">Semua dibaca</span></button>}
      </div>
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-slate-100">
        {tab !== 'ping' ? (
          listOf(tab).length === 0 ? (tab === 'pay' ? <EmptyState icon={Banknote} title="Belum ada pembayaran" text="Pengajuan / tagihan yang sudah dibayar akan muncul di sini — dengan bunyi mesin kasir 🔔" /> : tab === 'tr' ? <EmptyState icon={Languages} title="Semua terjemahan sudah dibagi" text="Project terjemahan baru yang belum punya penerjemah/vendor akan muncul di sini — dengan bunyi lonceng 🔔" /> : <EmptyState icon={Inbox} title="Belum ada notifikasi" text="Pembaruan tahap, penugasan, dan pengajuan akan muncul di sini." />) : (
            <ul className="divide-y divide-slate-100">
              {listOf(tab).slice(0, 40).map((n) => {
                const isNew = !(n.read_by || []).includes(user.id)
                const sender = data.users.find((u) => u.name === n.by)
                return (
                  <li key={n.id}>
                    <button type="button" onClick={() => (n.project_id && canOpen(n.project_id) ? openProject(n.project_id, markRead, n) : markRead([n]))}
                      className={cx('flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50', isNew && (tab === 'pay' ? 'bg-emerald-50/70' : tab === 'tr' ? 'bg-amber-50/70' : 'bg-brand-soft/40'))}>
                      <span className="relative shrink-0">{tab === 'pay' ? <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-100 text-emerald-700 ring-2 ring-white"><Banknote className="h-4 w-4" /></span> : tab === 'tr' ? <span className="grid h-9 w-9 place-items-center rounded-full bg-amber-100 text-amber-700 ring-2 ring-white"><Languages className="h-4 w-4" /></span> : <Avatar user={sender || { name: n.by || 'Sistem' }} size={36} />}{isNew && <span className={cx('absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white', tab === 'pay' ? 'bg-emerald-500' : tab === 'tr' ? 'bg-amber-500' : 'bg-brand')} aria-hidden />}</span>
                      <span className="min-w-0 flex-1">
                        <span className={cx('block text-sm leading-snug', isNew ? 'font-semibold text-ink' : 'text-ink-soft')}>{n.text}</span>
                        <span className="mt-0.5 block text-[11px] text-ink-mute">{n.by}{sender ? ` · ${roleLabel(sender)}` : ''} · {relTime(n.created_at, now)}</span>
                      </span>
                      {n.project_id && <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-slate-300" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )
        ) : (
          myPings.length === 0 ? <EmptyState icon={BellRing} title="Belum ada ping" text="Rekan kerja bisa mengirim pengingat untuk pekerjaan yang menunggu tindakan Anda." /> : (
            <ul className="divide-y divide-slate-100">
              {myPings.slice(0, 40).map((p) => <PingItem key={p.id} p={p} isNew={!(p.read_by || []).includes(user.id)} sender={userOf(p.from_user)} now={now}
                canOpen={canOpen(p.project_id)} onOpen={() => openProject(p.project_id, markPingRead, p)} onRead={() => markPingRead([p])}
                done={(() => { const pr = data.projects.find((x) => x.id === p.project_id); const s = pr?.sub_projects?.find((x) => x.id === p.sub_id); return s ? s.stage === DONE : !!pr && pr.sub_projects?.every((x) => x.stage === DONE) })()} />)}
            </ul>
          )
        )}
      </div>
      <p className="border-t border-slate-100 px-4 py-2 text-center text-[11px] text-ink-mute">{tab === 'notif' ? 'Membuka pekerjaan menandai notifikasi sebagai dibaca.' : tab === 'pay' ? 'Pembayaran berhasil — berbunyi mesin kasir saat ada yang baru.' : tab === 'tr' ? 'Klik untuk membuka project & membagi penerjemah.' : 'Ping hanya pengingat — maks. 2× per hari per pekerjaan & penerima.'}</p>
    </div>, document.body)

  return (
    <div className="relative">
      <button ref={btnRef} type="button" onClick={() => setOpen((o) => !o)} aria-label={`Notifikasi (${total} belum dibaca)`} aria-expanded={open}
        className={cx('relative grid h-11 w-11 place-items-center rounded-xl bg-white ring-1 ring-slate-200 hover:bg-slate-50', open && 'ring-brand')}>
        <Bell className={cx('h-4 w-4', total ? 'text-brand' : 'text-ink-soft')} />
        {total > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">{total}</span>}
      </button>
      {panel}
    </div>
  )
}

function EmptyState({ icon: Icon, title, text }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-2 grid h-11 w-11 place-items-center rounded-2xl bg-brand-soft text-brand"><Icon className="h-5 w-5" /></div>
      <p className="text-sm font-semibold text-ink">{title}</p><p className="mt-1 max-w-[260px] text-xs text-ink-mute">{text}</p>
    </div>
  )
}

function PingItem({ p, isNew, sender, now, canOpen, onOpen, onRead, done }) {
  const d = daysLeft(p.deadline)
  const dl = p.deadline ? `${tgl(p.deadline)}${d === 0 ? ' · Hari ini' : d === 1 ? ' · Besok' : d !== null && d < 0 ? ` · Terlambat ${-d} hr` : ''}` : '—'
  return (
    <li className={cx('px-4 py-3', isNew && 'bg-brand-soft/40')} onClick={() => isNew && onRead()}>
      <div className="flex items-start gap-3">
        <span className="relative shrink-0"><Avatar user={sender || { name: p.from_name }} size={40} />{isNew && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-white" aria-hidden />}</span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-1.5 text-sm"><b className="text-ink">{sender?.name || p.from_name}</b><span className="rounded-md bg-slate-100 px-1.5 py-px text-[10px] font-semibold text-ink-soft">{sender ? roleLabel(sender) : roleLabel(null, p.from_role)}</span><span className="ml-auto text-[11px] text-ink-mute">{relTime(p.created_at, now)}</span></p>
          <p className={cx('mt-1 text-sm leading-snug', isNew ? 'text-ink' : 'text-ink-soft')}>“{p.message}”</p>
          <p className="mt-1.5 text-xs font-semibold text-ink">{invoiceLabel(p.invoice_no)}{p.sub_title ? <span className="font-normal text-ink-soft"> · {p.sub_title}</span> : null}{p.stage_label ? <span className="font-normal text-ink-mute"> · {p.stage_label}</span> : null}</p>
          <p className={cx('mt-0.5 flex items-center gap-1 text-xs', d !== null && d <= 0 && !done ? 'font-semibold text-rose-600' : 'text-ink-mute')}><CalendarClock className="h-3.5 w-3.5" />Deadline: {dl}</p>
          <div className="mt-2 flex items-center gap-2">
            {done ? <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200"><CheckCheck className="h-3.5 w-3.5" />Sudah Selesai</span> : null}
            {canOpen ? <button type="button" onClick={(e) => { e.stopPropagation(); onOpen() }} className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1 text-[11px] font-semibold text-white shadow-glow hover:bg-brand-dark">Buka Pekerjaan <ArrowRight className="h-3.5 w-3.5" /></button>
              : <span className="text-[11px] text-ink-mute">Pekerjaan di luar akses Anda</span>}
          </div>
        </div>
      </div>
    </li>
  )
}

