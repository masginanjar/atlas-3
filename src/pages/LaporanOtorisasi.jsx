// ============================================================
//  LAPORAN OTORISASI — per bulan, per otorisator.
//  Hanya 4 arah tersumpah: Indonesia ⇄ Inggris, Indonesia ⇄ Belanda.
//  Atas: rekap per otorisator (halaman per arah, total, biaya).
//  Bawah: rincian dokumen yang diotorisasi orang yang dipilih.
//  Pimpinan/Akunting melihat semua & mengisi tarif; Otorisator melihat miliknya.
// ============================================================
import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, FileText, Send, Loader2 } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { cx } from '../components/ui.jsx'
import { go } from '../lib/router.js'
import { barisOtorisasi, rekap, labelBulan, geserBulan, kunciBulan, rupiah, unduhPdf, unduhExcel, ARAH_OTO } from '../lib/laporanOto.js'

/** Boleh melihat semua otorisator. */
export const lihatSemuaOto = (u) => ['superadmin', 'direktur', 'admin_pusat'].includes(u?.role)
const PENDEK = { 'Indonesia → Inggris': 'ID→EN', 'Inggris → Indonesia': 'EN→ID', 'Indonesia → Belanda': 'ID→NL', 'Belanda → Indonesia': 'NL→ID' }
const angka = (n) => Number(n || 0).toLocaleString('id-ID')

