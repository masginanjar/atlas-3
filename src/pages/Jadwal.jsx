import { useMemo, useState } from 'react'
import {
  CalendarRange, ChevronLeft, ChevronRight, Download, Pencil, Check, X,
  Plane, Clock, Users, Trash2, Info, Plus,
} from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { Button, Card, Input, Select, Field, Sheet, Empty, Tabs, cx } from '../components/ui.jsx'
import { BARIS_SHIFT, LIBUR, SKENARIO, shiftLabel, jamShift, ringkasJam } from '../config/shifts.js'
import {
  HARI_PENDEK, bulanKunci, labelBulan, geserBulan, mingguBulan, hariKunci,
  canUbahJadwal, canLihatSemua, cabangBolehUbah, cabangBolehLihat,
  indeksJadwal, isiShift, yangLibur, labelOrang, namaPendek, jadwalSaya, jamBaris,
  stafCabang, barisUntukCabang, cutiTerlihat, STATUS_CUTI, lamaCuti, tanggalCuti, ringkasCuti,
} from '../lib/jadwal.js'
import { svgJadwalCabang, svgJadwalPerusahaan, unduhPng } from '../lib/jadwalPng.js'
import { branchesOf } from '../config/access.js'

const TONE = {
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  emerald: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  rose: 'bg-rose-50 text-rose-800 ring-rose-200',
}

