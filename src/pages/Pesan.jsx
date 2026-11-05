import { useEffect, useMemo, useRef, useState } from 'react'
import { MessageCircle, Search, Send, Bell, ArrowLeft, RefreshCw, Volume2, Hash, AlarmClock } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { scopeByBranch } from '../config/access.js'
import { contactsFor, threadOf, peerOf, pingQuota, parseText, snippet, PING_MAX_24H } from '../lib/chat.js'
import { playChat, playChatPing, chatSoundEnabled, audioBlocked, unlockAudio } from '../lib/sounds.js'
import { statusOf, STATUS } from '../lib/presence.js'
import { go } from '../lib/router.js'
import { usePanel } from '../components/WorkspacePanel.jsx'
import Avatar from '../components/Avatar.jsx'
import { Card, cx } from '../components/ui.jsx'

const EMOJI = ['👍', '🙏', '🙂', '😄', '😅', '🔥', '✅', '❗', '⏰', '📄']
const TZ = 'Asia/Makassar'
const jam = (iso) => new Date(iso).toLocaleTimeString('id-ID', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
const hari = (iso) => new Date(iso).toLocaleDateString('id-ID', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'short' })
const singkat = (iso) => {
  const d = new Date(iso); const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  return sameDay ? jam(iso) : d.toLocaleDateString('id-ID', { timeZone: TZ, day: 'numeric', month: 'short' })
}

/** Jumlah pesan belum dibaca — dipakai untuk angka di menu. */
export const unreadCount = (chatTotals) => (chatTotals?.msg || 0)

/**
 * Pesan Masuk — daftar percakapan di kiri, isi percakapan di kanan.
 * Percakapan dengan pesan terbaru naik ke atas.
 */
