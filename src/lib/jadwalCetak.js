// ============================================================
//  CETAK / UNDUH JADWAL — A4 tegak, siap print (Simpan sebagai PDF).
//  Empat format, mengikuti lembar jadwal Pak (blok per minggu, Sen–Min):
//   orang · cabang · perusahaan · shift (cabang dengan baris shift, mis. Bali)
// ============================================================
import { BARIS_SHIFT, LIBUR, SKENARIO, shiftLabel } from '../config/shifts.js'
import { HARI, labelBulan, isiShift, yangLibur, isiHari, namaPendek, labelOrang, jamBaris, barisUntukCabang, stafCabang } from './jadwal.js'

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const WARNA = { admin_pagi: '#ffffff', admin_siang: '#fef9c3', pagi: '#e0f2fe', tengah: '#bfdbfe', siang: '#ede9fe', malam: '#e2e8f0', libur: '#e11d48', cuti: '#fcd34d' }
const SINGKAT = { admin_pagi: 'Adm Pagi', admin_siang: 'Adm Siang', pagi: 'Pagi', tengah: 'Tengah', siang: 'Siang', malam: 'Malam', libur: 'Libur' }

const CSS = `@page{size:A4 portrait;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#0e1540;margin:0}
.hal{page-break-after:always;display:flex;flex-direction:column;min-height:277mm}.hal:last-child{page-break-after:auto}
.kop{display:flex;border:1.5px solid #1e3a8a;border-radius:4px 4px 0 0;overflow:hidden}.kop .ki{width:42%;background:#1e3a8a;color:#fff;padding:7px 10px}.kop .ki b{font-size:12px;display:block}.kop .ki small{font-size:8px;opacity:.85}
.kop .ka{flex:1;background:#eef2ff;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800}
table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #94a3b8;font-size:8.5px;padding:2px;text-align:center;vertical-align:middle;overflow:hidden}
th{background:#1e3a8a;color:#fff;font-size:9px;padding:4px 2px}th.min{background:#be123c}.tg td{background:#1e293b;color:#fff;font-weight:700;font-size:8.5px}.tg td.luar{color:#64748b}
td.lb{font-weight:700;text-align:left;padding-left:4px;background:#f8fafc}td.lib{background:#e11d48;color:#fff;font-weight:700}td.cut{background:#fcd34d;font-weight:700}
.chip{display:block;border-radius:2px;font-weight:700;line-height:14px}.kaki{margin-top:auto;border-top:1px solid #cbd5e1;padding-top:4px;display:flex;justify-content:space-between;font-size:7.5px;color:#64748b}
.leg{display:flex;flex-wrap:wrap;gap:10px;font-size:8px;margin-top:6px}.leg b{padding:0 4px;border-radius:2px}
.kal td{height:118px;vertical-align:top;text-align:left;padding:4px}.kal .no{font-size:11px;font-weight:800}.kal .sh{margin-top:4px;border-radius:2px;padding:2px 4px;font-size:9.5px;font-weight:700}.kal small{display:block;font-size:8px;color:#475569;margin-top:2px}
.ring{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin:8px 0}.ring div{border-radius:4px;padding:5px;text-align:center}.ring b{font-size:16px;display:block}.ring span{font-size:8px}
.jam{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}.jam th{background:#1e3a8a;text-align:left}.jam td{font-size:7.5px;text-align:left}`

const kop = (kiri, sub, ym) => `<div class="kop"><div class="ki"><b>${esc(kiri)}</b><small>${esc(sub)}</small></div><div class="ka">${esc(labelBulan(ym))}</div></div>`
const kaki = (oleh) => `<div class="kaki"><span>247 Sworn Translator · dokumen internal</span><span>Diunduh ${esc(oleh)} · ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar', dateStyle: 'medium', timeStyle: 'short' })} WITA · ATLAS Alfa</span></div>`
const kepalaHari = (lebarPertama, judul) => `<tr>${lebarPertama ? `<th style="width:${lebarPertama}px">${judul}</th>` : ''}${HARI.map((h, i) => `<th class="${i === 6 ? 'min' : ''}">${h}</th>`).join('')}${lebarPertama === -1 ? '' : ''}</tr>`
const barisTanggal = (mg, kiri = true, kanan = false) => `<tr class="tg">${kiri ? '<td></td>' : ''}${mg.map((h) => `<td class="${h.bulanIni ? '' : 'luar'}">${h.tanggal}</td>`).join('')}${kanan ? '<td></td>' : ''}</tr>`

