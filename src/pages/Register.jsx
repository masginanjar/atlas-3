// ============================================================
//  NOMOR REGISTER — terjemahan tersumpah ID ⇄ EN / NL
//
//  Alur: Otorisator ACC → nomor dibuat & dipesan otomatis (1 dokumen = 1 nomor)
//        → Admin Pusat cek tanggal, jenis & nama dalam dokumen → Terbitkan
//        → CS/admin cabang diberi tahu → tampil untuk diinput Pak Arifin
//          ke sistemnya (salin / unduh Excel).
//  Tampilan mengikuti tabel Project (Mode Klasik); tanggal berbahasa Inggris
//  seperti Sheet "247 Registrasi Terjemahan 2026".
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import { Copy, Download, Search, Check, Loader2, ArrowUpRight } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { Button, Sheet, cx } from '../components/ui.jsx'
import { copyText } from '../components/CopyText.jsx'
import { InvoiceNo } from '../components/badges.jsx'
import { IkonBaris, LembarFile, DetailRingkas } from '../components/ModeKlasik.jsx'
import { useHp } from '../components/klasikSaklar.jsx'
import { scopeByBranch, invoiceLabel } from '../config/access.js'
import { docListOf } from '../config/workflows.js'
import { PASANGAN, valid, tanggalDari, namaDefault, jenisDefault, barisRegistrasi } from '../lib/registrasi.js'
import { db } from '../lib/db.js'
import { go } from '../lib/router.js'

/** Boleh menerbitkan & mengubah isian register. */
export const canTerbitkan = (u) => ['superadmin', 'supervisor', 'admin_pusat'].includes(u?.role)

// Tanggal bahasa Inggris, contoh "Tuesday, 10 November 2026"
const EN = new Intl.DateTimeFormat('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const tglInggris = (iso) => {
  try { const p = Object.fromEntries(EN.formatToParts(new Date(`${iso}T00:00:00Z`)).map((x) => [x.type, x.value])); return `${p.weekday}, ${p.day} ${p.month} ${p.year}` } catch { return iso }
}
const hariIni = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date())
const geserHari = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }

// Centang "Diinput" — catatan pribadi di browser ini (Pak Arifin menandai yang sudah diinput)
const KUNCI_INPUT = 'atlas-register-diinput'
const bacaInput = () => { try { return new Set(JSON.parse(localStorage.getItem(KUNCI_INPUT) || '[]')) } catch { return new Set() } }
const simpanInput = (set) => { try { localStorage.setItem(KUNCI_INPUT, JSON.stringify([...set].slice(-5000))) } catch { /* abaikan */ } }

/** Semua baris register (satu per nomor) dari project yang terlihat. */
function barisDari(projects) {
  const out = []
  for (const p of projects) {
    for (const s of p.sub_projects || []) {
      const nomor = s.data?.reg_numbers || []
      if (!nomor.some(Boolean)) continue
      const docs = docListOf(s)
      const terbit = s.stage !== 'registrasi'
      nomor.forEach((no, i) => {
        if (!valid(no)) return
        out.push({
          key: `${s.id}:${no}`, no, p, s, i, terbit,
          invoice: invoiceLabel(p.invoice_no || ''), arah: PASANGAN[String(no).slice(0, 2)] || '',
          tanggal: s.data?.reg_dates?.[i] || tanggalDari(no),
          jenis: s.data?.reg_types?.[i] || jenisDefault(docs[i] || s.title || ''),
          nama: s.data?.reg_names?.[i] || namaDefault(docs[i], p), cabang: p.branch || '',
        })
      })
    }
  }
  return out.sort((a, b) => (a.no.slice(6, 12) < b.no.slice(6, 12) ? -1 : 1)) // urut naik, sama seperti Sheet
}