export default function Pesan({ peerParam }) {
  const { user, data, chatMessages, chatUnread, sendMessage, sendChatPing, markChatRead, sendTyping, typing, notify, branchFilter } = useApp()
  const [thread, setThread] = useState(null)
  const [q, setQ] = useState('')
  const [text, setText] = useState('')
  const [pending, setPending] = useState([])
  const [blocked, setBlocked] = useState(false)
  const { open } = usePanel()
  const lastTyping = useRef(0)
  const endRef = useRef(null)
  const seen = useRef(null)
  const lastSound = useRef(0)

  const contacts = useMemo(() => contactsFor(user, data.users), [user, data.users])
  const projects = useMemo(() => scopeByBranch(user, data.projects, branchFilter), [user, data.projects, branchFilter])

  // dibuka dari Tim Aktif: #/pesan/<id>
  useEffect(() => { if (peerParam) setThread(threadOf(user.id, peerParam)) }, [peerParam]) // eslint-disable-line react-hooks/exhaustive-deps
  // di layar lebar: langsung buka percakapan yang ada pesan belum dibaca, atau yang terbaru
  const autoOpened = useRef(false)
  useEffect(() => {
    if (autoOpened.current || peerParam || thread || !chatMessages.length) return
    if (typeof window !== 'undefined' && window.innerWidth < 768) return
    const unread = Object.entries(chatUnread).find(([, v]) => v.msg > 0)?.[0]
    const latest = chatMessages[chatMessages.length - 1]?.thread
    const pick = unread || latest
    if (pick) { autoOpened.current = true; setThread(pick) }
  }, [chatMessages, chatUnread]) // eslint-disable-line react-hooks/exhaustive-deps

  const peer = thread ? peerOf(thread, user.id) : null
  const peerInfo = contacts.find((c) => c.id === peer)
  const msgs = useMemo(() => chatMessages.filter((m) => m.thread === thread), [chatMessages, thread])
  const quota = useMemo(() => (thread ? pingQuota(chatMessages, user, thread) : null), [chatMessages, user, thread])
  const peerTyping = thread && typing[thread] ? typing[thread].name : ''

  // daftar percakapan: yang ada pesannya naik ke atas, urut pesan terakhir
  const list = useMemo(() => {
    const last = {}
    for (const m of chatMessages) last[m.thread] = m
    const term = q.trim().toLowerCase()
    return contacts
      .map((c) => { const th = threadOf(user.id, c.id); return { ...c, th, last: last[th], un: chatUnread[th] || { msg: 0, ping: 0 } } })
      .filter((c) => !term || c.name.toLowerCase().includes(term))
      .sort((a, b) => {
        if (!!a.last !== !!b.last) return a.last ? -1 : 1
        if (a.last && b.last) return String(b.last.created_at).localeCompare(String(a.last.created_at))
        return a.name.localeCompare(b.name)
      })
  }, [contacts, chatMessages, chatUnread, q, user.id])

  useEffect(() => { if (thread) markChatRead(thread) }, [thread, msgs.length]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [msgs.length, thread])

  // bunyi hanya untuk pesan baru dari orang lain pada percakapan yang tidak sedang dibuka
  useEffect(() => {
    const m = chatMessages[chatMessages.length - 1]
    if (!m) return
    const t = new Date(m.created_at).getTime()
    if (seen.current === null) { seen.current = t; return }
    if (t <= seen.current) return
    seen.current = t
    if (m.from_user === user.id) return
    const viewing = thread === m.thread && document.visibilityState === 'visible'
    if (viewing || Date.now() - lastSound.current < 5000 || !chatSoundEnabled()) return
    lastSound.current = Date.now()
    if (audioBlocked()) { setBlocked(true); return }
    if (m.kind === 'ping') playChatPing(); else playChat()
  }, [chatMessages]) // eslint-disable-line react-hooks/exhaustive-deps

  const firstUnread = useMemo(() => msgs.find((m) => m.from_user !== user.id && !(m.read_by || []).includes(user.id))?.id, [thread]) // eslint-disable-line react-hooks/exhaustive-deps

  const onType = (v) => {
    setText(v)
    if (thread && peer && Date.now() - lastTyping.current > 1500) { lastTyping.current = Date.now(); sendTyping(thread, peer) }
  }
  const doSend = async (body = text, retryId) => {
    const t = body.trim()
    if (!t || !peer) return
    const mentions = [...t.matchAll(/#([A-Za-z0-9-]{3,})/g)].map((m) => m[1])
    const key = retryId || `p${Date.now()}`
    setPending((p) => [...p.filter((x) => x.key !== retryId), { key, text: t, state: 'kirim' }])
    setText('')
    try { await sendMessage({ to: peer, text: t, mentions }); setPending((p) => p.filter((x) => x.key !== key)) }
    catch { setPending((p) => p.map((x) => (x.key === key ? { ...x, state: 'gagal' } : x))) }
  }
  /** Isian awal pengingat dari percakapan: judul dari yang sedang diketik atau pesan terakhir,
   *  dan otomatis tertaut ke project bila percakapan menyebut #INV. */
  const reminderPrefill = () => {
    const last = msgs[msgs.length - 1]
    const base = text.trim() || (last ? `${last.from_user === user.id ? 'Tindak lanjut' : `Balas ${peerInfo?.name || ''}`}: ${snippet(last.text, 50)}` : `Hubungi ${peerInfo?.name || ''}`)
    const inv = [...msgs].reverse().flatMap((m) => m.mentions || [])[0]
    const p = inv ? projects.find((x) => String(x.invoice_no).toUpperCase() === String(inv).toUpperCase()) : null
    return { title: base.slice(0, 80), project_id: p?.id || '', note: `Dari percakapan dengan ${peerInfo?.name || ''}` }
  }
  const doPing = async () => { try { await sendChatPing(peer); notify('Ping terkirim') } catch (e) { notify(e.message, 'err') } }

  const hint = useMemo(() => {
    const m = /#([A-Za-z0-9-]*)$/.exec(text)
    if (!m) return null
    const term = m[1].toLowerCase()
    return projects.filter((p) => !term || p.invoice_no.toLowerCase().includes(term) || (p.customer?.name || '').toLowerCase().includes(term)).slice(0, 6)
  }, [text, projects])

  const Mention = ({ inv }) => {
    const p = projects.find((x) => String(x.invoice_no).toUpperCase() === inv.toUpperCase())
    if (!p) return <span className="rounded bg-slate-100 px-1 text-[12px] text-ink-mute" title="Project ini tidak dapat Anda akses">#{inv}</span>
    return <button type="button" onClick={() => go(`projects/${p.id}`)} className="rounded bg-brand-soft px-1 font-semibold text-brand hover:underline">#{inv}</button>
  }

  return (
    <div className="space-y-3">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold tracking-tight"><MessageCircle className="h-5 w-5 text-ink-mute" />Pesan Masuk</h1>
        <p className="text-sm text-ink-soft">Koordinasi cepat antar anggota tim — teks, emoji, dan tautan project.</p>
      </div>

      <Card className="grid h-[calc(100vh-var(--appbar)-172px)] min-h-[420px] grid-rows-1 gap-0 overflow-hidden p-0 md:grid-cols-[clamp(240px,24vw,320px)_minmax(0,1fr)]">
        {/* kiri: daftar nama */}
        <div className={cx('flex min-h-0 flex-col border-slate-200 md:border-r', thread && 'hidden md:flex')}>
          <label className="relative block border-b border-slate-100 p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari rekan…" aria-label="Cari rekan"
              className="w-full rounded-xl border-0 bg-slate-50 py-2 pl-8 pr-2 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand" />
          </label>
          <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {list.map((c) => {
              const st = c.user ? STATUS[statusOf(c.user)] : null
              const on = thread === c.th
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => setThread(c.th)}
                    className={cx('flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition', on ? 'bg-brand-soft' : 'hover:bg-slate-50')}>
                    <span className="relative shrink-0">
                      {c.user ? <Avatar user={c.user} size={34} ring={false} className="ring-1 ring-slate-200" />
                        : <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-slate-100 text-[11px] font-bold text-ink-soft ring-1 ring-slate-200">{c.team}</span>}
                      {st && <span className={cx('absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white', st.dot)} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={cx('min-w-0 truncate text-[13px]', c.un.msg ? 'font-bold text-ink' : 'font-semibold text-ink')}>{c.name}</span>
                        {c.last && <span className="shrink-0 text-[10px] text-ink-mute">{singkat(c.last.created_at)}</span>}
                      </span>
                      <span className="flex items-center gap-1.5">
                        {st && <span className={cx('shrink-0 text-[10px] font-bold', st.text)}>{st.label}</span>}
                        <span className={cx('min-w-0 flex-1 truncate text-[11px]', typing[c.th] ? 'font-semibold text-brand' : c.un.msg ? 'font-semibold text-ink-soft' : 'text-ink-mute')}>
                          {typing[c.th] ? 'sedang mengetik…' : c.last ? `${c.last.from_user === user.id ? 'Anda: ' : ''}${snippet(c.last.text, 28)}` : 'Belum ada pesan'}
                        </span>
                      </span>
                    </span>
                    {c.un.msg > 0 && <span className="shrink-0 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{c.un.msg}</span>}
                    {c.un.ping > 0 && <span className="shrink-0 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white" title="ping">{c.un.ping}</span>}
                  </button>
                </li>
              )
            })}
            {list.length === 0 && <li className="px-3 py-8 text-center text-xs text-ink-mute">Tidak ada yang cocok.</li>}
          </ul>
        </div>

        {/* kanan: isi percakapan */}
        <div className={cx('flex min-h-0 flex-col', !thread && 'hidden md:flex')}>
          {!thread ? (
            <p className="grid flex-1 place-items-center p-10 text-center text-sm text-ink-mute">Pilih nama di kiri untuk mulai mengobrol.<br />Bisa juga klik seseorang di daftar Tim Aktif.</p>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                <button type="button" onClick={() => setThread(null)} aria-label="Kembali" className="rounded-lg p-1 text-ink-mute hover:bg-slate-100 md:hidden"><ArrowLeft className="h-4 w-4" /></button>
                {peerInfo?.user && <Avatar user={peerInfo.user} size={28} ring={false} className="ring-1 ring-slate-200" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-ink">{peerInfo?.name || 'Percakapan'}</span>
                  <span className="block truncate text-[11px] text-ink-mute">{peerTyping ? 'sedang mengetik…' : peerInfo?.user ? STATUS[statusOf(peerInfo.user)].label : 'Inbox tim'}</span>
                </span>
                <button type="button" onClick={doPing} disabled={!quota || quota.left <= 0 || quota.gapLeft > 0}
                  title={quota && quota.left <= 0 ? `Kuota habis, pulih ${quota.resetAt?.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` : 'Ping penerima'}
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-white px-2 py-1.5 text-[11px] font-bold text-amber-700 ring-1 ring-amber-200 enabled:hover:bg-amber-50 disabled:opacity-40">
                  <Bell className="h-3.5 w-3.5" />{quota ? `${quota.used}/${PING_MAX_24H}` : ''}
                </button>
              </div>

              <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain p-3">
                {msgs.length === 0 && <li className="py-8 text-center text-xs text-ink-mute">Belum ada pesan. Sapa dulu 🙂</li>}
                {msgs.map((m, i) => {
                  const mine = m.from_user === user.id
                  const newDay = i === 0 || hari(m.created_at) !== hari(msgs[i - 1].created_at)
                  return (
                    <li key={m.id}>
                      {newDay && <p className="my-2 text-center text-[10px] font-semibold uppercase tracking-wider text-ink-mute">{hari(m.created_at)}</p>}
                      {m.id === firstUnread && !mine && <p className="my-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-rose-500"><span className="h-px flex-1 bg-rose-200" />Belum dibaca<span className="h-px flex-1 bg-rose-200" /></p>}
                      <div className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
                        <div className={cx('max-w-[78%] rounded-2xl px-3 py-1.5 text-sm ring-1',
                          m.kind === 'ping' ? 'bg-amber-50 text-amber-900 ring-amber-200' : mine ? 'bg-ink text-white ring-ink' : 'bg-white text-ink ring-slate-200')}>
                          {!mine && m.thread.startsWith('team:') && <p className="text-[10px] font-bold opacity-70">{m.from_name}</p>}
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
                    <div className={cx('max-w-[78%] rounded-2xl px-3 py-1.5 text-sm ring-1', p.state === 'gagal' ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-ink/60 text-white ring-ink/30')}>
                      <p className="whitespace-pre-wrap break-words">{p.text}</p>
                      <p className="mt-0.5 text-right text-[10px]">
                        {p.state === 'gagal'
                          ? <button type="button" onClick={() => doSend(p.text, p.key)} className="inline-flex items-center gap-1 font-bold hover:underline"><RefreshCw className="h-3 w-3" />Gagal — coba lagi</button>
                          : 'mengirim…'}
                      </p>
                    </div>
                  </li>
                ))}
                {peerTyping && (
                  <li className="flex items-center gap-1.5 px-1 text-[11px] font-semibold text-ink-mute" aria-live="polite">
                    <span className="flex gap-0.5">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-mute [animation-delay:-0.25s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-mute [animation-delay:-0.12s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-mute" />
                    </span>
                    {peerTyping} sedang mengetik…
                  </li>
                )}
                <div ref={endRef} />
              </ul>

              <div className="space-y-1.5 border-t border-slate-100 p-2">
                {blocked && <button type="button" onClick={async () => { if (await unlockAudio()) { setBlocked(false); notify('Suara chat aktif') } }}
                  className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200"><Volume2 className="h-3 w-3" />Aktifkan Suara</button>}
                {hint && hint.length > 0 && (
                  <ul className="max-h-36 overflow-auto rounded-xl bg-white p-1 ring-1 ring-slate-200">
                    {hint.map((p) => (
                      <li key={p.id}><button type="button" onClick={() => setText((t) => t.replace(/#([A-Za-z0-9-]*)$/, `#${p.invoice_no} `))}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-slate-50">
                        <Hash className="h-3 w-3 text-ink-mute" /><b>{p.invoice_no}</b><span className="truncate text-ink-mute">{p.customer?.name}</span></button></li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap items-center gap-0.5">
                  {EMOJI.map((e) => <button key={e} type="button" onClick={() => setText((t) => t + e)} className="rounded-lg px-1 text-base leading-none hover:bg-slate-100" aria-label={`Emoji ${e}`}>{e}</button>)}
                  <button type="button" onClick={() => open('reminder', { prefill: reminderPrefill() })} title="Buat pengingat dari percakapan ini"
                    className="ml-auto inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-ink-soft ring-1 ring-slate-200 hover:text-brand hover:ring-brand">
                    <AlarmClock className="h-3.5 w-3.5" />Ingatkan
                  </button>
                </div>
                <div className="flex w-full items-end gap-1.5">
                  <textarea value={text} onChange={(e) => onType(e.target.value)} rows={Math.min(5, Math.max(1, text.split('\n').length))}
                    placeholder="Tulis pesan… ketik # untuk menautkan project"
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend() } }}
                    aria-label="Tulis pesan" className="min-h-[42px] w-full flex-1 resize-none rounded-xl border-0 bg-white px-3 py-2.5 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-brand" />
                  <button type="button" onClick={() => doSend()} disabled={!text.trim()} aria-label="Kirim"
                    className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl bg-ink text-white disabled:opacity-40"><Send className="h-4 w-4" /></button>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>
      <p className="text-[11px] text-ink-mute">Pesan hanya bisa dibaca Anda dan lawan bicara. Pesan ke Tim Proofreader masuk ke satu inbox tim. Ping dibatasi {PING_MAX_24H}× per 24 jam dengan jeda 60 detik.</p>
    </div>
  )
}
