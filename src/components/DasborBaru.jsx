import { useMemo, useState } from 'react'
import { BellRing, Check, ArrowRight, ChevronDown, AlarmClock, AlertTriangle, Inbox, StickyNote, Send, Plane, CalendarDays } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { Card, Sheet, Button, cx } from './ui.jsx'
import { MapTabs } from './SubTab.jsx'
import { InvoiceNo } from './badges.jsx'
import { PriorityBadge } from './Priority.jsx'
import { go } from '../lib/router.js'
import { tanggalJam } from '../lib/waktu.js'
import { daysLeft } from '../lib/format.js'
import { isDone } from '../config/workflows.js'
import { scopeByBranch, roleLabel, isFreelance } from '../config/access.js'
import { sapaan } from '../lib/cover.js'
import { hitungHambatan } from './DashboardRingkas.jsx'
import { KapasitasAcc, bolehAccKapasitas } from './Kapasitas.jsx'
import { calendarItems } from '../pages/Calendar.jsx'
import { TZ } from './WorkspacePanel.jsx'

// ============================================================
//  DASBOR BARU — kerangka yang sama untuk semua peran:
//  sapaan + pil ping · angka (4 besar di HP, sisanya baris kecil) ·
//  map bertingkat (Kerja saya · Hambatan · Tenggat hari ini · Catatan) ·
//  panel kanan sesuai peran. Isinya diisi per peran oleh Dashboard.jsx.
// ============================================================

/** Sapaan ringkas + pil ping di kanan. */
export function KepalaDasbor({ user, ping }) {
  const tanggal = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const pendek = new Date().toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
  return (
    <section aria-label="Sapaan hari ini" data-sapaan className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <h1 className="flex items-center gap-2.5 text-[17px] font-extrabold leading-tight tracking-tight">Dashboard<span className="inline-flex min-h-6 items-center whitespace-nowrap rounded-full bg-[#DFF1FB] px-2.5 text-xs font-bold tracking-normal text-[#0B5C8A]">{roleLabel(user)}</span></h1>
        <p className="mt-0.5 text-xs font-semibold text-[#5E6380]"><span className="sm:hidden">{pendek} · </span>{sapaan()}, {user.display_name || user.name} · {roleLabel(user)}{user.branch && !isFreelance(user) ? ` · ${user.branch}` : ''}</p>
      </div>
      {ping}
      <p className="hidden shrink-0 pt-1 text-xs font-semibold text-ink-mute sm:block">{tanggal}</p>
    </section>
  )
}