/** Sel yang bisa diubah: klik → kotak isian; Enter/keluar = simpan, Esc = batal. */
function SelUbah({ nilai, tampil, jenis = 'text', boleh, onSimpan, label }) {
  const [ubah, setUbah] = useState(false)
  const [v, setV] = useState(nilai)
  const ref = useRef(null)
  useEffect(() => { if (ubah) ref.current?.focus() }, [ubah])
  if (!boleh) return <span>{tampil ?? nilai}</span>
  if (!ubah) return (
    <button type="button" onClick={(e) => { e.stopPropagation(); setV(nilai); setUbah(true) }} title={`Ubah ${label}`} aria-label={`Ubah ${label}`}
      className="max-w-full truncate border-b border-dashed border-slate-300 text-left hover:border-brand hover:text-brand">{tampil ?? nilai ?? '—'}</button>
  )
  const simpan = () => { setUbah(false); if (String(v).trim() && v !== nilai) onSimpan(String(v).trim()) }
  return (
    <input ref={ref} type={jenis} value={v} onChange={(e) => setV(e.target.value)} onBlur={simpan} aria-label={label}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setV(nilai); setUbah(false) } }}
      className="h-8 w-full min-w-[150px] rounded-md border-0 bg-white px-2 text-[12.5px] ring-2 ring-brand" />
  )
}

/** Kotak isian bergaris (antrian Admin Pusat): simpan saat keluar dari kotak bila berubah. */
function KotakUbah({ nilai, jenis = 'text', lebar, onSimpan, label }) {
  const [v, setV] = useState(nilai)
  useEffect(() => { setV(nilai) }, [nilai])
  return (
    <input type={jenis} value={v} onChange={(e) => setV(e.target.value)} aria-label={label}
      onBlur={() => { if (String(v).trim() && v !== nilai) onSimpan(String(v).trim()) }} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
      className={cx('h-9 rounded-lg border-0 bg-white px-2.5 text-[13px] ring-1 ring-slate-300 focus:ring-2 focus:ring-brand', lebar)} />
  )
}