export default function LaporanOtorisasi() {
  const { user, data, nameOf, save, notify } = useApp()
  const semuaOrang = lihatSemuaOto(user)
  const bolehTarif = ['superadmin', 'direktur'].includes(user?.role)
  const [ym, setYm] = useState(() => kunciBulan(new Date().toISOString()))
  const [pilih, setPilih] = useState(null)
  const [sibuk, setSibuk] = useState('')

  const tarifRow = (data.app_settings || []).find((r) => r.key === 'tarif_otorisasi')
  const tarif = tarifRow?.tarif || {}
  const tarifOf = (g) => Number(tarif[`${g.oto}|${g.grup}`]) || 0
  const simpanTarif = async (oto, grup, nama, v) => {
    const n = Number(String(v).replace(/\D/g, '')) || 0
    try { await save('app_settings', { ...(tarifRow || { key: 'tarif_otorisasi' }), key: 'tarif_otorisasi', tarif: { ...tarif, [`${oto}|${grup}`]: n } }); notify(`Tarif ${grup} ${nama} disimpan`) } catch (e) { notify(e.message, 'err') }
  }

  const rows = useMemo(() => barisOtorisasi(data.projects, ym, nameOf).filter((r) => semuaOrang || r.oto === (user._actor || user.id) || r.oto === user.id), [data.projects, ym, nameOf, semuaOrang, user])
  const grup = rekap(rows) // per otorisator × Inggris/Belanda (dipakai untuk unduhan)
  // rekap per otorisator
  const orang = useMemo(() => {
    const m = new Map()
    for (const r of rows) {
      if (!m.has(r.oto)) m.set(r.oto, { oto: r.oto, nama: r.otoNama, rows: [], dok: 0, hlm: 0, cepat: 0, arah: {} })
      const o = m.get(r.oto); o.rows.push(r); o.dok += 1; o.hlm += r.hlm; if (r.tipe !== 'Reguler/Normal') o.cepat += r.hlm
      o.arah[r.arah] = (o.arah[r.arah] || 0) + r.hlm
    }
    return [...m.values()].sort((a, b) => b.hlm - a.hlm)
  }, [rows])
  const aktif = orang.find((o) => o.oto === pilih) || orang[0]
  const hlmGrup = (o, g) => (g === 'Inggris' ? (o.arah['Indonesia → Inggris'] || 0) + (o.arah['Inggris → Indonesia'] || 0) : (o.arah['Indonesia → Belanda'] || 0) + (o.arah['Belanda → Indonesia'] || 0))
  const biayaOf = (o) => ['Inggris', 'Belanda'].reduce((a, g) => a + hlmGrup(o, g) * (Number(tarif[`${o.oto}|${g}`]) || 0), 0)
  const grupOrang = (o) => grup.filter((g) => g.oto === o.oto)
  const tot = { dok: orang.reduce((a, o) => a + o.dok, 0), hlm: orang.reduce((a, o) => a + o.hlm, 0), biaya: orang.reduce((a, o) => a + biayaOf(o), 0) }

  const jalan = async (kunci, fn) => { setSibuk(kunci); try { await fn() } catch (e) { notify(`Gagal: ${e.message}`, 'err') } finally { setSibuk('') } }
  const kirim = (o) => jalan(`kirim:${o.oto}`, async () => {
    await save('notifications', { to_user: o.oto, kind: 'laporan', text: `Laporan otorisasi ${labelBulan(ym)}: ${o.dok} dokumen · ${o.hlm} halaman — unduh di menu Otorisasi`, by: user.name, read_by: [] })
    notify(`Laporan dikirim ke ${o.nama}`)
  })
  const ikon = (k, I) => (sibuk === k ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <I className="h-3.5 w-3.5" />)
  const tombol = 'inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[12px] font-bold disabled:opacity-50'
  const th = 'px-3 py-2 font-semibold'

  return (
    <div className="flex min-w-0 flex-col gap-3.5" data-halaman-laporan-oto>
      <h1 className="text-2xl font-extrabold tracking-tight">Laporan Otorisasi</h1>
      <div className="min-w-0 overflow-hidden rounded-2xl border border-[#DADDE8] bg-white dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-[var(--klasik-latar)] px-3 py-2 text-[12.5px]" data-klasik-filter>
        <span className="flex items-center rounded-lg bg-white ring-1 ring-slate-200">
          <button type="button" onClick={() => setYm((v) => geserBulan(v, -1))} aria-label="Bulan sebelumnya" className="grid h-9 w-9 place-items-center text-ink-mute hover:text-ink"><ChevronLeft className="h-4 w-4" /></button>
          <b className="min-w-[124px] text-center text-[13px]" data-bulan>{labelBulan(ym)}</b>
          <button type="button" onClick={() => setYm((v) => geserBulan(v, 1))} aria-label="Bulan berikutnya" className="grid h-9 w-9 place-items-center text-ink-mute hover:text-ink"><ChevronRight className="h-4 w-4" /></button>
        </span>
        <span className="text-ink-mute">Terjemahan tersumpah Indonesia ⇄ Inggris / Belanda</span>
        <span className="ml-auto flex gap-2">
          <button type="button" disabled={!grup.length || !!sibuk} onClick={() => jalan('pdf-all', () => unduhPdf(grup, ym, tarifOf))} data-aksi="pdf-semua" className={cx(tombol, 'h-9 bg-white text-ink ring-1 ring-slate-300')}>{ikon('pdf-all', FileText)}PDF{semuaOrang ? ' semua' : ''}</button>
          <button type="button" disabled={!grup.length || !!sibuk} onClick={() => jalan('xls-all', () => unduhExcel(grup, ym, tarifOf))} data-aksi="excel-semua" className={cx(tombol, 'h-9 bg-white text-ink ring-1 ring-slate-300')}>{ikon('xls-all', Download)}Excel{semuaOrang ? ' semua' : ''}</button>
        </span>
      </div>

      {!orang.length ? <p className="px-4 py-14 text-center text-ink-mute">Belum ada dokumen tersumpah yang diotorisasi pada {labelBulan(ym)}.</p> : (
        <>
          {/* REKAP PER OTORISATOR */}
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]" data-tabel-rekap-oto>
              <thead className="bg-slate-50 text-left text-[10.5px] uppercase tracking-wide text-ink-mute">
                <tr className="border-b border-slate-200">
                  <th className={th}>Otorisator</th><th className={cx(th, 'text-right')}>Dokumen</th>
                  {ARAH_OTO.map((a) => <th key={a} className={cx(th, 'text-right')}>{PENDEK[a]} <span className="normal-case">hlm</span></th>)}
                  <th className={cx(th, 'text-right')}>Total hlm</th>
                  <th className={th}>Tarif / hlm (EN · NL)</th><th className={cx(th, 'text-right')}>Biaya</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {orang.map((o) => {
                  const on = aktif?.oto === o.oto
                  return (
                    <tr key={o.oto} onClick={() => setPilih(o.oto)} className={cx('cursor-pointer whitespace-nowrap border-b border-slate-100', on ? 'bg-[var(--klasik-pilih,#e3e9ff)]' : 'hover:bg-slate-50')} data-baris-oto>
                      <td className="px-3 py-2.5"><span className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-indigo-100 text-[11px] font-extrabold text-indigo-800">{o.nama.slice(0, 1)}</span><b className="text-[13px]">{o.nama}</b>{on && <span className="text-[10.5px] font-semibold text-brand">▾ rincian di bawah</span>}</span></td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{angka(o.dok)}</td>
                      {ARAH_OTO.map((a) => <td key={a} className={cx('px-3 py-2.5 text-right tabular-nums', !o.arah[a] && 'text-ink-mute')}>{o.arah[a] ? angka(o.arah[a]) : '—'}</td>)}
                      <td className="px-3 py-2.5 text-right text-[14px] font-extrabold tabular-nums">{angka(o.hlm)}</td>
                      <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                        {['Inggris', 'Belanda'].map((g) => {
                          const t = Number(tarif[`${o.oto}|${g}`]) || 0
                          return bolehTarif
                            ? <input key={`${g}:${t}`} defaultValue={t || ''} onBlur={(e) => { if ((Number(e.target.value.replace(/\D/g, '')) || 0) !== t) simpanTarif(o.oto, g, o.nama, e.target.value) }} inputMode="numeric" placeholder={g === 'Inggris' ? 'EN Rp' : 'NL Rp'} aria-label={`Tarif ${g} ${o.nama}`} title={`Tarif per halaman ${g}`} className="mr-1 h-8 w-[78px] rounded-md border-0 px-2 text-[12px] font-bold ring-1 ring-slate-300 focus:ring-2 focus:ring-brand" />
                            : <span key={g} className="mr-2 text-[12px] text-ink-mute">{g === 'Inggris' ? 'EN' : 'NL'} {t ? rupiah(t) : '—'}</span>
                        })}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold tabular-nums">{biayaOf(o) ? rupiah(biayaOf(o)) : <span className="text-ink-mute">Rp —</span>}</td>
                      <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                        <span className="flex justify-end gap-1">
                          <button type="button" disabled={!!sibuk} onClick={() => jalan(`pdf:${o.oto}`, () => unduhPdf(grupOrang(o), ym, tarifOf))} data-aksi="pdf" className={cx(tombol, 'bg-slate-100 text-ink')}>{ikon(`pdf:${o.oto}`, FileText)}PDF</button>
                          <button type="button" disabled={!!sibuk} onClick={() => jalan(`xls:${o.oto}`, () => unduhExcel(grupOrang(o), ym, tarifOf))} data-aksi="excel" className={cx(tombol, 'bg-slate-100 text-ink')}>{ikon(`xls:${o.oto}`, Download)}Excel</button>
                          {semuaOrang && <button type="button" disabled={!!sibuk} onClick={() => kirim(o)} data-aksi="kirim-staf" className={cx(tombol, 'bg-emerald-600 text-white')}>{ikon(`kirim:${o.oto}`, Send)}Kirim</button>}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {orang.length > 1 && (
                  <tr className="whitespace-nowrap bg-slate-50 font-bold">
                    <td className="px-3 py-2">Total</td><td className="px-3 py-2 text-right tabular-nums">{angka(tot.dok)}</td>
                    {ARAH_OTO.map((a) => <td key={a} className="px-3 py-2 text-right tabular-nums">{angka(orang.reduce((s, o) => s + (o.arah[a] || 0), 0))}</td>)}
                    <td className="px-3 py-2 text-right tabular-nums">{angka(tot.hlm)}</td>
                    <td /><td className="px-3 py-2 text-right tabular-nums">{tot.biaya ? rupiah(tot.biaya) : 'Rp —'}</td>
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* RINCIAN OTORISATOR TERPILIH */}
          {aktif && (
            <div className="border-t-4 border-[var(--klasik-luar,#e9edf5)]">
              <p className="px-3 pb-1 pt-3 text-[13px]"><b>Rincian {aktif.nama}</b> <span className="text-ink-mute">· {labelBulan(ym)} · {aktif.dok} dokumen · {aktif.hlm} halaman</span></p>
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]" data-tabel-oto>
                  <thead className="bg-slate-50 text-left text-[10.5px] uppercase tracking-wide text-ink-mute">
                    <tr className="border-b border-slate-200"><th className={cx(th, 'w-12')}>No</th><th className={th}>Tanggal ACC</th><th className={th}>No Invoice</th><th className={th}>Nama Klien</th><th className={th}>Dokumen</th><th className={th}>Arah</th><th className={cx(th, 'text-right')}>Hlm</th></tr>
                  </thead>
                  <tbody>
                    {aktif.rows.map((r, i) => (
                      <tr key={r.key} className={cx('whitespace-nowrap border-b border-slate-100', i % 2 && 'bg-[var(--klasik-zebra,#f6f8fc)]')}>
                        <td className="px-3 py-2 tabular-nums text-ink-mute">{i + 1}</td>
                        <td className="px-3 py-2">{r.tgl}</td>
                        <td className="px-3 py-2"><button type="button" onClick={() => go(`projects/${r.projectId}`)} title="Buka project" className="font-mono font-bold hover:text-brand hover:underline">{r.inv}</button></td>
                        <td className="max-w-[200px] truncate px-3 py-2">{r.klien}</td>
                        <td className="max-w-[240px] truncate px-3 py-2" title={r.dok}>{r.dok}</td>
                        <td className="px-3 py-2">{PENDEK[r.arah]}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.hlm}</td>
                      </tr>
                    ))}
                    <tr className="text-white" style={{ background: 'var(--klasik-head, #0e1540)' }}><td colSpan={6} className="px-3 py-2 font-bold">Total</td><td className="px-3 py-2 text-right font-bold tabular-nums">{aktif.hlm}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
      </div>
    </div>
  )
}