/** ① Per orang — kalender sebulan. */
function halOrang({ ym, minggu, peta, rows, user, nama, oleh }) {
  const milik = new Map(rows.filter((r) => r.user_id === user.id && String(r.tanggal).startsWith(ym)).map((r) => [r.tanggal, r]))
  const hit = {}; for (const r of milik.values()) hit[r.shift] = (hit[r.shift] || 0) + 1
  const kotak = ['pagi', 'tengah', 'siang', 'malam', LIBUR].filter((k) => hit[k] || k === LIBUR || k === 'pagi')
    .map((k) => `<div style="background:${WARNA[k]};color:${k === LIBUR ? '#fff' : '#0e1540'}"><b>${hit[k] || 0}</b><span>hari ${SINGKAT[k]}</span></div>`).join('')
  const adm = (hit.admin_pagi || 0) + (hit.admin_siang || 0)
  const kal = minggu.map((mg) => `<tr>${mg.map((h) => {
    const r = h.bulanIni ? milik.get(h.iso) : null
    if (!r) return `<td style="${h.bulanIni ? '' : 'background:#f8fafc'}"><div class="no" style="color:${h.bulanIni ? (h.akhirPekan && h.iso && new Date(`${h.iso}T00:00:00Z`).getUTCDay() === 0 ? '#e11d48' : '#0e1540') : '#cbd5e1'}">${h.tanggal}</div></td>`
    const j = jamBaris(peta, r)
    return `<td><div class="no">${h.tanggal}</div><div class="sh" style="background:${WARNA[r.shift] || '#fff'};color:${r.shift === LIBUR ? '#fff' : '#0e1540'}">${esc(shiftLabel(r.shift))}</div>${j ? `<small>${esc(r.jam_mulai ? `mulai ${r.jam_mulai}` : `${j.mulai}–${j.selesai}`)}</small><small style="color:#94a3b8">${esc(j.lokasi)}</small>` : ''}</td>`
  }).join('')}</tr>`).join('')
  return `<div class="hal">${kop(`Jadwal Saya · ${namaPendek(nama)}`, `${user.branch || ''}`, ym)}
<div class="ring">${kotak}${adm ? `<div style="background:#fef9c3"><b>${adm}</b><span>hari Admin</span></div>` : ''}</div>
<table class="kal"><tr>${HARI.map((h, i) => `<th class="${i === 6 ? 'min' : ''}">${h}</th>`).join('')}</tr>${kal}</table>
<div class="leg">Jam mengikuti aturan shift cabang (berubah bila ada yang libur). Perubahan jadwal dikabarkan lewat notifikasi ATLAS.</div>${kaki(oleh)}</div>`
}

/** ② Per cabang — baris = orang. */
function halCabang({ ym, minggu, peta, users, cabang, nameOf, oleh }) {
  const staf = stafCabang(users, cabang)
  const isi = (u, iso) => isiHari(peta, iso, cabang).find((r) => r.user_id === u.id)
  const blok = minggu.map((mg) => barisTanggal(mg) + staf.map((u) => `<tr><td class="lb">${esc(namaPendek(u.name))}</td>${mg.map((h) => {
    const r = h.bulanIni ? isi(u, h.iso) : null
    return r ? `<td style="padding:1px"><span class="chip" style="background:${WARNA[r.shift] || '#fff'};color:${r.shift === LIBUR ? '#fff' : '#0e1540'}">${esc(SINGKAT[r.shift] || r.shift)}</span></td>` : '<td></td>'
  }).join('')}</tr>`).join('')).join('')
  const rekap = staf.map((u) => {
    const mine = [...peta.values()].flat().filter((r) => r.user_id === u.id && r.cabang === cabang && String(r.tanggal).startsWith(ym))
    const masuk = mine.filter((r) => r.shift !== LIBUR).length; const lib = mine.length - masuk
    return `<tr><td class="lb">${esc(namaPendek(u.name))}</td><td>${masuk}</td><td>${lib}</td></tr>`
  }).join('')
  return `<div class="hal">${kop(`Cabang ${cabang} · Jadwal Kerja`, `${staf.length} orang`, ym)}
<table>${`<tr><th style="width:78px">Nama</th>${HARI.map((h, i) => `<th class="${i === 6 ? 'min' : ''}">${h}</th>`).join('')}</tr>`}${blok}</table>
<div style="display:flex;gap:14px;margin-top:8px;align-items:flex-start"><table style="width:220px"><tr><th>Rekap</th><th>Masuk</th><th>Libur</th></tr>${rekap}</table>
<div class="leg" style="flex-direction:column;gap:3px">${['pagi', 'tengah', 'siang', 'malam', 'admin_pagi', 'admin_siang', LIBUR].map((k) => `<span><b style="background:${WARNA[k]};color:${k === LIBUR ? '#fff' : '#0e1540'}">${SINGKAT[k]}</b></span>`).join('')}</div></div>${kaki(oleh)}</div>`
}