export default function Register() {
  const { user, data, processStage, patchSubData, notify } = useApp()
  const bolehTerbit = canTerbitkan(user)
  const hp = useHp()
  const [cepat, setCepat] = useState(() => (canTerbitkan(user) ? 'menunggu' : 'hari'))
  const [q, setQ] = useState('')
  const [sibuk, setSibuk] = useState(null)
  const [diinput, setDiinput] = useState(bacaInput)
  const [lihat, setLihat] = useState(null)
  const [folder, setFolder] = useState(null)

  const semua = useMemo(() => barisDari(scopeByBranch(user, data.projects || []).filter((p) => !p.cancelled)), [user, data.projects])
  const hari = hariIni(), kemarin = geserHari(hari, -1), seminggu = geserHari(hari, -6)
  const menunggu = semua.filter((r) => !r.terbit)
  const terbitSemua = semua.filter((r) => r.terbit)
  const n = { hari: terbitSemua.filter((r) => r.tanggal === hari).length, kemarin: terbitSemua.filter((r) => r.tanggal === kemarin).length }
  const s = q.trim().toLowerCase()
  const rows = semua.filter((r) => (cepat === 'menunggu' ? !r.terbit : r.terbit && (
    cepat === 'hari' ? r.tanggal === hari : cepat === 'kemarin' ? r.tanggal === kemarin : cepat === '7' ? r.tanggal >= seminggu : true)))
    .filter((r) => !s || [r.no, r.invoice, r.jenis, r.nama, r.cabang].some((v) => String(v).toLowerCase().includes(s)))
  const terbit = rows.filter((r) => r.terbit)

  // Ubah tanggal / jenis / nama → disimpan ke project (+ tabel registrations bila sudah terbit)
  const ubahIsian = async (r, kunci, nilai, label) => {
    try {
      const p = (data.projects || []).find((x) => x.id === r.p.id) || r.p
      const sub = (p.sub_projects || []).find((x) => x.id === r.s.id) || r.s
      const arr = [...(sub.data?.[kunci] || [])]; arr[r.i] = nilai
      const saved = await patchSubData(p, sub.id, { [kunci]: arr }, `Register ${r.no}: ${label} → ${nilai}`)
      if (r.terbit) {
        const p2 = saved?.sub_projects ? saved : p
        const sub2 = (p2.sub_projects || []).find((x) => x.id === sub.id) || { ...sub, data: { ...sub.data, [kunci]: arr } }
        const baris = barisRegistrasi(p2, sub2, user).filter((x) => x.reg_no === r.no)
        if (baris.length) await db.regUpsert(baris)
      }
      notify(`${label} disimpan`)
    } catch (e) { notify(e.message, 'err') }
  }

  const terbitkan = async (sub) => {
    setSibuk(sub.id)
    try {
      const p = (data.projects || []).find((x) => (x.sub_projects || []).some((y) => y.id === sub.id))
      await processStage(p, sub.id, {}, true)
    } catch (e) { notify(e.message, 'err') } finally { setSibuk(null) }
  }
  const terbitkanSemua = async () => { const subs = [...new Map(menunggu.map((r) => [r.s.id, r.s])).values()]; for (const x of subs) await terbitkan(x); notify(`${menunggu.length} nomor terbit`) }

  const salinSemua = async () => {
    const tsv = terbit.map((r) => [r.invoice, r.no, tglInggris(r.tanggal), r.jenis, r.nama].join('\t')).join('\n')
    const ok = await copyText(tsv)
    notify(ok ? `${terbit.length} baris disalin — tempel ke Sheet / sistem` : 'Gagal menyalin', ok ? 'ok' : 'err')
  }
  const unduh = async () => {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet([['No. Invoice', 'No Registrasi', 'Tanggal', 'Jenis Dokumen', 'Nama dalam Dokumen'],
      ...terbit.map((r) => [r.invoice, r.no, tglInggris(r.tanggal), r.jenis, r.nama])])
    ws['!cols'] = [{ wch: 16 }, { wch: 17 }, { wch: 30 }, { wch: 36 }, { wch: 26 }]
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Register')
    XLSX.writeFile(wb, `Nomor-Register-${cepat === 'semua' ? 'semua' : hari}.xlsx`)
  }
  const tandai = (no) => setDiinput((old) => { const x = new Set(old); if (x.has(no)) x.delete(no); else x.add(no); simpanInput(x); return x })
  const salin = async (no) => notify((await copyText(no)) ? `${no} disalin` : 'Gagal menyalin')

  // Gabung sel No. Invoice berurutan yang sama; tombol Terbitkan per sub project
  const rentangSama = (kunci) => rows.map((r, i) => { if (i && kunci(rows[i - 1]) === kunci(r)) return 0; let k = 1; while (i + k < rows.length && kunci(rows[i + k]) === kunci(r)) k++; return k })
  const spanInv = rentangSama((r) => r.invoice)
  const spanSub = rentangSama((r) => (r.terbit ? `t:${r.key}` : r.s.id))

  const projLihat = lihat && (data.projects || []).find((x) => x.id === lihat)
  const lembar = (
    <>
      {projLihat && (
        <Sheet open side onClose={() => setLihat(null)} title={invoiceLabel(projLihat.invoice_no)} subtitle={`${projLihat.customer?.name || ''} · ${projLihat.branch}`}>
          <div data-klasik-detail><DetailRingkas id={projLihat.id} onClose={() => setLihat(null)} /></div>
        </Sheet>
      )}
      <LembarFile id={folder} onClose={() => setFolder(null)} />
    </>
  )
  const tombolProject = (r, besar) => (
    <button type="button" onClick={(e) => { e.stopPropagation(); go(`projects/${r.p.id}`) }} title={`Buka project ${r.invoice}`} data-aksi="buka-project"
      className={cx('ml-1.5 inline-flex shrink-0 items-center gap-0.5 rounded-md bg-indigo-50 px-1.5 font-bold text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-100', besar ? 'h-9 text-xs' : 'h-6 text-[11px]')}>
      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />Project
    </button>
  )
  const tombolSalin = (no) => (
    <button type="button" onClick={(e) => { e.stopPropagation(); salin(no) }} aria-label={`Salin ${no}`} title="Salin nomor" className="ml-1 inline-grid h-7 w-7 place-items-center rounded-md align-middle text-slate-400 hover:bg-slate-200 hover:text-ink"><Copy className="h-3.5 w-3.5" /></button>
  )
  const filter = [...(bolehTerbit ? [['menunggu', `Menunggu terbit ${menunggu.length}`]] : []), ['hari', `Hari ini ${n.hari}`], ['kemarin', `Kemarin ${n.kemarin}`], ['7', '7 hari'], ['semua', 'Semua']]

  const atas = (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-[var(--klasik-latar)] px-3 py-2 text-[12.5px]" data-klasik-filter>
      <span className="flex max-w-full shrink-0 gap-0.5 overflow-x-auto rounded-lg bg-white p-0.5 font-semibold ring-1 ring-slate-200" role="group" aria-label="Filter cepat">
        {filter.map(([k, l]) => <button key={k} type="button" onClick={() => setCepat(k)} aria-pressed={cepat === k}
          className={cx('h-8 whitespace-nowrap rounded-md px-2.5', cepat === k ? 'bg-ink text-white' : k === 'menunggu' && menunggu.length ? 'text-amber-700 hover:bg-amber-50' : 'text-ink-soft hover:bg-slate-50')}>{l}</button>)}
      </span>
      <label className={cx('relative block', hp ? 'w-full' : 'w-[260px] shrink-0')}>
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-mute" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nomor, invoice, nama…" aria-label="Cari register" className={cx('w-full rounded-lg border-0 bg-white pl-8 pr-2 ring-1 ring-slate-200 focus:ring-2 focus:ring-brand', hp ? 'h-11 text-[14px]' : 'h-9 text-[12.5px]')} />
      </label>
      <span className="ml-auto flex gap-2">
        {cepat === 'menunggu'
          ? rows.length > 1 && <Button size="sm" variant="dark" onClick={terbitkanSemua} disabled={!!sibuk} data-aksi="terbitkan-semua" className="whitespace-nowrap"><Check className="h-4 w-4" />{hp ? `Terbitkan ${rows.length}` : `Terbitkan semua (${rows.length})`}</Button>
          : <>
            <Button size="sm" variant="secondary" onClick={salinSemua} disabled={!terbit.length} data-aksi="salin-semua"><Copy className="h-4 w-4" />Salin</Button>
            <Button size="sm" variant="secondary" onClick={unduh} disabled={!terbit.length} data-aksi="unduh-excel"><Download className="h-4 w-4" />Excel</Button>
          </>}
      </span>
    </div>
  )

  const statusTerbit = (r) => (bolehTerbit
    ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800"><Check className="h-3 w-3" />Terbit</span>
    : <label className="inline-flex min-h-[32px] items-center gap-1.5 text-[11.5px] text-ink-mute"><input type="checkbox" checked={diinput.has(r.no)} onChange={() => tandai(r.no)} aria-label={`Sudah diinput ${r.no}`} className="h-4 w-4" />Diinput</label>)
  const jumlahSub = (r) => (r.s.data?.reg_numbers || []).filter(Boolean).length
  const tombolTerbit = (r, besar) => (
    <button type="button" onClick={(e) => { e.stopPropagation(); terbitkan(r.s) }} disabled={!!sibuk} data-aksi="terbitkan"
      className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-ink px-2.5 font-bold text-white disabled:opacity-50', besar ? 'h-10 text-[13px]' : 'h-7 text-[11.5px]')}>
      {sibuk === r.s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}Terbitkan{jumlahSub(r) > 1 ? ` ${jumlahSub(r)}` : ''}
    </button>
  )

  if (hp) return (
    <div className="min-w-0" data-halaman-register>
      {atas}
      <ul className="divide-y divide-slate-200 bg-white text-[12.5px]">
        {rows.map((r) => (
          <li key={r.key} className={cx('px-3 py-2.5', !r.terbit && 'bg-amber-50')} data-register-baris={r.terbit ? 'terbit' : 'menunggu'}>
            <div className="flex items-center"><span className="font-mono text-[15px] font-extrabold">{r.no}</span>{tombolSalin(r.no)}<span className="ml-auto">{tombolProject(r, true)}</span></div>
            <div className="mt-1 text-[13px] font-bold"><SelUbah nilai={r.jenis} boleh={bolehTerbit} label="jenis dokumen" onSimpan={(v) => ubahIsian(r, 'reg_types', v, 'Jenis dokumen')} /></div>
            <div className="mt-0.5 flex flex-wrap gap-x-1.5 text-[12px] text-ink-soft">
              <SelUbah nilai={r.nama} boleh={bolehTerbit} label="nama dalam dokumen" onSimpan={(v) => ubahIsian(r, 'reg_names', v, 'Nama')} /><span>·</span>
              <SelUbah nilai={r.tanggal} tampil={tglInggris(r.tanggal)} jenis="date" boleh={bolehTerbit} label="tanggal" onSimpan={(v) => ubahIsian(r, 'reg_dates', v, 'Tanggal')} />
            </div>
            <div className="mt-1.5 flex items-center gap-2"><InvoiceNo project={r.p} /><span className="text-[11px] text-ink-mute">{r.cabang}</span><span className="ml-auto">{r.terbit ? statusTerbit(r) : tombolTerbit(r, true)}</span></div>
          </li>
        ))}
        {!rows.length && <li className="px-4 py-10 text-center text-ink-mute">Belum ada nomor register pada pilihan ini.</li>}
      </ul>
      {lembar}
    </div>
  )

  // ---------- PC: sama seperti tab Project — bar saring di atas, tabel penuh ----------
  const th = 'px-3 py-2 font-semibold'
  return (
    <div className="min-w-0" data-halaman-register>
      {atas}
      <div className="overflow-x-auto bg-white">
        <table className="w-full text-[12.5px]" data-klasik-tabel data-tabel-register>
          <thead className="bg-slate-50 text-left text-[10.5px] uppercase tracking-wide text-ink-mute">
            <tr className="border-b border-slate-200"><th className={cx(th, 'w-12')}>No</th><th className={th}>No. Invoice</th><th className={th}>No. Registrasi</th><th className={th}>Tanggal</th><th className={th}>Jenis Dokumen</th><th className={th}>Nama dalam Dokumen</th><th className={th}>Cabang</th><th className={cx(th, 'text-center')}>{cepat === 'menunggu' ? '' : 'Diinput'}</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr key={r.key} data-klasik-aju="" className={cx('whitespace-nowrap align-middle', r.terbit && diinput.has(r.no) && 'text-ink-mute')} data-register-baris={r.terbit ? 'terbit' : 'menunggu'}>
                <td className="px-3 py-2 tabular-nums text-ink-mute">{i + 1}</td>
                {spanInv[i] > 0 && <td rowSpan={spanInv[i]} className="px-3 py-2 align-top"><span className="inline-flex items-center"><InvoiceNo project={r.p} /><IkonBaris id={r.p.id} inv={r.p.invoice_no} lihat={setLihat} folder={setFolder} /></span>{spanInv[i] > 1 && <span className="block text-[10.5px] text-ink-mute">{spanInv[i]} dokumen</span>}</td>}
                <td className="px-3 py-2"><span className="font-mono text-[13px] font-extrabold">{r.no}</span>{r.terbit && tombolSalin(r.no)}{tombolProject(r)}</td>
                <td className="px-3 py-2"><SelUbah nilai={r.tanggal} tampil={tglInggris(r.tanggal)} jenis="date" boleh={bolehTerbit} label="tanggal" onSimpan={(v) => ubahIsian(r, 'reg_dates', v, 'Tanggal')} /></td>
                <td className="max-w-[340px] truncate px-3 py-2"><SelUbah nilai={r.jenis} boleh={bolehTerbit} label="jenis dokumen" onSimpan={(v) => ubahIsian(r, 'reg_types', v, 'Jenis dokumen')} /></td>
                <td className="max-w-[240px] truncate px-3 py-2"><SelUbah nilai={r.nama} boleh={bolehTerbit} label="nama dalam dokumen" onSimpan={(v) => ubahIsian(r, 'reg_names', v, 'Nama')} /></td>
                <td className="px-3 py-2">{r.cabang}</td>
                {r.terbit
                  ? <td className="px-3 py-2 text-center"><input type="checkbox" checked={diinput.has(r.no)} onChange={() => tandai(r.no)} aria-label={`Sudah diinput ${r.no}`} className="h-4 w-4" /></td>
                  : spanSub[i] > 0 && <td rowSpan={spanSub[i]} className="px-3 py-2 text-center">{tombolTerbit(r)}</td>}
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="px-5 py-12 text-center text-ink-mute">{cepat === 'menunggu' ? 'Tidak ada nomor yang menunggu diterbitkan.' : 'Belum ada nomor terbit pada tanggal ini.'}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-ink-mute">
        <span>Menampilkan {rows.length} nomor · {cepat === 'menunggu' ? 'nomor sudah dipesan saat ACC — cek, lalu Terbitkan' : 'kolom sama dengan Sheet, salin / unduh lalu input ke sistem'}{bolehTerbit ? ' · klik tanggal, jenis atau nama untuk mengubah' : ''}</span>
        {cepat !== 'menunggu' && <span className="ml-auto">{terbit.filter((r) => diinput.has(r.no)).length} sudah diinput</span>}
      </div>
      {lembar}
    </div>
  )
}