/** Ping: pil jumlah (HP → lembar bawah), strip satu baris di PC. */
export function PingStrip() {
  const { user, data, myPings, markPingRead } = useApp()
  const belum = myPings.filter((p) => p.kind !== 'pengumuman' && !(p.read_by || []).includes(user.id))
  const [sheet, setSheet] = useState(false)
  const [buka, setBuka] = useState(false)
  if (!belum.length) return { pil: null, strip: null }
  const nama = (p) => data.users.find((u) => u.id === p.from_user)?.name || p.by || 'Rekan'
  const Baris = ({ p, besar }) => (
    <div className={cx('flex items-start gap-2', besar ? 'rounded-xl bg-rose-50 p-3 ring-1 ring-rose-200' : 'px-4 py-2')}>
      <span className="min-w-0 flex-1">
        <span className={cx('block font-semibold text-rose-900', besar ? 'text-sm' : 'text-[13px]')}>{p.message || 'Mohon dicek'}</span>
        <span className="mt-0.5 block text-[11px] text-rose-700/80">{nama(p)} · {tanggalJam(p.created_at)}{p.invoice_no ? ` · ${p.invoice_no}` : ''}</span>
        {besar && <span className="mt-2 flex gap-1.5">
          {p.project_id && <Button className="h-11 flex-1" onClick={() => { markPingRead([p]); setSheet(false); go(`projects/${p.project_id}`) }}>Buka project</Button>}
          <Button variant="outline" className="h-11 flex-1" onClick={() => markPingRead([p])}><Check className="h-4 w-4" />Sudah dibaca</Button>
        </span>}
      </span>
      {!besar && <>
        {p.project_id && <button type="button" onClick={() => { markPingRead([p]); go(`projects/${p.project_id}`) }} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-rose-600 hover:bg-rose-100" aria-label="Buka project"><ArrowRight className="h-4 w-4" /></button>}
        <button type="button" onClick={() => markPingRead([p])} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-rose-600 hover:bg-rose-100" aria-label="Tandai dibaca"><Check className="h-4 w-4" /></button>
      </>}
    </div>
  )
  const pil = (
    <>
      <button type="button" onClick={() => setSheet(true)} data-ping-pil
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-rose-50 px-3 text-xs font-extrabold text-rose-700 ring-1 ring-rose-200 sm:hidden">
        <BellRing className="h-3.5 w-3.5" />{belum.length} ping
      </button>
      <Sheet open={sheet} onClose={() => setSheet(false)} title={`Ping untuk Anda (${belum.length})`}>
        <div className="space-y-2 pb-2">
          {belum.map((p) => <Baris key={p.id} p={p} besar />)}
          <div className="flex items-center justify-between pt-1 text-xs text-ink-mute"><span>Ping lama ada di lonceng 🔔</span><button type="button" onClick={() => { markPingRead(belum); setSheet(false) }} className="font-bold text-brand">Tandai semua dibaca</button></div>
        </div>
      </Sheet>
    </>
  )
  const utama = belum[0]
  const strip = (
    <section aria-label="Ping masuk" className="hidden overflow-hidden rounded-xl bg-rose-50 ring-1 ring-rose-200 sm:block" data-ping-strip>
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs">
        <b className="shrink-0 text-rose-700"><BellRing className="mr-1 inline h-3.5 w-3.5" />{belum.length} ping</b>
        <span className="min-w-0 flex-1 truncate font-semibold text-ink">{utama.message || 'Mohon dicek'} <span className="font-normal text-ink-mute">· {nama(utama)} · {tanggalJam(utama.created_at)}</span></span>
        {utama.project_id && <button type="button" onClick={() => { markPingRead([utama]); go(`projects/${utama.project_id}`) }} className="h-8 shrink-0 rounded-lg bg-white px-2.5 font-bold text-rose-700 ring-1 ring-rose-200 hover:ring-rose-400">Buka project</button>}
        <button type="button" onClick={() => markPingRead([utama])} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-rose-700 ring-1 ring-rose-200 hover:ring-rose-400" aria-label="Tandai dibaca"><Check className="h-4 w-4" /></button>
        {belum.length > 1 && <button type="button" onClick={() => setBuka((v) => !v)} aria-expanded={buka} className="h-8 shrink-0 rounded-lg bg-white px-2.5 font-bold text-rose-700 ring-1 ring-rose-200 hover:ring-rose-400">+{belum.length - 1} lagi <ChevronDown className={cx('inline h-3.5 w-3.5 transition', buka && 'rotate-180')} /></button>}
      </div>
      {buka && <div className="divide-y divide-rose-100 border-t border-rose-200">{belum.slice(1).map((p) => <Baris key={p.id} p={p} />)}</div>}
    </section>
  )
  return { pil, strip }
}

/**
 * Angka: tiles = [{k,label,value,sub,tone,uang,onClick|href}]. Di HP 4 pertama
 * jadi kotak besar, sisanya baris chip kecil; di PC semuanya kotak.
 */
export function AngkaPeran({ tiles, aktif }) {
  const utama = tiles.slice(0, 4), lain = tiles.slice(4)
  const Kotak = ({ t, kecil }) => {
    const Tag = t.href ? 'a' : 'button'
    const props = t.href ? { href: t.href } : { type: 'button', onClick: t.onClick }
    return (
      <Tag {...props} data-angka-kartu={t.k} aria-pressed={aktif === t.k || undefined}
        className={cx('group relative flex min-w-0 flex-col gap-1 rounded-2xl border bg-white px-3.5 py-3 text-left transition hover:border-[#B9BDD0] dark:bg-white/5',
          aktif === t.k ? 'border-[#141B34]' : 'border-[#DADDE8] dark:border-white/10', kecil && 'lg:flex')}>
        <p className="truncate text-xs text-[#5E6380]" title={t.label}>{t.label}</p>
        <p className={cx('truncate font-extrabold leading-tight tabular-nums', t.uang ? 'text-base' : 'text-[22px]', t.tone === 'danger' ? 'text-[#C62828]' : t.tone === 'warn' ? 'text-[#6B4E00]' : t.tone === 'ok' ? 'text-[#17693A]' : 'text-[#141B34] dark:text-white')}>{t.value}</p>
        {t.sub && <p className="truncate text-[11px] text-[#5E6380]">{t.sub}</p>}
      </Tag>
    )
  }
  return (
    <section aria-label="Angka hari ini" data-angka className="space-y-2">
      <div className="grid grid-cols-2 gap-2.5 lg:[grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
        {utama.map((t) => <Kotak key={t.k} t={t} />)}
        {lain.map((t) => <span key={t.k} className="hidden min-w-0 lg:block"><Kotak t={t} kecil /></span>)}
      </div>
      {lain.length > 0 && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] lg:hidden" data-angka-kecil>
          {lain.map((t) => {
            const Tag = t.href ? 'a' : 'button'
            const props = t.href ? { href: t.href } : { type: 'button', onClick: t.onClick }
            return <Tag key={t.k} {...props} className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] border border-[#E7E8F0] bg-white px-3 text-xs font-semibold text-[#5E6380]">{t.label}<b className="text-ink">{t.value}</b></Tag>
          })}
        </div>
      )}
    </section>
  )
}

