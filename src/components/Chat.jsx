import { useEffect, useMemo, useRef, useState } from 'react'
import { MessageCircle, Search, Send, Bell, ArrowLeft, RefreshCw, Volume2, Hash, Smile } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { scopeByBranch } from '../config/access.js'
import { contactsFor, threadOf, peerOf, pingQuota, parseText, snippet, PING_MAX_24H } from '../lib/chat.js'
import { playChat, playChatPing, chatSoundEnabled, audioBlocked, unlockAudio } from '../lib/sounds.js'
import { statusOf, STATUS } from '../lib/presence.js'
import { go } from '../lib/router.js'
import Avatar from './Avatar.jsx'
import { Sheet, cx } from './ui.jsx'

const EMOJI = ['👍', '🙏', '🙂', '😄', '😅', '🔥', '✅', '❗', '⏰', '📄', '💪', '🫶']
const jam = (iso) => new Date(iso).toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit' })
const hari = (iso) => new Date(iso).toLocaleDateString('id-ID', { timeZone: 'Asia/Makassar', weekday: 'long', day: 'numeric', month: 'short' })

/** Ikon chat di header + panel kanan. Satu panel, tidak menumpuk panel kerja. */
export default function Chat() {
  const { user, data, chatMessages, chatUnread, chatTotals, sendMessage, sendChatPing, markChatRead, notify, branchFilter } = useApp()
  const [open, setOpen] = useState(false)
  const [thread, setThread] = useState(null)
  const [q, setQ] = useState('')
  const [text, setText] = useState('')
  const [pending, setPending] = useState([]) // pesan yang sedang dikirim / gagal
  const [blocked, setBlocked] = useState(false)
  const seen = useRef(null) // waktu pesan terakhir yang sudah "diketahui" → cegah bunyi saat muat ulang
  const lastSound = useRef(0)
  const endRef = useRef(null)

  const contacts = useMemo(() => contactsFor(user, data.users), [user, data.users])
  const projects = useMemo(() => scopeByBranch(user, data.projects, branchFilter), [user, data.projects, branchFilter])
  const peer = thread ? peerOf(thread, user.id) : null
  const peerInfo = contacts.find((c) => c.id === peer)
  const msgs = useMemo(() => chatMessages.filter((m) => m.thread === thread), [chatMessages, thread])
  const quota = useMemo(() => (thread ? pingQuota(chatMessages, user, thread) : null), [chatMessages, user, thread])

  // Bunyi untuk pesan BARU dari orang lain saja — bukan pesan sendiri, bukan riwayat lama,
  // bukan hasil muat ulang. Beberapa pesan berdekatan digabung jadi satu bunyi.
  useEffect(() => {
    const last = chatMessages[chatMessages.length - 1]
    if (!last) return
    const t = new Date(last.created_at).getTime()
    if (seen.current === null) { seen.current = t; return } // muat pertama: diam
    if (t <= seen.current) return
    seen.current = t
    if (last.from_user === user.id) return
    const viewing = open && thread === last.thread && document.visibilityState === 'visible'
    if (!viewing) notify(`${last.from_name}: ${snippet(last.text, 48)}`, 'ok', `chat:${last.from_user}`)
    if (Date.now() - lastSound.current < 5000) return // gabungkan bunyi
    lastSound.current = Date.now()
    if (!chatSoundEnabled()) return
    if (audioBlocked()) { setBlocked(true); return }
    if (last.kind === 'ping') playChatPing(); else if (!viewing) playChat()
  }, [chatMessages]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (open && thread) markChatRead(thread) }, [open, thread, msgs.length]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [msgs.length, thread, open])

  const firstUnread = useMemo(() => msgs.find((m) => m.from_user !== user.id && !(m.read_by || []).includes(user.id))?.id, [thread]) // eslint-disable-line react-hooks/exhaustive-deps

  const doSend = async (body = text, retryId) => {
    const t = body.trim()
    if (!t || !peer) return
    const mentions = [...t.matchAll(/#([A-Za-z0-9-]{3,})/g)].map((m) => m[1])
    const key = retryId || `p${Date.now()}`
    setPending((p) => [...p.filter((x) => x.key !== retryId), { key, text: t, state: 'kirim' }])
    setText('')
    try {
      await sendMessage({ to: peer, text: t, mentions })
      setPending((p) => p.filter((x) => x.key !== key))
    } catch {
      setPending((p) => p.map((x) => (x.key === key ? { ...x, state: 'gagal' } : x)))
    }
  }
  const doPing = async () => {
    try { await sendChatPing(peer); notify('Ping terkirim') } catch (e) { notify(e.message, 'err') }
  }

  // saran project saat mengetik "#"
  const hint = useMemo(() => {
    const m = /#([A-Za-z0-9-]*)$/.exec(text)
    if (!m) return null
    const term = m[1].toLowerCase()
    return projects.filter((p) => !term || p.invoice_no.toLowerCase().includes(term) || (p.customer?.name || '').toLowerCase().includes(term)).slice(0, 6)
  }, [text, projects])
  const pickProject = (p) => setText((t) => t.replace(/#([A-Za-z0-9-]*)$/, `#${p.invoice_no} `))

  const Mention = ({ inv }) => {
    const p = projects.find((x) => String(x.invoice_no).toUpperCase() === inv.toUpperCase())
    // izin diperiksa ulang saat dibuka: yang tidak boleh diakses tampil sebagai teks biasa
    if (!p) return <span className="rounded bg-slate-100 px-1 text-[12px] text-ink-mute" title="Project ini tidak dapat Anda akses">#{inv}</span>
    return <button type="button" onClick={() => { go(`projects/${p.id}`) }} className="rounded bg-brand-soft px-1 font-semibold text-brand hover:underline">#{inv}</button>
  }

  const list = contacts.filter((c) => !q.trim() || c.name.toLowerCase().includes(q.trim().toLowerCase()))

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Chat tim" aria-label={`Chat tim${chatTotals.msg ? `, ${chatTotals.msg} belum dibaca` : ''}`}
        className="relative grid h-8 w-8 place-items-center rounded-lg text-ink-mute transition hover:bg-white hover:text-brand">
        <MessageCircle className="h-[17px] w-[17px]" />
        {chatTotals.msg > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{chatTotals.msg}</span>}
        {chatTotals.ping > 0 && <span className="absolute -bottom-0.5 -right-0.5 grid h-3.5 min-w-[14px] place-items-center rounded-full bg-amber-500 px-0.5 text-[9px] font-bold text-white" title={`${chatTotals.ping} ping`}>{chatTotals.ping}</span>}
      </button>

      <Sheet open={open} side onClose={() => setOpen(false)} title={thread ? peerInfo?.name || 'Percakapan' : 'Chat Tim'}
        subtitle={thread ? 'Pesan singkat & mention project' : 'Koordinasi cepat antar anggota tim'}
        footer={thread ? (
          <div className="w-full space-y-1.5">
            {blocked && (
              <button type="button" onClick={async () => { if (await unlockAudio()) { setBlocked(false); notify('Suara chat aktif') } }}
                className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200"><Volume2 className="h-3 w-3" />Aktifkan Suara</button>
            )}
            {hint && hint.length > 0 && (
              <ul className="max-h-36 overflow-auto rounded-xl bg-white p-1 ring-1 ring-slate-200">
                {hint.map((p) => (
                  <li key={p.id}><button type="button" onClick={() => pickProject(p)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-slate-50">
                    <Hash className="h-3 w-3 text-ink-mute" /><b>{p.invoice_no}</b><span className="truncate text-ink-mute">{p.customer?.name}</span></button></li>
                ))}
              </ul>
            )}
            <div className="flex items-end gap-1.5">
              <div className="flex gap-0.5 overflow-x-auto pb-1">
                {EMOJI.slice(0, 6).map((e) => <button key={e} type="button" onClick={() => setText((t) => t + e)} className="rounded-lg px-1 text-base hover:bg-slate-100" aria-label={`Emoji ${e}`}>{e}</button>)}
              </div>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder="Tulis pesan… ketik # untuk project"
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend() } }}
                aria-label="Tulis pesan" className="min-h-[40px] flex-1 resize-none rounded-xl border-0 bg-white px-3 py-2 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-brand" />
              <button type="button" onClick={doPing} disabled={!quota || quota.left <= 0 || quota.gapLeft > 0}
                title={quota && quota.left <= 0 ? `Kuota habis, pulih ${quota.resetAt?.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` : 'Ping penerima'}
                className="grid h-10 shrink-0 place-items-center gap-0.5 rounded-xl bg-white px-2 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200 enabled:hover:bg-amber-50 disabled:opacity-40">
                <Bell className="h-4 w-4" />{quota ? `${quota.used}/${PING_MAX_24H}` : ''}
              </button>
              <button type="button" onClick={() => doSend()} disabled={!text.trim()} aria-label="Kirim"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink text-white disabled:opacity-40"><Send className="h-4 w-4" /></button>
            </div>
          </div>
        ) : null}>
        {!thread ? (
          <div className="space-y-2">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari rekan…" aria-label="Cari rekan"
                className="w-full rounded-xl border-0 bg-slate-50 py-2.5 pl-9 pr-3 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand" />
            </label>
            <ul className="space-y-0.5">
              {list.map((c) => {
                const th = threadOf(user.id, c.id)
                const un = chatUnread[th] || { msg: 0, ping: 0 }
                const last = [...chatMessages].reverse().find((m) => m.thread === th)
                const st = c.user ? STATUS[statusOf(c.user)] : null
                return (
                  <li key={c.id}>
                    <button type="button" onClick={() => setThread(th)} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-slate-50">
                      <span className="relative shrink-0">
                        {c.user ? <Avatar user={c.user} size={32} ring={false} className="ring-1 ring-slate-200" />
                          : <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-[11px] font-bold text-ink-soft ring-1 ring-slate-200">{c.team}</span>}
                        {st && <span className={cx('absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white', st.dot)} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-ink">{c.name}</span>
                        <span className="block truncate text-[11px] text-ink-mute">{last ? `${last.from_user === user.id ? 'Anda: ' : ''}${snippet(last.text, 40)}` : 'Belum ada pesan'}</span>
                      </span>
                      {un.msg > 0 && <span className="shrink-0 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{un.msg}</span>}
                      {un.ping > 0 && <span className="shrink-0 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white" title="ping">{un.ping}</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
            <p className="pt-1 text-[11px] text-ink-mute">Pesan hanya bisa dibaca Anda dan lawan bicara. Pesan ke Tim Proofreader masuk ke satu inbox tim.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <button type="button" onClick={() => setThread(null)} className="inline-flex items-center gap-1 text-xs font-semibold text-ink-soft hover:text-brand"><ArrowLeft className="h-3.5 w-3.5" />Semua percakapan</button>
            {msgs.length === 0 && <p className="py-8 text-center text-xs text-ink-mute">Belum ada pesan. Sapa dulu 🙂</p>}
            <ul className="space-y-1.5">
              {msgs.map((m, i) => {
                const mine = m.from_user === user.id
                const newDay = i === 0 || hari(m.created_at) !== hari(msgs[i - 1].created_at)
                return (
                  <li key={m.id}>
                    {newDay && <p className="my-2 text-center text-[10px] font-semibold uppercase tracking-wider text-ink-mute">{hari(m.created_at)}</p>}
                    {m.id === firstUnread && !mine && <p className="my-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-rose-500"><span className="h-px flex-1 bg-rose-200" />Belum dibaca<span className="h-px flex-1 bg-rose-200" /></p>}
                    <div className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
                      <div className={cx('max-w-[82%] rounded-2xl px-3 py-1.5 text-sm ring-1',
                        m.kind === 'ping' ? 'bg-amber-50 text-amber-900 ring-amber-200' : mine ? 'bg-ink text-white ring-ink' : 'bg-white text-ink ring-slate-200')}>
                        {!mine && !m.thread.startsWith('dm:') && <p className="text-[10px] font-bold opacity-70">{m.from_name}</p>}
                        <p className="whitespace-pre-wrap break-words">
                          {m.kind === 'ping' && <Bell className="mr-1 inline h-3.5 w-3.5" />}
                          {parseText(m.text).map((part, k) => (part.inv ? <Mention key={k} inv={part.inv} /> : <span key={k}>{part.t}</span>))}
                        </p>
                        <p className={cx('mt-0.5 text-right text-[10px]', mine && m.kind !== 'ping' ? 'text-white/60' : 'text-ink-mute')}>{jam(m.created_at)}{mine && ((m.read_by || []).length ? ' · dibaca' : ' · terkirim')}</p>
                      </div>
                    </div>
                  </li>
                )
              })}
              {pending.map((p) => (
                <li key={p.key} className="flex justify-end">
                  <div className={cx('max-w-[82%] rounded-2xl px-3 py-1.5 text-sm ring-1', p.state === 'gagal' ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-ink/60 text-white ring-ink/30')}>
                    <p className="whitespace-pre-wrap break-words">{p.text}</p>
                    <p className="mt-0.5 flex items-center justify-end gap-1 text-right text-[10px]">
                      {p.state === 'gagal'
                        ? <button type="button" onClick={() => doSend(p.text, p.key)} className="inline-flex items-center gap-1 font-bold hover:underline"><RefreshCw className="h-3 w-3" />Gagal — coba lagi</button>
                        : 'mengirim…'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <div ref={endRef} />
            {quota && quota.left <= 0 && <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-900 ring-1 ring-amber-200">Kuota ping habis ({PING_MAX_24H}× per 24 jam). Bisa ping lagi sekitar {quota.resetAt?.toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit' })}.</p>}
          </div>
        )}
      </Sheet>
    </>
  )
}