export default function Jadwal({ embedded }) {
  const { user, data, nameOf, notify, save, remove, ask } = useApp()
  const [ym, setYm] = useState(() => bulanKunci(new Date()))
  const bolehUbah = canUbahJadwal(user)
  const lihatSemua = canLihatSemua(user)

  const cabangLihat = useMemo(() => cabangBolehLihat(user), [user])
  const cabangUbah = useMemo(() => cabangBolehUbah(user), [user])
  const [cabang, setCabang] = useState(() => branchesOf(user)[0] || cabangLihat[0] || 'Bali')
  const [tab, setTab] = useState('saya')
  const [edit, setEdit] = useState(null)   // { iso, cabang }
  const [ajukan, setAjukan] = useState(false)
  const [unduh, setUnduh] = useState(false)

  const minggu = useMemo(() => mingguBulan(ym), [ym])
  const rows = data.jadwal || []
  const peta = useMemo(() => indeksJadwal(rows), [rows])
  const cuti = useMemo(() => cutiTerlihat(data.cuti, user), [data.cuti, user])

  // Komponen Tabs memakai `value`, bukan `key`.
  const tabs = [
    { value: 'saya', label: 'Jadwal Saya' },
    { value: 'cabang', label: 'Satu Cabang' },
    ...(lihatSemua ? [{ value: 'perusahaan', label: 'Satu Perusahaan' }] : []),
  ]

  const unduhJadwal = async () => {
    setUnduh(true)
    try {
      if (tab === 'perusahaan') {
        const svg = svgJadwalPerusahaan({
          judul: labelBulan(ym),
          sub: 'Jadwal Libur — 247 Sworn Translator',
          minggu, cabangList: cabangLihat, hariPendek: HARI_PENDEK,
          liburSel: (iso, cb) => yangLibur(peta, iso, cb).map((r) => namaPendek(nameOf(r.user_id))).join(', '),
        })
        await unduhPng(svg, `Jadwal 247 - ${labelBulan(ym)}`)
      } else {
        const baris = barisUntukCabang(data.users, cabang)
        const svg = svgJadwalCabang({
          judul: labelBulan(ym),
          sub: `TIM ${cabang.toUpperCase()}`,
          minggu, baris, hariPendek: HARI_PENDEK,
          sel: (iso, key) => isiShift(peta, iso, cabang, key)
            .map((r) => labelOrang(r, nameOf(r.user_id))).join(', '),
          libur: (iso) => yangLibur(peta, iso, cabang).map((r) => namaPendek(nameOf(r.user_id))).join(', '),
        })
        await unduhPng(svg, `Jadwal ${cabang} - ${labelBulan(ym)}`)
      }
      notify('Jadwal diunduh sebagai PNG ukuran A4')
    } catch (e) { notify(e.message || 'Gagal mengunduh', 'err') } finally { setUnduh(false) }
  }

  return (
    <div className={embedded ? 'space-y-3' : 'mx-auto w-full max-w-6xl space-y-4 p-4'}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          {embedded
            ? <p className="text-xs text-ink-soft">Shift harian dan hari libur tim.</p>
            : <><h1 className="flex items-center gap-2 text-lg font-bold text-ink"><CalendarRange className="h-5 w-5 text-brand" />Jadwal</h1>
              <p className="text-xs text-ink-soft">Shift harian dan hari libur tim.</p></>}
        </div>
        <Button size="sm" variant="outline" onClick={() => setAjukan(true)} data-aksi="ajukan-cuti"><Plane className="h-3.5 w-3.5" />Ajukan Libur</Button>
        {tab !== 'saya' && (
          <Button size="sm" variant="outline" loading={unduh} onClick={unduhJadwal}>
            <Download className="h-3.5 w-3.5" />Unduh PNG A4
          </Button>
        )}
      </div>

      {/* Tab, pemilih bulan, dan pemilih cabang dijadikan satu baris —
          sebelumnya tiga baris terpisah padahal ketiganya alat yang sama. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1"><Tabs tabs={tabs} value={tab} onChange={setTab} /></div>
        <div className="flex shrink-0 items-center gap-1 rounded-xl bg-white p-1 ring-1 ring-slate-200">
          <button type="button" onClick={() => setYm(geserBulan(ym, -1))} aria-label="Bulan sebelumnya"
            className="inline-grid h-11 w-11 place-items-center rounded-lg text-ink-soft hover:bg-slate-100"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-[120px] text-center text-sm font-bold text-ink" data-label-bulan>{labelBulan(ym)}</span>
          <button type="button" onClick={() => setYm(geserBulan(ym, 1))} aria-label="Bulan berikutnya"
            className="inline-grid h-11 w-11 place-items-center rounded-lg text-ink-soft hover:bg-slate-100"><ChevronRight className="h-4 w-4" /></button>
        </div>
        {tab === 'cabang' && cabangLihat.length > 1 && (
          <Select value={cabang} onChange={(e) => setCabang(e.target.value)} aria-label="Pilih cabang" className="w-auto">
            {cabangLihat.map((b) => <option key={b}>{b}</option>)}
          </Select>
        )}
        {bolehUbah && tab === 'cabang' && !cabangUbah.includes(cabang) && (
          <span className="text-[11px] text-ink-mute">Hanya bisa dilihat — cabang ini bukan wilayah Anda.</span>
        )}
      </div>

      {tab === 'saya' && <TampilanSaya {...{ user, ym, rows, peta, cuti, nameOf }} />}
      {tab === 'cabang' && (
        <TampilanCabang {...{ minggu, cabang, peta, data, nameOf, ym,
          bolehUbah: bolehUbah && cabangUbah.includes(cabang), onEdit: setEdit }} />
      )}
      {tab === 'perusahaan' && (
        <TampilanPerusahaan {...{ minggu, cabangList: cabangLihat, peta, nameOf }} />
      )}

      <DaftarCuti {...{ cuti, user, nameOf, save, remove, notify, ask, bolehUbah }} />

      {edit && (
        <SheetEdit s={edit} data={data} peta={peta} nameOf={nameOf} save={save} remove={remove}
          notify={notify} onClose={() => setEdit(null)} />
      )}
      {ajukan && <SheetCuti user={user} save={save} notify={notify} onClose={() => setAjukan(false)} />}
    </div>
  )
}

/* ---------------- Jadwal Saya ---------------- */
function TampilanSaya({ user, ym, rows, peta, cuti }) {
  const saya = useMemo(() => jadwalSaya(rows, user?.id, ym), [rows, user, ym])
  const hariIni = hariKunci(new Date())
  const cutiSaya = cuti.filter((c) => c.user_id === user?.id && String(c.mulai).startsWith(ym.slice(0, 4)))

  if (!saya.length) return (
    <Empty icon={CalendarRange} title="Belum ada jadwal bulan ini"
      text="Jadwal dibuat oleh Superadmin atau Direktur." />
  )
  return (
    <div className="space-y-2">
      {saya.map((r) => {
        const j = jamBaris(peta, r)
        const kini = r.tanggal === hariIni
        const libur = r.shift === LIBUR
        return (
          <Card key={r.id} className={cx('flex flex-wrap items-center gap-3 p-4', kini && 'ring-2 ring-brand/40')}>
            <div className="min-w-0 basis-24">
              <p className="text-[11px] font-semibold uppercase text-ink-mute">
                {HARI_PENDEK[(new Date(`${r.tanggal}T00:00:00Z`).getUTCDay() + 6) % 7]}
              </p>
              <p className="text-lg font-bold tabular-nums text-ink">{Number(r.tanggal.slice(8))}</p>
            </div>
            <div className="min-w-0 flex-1">
              <p className={cx('text-sm font-bold', libur ? 'text-rose-700' : 'text-ink')}>
                {shiftLabel(r.shift)}{r.jam_mulai ? ` · mulai ${r.jam_mulai}` : ''}
              </p>
              {j && <p className="flex items-center gap-1.5 text-xs text-ink-soft"><Clock className="h-3.5 w-3.5" />{ringkasJam(j)} · istirahat {j.istirahat}</p>}
              {libur && <p className="text-xs text-rose-600">Hari libur Anda.</p>}
            </div>
            {kini && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand">Hari ini</span>}
          </Card>
        )
      })}
      {cutiSaya.length > 0 && (
        <Card className="p-4">
          <p className="mb-2 text-sm font-bold text-ink">Pengajuan cuti saya</p>
          {cutiSaya.map((c) => (
            <p key={c.id} className="text-xs text-ink-soft">
              {ringkasCuti(c)} ({lamaCuti(c)} hari) —{' '}
              <b>{STATUS_CUTI[c.status]?.label || c.status}</b>{c.alasan ? ` · ${c.alasan}` : ''}
            </p>
          ))}
        </Card>
      )}
    </div>
  )
}

/* ---------------- Satu Cabang ---------------- */
function TampilanCabang({ minggu, cabang, peta, data, nameOf, bolehUbah, onEdit }) {
  const baris = useMemo(() => barisUntukCabang(data.users, cabang), [data.users, cabang])
  const hariIni = hariKunci(new Date())

  return (
    <div className="space-y-4">
      {minggu.map((mg, wi) => (
        <Card key={wi} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] table-fixed text-xs md:min-w-0">
              <thead>
                <tr className="bg-slate-50">
                  <th className="w-20 px-2 py-1.5 text-left text-[11px] font-bold uppercase text-ink-mute">Shift</th>
                  {mg.map((h) => (
                    <th key={h.iso} className={cx('px-1 py-1.5 text-center',
                      h.iso === hariIni && 'bg-brand-soft', !h.bulanIni && 'opacity-45')}>
                      <span className="block text-[10px] font-semibold text-ink-mute">{HARI_PENDEK[(new Date(`${h.iso}T00:00:00Z`).getUTCDay() + 6) % 7]}</span>
                      <span className="block text-sm font-bold tabular-nums text-ink">{h.tanggal}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {baris.map((b) => (
                  <tr key={b.key}>
                    <td className="px-2 py-1.5 text-[11px] font-bold text-ink-soft">{b.label}</td>
                    {mg.map((h) => {
                      const isi = isiShift(peta, h.iso, cabang, b.key)
                      return (
                        <td key={h.iso} className={cx('px-1 py-1.5 text-center align-top',
                          h.akhirPekan && 'bg-orange-50/60', !h.bulanIni && 'opacity-45')}>
                          {isi.length
                            ? isi.map((r) => (
                              <span key={r.id} className="block truncate text-[11px] text-ink">{labelOrang(r, nameOf(r.user_id))}</span>
                            ))
                            : <span className="text-[11px] text-slate-300">-</span>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
                <tr className="bg-rose-50">
                  <td className="px-2 py-1.5 text-[11px] font-bold text-rose-800">Libur</td>
                  {mg.map((h) => {
                    const l = yangLibur(peta, h.iso, cabang)
                    return (
                      <td key={h.iso} className={cx('px-1 py-1.5 text-center align-top', !h.bulanIni && 'opacity-45')}>
                        {l.map((r) => <span key={r.id} className="block truncate text-[11px] font-semibold text-rose-700">{namaPendek(nameOf(r.user_id))}</span>)}
                      </td>
                    )
                  })}
                </tr>
                {bolehUbah && (
                  <tr>
                    <td className="px-2 py-1.5 text-[11px] text-ink-mute">Ubah</td>
                    {mg.map((h) => (
                      <td key={h.iso} className="px-1 py-1 text-center">
                        <button type="button" onClick={() => onEdit({ iso: h.iso, cabang })}
                          aria-label={`Ubah jadwal ${h.iso}`} title="Atur shift hari ini"
                          className="inline-grid h-11 w-11 place-items-center rounded-lg text-brand hover:bg-brand-soft">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
      <TabelJam />
    </div>
  )
}

/* ---------------- Satu Perusahaan ---------------- */
function TampilanPerusahaan({ minggu, cabangList, peta, nameOf }) {
  const hariIni = hariKunci(new Date())
  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-soft">Isi setiap kotak adalah yang <b>libur</b> hari itu — seperti lembar jadwal libur bulanan.</p>
      {minggu.map((mg, wi) => (
        <Card key={wi} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] table-fixed text-xs md:min-w-0">
              <thead>
                <tr className="bg-slate-50">
                  <th className="w-24 px-2 py-1.5 text-left text-[11px] font-bold uppercase text-ink-mute">Cabang</th>
                  {mg.map((h) => (
                    <th key={h.iso} className={cx('px-1 py-1.5 text-center',
                      h.iso === hariIni && 'bg-brand-soft', !h.bulanIni && 'opacity-45')}>
                      <span className="block text-[10px] font-semibold text-ink-mute">{HARI_PENDEK[(new Date(`${h.iso}T00:00:00Z`).getUTCDay() + 6) % 7]}</span>
                      <span className="block text-sm font-bold tabular-nums text-ink">{h.tanggal}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cabangList.map((cb) => (
                  <tr key={cb}>
                    <td className="px-2 py-1.5 text-[11px] font-bold text-ink-soft">{cb}</td>
                    {mg.map((h) => {
                      const l = yangLibur(peta, h.iso, cb)
                      return (
                        <td key={h.iso} className={cx('px-1 py-1.5 text-center align-top',
                          l.length && 'bg-rose-50', !l.length && h.akhirPekan && 'bg-orange-50/60',
                          !h.bulanIni && 'opacity-45')}>
                          {l.map((r) => <span key={r.id} className="block truncate text-[11px] font-semibold text-rose-700">{namaPendek(nameOf(r.user_id))}</span>)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  )
}

/** Tabel jam kerja per skenario — disalin dari lembar jadwal. */
function TabelJam() {
  return (
    <Card className="p-4">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-ink"><Info className="h-4 w-4 text-ink-mute" />Jam kerja per shift</p>
      <p className="mb-3 text-[11px] text-ink-soft">Jam berubah tergantung berapa orang yang masuk hari itu.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {SKENARIO.map((sk) => (
          <div key={sk.key} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
            <p className="mb-1.5 text-xs font-bold text-ink">{sk.label}</p>
            <table className="w-full text-[11px]">
              <thead><tr className="text-ink-mute"><th className="text-left font-semibold">Shift</th><th className="text-left font-semibold">Jam</th><th className="text-left font-semibold">Istirahat</th><th className="text-left font-semibold">Lokasi</th></tr></thead>
              <tbody>
                {Object.entries(sk.jam).map(([k, j]) => (
                  <tr key={k}>
                    <td className="pr-2 font-semibold text-ink-soft">{shiftLabel(k)}</td>
                    <td className="pr-2 tabular-nums text-ink">{j.mulai} - {j.selesai}</td>
                    <td className="pr-2 text-ink-soft">{j.istirahat}</td>
                    <td className="text-ink-soft">{j.lokasi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </Card>
  )
}

/* ---------------- atur shift satu hari ---------------- */
function SheetEdit({ s, data, peta, nameOf, save, remove, notify, onClose }) {
  const staf = useMemo(() => stafCabang(data.users, s.cabang), [data.users, s.cabang])
  const baris = useMemo(() => barisUntukCabang(data.users, s.cabang), [data.users, s.cabang])
  const [busy, setBusy] = useState(false)

  const sekarang = (uid) => (peta.get(`${s.iso}|${s.cabang}`) || []).find((r) => r.user_id === uid) || null

  const set = async (u, shift, jam_mulai = '') => {
    setBusy(true)
    try {
      const ada = sekarang(u.id)
      if (!shift) { if (ada) await remove('jadwal', ada.id); notify(`${u.name}: jadwal dikosongkan`); return }
      await save('jadwal', { ...(ada || {}), tanggal: s.iso, cabang: s.cabang, user_id: u.id, shift, jam_mulai })
      notify(`${u.name}: ${shiftLabel(shift)}${jam_mulai ? ` (${jam_mulai})` : ''}`)
    } catch (e) { notify(e.message || 'Gagal menyimpan', 'err') } finally { setBusy(false) }
  }

  return (
    <Sheet open onClose={onClose} title="Atur Shift" subtitle={`${s.cabang} · ${s.iso}`} wide
      footer={<Button variant="ghost" onClick={onClose}>Tutup</Button>}>
      {!staf.length ? (
        <Empty icon={Users} title="Belum ada staf di cabang ini"
          text="Tambahkan penggunanya dulu di menu Setting." />
      ) : (
        <div className="space-y-2">
          {staf.map((u) => {
            const r = sekarang(u.id)
            return (
              <div key={u.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <p className="min-w-0 basis-full text-sm font-semibold text-ink">{u.name}</p>
                <Select value={r?.shift || ''} disabled={busy} aria-label={`Shift ${u.name}`}
                  onChange={(e) => set(u, e.target.value, r?.jam_mulai || '')} className="min-w-0 flex-1 basis-40">
                  <option value="">— tidak dijadwalkan —</option>
                  {baris.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
                  <option value={LIBUR}>Libur</option>
                </Select>
                <Input value={r?.jam_mulai || ''} disabled={busy || !r || r.shift === LIBUR}
                  placeholder="jam khusus, mis. 09.00" aria-label={`Jam khusus ${u.name}`}
                  onChange={(e) => r && set(u, r.shift, e.target.value)} className="min-w-0 basis-40" />
                {r && (
                  <button type="button" onClick={() => set(u, '')} disabled={busy}
                    aria-label={`Hapus jadwal ${u.name}`} title="Kosongkan"
                    className="inline-grid h-11 w-11 place-items-center rounded-lg text-rose-600 hover:bg-rose-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                {r && r.shift !== LIBUR && (
                  <p className="basis-full text-[11px] text-ink-mute">{ringkasJam(jamShift(r.shift, { adaYangLibur: yangLibur(peta, s.iso, s.cabang).length > 0 }))}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Sheet>
  )
}

/* ---------------- cuti ---------------- */
function SheetCuti({ user, save, notify, onClose }) {
  // Satu pengajuan bisa memuat beberapa periode libur sekaligus — misalnya
  // libur 10 Nov, lalu 15–17 Nov — supaya tidak perlu mengajukan berkali-kali.
  const hariIni = hariKunci(new Date())
  const [periode, setPeriode] = useState([{ mulai: hariIni, selesai: hariIni }])
  const [alasan, setAlasan] = useState('')
  const [busy, setBusy] = useState(false)

  const ubah = (i, patch) => setPeriode((a) => a.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  const tambah = () => setPeriode((a) => [...a, { mulai: hariIni, selesai: hariIni }])
  const hapus = (i) => setPeriode((a) => (a.length > 1 ? a.filter((_, j) => j !== i) : a))

  const bersih = periode.filter((p) => p.mulai).map((p) => ({ mulai: p.mulai, selesai: p.selesai || p.mulai }))
  const salah = bersih.find((p) => p.selesai < p.mulai)
  const semuaTanggal = tanggalCuti({ periode: bersih })

  const kirim = async () => {
    if (!bersih.length) { notify('Isi minimal satu tanggal libur', 'err'); return }
    if (salah) { notify('Tanggal selesai tidak boleh sebelum tanggal mulai', 'err'); return }
    setBusy(true)
    try {
      const urut = [...bersih].sort((a, b) => a.mulai.localeCompare(b.mulai))
      await save('cuti', {
        user_id: user.id, nama: user.name, cabang: branchesOf(user)[0] || user.branch,
        periode: urut,
        // mulai/selesai tetap diisi sebagai rentang keseluruhan, supaya data lama & baru sebentuk
        mulai: urut[0].mulai, selesai: urut[urut.length - 1].selesai,
        alasan, status: 'diajukan', at: new Date().toISOString(),
      })
      notify(`Pengajuan ${semuaTanggal.length} hari libur dikirim — hanya terlihat di cabang Anda`)
      onClose()
    } catch (e) { notify(e.message || 'Gagal mengirim', 'err') } finally { setBusy(false) }
  }

  return (
    <Sheet open onClose={onClose} title="Ajukan Libur / Cuti" subtitle="Satu pengajuan bisa memuat beberapa tanggal"
      footer={<><Button variant="ghost" onClick={onClose}>Batal</Button>
        <Button loading={busy} onClick={kirim} disabled={!bersih.length || !!salah} data-aksi="kirim-cuti"><Plane className="h-4 w-4" />Kirim</Button></>}>
      <div className="space-y-3">
        <div className="space-y-2" data-periode-cuti>
          {periode.map((p, i) => (
            <div key={i} className="rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-200" data-periode={i}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white text-[10px] font-bold text-ink-soft ring-1 ring-slate-200">{i + 1}</span>
                <span className="mr-auto text-[11px] font-bold uppercase tracking-wide text-ink-mute">Libur ke-{i + 1}</span>
                {periode.length > 1 && (
                  <button type="button" onClick={() => hapus(i)} aria-label={`Hapus libur ke-${i + 1}`}
                    className="grid h-8 w-8 place-items-center rounded-lg text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Mulai" required>
                  <Input type="date" value={p.mulai} onChange={(e) => ubah(i, { mulai: e.target.value, ...(p.selesai < e.target.value ? { selesai: e.target.value } : {}) })} aria-label={`Tanggal mulai libur ${i + 1}`} />
                </Field>
                <Field label="Sampai" required>
                  <Input type="date" value={p.selesai} min={p.mulai} onChange={(e) => ubah(i, { selesai: e.target.value })} aria-label={`Tanggal selesai libur ${i + 1}`} />
                </Field>
              </div>
            </div>
          ))}
        </div>
        <Button variant="outline" className="w-full" onClick={tambah} data-aksi="tambah-periode"><Plus className="h-4 w-4" />Tambah tanggal libur</Button>

        <Field label="Alasan" hint="Opsional — berlaku untuk seluruh tanggal di atas.">
          <Input value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="mis. acara keluarga" aria-label="Alasan cuti" />
        </Field>
        {salah && <p className="rounded-xl bg-rose-50 p-2.5 text-[11px] font-semibold text-rose-800 ring-1 ring-rose-200">Ada periode yang tanggal selesainya sebelum tanggal mulai.</p>}
        <p className="rounded-xl bg-sky-50 p-3 text-[11px] text-sky-900 ring-1 ring-sky-200" data-ringkas-cuti>
          Total <b>{semuaTanggal.length} hari</b> libur diajukan.
          Pengajuan ini hanya muncul di cabang Anda — cabang lain tidak melihatnya.
          Setelah disetujui, semua tanggalnya otomatis ditandai libur di jadwal.
        </p>
      </div>
    </Sheet>
  )
}

function DaftarCuti({ cuti, user, nameOf, save, remove, notify, ask, bolehUbah }) {
  const menunggu = cuti.filter((c) => c.status === 'diajukan')
  if (!cuti.length) return null

  const putuskan = async (c, status) => {
    try {
      await save('cuti', { ...c, status, diputus_oleh: user.name, diputus_at: new Date().toISOString() })
      // Disetujui → tanggalnya ditandai libur supaya jadwal cabang ikut berubah.
      if (status === 'disetujui') {
        for (const iso of tanggalCuti(c)) {
          await save('jadwal', { tanggal: iso, cabang: c.cabang, user_id: c.user_id, shift: LIBUR, dari_cuti: c.id }).catch(() => {})
        }
      }
      notify(status === 'disetujui' ? 'Cuti disetujui — tanggalnya ditandai libur' : 'Cuti ditolak')
    } catch (e) { notify(e.message || 'Gagal menyimpan', 'err') }
  }
  const batal = async (c) => {
    if (!(await ask('Batalkan pengajuan cuti ini?'))) return
    try { await remove('cuti', c.id); notify('Pengajuan dibatalkan') }
    catch (e) { notify(e.message || 'Gagal membatalkan', 'err') }
  }

  return (
    <Card className="p-4">
      <p className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
        <Plane className="h-4 w-4 text-sky-600" />Pengajuan Cuti
        {menunggu.length > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">{menunggu.length} menunggu</span>}
      </p>
      <div className="space-y-2">
        {cuti.slice(0, 20).map((c) => {
          const st = STATUS_CUTI[c.status] || STATUS_CUTI.diajukan
          return (
            <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <p className="min-w-0 flex-1 text-xs text-ink">
                <b>{c.nama || nameOf(c.user_id)}</b> · {c.cabang} · {ringkasCuti(c)} ({lamaCuti(c)} hari)
                {c.alasan ? <span className="text-ink-soft"> · {c.alasan}</span> : null}
              </p>
              <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-bold ring-1', TONE[st.tone])}>{st.label}</span>
              {bolehUbah && c.status === 'diajukan' && (
                <>
                  <Button size="sm" onClick={() => putuskan(c, 'disetujui')}><Check className="h-3.5 w-3.5" />Setujui</Button>
                  <Button size="sm" variant="outline" onClick={() => putuskan(c, 'ditolak')}><X className="h-3.5 w-3.5" />Tolak</Button>
                </>
              )}
              {c.user_id === user.id && c.status === 'diajukan' && (
                <button type="button" onClick={() => batal(c)} aria-label="Batalkan pengajuan cuti"
                  className="inline-grid h-11 w-11 place-items-center rounded-lg text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