/** Baris ringkas satu project (untuk Tenggat hari ini & Hambatan). */
function BarisProject({ p, keterangan, kanan, aksi }) {
  const d = daysLeft(p.about?.deadline)
  return (
    <li className="flex min-w-0 items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4">
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <a href={`#/projects/${p.id}`} className="truncate text-sm font-bold tabular-nums hover:underline"><InvoiceNo project={p} /></a>
          {p.about?.priority && p.about.priority !== 'Normal' && <PriorityBadge p={p.about.priority} />}
          <span className="hidden truncate text-xs text-ink-mute sm:inline">{p.customer?.name}</span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-ink-soft">{keterangan}</span>
      </span>
      {kanan ?? <span className={cx('hidden shrink-0 text-right text-xs font-semibold sm:block', d !== null && d <= 0 ? 'text-rose-600' : 'text-ink-mute')}>{d === null ? '' : d < 0 ? `Terlambat ${-d} hr` : d === 0 ? 'Hari ini' : `${d} hari lagi`}</span>}
      {aksi}
    </li>
  )
}

const Chip = ({ on, onClick, n, children }) => (
  <button type="button" onClick={onClick} aria-pressed={on}
    className={cx('inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] px-3.5 text-[13px] font-bold ring-1 transition', on ? 'bg-[#141B34] text-white ring-[#141B34]' : 'bg-white text-[#141B34] ring-[#D9DBE7] hover:ring-[#B9BDD0]')}>
    {children}{n !== undefined && <span className={cx('text-[10px]', on ? 'text-slate-300' : 'text-ink-mute')}>{n}</span>}
  </button>
)

/**
 * Map bertingkat daftar kerja. tabsExtra: tab tambahan dari peran
 * [{key,label,n,panel:(chips)=>node,isi:node}]. kerja: node isi tab Kerja saya.
 */