/** ③ Perusahaan — baris = cabang, isi = yang libur. */
function halPerusahaan({ ym, minggu, peta, cabangList, nameOf, oleh }) {
  const blok = minggu.map((mg) => barisTanggal(mg, false, true) + cabangList.map((cb) => `<tr>${mg.map((h) => {
    const l = h.bulanIni ? yangLibur(peta, h.iso, cb) : []
    return l.length ? `<td class="lib" style="font-size:7.5px;line-height:9px">${esc(l.map((r) => namaPendek(nameOf(r.user_id))).join(', '))}</td>` : '<td></td>'
  }).join('')}<td class="lb">${esc(cb)}</td></tr>`).join('')).join('')
  return `<div class="hal">${kop('Jadwal Libur Semua Cabang', '247 Sworn Translator · CS & Admin', ym)}
<table><tr>${HARI.map((h, i) => `<th class="${i === 6 ? 'min' : ''}">${h}</th>`).join('')}<th style="width:62px">Cabang</th></tr>${blok}</table>
<div class="leg"><span><b style="background:#e11d48;color:#fff">Nama</b> Libur</span><span style="color:#64748b">Kosong = semua masuk</span></div>${kaki(oleh)}</div>`
}

/** ④ Shift cabang (mis. Bali) — baris = shift, isi = nama; baris Libur merah. */
function halShift({ ym, minggu, peta, users, cabang, nameOf, oleh }) {
  const baris = barisUntukCabang(users, cabang)
  const blok = minggu.map((mg) => barisTanggal(mg) + baris.map((b) => `<tr><td class="lb" style="background:${WARNA[b.key]}">${esc(b.label)}</td>${mg.map((h) => {
    const isi = h.bulanIni ? isiShift(peta, h.iso, cabang, b.key) : []
    return `<td style="background:${WARNA[b.key]}">${isi.length ? esc(isi.map((r) => labelOrang(r, nameOf(r.user_id))).join(', ')) : (h.bulanIni ? '-' : '')}</td>`
  }).join('')}</tr>`).join('') + `<tr><td class="lb lib">Libur</td>${mg.map((h) => `<td class="lib" style="font-size:7.5px">${h.bulanIni ? esc(yangLibur(peta, h.iso, cabang).map((r) => namaPendek(nameOf(r.user_id))).join(', ')) : ''}</td>`).join('')}</tr>`).join('')
  const jam = SKENARIO.map((s) => `<table><tr><th colspan="4">${esc(s.label)}</th></tr><tr><td><b>Shift</b></td><td><b>Jam</b></td><td><b>Istirahat</b></td><td><b>Lokasi</b></td></tr>${Object.entries(s.jam).map(([k, j]) => `<tr><td>${esc(shiftLabel(k))}</td><td>${j.mulai}–${j.selesai}</td><td>${esc(j.istirahat)}</td><td>${esc(j.lokasi)}</td></tr>`).join('')}</table>`).join('')
  return `<div class="hal">${kop(`Tim ${cabang} · Jadwal Shift`, 'CS & Admin', ym)}
<table><tr><th style="width:66px">Shift</th>${HARI.map((h, i) => `<th class="${i === 6 ? 'min' : ''}">${h}</th>`).join('')}</tr>${blok}</table>
<div class="jam">${jam}</div>${kaki(oleh)}</div>`
}

/** Susun HTML lengkap untuk dicetak. jenis: 'orang' | 'cabang' | 'perusahaan' | 'shift' */
export function htmlCetak(jenis, o) {
  const isi = jenis === 'orang' ? halOrang(o) : jenis === 'cabang' ? halCabang(o) : jenis === 'perusahaan' ? halPerusahaan(o) : halShift(o)
  return `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><title>${esc(o.judul || 'Jadwal')}</title><style>${CSS}</style></head><body>${isi}</body></html>`
}

/** Buka dialog cetak (pilih "Simpan sebagai PDF" untuk mengunduh). */
export function cetakHtml(html) {
  const f = document.createElement('iframe')
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(f)
  const doc = f.contentDocument; doc.open(); doc.write(html); doc.close()
  setTimeout(() => {
    try { f.contentWindow.focus(); f.contentWindow.print() } catch {
      // cadangan: unduh sebagai berkas HTML yang bisa dibuka & dicetak
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' })); a.download = 'jadwal.html'; a.click()
    }
    setTimeout(() => f.remove(), 60000)
  }, 350)
}
