import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { db, TABLES, MODE } from './db.js'
import { describe } from './activity.js'
import { branchesOf, APOSTILLE_FUND, ROLES, roleLabel, displayNameFor, WORKER_ROLES, branchOfInvoice, can } from '../config/access.js'
import { zoho } from './integrations.js'
import { startHeartbeat, statusOf } from './presence.js'
import { threadOf, myMessages, unreadByThread, pingQuota, openChatBus, PING_MAX_24H, PING_GAP_MS } from './chat.js'
import { broadcastSignOut, markActivity, setIdleReason, simpanTujuan, ambilTujuan } from './session.js'
import { CHAT_ENABLED } from './flags.js'
import { DONE, stagesOf, flowOf, isBilled, regComplete, stageLabel } from '../config/workflows.js'
import { cariStok, cariPeringatan, kunciPeringatan, teksPeringatan, sudahTercatat, arahLabel, canKelolaAffidavit, AMBANG_RENDAH } from './affidavit.js'

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

/** Tanggal 1 bulan lalu (YYYY-MM-DD) — batas bawaan pemuatan faktur Zoho. */
export const awalBulanLalu = () => {
  const d = new Date()
  return `${new Date(d.getFullYear(), d.getMonth() - 1, 1).toLocaleDateString('sv-SE')}`
}