export function PetaKerja({ user, s, nKerja, kerja, tab, setTab, tabsExtra = [], sembunyi = [] }) {
  const { data, branchFilter, sendPing, notify } = useApp()
  const [chipH, setChipH] = useState('semua')
  const [chipT, setChipT] = useState('semua')
  const [semuaH, setSemuaH] = useState(false)
  const hambatan = useMemo(() => hitungHambatan(s, user), [s, user])
  const act = s.active.filter((p) => !p.demo_perf)
  const tenggat = act.filter((p) => daysLeft(p.about?.deadline) === 0).sort((a, b) => String(a.about?.deadline_time || '').localeCompare(String(b.about?.deadline_time || '')))
  const catatan = useMemo(() => scopeByBranch(user, data.projects, branchFilter)
    .filter((p) => !isDone(p) && !p.cancelled && String(p.about?.notes || '').trim())
    .map((p) => ({ p, teks: String(p.about.notes).replace(/\s*\n+\s*/g, ' · ').trim() }))
    .sort((a, b) => String(a.p.about?.deadline || '').localeCompare(String(b.p.about?.deadline || ''))), [user, data.projects, branchFilter])
  const bolehPing = ['direktur', 'supervisor', 'superadmin'].includes(user.role)
  const csDari = (p) => p.about?.cs_id || p.created_by
  const ping = async (r) => {
    const to = csDari(r.p); if (!to) return
    try { await sendPing({ to_user: to, project: r.p, message: `Mohon ditindaklanjuti: ${r.masalah}` }); notify(`Ping terkirim ke ${data.users.find((u) => u.id === to)?.name || 'CS'}`) } catch (e) { notify(e.message, 'err') }
  }
  const hRows = hambatan.filter((r) => chipH === 'semua' ? true : chipH === 'sameday' ? r.prio === 'Sameday' : chipH === 'lama' ? (r.dl !== null && r.dl <= -3) : chipH === 'belum' ? /Belum/i.test(r.masalah) : r.jenis === chipH)
  const tRows = tenggat.filter((p) => chipT === 'semua' ? true : chipT === 'prio' ? (p.about?.priority && p.about.priority !== 'Normal') : (p.about?.print_location || p.branch) === chipT)
  const printLoc = [...new Set(tenggat.map((p) => p.about?.print_location || p.branch))].sort()
  const nada = { tenggat: 'bg-rose-50 text-rose-700 ring-rose-200', prioritas: 'bg-amber-50 text-amber-800 ring-amber-200', tugas: 'bg-indigo-50 text-indigo-700 ring-indigo-200', acc: 'bg-violet-50 text-violet-700 ring-violet-200', transfer: 'bg-emerald-50 text-emerald-700 ring-emerald-200' }

  const tabs = [
    !sembunyi.includes('kerja') && { key: 'kerja', label: 'Kerja saya', n: nKerja, tone: 'mute' },
    ...tabsExtra.map((t) => ({ key: t.key, label: t.label, n: t.n, tone: t.tone || 'mute' })),
    { key: 'hambatan', label: 'Hambatan', n: hambatan.length },
    { key: 'tenggat', label: 'Tenggat hari ini', n: tenggat.length, tone: 'mute' },
    !sembunyi.includes('catatan') && { key: 'catatan', label: 'Catatan', n: catatan.length, tone: 'mute' },
  ].filter(Boolean)
  const extra = tabsExtra.find((t) => t.key === tab)
  const panel = tab === 'hambatan' ? (
    <div className="-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
      <Chip on={chipH === 'semua'} onClick={() => setChipH('semua')} n={hambatan.length}>Semua</Chip>
      <Chip on={chipH === 'sameday'} onClick={() => setChipH('sameday')} n={hambatan.filter((r) => r.prio === 'Sameday').length}>Sameday</Chip>
      <Chip on={chipH === 'lama'} onClick={() => setChipH('lama')} n={hambatan.filter((r) => r.dl !== null && r.dl <= -3).length}>&gt; 3 hari</Chip>
      {hambatan.some((r) => r.jenis === 'tugas') && <Chip on={chipH === 'tugas'} onClick={() => setChipH('tugas')} n={hambatan.filter((r) => r.jenis === 'tugas').length}>Belum ada penerjemah/vendor</Chip>}
      {hambatan.some((r) => r.jenis === 'acc') && <Chip on={chipH === 'acc'} onClick={() => setChipH('acc')} n={hambatan.filter((r) => r.jenis === 'acc').length}>Menunggu ACC</Chip>}
      {hambatan.some((r) => r.jenis === 'transfer') && <Chip on={chipH === 'transfer'} onClick={() => setChipH('transfer')} n={hambatan.filter((r) => r.jenis === 'transfer').length}>Belum ditransfer</Chip>}
    </div>
  ) : tab === 'tenggat' ? (
    <div className="-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
      <Chip on={chipT === 'semua'} onClick={() => setChipT('semua')} n={tenggat.length}>Semua</Chip>
      <Chip on={chipT === 'prio'} onClick={() => setChipT('prio')} n={tenggat.filter((p) => p.about?.priority && p.about.priority !== 'Normal').length}>Prioritas</Chip>
      {printLoc.length > 1 && printLoc.map((b) => <Chip key={b} on={chipT === b} onClick={() => setChipT(b)} n={tenggat.filter((p) => (p.about?.print_location || p.branch) === b).length}>Print {b}</Chip>)}
    </div>
  ) : extra?.panel ? extra.panel(Chip) : tab === 'kerja' ? (kerja?.panel || null) : null

  return (
    <div data-peta-kerja={tab} className="min-w-0">
      <MapTabs tabs={tabs} aktif={tab} onPilih={setTab} ada={!!panel} label="Daftar kerja" panel={panel} />
      {(tab === 'kerja' && kerja?.polos) || (extra && extra.polos) ? (
        <div className="mt-2" data-isi-polos>{tab === 'kerja' ? kerja.isi : extra.isi}</div>
      ) : (
      <Card className="mt-2 overflow-hidden p-0">
        {tab === 'kerja' && (kerja?.isi || kerja)}
        {extra && extra.isi}
        {tab === 'hambatan' && (
          hRows.length === 0 && !bolehAccKapasitas(user) ? <p className="px-4 py-6 text-center text-sm text-ink-mute">Tidak ada hambatan. Semua tenggat dan persetujuan aman.</p> : (
            <>
              <ul className="divide-y divide-slate-100" aria-label="Daftar hambatan">
                {(semuaH ? hRows : hRows.slice(0, 8)).map((r) => (
                  <BarisProject key={r.key} p={r.p} keterangan={r.masalah} kanan={null}
                    aksi={<span className="flex shrink-0 items-center gap-1.5">
                      {bolehPing && csDari(r.p) && csDari(r.p) !== user.id && <button type="button" onClick={() => ping(r)} className="hidden h-8 items-center gap-1 rounded-lg bg-white px-2.5 text-xs font-bold text-ink-soft ring-1 ring-slate-200 hover:text-brand hover:ring-brand sm:inline-flex" data-aksi="ping-cs"><Send className="h-3 w-3" />Ping {String(data.users.find((u) => u.id === csDari(r.p))?.name || 'CS').split(' ')[0]}</button>}
                      <button type="button" onClick={() => go(r.href.replace(/^#\//, ''))} data-aksi="hambatan" className={cx('h-10 shrink-0 rounded-lg px-3 text-xs font-bold ring-1 transition hover:brightness-95 sm:h-8', nada[r.jenis])}>{r.aksi}</button>
                    </span>} />
                ))}
              </ul>
              {hRows.length > 8 && <button type="button" onClick={() => setSemuaH((v) => !v)} className="flex items-center gap-1 px-4 py-2 text-left text-[11px] font-semibold text-brand hover:underline">{semuaH ? 'Tampilkan lebih sedikit' : `+${hRows.length - 8} lainnya`}<ChevronDown className={cx('h-3.5 w-3.5 transition', semuaH && 'rotate-180')} /></button>}
              {bolehAccKapasitas(user) && <div className="border-t border-slate-100 p-3 [&>*]:shadow-none [&>*]:ring-0"><KapasitasAcc /></div>}
            </>
          )
        )}
        {tab === 'tenggat' && (
          tRows.length === 0 ? <p className="px-4 py-6 text-center text-sm text-ink-mute">Tidak ada tenggat hari ini.</p> : (
            <ul className="divide-y divide-slate-100">
              {tRows.map((p) => <BarisProject key={p.id} p={p} keterangan={`${p.about?.deadline_time ? `${p.about.deadline_time} · ` : ''}${(p.sub_projects || []).filter((x) => x.stage !== 'done').length} dok berjalan · ${p.branch}${(p.about?.print_location && p.about.print_location !== p.branch) ? ` · print ${p.about.print_location}` : ''}`}
                aksi={<button type="button" onClick={() => go(`projects/${p.id}`)} className="h-10 shrink-0 rounded-lg bg-white px-3 text-xs font-bold text-ink ring-1 ring-slate-200 hover:ring-brand sm:h-8">Buka</button>} />)}
            </ul>
          )
        )}
        {tab === 'catatan' && (
          catatan.length === 0 ? <p className="px-4 py-6 text-center text-sm text-ink-mute">Tidak ada catatan project aktif.</p> : (
            <ul className="divide-y divide-amber-100">
              {catatan.map(({ p, teks }) => (
                <li key={p.id} className="bg-amber-50/40"><a href={`#/projects/${p.id}`} className="flex min-h-[40px] items-center gap-2 px-3 py-2 text-xs text-amber-900 hover:underline sm:px-4">
                  <StickyNote className="h-3.5 w-3.5 shrink-0 text-amber-500" /><b className="shrink-0"><InvoiceNo project={p} /></b><span className="hidden shrink-0 text-amber-700 sm:inline">{p.customer?.name || '—'}</span><span className="min-w-0 flex-1 truncate" title={teks}>{teks}</span></a></li>
              ))}
            </ul>
          )
        )}
      </Card>
      )}
    </div>
  )
}

/** Agenda hari ini: deadline, to-do, pengingat (dari data yang sama dengan Agenda). */
export function AgendaHariIni() {
  const { user, data, branchFilter } = useApp()
  const dayKey = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(d))
  const jam = (d) => new Date(d).toLocaleTimeString('id-ID', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
  const today = dayKey(new Date())
  const items = useMemo(() => calendarItems(user, data, branchFilter).filter((i) => dayKey(i.at) === today).sort((a, b) => String(a.at).localeCompare(String(b.at))), [user, data, branchFilter, today]) // eslint-disable-line react-hooks/exhaustive-deps
  const dl = items.filter((i) => i.type === 'deadline'); const lain = items.filter((i) => i.type !== 'deadline')
  const dot = { deadline: 'bg-rose-500', todo: 'bg-sky-500', reminder: 'bg-amber-500' }
  return (
    <Card className="overflow-hidden p-0" data-agenda-hari-ini>
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2"><CalendarDays className="h-4 w-4 text-brand" /><h2 className="flex-1 text-[13px] font-extrabold">Agenda hari ini</h2><a href="#/agenda" className="text-[11.5px] font-bold text-brand hover:underline">Agenda →</a></div>
      <ul className="px-3 py-1">
        {dl.length > 0 && <li className="flex items-center gap-2 py-1.5 text-xs"><span className="w-10 font-bold tabular-nums text-ink-mute">{jam(dl[0].at)}</span><span className={cx('h-2 w-2 rounded-full', dot.deadline)} /><span className="min-w-0 flex-1 truncate">{dl.length} deadline project</span></li>}
        {lain.slice(0, 5).map((i) => <li key={i.id} className="flex items-center gap-2 border-t border-slate-100 py-1.5 text-xs"><span className="w-10 font-bold tabular-nums text-ink-mute">{jam(i.at)}</span><span className={cx('h-2 w-2 shrink-0 rounded-full', dot[i.type])} /><span className="min-w-0 flex-1 truncate">{i.type === 'todo' ? 'To-do: ' : 'Pengingat: '}{i.title}</span></li>)}
        {items.length === 0 && <li className="py-3 text-center text-xs text-ink-mute">Tidak ada agenda hari ini.</li>}
      </ul>
    </Card>
  )
}
