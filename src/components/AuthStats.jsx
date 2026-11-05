import { useMemo, useState } from 'react'
import { BadgeCheck, ChevronUp } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { Card, Input, Select, cx } from './ui.jsx'
import { dayKey, addDays } from '../lib/performance.js'
import { flowOf, stageIndex, DONE } from '../config/workflows.js'
import { kindPages } from '../config/subtypes.js'

// ============================================================
//  STATISTIK OTORISASI — jumlah dokumen yang diotorisasi (dari proofreader),
//  dengan rentang tanggal + grafik bulanan 12 bulan.
//  Staf Otorisasi: hanya dirinya. Master Otorisasi: dirinya + seluruh staf otorisasi.
// ============================================================
const docsOf = (s) => Number(s.file_count) || s.docs?.length || 1
const authAt = (s) => s.data?.authorized_at || (s.history || []).find((h) => /^Otorisasi/.test(h.action || ''))?.at || null
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const COLORS = ['#1f4fd1', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4']

/** Kartu statistik umum: rows = [{ at, day, by, key, n }]. */
function StatsCard({ title, unit, rows, master, people: allPeople, foldKey, breakdownLabel, keyLabel, narrow, stack }) {
  const { user, data } = useApp()
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(`atlas-fold-${foldKey}`) !== '0' } catch { return true } })
  const toggle = () => setOpen((o) => { try { localStorage.setItem(`atlas-fold-${foldKey}`, o ? '0' : '1') } catch { /* abaikan */ } return !o })
  const today = dayKey()
  const monthStart = `${today.slice(0, 8)}01`
  const [range, setRange] = useState({ from: monthStart, to: today })
  const [who, setWho] = useState(master ? 'semua' : user.id)
  const nameOf = (id) => data.users.find((u) => u.id === id)?.name ?? '—'
  const scoped = rows.filter((r) => (master ? who === 'semua' || r.by === who : r.by === user.id))
  const inRange = scoped.filter((r) => (!range.from || r.day >= range.from) && (!range.to || r.day <= range.to))
  const total = inRange.reduce((a, r) => a + r.n, 0)
  const group = (key) => Object.entries(inRange.reduce((a, r) => { a[r[key]] = (a[r[key]] || 0) + r.n; return a }, {})).sort((a, b) => b[1] - a[1])

  // 12 bulan terakhir
  const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(`${today.slice(0, 7)}-15T12:00:00+08:00`); d.setMonth(d.getMonth() - (11 - i)); return dayKey(d).slice(0, 7) })
  const people = stack ? stack.map((k) => k.key) : master && who === 'semua' ? [...new Set(scoped.map((r) => r.by))] : [master ? who : user.id]
  const series = months.map((m) => ({ m, parts: people.map((id) => scoped.filter((r) => (stack ? r.kind : r.by) === id && r.day.startsWith(m)).reduce((a, r) => a + r.n, 0)) }))
  const colorOf = (i) => (stack ? stack[i].color : COLORS[i % COLORS.length])
  const max = Math.max(1, ...series.map((x) => x.parts.reduce((a, b) => a + b, 0)))
  const preset = (from, to) => setRange({ from, to })
  const chip = (on) => cx('rounded-lg px-2.5 py-1 text-xs font-semibold ring-1', on ? 'bg-brand text-white ring-brand' : 'bg-white text-ink-soft ring-slate-200 hover:ring-brand')

  return (
    <Card className="overflow-hidden">
      <div className="card-head flex flex-wrap items-center gap-2 bg-emerald-50 px-4 py-3">
        <BadgeCheck className="h-4 w-4 text-emerald-600" />
        <h2 className="font-bold">{title}</h2>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">{total} {unit}</span>
        <button type="button" onClick={toggle} aria-expanded={open} aria-label={`${open ? 'Tutup' : 'Buka'} ${title}`} className="fold ml-auto grid h-8 w-8 place-items-center rounded-lg bg-white text-ink-soft ring-1 ring-slate-200 hover:text-brand">
          <ChevronUp className={cx('h-4 w-4 transition-transform', !open && 'rotate-180')} />
        </button>
      </div>
      {open && <>
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-4 py-2">
          <button className={chip(range.from === today && range.to === today)} onClick={() => preset(today, today)}>Hari ini</button>
          <button className={chip(range.from === addDays(today, -6) && range.to === today)} onClick={() => preset(addDays(today, -6), today)}>7 hari</button>
          <button className={chip(range.from === monthStart && range.to === today)} onClick={() => preset(monthStart, today)}>Bulan ini</button>
          <button className={chip(range.from === addDays(today, -29) && range.to === today)} onClick={() => preset(addDays(today, -29), today)}>30 hari</button>
          <button className={chip(!range.from && !range.to)} onClick={() => preset('', '')}>Semua</button>
          <span className="flex items-center gap-1.5 text-xs text-ink-mute">
            <Input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="!w-36 !py-1 text-xs" aria-label="Dari tanggal" />–
            <Input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="!w-36 !py-1 text-xs" aria-label="Sampai tanggal" />
          </span>
          {master && <Select value={who} onChange={(e) => setWho(e.target.value)} className="!w-48 !py-1 text-xs sm:ml-auto" aria-label="Pilih orang">
            <option value="semua">Semua</option>{allPeople.map((u) => <option key={u.id} value={u.id}>{u.name}{u.id === user.id ? ' (saya)' : ''}</option>)}
          </Select>}
        </div>
        <div className={cx('grid gap-4 p-4', !narrow && 'lg:grid-cols-[220px_1fr]')}>
          <div className="space-y-3">
            <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
              <p className="text-xs font-semibold text-emerald-800">{unit[0].toUpperCase() + unit.slice(1)} {keyLabel}</p>
              <p className="text-4xl font-extrabold tabular-nums text-emerald-700">{total}</p>
              <p className="text-xs text-ink-soft">{new Set(inRange.map((r, i) => r.sid ?? i)).size} {narrow ? 'dokumen' : 'sub project'} · {range.from || range.to ? `${range.from || '…'} s/d ${range.to || '…'}` : 'semua waktu'}</p>
            </div>
            {stack && (
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-mute">Per jenis dokumen</p>
                <ul className="space-y-1 text-sm">{stack.map((k) => <li key={k.key} className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full" style={{ background: k.color }} />{k.label}</span><b className="tabular-nums">{inRange.filter((r) => r.kind === k.key).reduce((a, r) => a + r.n, 0)}</b></li>)}</ul>
              </div>
            )}
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-mute">{breakdownLabel}</p>
              {group('key').length === 0 ? <p className="text-xs text-ink-mute">Belum ada.</p> : (
                <ul className="space-y-1 text-sm">{group('key').map(([id, n]) => <li key={id} className="flex justify-between"><span className="truncate">{id || 'Tidak tercatat'}</span><b className="tabular-nums">{n}</b></li>)}</ul>
              )}
            </div>
            {master && who === 'semua' && (
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-mute">Per otorisator</p>
                <ul className="space-y-1 text-sm">{group('by').map(([id, n]) => <li key={id} className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 truncate"><i className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[people.indexOf(id) % COLORS.length] }} />{nameOf(id)}</span><b className="tabular-nums">{n}</b></li>)}</ul>
              </div>
            )}
          </div>
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-mute">Grafik bulanan — {unit} {keyLabel} (12 bulan)</p>
            <div className="flex h-48 items-end gap-1.5 border-b border-slate-200" role="img" aria-label={`Grafik bulanan: ${series.map((x) => `${x.m} ${x.parts.reduce((a, b) => a + b, 0)}`).join(', ')}`}>
              {series.map(({ m, parts }) => {
                const sum = parts.reduce((a, b) => a + b, 0)
                return (
                  <div key={m} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={`${MONTHS[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}: ${sum} ${unit}`}>
                    <span className="mb-0.5 text-[10px] font-bold tabular-nums text-ink-soft">{sum || ''}</span>
                    <div className={cx('flex w-full max-w-[34px] flex-col-reverse overflow-hidden rounded-t-md', m === today.slice(0, 7) && 'ring-2 ring-emerald-300')} style={{ height: `${(sum / max) * 100}%` }}>
                      {parts.map((n, i) => n > 0 && <div key={i} style={{ height: `${(n / sum) * 100}%`, background: colorOf(i) }} />)}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-1 flex gap-1.5">{series.map(({ m }) => <span key={m} className="min-w-0 flex-1 text-center text-[10px] text-ink-mute">{MONTHS[Number(m.slice(5)) - 1]}</span>)}</div>
          </div>
        </div>
      </>}
    </Card>
  )
}

/** Otorisator: dokumen yang diotorisasi (per proofreader asal). Master melihat seluruh tim. */
export default function AuthStats({ narrow }) {
  const { user, data } = useApp()
  const master = user.otorisator_level === 'master'
  const name = (id) => data.users.find((u) => u.id === id)?.name ?? ''
  const rows = useMemo(() => data.projects.flatMap((p) => (p.sub_projects || []).filter((s) => s.data?.authorized_by).map((s) => {
    const at = authAt(s)
    return at && { at, day: dayKey(new Date(at)), by: s.data.authorized_by, key: name(s.data.proofreader), n: docsOf(s) }
  }).filter(Boolean)), [data.projects, data.users]) // eslint-disable-line react-hooks/exhaustive-deps
  const people = data.users.filter((u) => u.role === 'otorisator' || (u.extra_roles || []).includes('otorisator'))
  return <StatsCard title={master ? 'Hasil Otorisasi Tim' : 'Dokumen yang Saya Otorisasi'} unit="dokumen" keyLabel="diotorisasi" breakdownLabel="Dari proofreader"
    rows={rows} master={master} people={people} foldKey="auth" narrow={narrow} />
}

/** Penerjemah: jumlah halaman terjemahan yang SUDAH selesai (halaman sesuai data CS), riwayat bulanan. */
export function TranslatorStats({ narrow }) {
  const { user, data } = useApp()
  const rows = useMemo(() => data.projects.flatMap((p) => (p.sub_projects || []).filter((s) => {
    const flow = flowOf(s, p)
    return ['tr_int', 'tr_nt'].includes(flow) && s.data?.translator === user.id && (s.stage === DONE || stageIndex(flow, s.stage) > stageIndex(flow, 'penerjemahan'))
  }).map((s) => {
    const at = s.data?.translated_at || (s.history || []).find((h) => /^Penerjemahan/.test(h.action || ''))?.at
    if (!at) return []
    if (flowOf(s, p) === 'tr_nt') return [{ sid: s.id, at, day: dayKey(new Date(at)), by: user.id, kind: 'nt', key: `${s.lang_from} → ${s.lang_to}`, n: Number(s.pages) || 1 }]
    const k = kindPages(s)
    return ['reguler', 'non_reguler'].filter((kind) => k[kind] > 0).map((kind) => ({ sid: s.id, at, day: dayKey(new Date(at)), by: user.id, kind, key: `${s.lang_from} → ${s.lang_to}`, n: k[kind] }))
  }).flat()), [data.projects, user.id])
  return <StatsCard title="Jumlah Terjemahan Saya" unit="halaman" keyLabel="selesai diterjemahkan" breakdownLabel="Per pasangan bahasa"
    rows={rows} master={false} people={[]} foldKey="tr-stats" narrow={narrow}
    stack={[{ key: 'reguler', label: 'Reguler', color: '#1f4fd1' }, { key: 'non_reguler', label: 'Non Reguler', color: '#8b5cf6' }, { key: 'nt', label: 'Non Tersumpah', color: '#06b6d4' }]} />
}

/** Proofreader: jumlah halaman yang SUDAH selesai diperiksa (lanjut ke otorisasi), riwayat bulanan. */
const proofAt = (s) => s.data?.proofread_at || (s.history || []).find((h) => /^Pemeriksaan Proofreader/.test(h.action || ''))?.at
  || (s.data?.translated_at && s.data?.authorized_at ? new Date((new Date(s.data.translated_at).getTime() + new Date(s.data.authorized_at).getTime()) / 2).toISOString() : s.data?.authorized_at) || null
export function ProofreaderStats({ narrow }) {
  const { user, data } = useApp()
  const rows = useMemo(() => data.projects.flatMap((p) => (p.sub_projects || []).filter((s) => {
    const flow = flowOf(s, p)
    return flow === 'tr_int' && s.data?.proofreader === user.id && (s.stage === DONE || stageIndex(flow, s.stage) > stageIndex(flow, 'proofread'))
  }).map((s) => {
    const at = proofAt(s)
    if (!at) return []
    const k = kindPages(s)
    return ['reguler', 'non_reguler'].filter((kind) => k[kind] > 0).map((kind) => ({ sid: s.id, at, day: dayKey(new Date(at)), by: user.id, kind, key: `${s.lang_from} → ${s.lang_to}`, n: k[kind] }))
  }).flat()), [data.projects, user.id])
  return <StatsCard title="Jumlah Proofread Saya" unit="halaman" keyLabel="selesai diperiksa" breakdownLabel="Per pasangan bahasa"
    rows={rows} master={false} people={[]} foldKey="pr-stats" narrow={narrow}
    stack={[{ key: 'reguler', label: 'Reguler', color: '#1f4fd1' }, { key: 'non_reguler', label: 'Non Reguler', color: '#8b5cf6' }]} />
}