export function AppProvider({ children }) {
  const [baseUser, setUser] = useState(null)
  const [data, setData] = useState({ users: [], people: [], projects: [], petty_cash: [], couriers: [], notifications: [], requests: [], perf_daily: [], share_links: [], share_log: [], vendor_bills: [], fund_balances: [], app_settings: [], activity_log: [], pings: [], notes: [], todos: [], reminders: [], messages: [], affidavit_stok: [], affidavit_pakai: [], affidavit_kirim: [], jadwal: [], cuti: [], mitra: [], kapasitas: [] })
  // double job: user bisa berganti peran aktif (mis. Proofreader ↔ Staf Otorisasi)
  const [activeRole, setActiveRoleState] = useState(() => { try { return sessionStorage.getItem('atlas-active-role') } catch { return null } })
  const user = useMemo(() => {
    if (!baseUser) return null
    const roles = [baseUser.role, ...(baseUser.extra_roles || [])]
    // foto profil selalu diambil dari tabel users terkini (bisa diganti di Pengaturan → Profil)
    const live = data.users.find((u) => u.id === baseUser.id)
    const base = live && live.avatar !== baseUser.avatar ? { ...baseUser, avatar: live.avatar } : baseUser
    return roles.includes(activeRole) && activeRole !== baseUser.role ? { ...base, role: activeRole, base_role: baseUser.role } : base
  }, [baseUser, activeRole, data.users])
  const setActiveRole = (r) => { try { sessionStorage.setItem('atlas-active-role', r) } catch { /* abaikan */ } setActiveRoleState(r) }
  const [booting, setBooting] = useState(true)
  const [toast, setToast] = useState(null)
  const [branchFilter, setBranchFilter] = useState('Semua')
  const [confirmState, setConfirmState] = useState(null)
  const ask = useCallback((msg) => new Promise((resolve) => setConfirmState({ msg, resolve })), [])

  // ---------- notifikasi layar (toast) ----------
  // Aturan: hanya SATU toast tampil, 3,5 detik, bisa ditutup, tanpa suara.
  // Pesan sejenis (group sama) digabung jadi satu — mis. "4 anggota tim kini online".
  const toastQ = useRef([]); const toastTimer = useRef(null); const muteRef = useRef(0)
  // pesan gabungan bila beberapa kejadian sejenis datang bersamaan
  const mergedMsg = (group, n, msg) => (group === 'presence' ? `${n} anggota tim kini online`
    : group === 'reminder' ? `${n} pengingat jatuh tempo — lihat menu Reminders` : msg)
  const showNext = useCallback(() => {
    clearTimeout(toastTimer.current)
    const next = toastQ.current.shift()
    if (!next) { setToast(null); return }
    setToast(next)
    toastTimer.current = setTimeout(() => showNext(), 3500)
  }, [])
  const dismissToast = useCallback(() => showNext(), [showNext])
  const notify = useCallback((msg, tone = 'ok', group = null) => {
    // Mode senyap: pesan biasa ditahan, tetapi peringatan/kesalahan & hal keamanan tetap tampil
    if (tone !== 'err' && group !== 'security' && muteRef.current && Date.now() < muteRef.current) return
    const item = { msg, tone, group, n: 1, k: Date.now() + Math.random() }
    setToast((cur) => {
      // gabungkan dengan toast yang sedang tampil bila satu kelompok
      if (cur && group && cur.group === group) {
        const n = cur.n + 1
        clearTimeout(toastTimer.current)
        toastTimer.current = setTimeout(() => showNext(), 3500)
        return { ...cur, n, msg: mergedMsg(group, n, msg), k: cur.k }
      }
      if (cur) {
        // antre; kelompok yang sama di antrean juga digabung, antrean maksimal 3
        const q = toastQ.current
        const same = group && q.find((x) => x.group === group)
        if (same) { same.n += 1; same.msg = mergedMsg(group, same.n, msg) }
        else { q.push(item); if (q.length > 3) q.shift() }
        return cur
      }
      clearTimeout(toastTimer.current)
      toastTimer.current = setTimeout(() => showNext(), 3500)
      return item
    })
  }, [showNext])
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  // Muat dua tahap: tabel inti dulu supaya layar cepat terisi, sisanya menyusul di latar.
  const CORE = ['users', 'projects', 'notifications', 'couriers', 'people', 'app_settings']
  const refresh = useCallback(async () => {
    const rest = TABLES.filter((t) => !CORE.includes(t))
    const core = await Promise.all(CORE.map((t) => db.list(t).catch(() => [])))
    setData((d) => ({ ...d, ...Object.fromEntries(CORE.map((t, i) => [t, core[i]])) }))
    const more = await Promise.all(rest.map((t) => db.list(t).catch(() => [])))
    setData((d) => ({ ...d, ...Object.fromEntries(rest.map((t, i) => [t, more[i]])) }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** Segarkan beberapa tabel saja — dipakai setelah operasi atomik di server. */
  const refreshTables = useCallback(async (tables) => {
    const rows = await Promise.all(tables.map((t) => db.list(t).catch(() => null)))
    setData((d) => ({ ...d, ...Object.fromEntries(tables.map((t, i) => [t, rows[i] ?? d[t]])) }))
  }, [])

  useEffect(() => {
    db.currentUser().then(async (u) => { if (u) { setUser(u); await refresh() } }).finally(() => setBooting(false))
  }, [refresh])

  // Setelah masuk: kembali ke halaman terakhir yang diizinkan, selain itu ke My Project.
  const arahkanSetelahMasuk = () => {
    const tujuan = ambilTujuan()
    window.location.hash = `/${tujuan || 'projects'}`
  }
  const signIn = async (email, password) => { const u = await db.signIn(email, password); setActiveRole(u.role); setUser(u); arahkanSetelahMasuk(); await refresh(); return u }
  const signUp = async (email, password) => { const u = await db.signUp?.(email, password); if (u && !u.pending) { setActiveRole(u.role); setUser(u); arahkanSetelahMasuk(); await refresh() } return u }
  // Realtime (Supabase): perubahan dari pengguna lain → muat ulang tabel terkait (digabung per 400 ms)
  const [liveStatus, setLiveStatus] = useState('') // '', 'SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED', 'POLLING'
  useEffect(() => {
    if (!user || !db.subscribe) return
    let pending = new Set(); let timer = null; let status = ''; let lastFull = 0; let alive = true
    const flush = async () => { const ts = [...pending]; pending = new Set(); const rows = await Promise.all(ts.map((t) => db.list(t).catch(() => null))); if (!alive) return; setData((d) => { const n = { ...d }; ts.forEach((t, i) => { if (rows[i]) n[t] = rows[i] }); return n }) }
    // Denyut kehadiran menulis ke tabel users tiap menit untuk SETIAP orang yang online.
    // Supaya tidak memicu muat ulang terus-menerus, perubahan users disegarkan paling cepat 30 detik sekali.
    let lastUsers = 0
    const touch = (t) => {
      if (t === 'users') { const n = Date.now(); if (n - lastUsers < 30000) return; lastUsers = n }
      pending.add(t); clearTimeout(timer); timer = setTimeout(flush, 400)
    }
    // muat ulang tabel utama (dipakai saat realtime tidak tersambung atau tab kembali aktif)
    const MAIN = ['projects', 'notifications', 'pings', 'requests', 'petty_cash', 'vendor_bills', 'fund_balances', ...(CHAT_ENABLED ? ['messages'] : []), 'todos', 'reminders', 'notes']
    const refreshMain = (minGap = 4000) => { const now = Date.now(); if (now - lastFull < minGap) return; lastFull = now; for (const t of MAIN) pending.add(t); clearTimeout(timer); timer = setTimeout(flush, 50) }
    const stop = db.subscribe(TABLES, touch, (st) => { status = st; setLiveStatus(st === 'SUBSCRIBED' ? 'SUBSCRIBED' : st); if (st === 'SUBSCRIBED') refreshMain(0) })
    // Cadangan: bila realtime belum/tidak tersambung, polling tiap 20 detik agar perubahan rekan tetap muncul tanpa refresh
    const poll = setInterval(() => { if (status !== 'SUBSCRIBED') { setLiveStatus('POLLING'); refreshMain(6000) } }, 8000)
    // Chat: selalu disegarkan cepat walau realtime sedang tersambung — pesan tidak boleh telat.
    // Chat dimatikan → tidak ada penyegaran sama sekali.
    const chatPoll = CHAT_ENABLED
      ? setInterval(() => { if (document.visibilityState === 'visible') touch('messages') }, 10000)
      : null
    // Kembali ke tab / layar HP menyala → segarkan sekali
    const onVisible = () => { if (document.visibilityState === 'visible') refreshMain() }
    document.addEventListener('visibilitychange', onVisible); window.addEventListener('focus', onVisible); window.addEventListener('online', onVisible)
    return () => { alive = false; stop(); clearTimeout(timer); clearInterval(poll); if (chatPoll) clearInterval(chatPoll); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('focus', onVisible); window.removeEventListener('online', onVisible) }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps
  // ---------- faktur Zoho (menu Faktur & badge "belum dibuat project") ----------
  const [invoices, setInvoices] = useState(null) // null = belum dimuat
  const [invoiceErr, setInvoiceErr] = useState('')
  // Periode faktur yang sedang dimuat. Bawaannya bulan ini + bulan lalu supaya
  // faktur bulan sebelumnya tetap terbawa, bukan hanya bulan terbaru.
  const [invoiceRange, setInvoiceRange] = useState(() => ({ from: awalBulanLalu(), to: '' }))
  const refreshInvoices = useCallback(async (r) => {
    const rng = r && typeof r === 'object' ? r : invoiceRange
    try {
      const list = await zoho.recentInvoices({ from: rng.from || '', to: rng.to || '' })
      setInvoices(list.slice().sort((a, b) => `${b.date || ''} ${b.created_time || ''}`.localeCompare(`${a.date || ''} ${a.created_time || ''}`)))
      setInvoiceErr(''); return true
    } catch (e) { setInvoiceErr(e.message || 'Gagal mengambil data Zoho'); return false }
  }, [invoiceRange])
  useEffect(() => {
    if (!baseUser || WORKER_ROLES.includes(baseUser.role)) return
    refreshInvoices()
    const t = setInterval(refreshInvoices, 10 * 60000) // segarkan berkala; tidak membuat data ganda
    return () => clearInterval(t)
  }, [baseUser?.id, invoiceRange.from, invoiceRange.to]) // eslint-disable-line react-hooks/exhaustive-deps
  /** Invoice yang belum punya project (dipakai untuk angka di menu Faktur). */
  const unlinkedInvoices = useMemo(() => {
    if (!invoices || !user) return 0
    const have = new Set()
    for (const p of data.projects) { if (p.zoho_invoice_id) have.add(`id:${p.zoho_invoice_id}`); if (p.invoice_no) have.add(`no:${String(p.invoice_no).toUpperCase()}`) }
    const mine = branchesOf(user); const all = can.seeAllBranches(user)
    return invoices.filter((i) => {
      const b = i.branch || branchOfInvoice(i.invoice_no)
      if (!(all ? branchFilter === 'Semua' || b === branchFilter : b && mine.includes(b))) return false
      return !have.has(`id:${i.zoho_invoice_id}`) && !have.has(`no:${String(i.invoice_no).toUpperCase()}`)
    }).length
  }, [invoices, data.projects, user, branchFilter])

  // ---------- kehadiran (Tim Aktif) ----------
  // Denyut 1 menit sekali selama tab terbuka → kolom online_until & last_active_at.
  const prevOnline = useRef(null)
  useEffect(() => {
    if (!baseUser) return
    markActivity()
    const hb = startHeartbeat(db, baseUser.id, (row) => upsertLocal('users', row))
    return () => { hb.stop() }
  }, [baseUser?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  // Rekan yang baru online → satu toast gabungan, dan tidak "meledak" saat pertama login
  const firstSeen = useRef(0)
  useEffect(() => {
    if (!baseUser) { prevOnline.current = null; firstSeen.current = 0; return }
    const live = new Set(data.users.filter((u) => u.id !== baseUser.id && statusOf(u) === 'online').map((u) => u.id))
    const before = prevOnline.current
    prevOnline.current = live
    if (!before) { firstSeen.current = Date.now(); return } // snapshot pertama: diam
    if (Date.now() - firstSeen.current < 20000) return // 20 detik pertama setelah login: diam
    for (const id of live) if (!before.has(id)) {
      const u = data.users.find((x) => x.id === id)
      if (u) notify(`${displayNameFor(user, u)} kini online`, 'ok', 'presence')
    }
  }, [data.users, baseUser?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const row = data.users.find((u) => u.id === baseUser?.id)
    const t = row?.mute_until ? new Date(row.mute_until).getTime() : 0
    muteRef.current = Number.isFinite(t) ? t : 0
  }, [data.users, baseUser?.id])

  const signOut = useCallback(async (reason) => {
    if (reason === 'idle') { setIdleReason(); simpanTujuan() }
    try { if (baseUser) await db.update('users', baseUser.id, { online_until: null }) } catch { /* abaikan */ }
    await db.signOut(); broadcastSignOut(); setUser(null); setActiveRole('')
  }, [baseUser?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- helper tabel ----------
  const upsertLocal = (t, row) => setData((d) => {
    const exists = d[t].some((x) => x.id === row.id)
    return { ...d, [t]: exists ? d[t].map((x) => (x.id === row.id ? row : x)) : [row, ...d[t]] }
  })
  // catat riwayat aktivitas (tidak menghambat penyimpanan bila gagal)
  const log = async (t, prev, row, op) => {
    try {
      const a = describe(t, prev, row, op); if (!a || !user) return
      const rec = await db.insert('activity_log', { ...a, table: t, by: user.name, by_id: user.id, role: user.role })
      upsertLocal('activity_log', rec)
    } catch { /* abaikan */ }
  }
  const save = async (t, row) => {
    const { id, ...rest } = row
    const prev = id ? data[t]?.find((x) => x.id === id) : null
    const saved = id ? await db.update(t, id, rest) : await db.insert(t, rest)
    upsertLocal(t, saved); log(t, prev, saved, id ? 'update' : 'insert'); return saved
  }
  const remove = async (t, id) => {
    const prev = data[t]?.find((x) => x.id === id)
    await db.remove(t, id); setData((d) => ({ ...d, [t]: d[t].filter((x) => x.id !== id) })); log(t, prev, null, 'remove')
  }

  // ---------- petty cash ----------
  const pettyBalance = useCallback((branch) => data.petty_cash
    .filter((p) => p.branch === branch)
    .reduce((a, p) => a + (p.type === 'in' ? 1 : -1) * Number(p.amount || 0), 0), [data.petty_cash])

  // ---------- workflow ----------
  /** Simpan isian tahap. advance=true → validasi & pindah ke tahap berikutnya. */
  const processStage = async (project, subId, values, advance) => {
    const subs = project.sub_projects.map((s) => ({ ...s }))
    const s = subs.find((x) => x.id === subId)
    const stages = stagesOf(flowOf(s, project))
    const idx = stages.findIndex((st) => st.key === s.stage)
    const stage = stages[idx]
    if (!stage) throw new Error('Tahap tidak valid')
    let merged = { ...s.data, ...values }
    if (stage.compute) merged = { ...merged, ...stage.compute(merged) }

    let pettyRow = null
    if (advance) {
      const kurangCeklist = (f) => (f.items || [])
        .filter((it) => !(f.opsional || []).includes(it) && !(merged[f.key] || []).includes(it))
      const missing = stage.fields.filter((f) => f.required && (f.type === 'reg_numbers' ? !regComplete({ ...s, data: merged }) : f.type === 'checklist' ? kurangCeklist(f).length > 0 : (merged[f.key] === undefined || merged[f.key] === '' || merged[f.key] === null)))
      if (missing.length) {
        // Kalau yang kurang hanya langkah milik peran lain (mis. Bayar Pajak milik
        // Supervisor), sebutkan siapa yang ditunggu — bukan "lengkapi" yang
        // membuat pelaksana mencari-cari sesuatu yang memang bukan haknya.
        const nunggu = missing.flatMap((f) => (f.type === 'checklist' ? kurangCeklist(f) : []))
          .filter((it) => missing.some((f) => f.itemRoles?.[it] && !f.itemRoles[it].includes(user.role)))
        if (nunggu.length && nunggu.length === missing.flatMap((f) => (f.type === 'checklist' ? kurangCeklist(f) : [f.label])).length) {
          throw new Error(`Menunggu Supervisor menyelesaikan: ${nunggu.join(', ')}`)
        }
        throw new Error('Lengkapi: ' + missing.map((f) => f.label).join(', '))
      }
      if (stage.effect === 'pettycash_out') {
        const amt = Number(merged.apostille_cost || 0)
        const bal = pettyBalance(APOSTILLE_FUND)
        if (amt > bal) throw new Error(`Saldo petty cash apostille tidak cukup (${bal.toLocaleString('id-ID')})`)
        pettyRow = { branch: APOSTILLE_FUND, type: 'out', amount: amt, note: `Apostille ${project.invoice_no} — ${s.title}`, project_id: project.id, by: user.name }
      }
    }
    if (advance && stage.onAdvance) merged = { ...merged, ...stage.onAdvance(s, user) }
    if (advance && stage.printBranch) merged = { ...merged, [`${stage.key}_by`]: user.id }
    if (advance && stage.key === 'proofread') merged = { ...merged, proofread_at: new Date().toISOString(), proofread_by: user.id }
    s.data = merged
    const next = advance ? (stages[idx + 1]?.key ?? DONE) : s.stage
    const override = values?.__override
    delete merged.__override
    const nextLabel = next === DONE ? 'Selesai' : stages[idx + 1].label
    s.history = [...(s.history || []), { at: new Date().toISOString(), by: user.name, role: user.role, action: advance ? (override ? `${stage.label} → ${nextLabel} · dilanjutkan tanpa menunggu ${stage.roles.filter((r) => r !== 'superadmin').map((r) => ROLES[r]?.label || r).join('/')} oleh ${roleLabel(user)} · alasan: ${override}` : `${stage.label} → ${nextLabel}`) : `Update ${stage.label}`, ...(override ? { override: true, reason: override, from: stage.key, to: next } : {}) }]
    s.stage = next
    if (advance) s.stage_at = new Date().toISOString()
    const saved = await save('projects', { ...project, sub_projects: subs })
    if (pettyRow) await save('petty_cash', pettyRow)
    // Notifikasi in-app (tujuan: user / role / cabang)
    if (advance && stage.notify) {
      for (const n of stage.notify(project, s, user).filter((x) => x.to_user || x.to_role || x.to_branch)) {
        await save('notifications', { ...n, text: `${project.invoice_no} · ${s.title}: ${n.text}`, project_id: project.id, by: user.name, read_by: [] }).catch(() => {})
      }
    }
    // F8: titip print — bila tahap cetak/scan diselesaikan oleh cabang print yang BUKAN cabang
    // pemilik project, CS asal diberi tahu otomatis (dulu harus ping manual).
    if (advance && stage.printBranch) {
      const printDi = project.about?.print_location || project.branch
      const beda = printDi !== project.branch && !branchesOf(user).includes(project.branch)
      if (beda && project.created_by && project.created_by !== user.id) {
        await save('notifications', { to_user: project.created_by, kind: 'print', text: `${project.invoice_no} · ${s.title}: ${stage.label} selesai di cabang ${printDi} oleh ${user.name} — ${next === DONE ? 'selesai' : `lanjut ${stages[idx + 1]?.label}`}`, project_id: project.id, by: user.name, read_by: [] }).catch(() => {})
      }
    }
    return saved
  }

  /** Ubah data sub project di luar alur tahap (mis. panel Biaya). */
  const patchSubData = async (project, subId, patch, action) => {
    const subs = project.sub_projects.map((x) => (x.id === subId
      ? { ...x, data: { ...x.data, ...patch }, history: [...(x.history || []), { at: new Date().toISOString(), by: user.name, action }] } : x))
    return save('projects', { ...project, sub_projects: subs })
  }

  /**
   * Tolak / kembalikan pengajuan vendor untuk diperbaiki (Direktur saat persetujuan, Akunting saat pembayaran).
   * Sub project kembali ke tahap "Pengajuan Vendor"; alasan tersimpan & pengaju diberi notifikasi.
   */
  const returnPengajuan = async (project, subId, reason) => {
    const why = String(reason || '').trim(); if (!why) throw new Error('Isi alasan penolakan / perbaikan')
    const now = new Date().toISOString(); let title = ''; let to = null
    const subs = project.sub_projects.map((x) => {
      if (x.id !== subId) return x
      title = x.title; to = x.data?.submitted_by || project.created_by
      const fromLabel = stageLabel(x.flow || project.category, x.stage)
      return { ...x, stage: 'pengajuan', stage_at: now,
        data: { ...x.data, revision_note: why, revision_by: user.id, revision_name: user.name, revision_at: now, revision_from: x.stage, revision_count: (Number(x.data?.revision_count) || 0) + 1, sumber_dana: '' },
        history: [...(x.history || []), { at: now, by: user.name, role: user.role, action: `${fromLabel} → Pengajuan Vendor · dikembalikan untuk diperbaiki · alasan: ${why}`, rejected: true, reason: why }] }
    })
    const saved = await save('projects', { ...project, sub_projects: subs })
    const text = `${project.invoice_no} · ${title}: Pengajuan dikembalikan oleh ${user.name} — ${why}`
    const sent = new Set()
    for (const uid of [to, project.created_by].filter(Boolean)) { if (sent.has(uid) || uid === user.id) continue; sent.add(uid); await save('notifications', { to_user: uid, kind: 'revision', text, project_id: project.id, by: user.name, read_by: [] }).catch(() => {}) }
    return saved
  }

  /**
   * Supervisor / Superadmin MENGGANTI penerjemah yang tugasnya sudah terkirim.
   * Wajib pakai alasan: tercatat di riwayat dan dikirim ke kedua penerjemah.
   */
  const gantiPenerjemah = async (project, subId, toId, reason) => {
    const why = String(reason || '').trim(); if (!why) throw new Error('Isi alasan penggantian penerjemah')
    if (!toId) throw new Error('Pilih penerjemah pengganti')
    const now = new Date().toISOString(); let title = ''; let dari = null
    const subs = project.sub_projects.map((x) => {
      if (x.id !== subId) return x
      title = x.title; dari = x.data?.translator || x.translator || null
      if (dari === toId) throw new Error('Penerjemah pengganti sama dengan yang sekarang')
      const nDari = data.users.find((u) => u.id === dari)?.name || '—'
      const nKe = data.users.find((u) => u.id === toId)?.name || toId
      return { ...x, translator: toId, stage: 'penerjemahan', stage_at: now,
        data: { ...x.data, translator: toId, ganti_note: why, ganti_by: user.id, ganti_name: user.name, ganti_at: now, ganti_dari: dari, ganti_dari_nama: nDari, penerjemahan_work_started_at: '' },
        history: [...(x.history || []), { at: now, by: user.name, role: user.role, action: `Penerjemah diganti: ${nDari} → ${nKe} · alasan: ${why}`, reason: why }] }
    })
    const saved = await save('projects', { ...project, sub_projects: subs })
    const kirim = [[toId, `Tugas terjemahan baru untuk Anda: ${project.invoice_no} · ${title}`],
      [dari, `Tugas ${project.invoice_no} · ${title} dialihkan ke penerjemah lain — ${why}`]]
    for (const [uid, text] of kirim) {
      if (!uid || uid === user.id) continue
      await save('notifications', { to_user: uid, kind: 'assign', text, project_id: project.id, by: user.name, read_by: [] }).catch(() => {})
    }
    return saved
  }

  /**
   * Penerjemah MENOLAK tugas yang sudah dikirim kepadanya (mis. sedang penuh).
   * Sub project kembali ke tahap "Pilih Penerjemah", alasan tersimpan, dan
   * Supervisor cabang diberi tahu supaya bisa menunjuk penerjemah lain.
   */
  const tolakTugas = async (project, subId, reason) => {
    const why = String(reason || '').trim(); if (!why) throw new Error('Isi alasan penolakan')
    const now = new Date().toISOString(); let title = ''
    const subs = project.sub_projects.map((x) => {
      if (x.id !== subId) return x
      title = x.title
      return { ...x, translator: '', stage: 'pilih_penerjemah', stage_at: now,
        data: { ...x.data, translator: '', tolak_note: why, tolak_by: user.id, tolak_name: user.name, tolak_at: now, tolak_count: (Number(x.data?.tolak_count) || 0) + 1, penerjemahan_work_started_at: '' },
        history: [...(x.history || []), { at: now, by: user.name, role: user.role, action: `Tugas ditolak penerjemah → kembali ke Pilih Penerjemah · alasan: ${why}`, rejected: true, reason: why }] }
    })
    const saved = await save('projects', { ...project, sub_projects: subs })
    const text = `${project.invoice_no} · ${title}: ${user.name} menolak tugas terjemahan — ${why}`
    await save('notifications', { to_role: 'supervisor', to_branch: project.branch, kind: 'revision', text, project_id: project.id, by: user.name, read_by: [] }).catch(() => {})
    if (project.created_by && project.created_by !== user.id) {
      await save('notifications', { to_user: project.created_by, kind: 'revision', text, project_id: project.id, by: user.name, read_by: [] }).catch(() => {})
    }
    return saved
  }

  /** Simpan biaya apostille/legalisasi & sinkronkan ke petty cash cabang (1 mutasi per sub project). */
  const saveBiaya = async (project, sub, biaya_proses, biaya_lain, total) => {
    await patchSubData(project, sub.id, { biaya_proses, biaya_lain }, `Biaya diperbarui: ${total.toLocaleString('id-ID')}`)
    const existing = data.petty_cash.find((x) => x.sub_id === sub.id && x.type === 'out')
    if (existing && total === 0) return remove('petty_cash', existing.id)
    if (total > 0) await save('petty_cash', { ...(existing || {}), branch: APOSTILLE_FUND, type: 'out', amount: total, note: `Biaya apostille ${project.invoice_no} — ${sub.title}`, project_id: project.id, sub_id: sub.id, by: user.name })
  }

  /**
   * Akses cepat Supervisor: tetapkan penerjemah internal ATAU vendor untuk sub project terjemahan.
   *  • internal → alur tr_int, langsung ke tahap Penerjemahan (masuk To-Do penerjemah)
   *  • vendor   → alur tr_ext; bila layanan dipilih, langsung diajukan ke Direktur
   */
  const assignTranslator = async (project, subId, { kind, id, service, extra = {} }) => {
    const now = new Date().toISOString()
    const notes = []
    let title = ''
    const subs = project.sub_projects.map((x) => {
      if (x.id !== subId) return x
      title = x.title
      const by = { at: now, by: user.name }
      if (kind === 'internal') {
        const who = data.users.find((u) => u.id === id)?.name ?? id
        notes.push({ to_user: id, text: 'Tugas terjemahan baru untuk Anda' })
        return { ...x, flow: 'tr_int', translator_kind: 'translator', translator: id, executor_kind: '', executor_id: '', stage: 'penerjemahan', stage_at: now,
          data: { ...x.data, translator: id, vendor: '', vendor_service: '', vendor_cost: 0, total_pengajuan: 0 },
          history: [...(x.history || []), { ...by, action: `Penerjemah ditetapkan: ${who} → Penerjemahan` }] }
      }
      if (kind === 'coord') {
        const who = data.users.find((u) => u.id === id)
        notes.push({ to_user: id, text: `Order bahasa ${who?.coordinator_lang ?? ''} baru — silakan ajukan ke vendor` })
        return { ...x, flow: 'tr_ext', translator_kind: 'vendor', translator: '', executor_kind: 'vendor', executor_id: '', stage: 'pengajuan', stage_at: now,
          data: { ...x.data, coordinator: id, vendor: '' },
          history: [...(x.history || []), { ...by, action: `Diserahkan ke Koordinator ${who?.coordinator_lang ?? ''}: ${who?.name ?? id}` }] }
      }
      const v = data.people.find((p) => p.id === id)
      const d = { ...x.data, ...extra, vendor: id }
      if (isBilled(v)) { // termin tagihan: order dicatat, tidak langsung dibayar
        let stage = 'order'
        if (service) {
          Object.assign(d, { vendor_service: service.name, vendor_cost: Number(service.price) || 0, total_pengajuan: Number(service.price) || 0, ordered_by: user.id, ordered_name: user.name, ordered_at: now })
          stage = 'proses_vendor'
        }
        if (project.created_by && project.created_by !== user.id) notes.push({ to_user: project.created_by, text: `Order ke vendor ${v?.name ?? ''} dicatat (dibayar lewat tagihan)` })
        return { ...x, flow: 'tr_bill', translator_kind: 'vendor', translator: id, executor_kind: 'vendor', executor_id: id, stage, data: d,
          history: [...(x.history || []), { ...by, action: `Order ke vendor ${v?.name ?? id}${service ? ` (${service.name})` : ''} · bayar sesuai tagihan` }] }
      }
      let stage = 'pengajuan'
      if (service) {
        const ongkir = Number(d.ongkir_cost) || 0
        Object.assign(d, { vendor_service: service.name, vendor_cost: Number(service.price) || 0, total_pengajuan: (Number(service.price) || 0) + ongkir,
          submitted_by: user.id, submitted_name: user.name, submitted_at: now })
        stage = 'persetujuan'
        notes.push({ to_role: 'direktur', text: 'Pengajuan vendor baru menunggu persetujuan' })
        if (project.created_by && project.created_by !== user.id) notes.push({ to_user: project.created_by, text: `${user.name} mengajukan vendor ${v?.name ?? ''} untuk order Anda` })
      } else notes.push({ to_user: project.created_by, text: `Vendor ${v?.name ?? ''} ditetapkan — lengkapi pengajuan vendor` })
      return { ...x, flow: 'tr_ext', translator_kind: 'vendor', translator: id, executor_kind: 'vendor', executor_id: id, stage, data: d,
        history: [...(x.history || []), { ...by, action: `Vendor ditetapkan: ${v?.name ?? id}${service ? ` (${service.name}) → Menunggu Persetujuan` : ''}` }] }
    })
    const saved = await save('projects', { ...project, sub_projects: subs })
    for (const n of notes) await save('notifications', { ...n, text: `${project.invoice_no} · ${title}: ${n.text}`, project_id: project.id, by: user.name, read_by: [] }).catch(() => {})
    return saved
  }

  /** Ambil / lepas dokumen di to-do bersama (penanda "sedang diproses"). */
  const claimSub = async (project, subId, take) => {
    if (take && db.claim) { // live: klaim atomik di server (aman dari rebutan dua otorisator)
      const saved = await db.claim(project.id, subId)
      setData((d) => ({ ...d, projects: d.projects.map((p) => (p.id === saved.id ? saved : p)) }))
      return saved
    }
    const subs = project.sub_projects.map((x) => (x.id === subId
      ? { ...x, data: { ...x.data, claim: take ? { by: user.id, name: user.name, at: new Date().toISOString() } : null },
        history: [...(x.history || []), { at: new Date().toISOString(), by: user.name, action: take ? 'Mengambil dokumen untuk diproses' : 'Melepas dokumen' }] }
      : x))
    return save('projects', { ...project, sub_projects: subs })
  }

  // ---------- affidavit: stok lembar per cabang × arah ----------
  // Pengurangan stok HARUS atomic di server: dua CS yang mencetak bersamaan
  // tidak boleh membuat stok minus. Di live dipakai RPC `affidavit_pakai`;
  // di demo (satu browser) cukup dihitung di sini.
  const stokRow = (cabang, arah) => cariStok(data.affidavit_stok, cabang, arah)

  /** Admin Pusat menetapkan / mengoreksi stok cabang. `sisa` null = kembalikan ke "belum diisi". */
  const setStokAffidavit = async (cabang, arah, sisa, catatan = '') => {
    if (!canKelolaAffidavit(user)) throw new Error('Hanya Admin Pusat yang boleh menetapkan stok affidavit')
    const n = sisa === null || sisa === '' ? null : Math.max(0, Math.round(Number(sisa) || 0))
    const row = stokRow(cabang, arah)
    const saved = await save('affidavit_stok', { ...(row || {}), cabang, arah, sisa: n, catatan, oleh: user.name, at: new Date().toISOString() })
    await syncPeringatan(cabang, arah, n)
    return saved
  }

  /**
   * Catat pemakaian lembar saat CS menandai dokumen sudah dicetak.
   * `kunci` membuatnya idempoten: klik dua kali atau koneksi putus lalu dicoba
   * lagi hanya mengurangi satu kali.
   */
  const pakaiAffidavit = async ({ cabang, arah, lembar, kunci, project, sub, catatan = '' }) => {
    const n = Math.max(1, Math.round(Number(lembar) || 0))
    if (sudahTercatat(data.affidavit_pakai, kunci)) return { sudah: true }

    const ref = {
      cabang, arah, lembar: n, kunci,
      project_id: project?.id || null,
      invoice_no: project?.invoice_no || '',
      sub_id: sub?.id || null,
      sub_title: sub?.title || '',
      cs: user.name, cs_id: user.id,
      at: new Date().toISOString(), catatan,
    }

    if (db.affidavitPakai) { // LIVE: kurangi stok & catat pemakaian dalam satu transaksi server
      const out = await db.affidavitPakai(ref)
      if (out?.sudah) return { sudah: true }
      await refreshTables(['affidavit_stok', 'affidavit_pakai'])
      await syncPeringatan(cabang, arah, out?.sisa)
      return out
    }

    // DEMO: cek saldo lalu kurangi
    const row = stokRow(cabang, arah)
    if (!row || row.sisa == null) throw new Error(`Stok affidavit ${arahLabel(arah)} untuk cabang ${cabang} belum diisi pusat`)
    const sisa = Number(row.sisa)
    if (sisa < n) throw new Error(`Stok tidak cukup: tersisa ${sisa} lembar, dibutuhkan ${n}`)
    await save('affidavit_stok', { ...row, sisa: sisa - n, at: new Date().toISOString() })
    await save('affidavit_pakai', ref)
    await syncPeringatan(cabang, arah, sisa - n)
    return { sisa: sisa - n }
  }

  /** Admin Pusat mencatat pengiriman lembar ke cabang (belum menambah stok tersedia). */
  const catatPengiriman = async ({ cabang, arah, lembar, catatan = '' }) => {
    if (!canKelolaAffidavit(user)) throw new Error('Hanya Admin Pusat yang boleh mencatat pengiriman')
    const n = Math.max(1, Math.round(Number(lembar) || 0))
    const saved = await save('affidavit_kirim', {
      cabang, arah, lembar: n, status: 'dalam_pengiriman',
      oleh: user.name, oleh_id: user.id, at: new Date().toISOString(), catatan,
    })
    await save('notifications', {
      to_role: 'cs', to_branch: cabang,
      text: `${n} lembar affidavit ${arahLabel(arah)} dikirim ke cabang ${cabang} — konfirmasi bila sudah diterima`,
      by: user.name, read_by: [],
    }).catch(() => {})
    return saved
  }

  /** Cabang mengonfirmasi lembar sudah diterima → stok tersedia bertambah. */
  const terimaPengiriman = async (kirim, lembarDiterima) => {
    const n = Math.max(0, Math.round(Number(lembarDiterima ?? kirim.lembar) || 0))
    if (!n) throw new Error('Isi jumlah lembar yang diterima')
    if (n > Number(kirim.lembar)) throw new Error(`Tidak boleh lebih dari yang dikirim (${kirim.lembar} lembar)`)

    if (db.affidavitTerima) { // LIVE: tambah stok & tutup pengiriman dalam satu transaksi
      const out = await db.affidavitTerima({ kirim_id: kirim.id, lembar: n, oleh: user.name })
      await refreshTables(['affidavit_stok', 'affidavit_kirim'])
      await syncPeringatan(kirim.cabang, kirim.arah, out?.sisa)
      return out
    }

    const row = stokRow(kirim.cabang, kirim.arah)
    const sisa = (row?.sisa == null ? 0 : Number(row.sisa)) + n
    await save('affidavit_stok', { ...(row || {}), cabang: kirim.cabang, arah: kirim.arah, sisa, at: new Date().toISOString() })
    await save('affidavit_kirim', {
      ...kirim,
      status: 'diterima', lembar_diterima: n,
      diterima_oleh: user.name, diterima_at: new Date().toISOString(),
    })
    await syncPeringatan(kirim.cabang, kirim.arah, sisa)
    return { sisa }
  }

  /**
   * Satu peringatan AKTIF per cabang+arah: angkanya diperbarui, tidak menumpuk.
   * Ditutup begitu stok >= AMBANG_RENDAH.
   */
  const syncPeringatan = async (cabang, arah, sisa) => {
    if (sisa === undefined) return
    const ada = cariPeringatan(data.notifications, cabang, arah)
    const perlu = sisa != null && Number(sisa) < AMBANG_RENDAH
    if (!perlu) {
      if (ada) await save('notifications', { ...ada, closed: true }).catch(() => {})
      return
    }
    const text = teksPeringatan(cabang, arah, sisa)
    if (ada) {
      if (ada.text !== text) await save('notifications', { ...ada, text, read_by: [] }).catch(() => {})
      return
    }
    await save('notifications', {
      to_role: 'admin_pusat', kind: 'affidavit',
      aff_key: kunciPeringatan(cabang, arah), aff_cabang: cabang, aff_arah: arah,
      text, by: 'Sistem', read_by: [],
    }).catch(() => {})
  }

  // ---------- notifikasi ----------
  const myNotifications = useMemo(() => {
    if (!user) return []
    return data.notifications
      // peringatan yang sudah ditutup (mis. stok affidavit kembali cukup) tidak ditampilkan lagi
      .filter((n) => !n.closed)
      .filter((n) => n.to_user ? n.to_user === user.id
        : n.to_role ? n.to_role === user.role && (!n.to_branch || branchesOf(user).includes(n.to_branch) || ['superadmin', 'admin_pusat', 'supervisor'].includes(user.role))
        : branchesOf(user).includes(n.to_branch))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [data.notifications, user])
  const markRead = async (list) => {
    for (const n of list.filter((x) => !(x.read_by || []).includes(user.id))) await save('notifications', { ...n, read_by: [...(n.read_by || []), user.id] })
  }

  // ---------- ping (pengingat antar-role) ----------
  // Batas ping pekerjaan: maksimal 3x sehari, jeda 1 jam.
  const PING_COOLDOWN_MS = 60 * 60 * 1000
  const myPings = useMemo(() => (!user ? [] : (data.pings || []).filter((p) => p.to_user === user.id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))), [data.pings, user])
  /** Ping terakhir dari user ini untuk pekerjaan & penerima yang sama (untuk batas 15 menit). */
  const lastPingTo = useCallback((to_user, project_id, sub_id) => (data.pings || [])
    .filter((p) => p.from_user === user?.id && p.to_user === to_user && p.project_id === project_id && (p.sub_id || null) === (sub_id || null))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null, [data.pings, user])
  const PING_DAILY_MAX = 3
  const sendPing = async ({ to_user, project, sub, stage, message }) => {
    const todayKey = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Makassar' })
    const todayN = (data.pings || []).filter((p) => p.from_user === user.id && p.to_user === to_user && p.project_id === project.id && (p.sub_id || null) === (sub?.id || null)
      && new Date(p.created_at).toLocaleDateString('sv-SE', { timeZone: 'Asia/Makassar' }) === todayKey).length
    if (todayN >= PING_DAILY_MAX) throw new Error(`Batas ping tercapai: maksimal ${PING_DAILY_MAX}× per hari untuk pekerjaan & penerima yang sama`)
    const last = lastPingTo(to_user, project.id, sub?.id)
    if (last && Date.now() - new Date(last.created_at) < PING_COOLDOWN_MS) {
      const m = Math.ceil((PING_COOLDOWN_MS - (Date.now() - new Date(last.created_at))) / 60000)
      throw new Error(`Ping untuk pekerjaan & penerima yang sama baru bisa dikirim ulang ${m} menit lagi`)
    }
    const row = await save('pings', { from_user: user.id, from_name: user.name, from_role: user.role, to_user, project_id: project.id, sub_id: sub?.id || null,
      invoice_no: project.invoice_no, sub_title: sub?.title || '', stage_key: stage?.key || null, stage_label: stage?.label || '', deadline: project.about?.deadline || null,
      message: String(message || '').trim(), read_by: [] })
    return row
  }
  const markPingRead = async (list) => {
    for (const p of list.filter((x) => !(x.read_by || []).includes(user.id))) await save('pings', { ...p, read_by: [...(p.read_by || []), user.id] })
  }
  // ---------- chat internal ----------
  const chatMessages = useMemo(() => (user ? myMessages(data, user).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))) : []), [data.messages, user])
  const chatUnread = useMemo(() => (user ? unreadByThread(chatMessages, user) : {}), [chatMessages, user])
  const chatTotals = useMemo(() => Object.values(chatUnread).reduce((a, v) => ({ msg: a.msg + v.msg, ping: a.ping + v.ping }), { msg: 0, ping: 0 }), [chatUnread])

  // Saluran cepat: penanda "ada pesan baru" & status mengetik.
  // Teks pesannya sendiri selalu diambil dari database (ikut aturan akses), bukan dari siaran.
  const bus = useRef(null)
  const [typing, setTyping] = useState({}) // { [thread]: { name, at } }
  useEffect(() => {
    if (!baseUser || !CHAT_ENABLED) return
    const isPr = (baseUser.base_role || baseUser.role) === 'proofreader'
    const myBox = isPr ? 'tim-proofreader' : baseUser.id
    const pullMessages = async () => { try { await db.reload?.(); const rows = await db.list('messages'); setData((d) => ({ ...d, messages: rows })) } catch { /* abaikan */ } }
    const ch = openChatBus(myBox, (e) => {
      if (!e || e.from === baseUser.id) return
      if (e.t === 'bump') pullMessages()
      if (e.t === 'typing' && e.thread) setTyping((v) => ({ ...v, [e.thread]: { name: e.name, at: Date.now() } }))
    })
    bus.current = ch
    return () => { ch.stop(); bus.current = null }
  }, [baseUser?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  // bersihkan status mengetik yang kedaluwarsa (lebih dari 4 detik)
  useEffect(() => {
    const t = setInterval(() => setTyping((v) => {
      const n = Object.fromEntries(Object.entries(v).filter(([, x]) => Date.now() - x.at < 4000))
      return Object.keys(n).length === Object.keys(v).length ? v : n
    }), 1500)
    return () => clearInterval(t)
  }, [])
  /** Beri tahu lawan bicara bahwa kita sedang mengetik (tidak disimpan ke database). */
  const sendTyping = useCallback((thread, to) => {
    bus.current?.send(to, { t: 'typing', thread, from: user?.id, name: (user?.display_name || user?.name || '').replace(/\s*\([^)]*\)/g, '') })
  }, [user?.id, user?.display_name, user?.name])

  /** Kirim pesan. Mengembalikan baris tersimpan; pemanggil menangani status "gagal / coba lagi". */
  const sendMessage = async ({ to, text, mentions = [] }) => {
    const body = String(text || '').trim()
    if (!body) throw new Error('Pesan kosong')
    const row = await save('messages', { thread: threadOf(user.id, to), kind: 'msg', from_user: user.id, from_name: user.name, to_user: to, text: body, mentions, read_by: [] })
    bus.current?.send(to, { t: 'bump', from: user.id })
    return row
  }
  /**
   * Ping percakapan. Batas 3× per 24 jam ke lawan bicara yang sama + jeda 60 detik
   * DIPERIKSA DI SINI (lapisan data), bukan hanya di tombol — klik dari tab/perangkat lain
   * tetap kena batas yang sama karena dihitung dari data tersimpan.
   */
  const sendChatPing = async (to) => {
    const thread = threadOf(user.id, to)
    const q = pingQuota(chatMessages, user, thread)
    if (q.left <= 0) throw new Error(`Batas ping tercapai (${PING_MAX_24H}× per 24 jam). Bisa ping lagi ${q.resetAt ? q.resetAt.toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit' }) : 'nanti'}.`)
    if (q.gapLeft > 0) throw new Error(`Tunggu ${Math.ceil(q.gapLeft / 1000)} detik lagi sebelum ping berikutnya.`)
    const row = await save('messages', { thread, kind: 'ping', from_user: user.id, from_name: user.name, to_user: to, text: 'Ping — mohon dicek ya', mentions: [], read_by: [] })
    bus.current?.send(to, { t: 'bump', from: user.id })
    return row
  }
  const markChatRead = async (thread) => {
    const list = chatMessages.filter((m) => m.thread === thread && m.from_user !== user.id && !(m.read_by || []).includes(user.id))
    if (!list.length) return
    for (const m of list) await save('messages', { ...m, read_by: [...(m.read_by || []), user.id] }).catch(() => {})
    // beri tahu pengirim supaya tanda "dibaca" muncul tanpa menunggu
    for (const id of [...new Set(list.map((m) => m.from_user))]) bus.current?.send(id, { t: 'bump', from: user.id })
  }

  /** Ganti / hapus foto profil (data URL kecil) — tersimpan permanen di tabel users. */
  const setAvatar = async (dataUrl) => {
    const row = data.users.find((u) => u.id === user.id) || user
    const saved = await save('users', { ...row, avatar: dataUrl || null })
    setUser((b) => (b ? { ...b, avatar: saved.avatar || null } : b))
    return saved
  }

  /** Perbarui data profil sendiri (nama, nama tampilan, telepon, bahasa kerja). Peran & hak akses tidak bisa diubah sendiri. */
  const updateProfile = async (patch) => {
    const row = data.users.find((u) => u.id === user.id) || user
    // "Tersedia 24 jam" hanya untuk Direktur — tampilan ketersediaan, tidak mengubah aturan keluar otomatis
    const allowed = ['name', 'display_name', 'phone', 'languages', 'about', 'status_text', 'mute_until', ...(user?.role === 'direktur' ? ['available_24h'] : [])]
    const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k)))
    const saved = await save('users', { ...row, ...clean })
    setUser((b) => (b ? { ...b, ...clean } : b))
    return saved
  }

  /** Nama orang dari id (pengguna atau master data).
   *  Proofreader tampil sebagai satu identitas tim untuk pengguna biasa — lihat displayNameFor(). */
  const nameOf = useCallback((id) => {
    const u = data.users.find((x) => x.id === id)
    if (u) return displayNameFor(user, u)
    return data.people.find((p) => p.id === id)?.name
  }, [data.users, data.people, user])

  const value = useMemo(() => ({
    user, setActiveRole, booting, data, refresh, signIn, signUp, signOut, MODE, save, remove, processStage, pettyBalance, claimSub, myNotifications, markRead, nameOf, patchSubData, saveBiaya, assignTranslator, returnPengajuan, gantiPenerjemah, tolakTugas, myPings, sendPing, markPingRead, lastPingTo, setAvatar, updateProfile, PING_COOLDOWN_MS, PING_DAILY_MAX,
    notify, toast, dismissToast, branchFilter, setBranchFilter, ask, confirmState, setConfirmState, liveStatus,
    invoices, invoiceErr, refreshInvoices, unlinkedInvoices, invoiceRange, setInvoiceRange,
    chatMessages, chatUnread, chatTotals, sendMessage, sendChatPing, markChatRead, sendTyping, typing, PING_MAX_24H, PING_GAP_MS,
    setStokAffidavit, pakaiAffidavit, catatPengiriman, terimaPengiriman, refreshTables,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [user, booting, data, toast, branchFilter, pettyBalance, confirmState, myNotifications, nameOf, myPings, lastPingTo, liveStatus, invoices, invoiceErr, unlinkedInvoices, invoiceRange, refreshInvoices, chatMessages, chatUnread, chatTotals, typing, sendTyping])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
