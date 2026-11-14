// Pembaca file impor (Excel .xlsx / CSV) untuk Draft & Impor Massal dan Saldo & Mutasi.
export async function bacaFile(file) {
  const nama = String(file.name || '').toLowerCase()
  if (nama.endsWith('.csv') || nama.endsWith('.txt')) return bacaCsv(await file.text())
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())
  const ws = wb.worksheets[0]
  if (!ws) return { kolom: [], baris: [] }
  const semua = []
  ws.eachRow({ includeEmpty: false }, (row) => semua.push(row.values.slice(1).map((v) => (v && typeof v === 'object' ? (v.text ?? v.result ?? (v instanceof Date ? v.toISOString() : JSON.stringify(v))) : v ?? ''))))
  return keObjek(semua)
}
export function bacaCsv(teks) {
  const pemisah = (teks.split('\n')[0].match(/;/g) || []).length > (teks.split('\n')[0].match(/,/g) || []).length ? ';' : ','
  const out = []; let row = []; let sel = ''; let kutip = false
  for (let i = 0; i < teks.length; i++) {
    const c = teks[i]
    if (kutip) { if (c === '"' && teks[i + 1] === '"') { sel += '"'; i++ } else if (c === '"') kutip = false; else sel += c }
    else if (c === '"') kutip = true
    else if (c === pemisah) { row.push(sel); sel = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && teks[i + 1] === '\n') i++; row.push(sel); sel = ''; if (row.some((x) => String(x).trim())) out.push(row); row = [] }
    else sel += c
  }
  if (sel || row.length) { row.push(sel); if (row.some((x) => String(x).trim())) out.push(row) }
  return keObjek(out)
}
function keObjek(rows) {
  if (!rows.length) return { kolom: [], baris: [] }
  const kolom = rows[0].map((h, i) => String(h || `Kolom ${i + 1}`).trim())
  const baris = rows.slice(1).map((r) => Object.fromEntries(kolom.map((k, i) => [k, String(r[i] ?? '').trim()])))
  return { kolom, baris }
}
/** Tebak kolom file berdasar kata kunci (pengguna tetap bisa mengubah pemetaan). */
export function tebakPeta(kolom, bidang) {
  const peta = {}
  for (const [key, , kata] of bidang) {
    const k = kolom.find((c) => kata.some((w) => c.toLowerCase().replace(/[^a-z0-9]/g, '').includes(w)))
    if (k) peta[key] = k
  }
  return peta
}
export const angka = (s) => { const t = String(s ?? '').replace(/[^\d,.-]/g, ''); if (!t) return 0; const n = Number(t.includes(',') && !t.includes('.') ? t.replace(',', '.') : t.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0 }
export function unduhCsv(nama, kolom, contoh = []) {
  const esc = (v) => (/[",;\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
  const teks = [kolom, ...contoh].map((r) => r.map(esc).join(',')).join('\n')
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + teks], { type: 'text/csv' })); a.download = nama; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
