// ============================================================
//  LAPORAN OTORISASI — rekap per bulan per otorisator (pengganti file
//  "Otorisasi_247_2026.xlsx"). Data diambil dari tahap Otorisasi yang
//  sudah di-ACC (authorized_by / authorized_at di sub project).
//  Unduh: PDF (jsPDF) & Excel (ExcelJS) — dimuat hanya saat diunduh.
// ============================================================
export const BULAN_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const fmtWita = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' })
export const kunciBulan = (iso) => (iso ? fmtWita.format(new Date(iso)).slice(0, 7) : '')
export const labelBulan = (ym) => { const [y, m] = String(ym).split('-'); return `${BULAN_ID[Number(m) - 1] || ''} ${y}` }
export const geserBulan = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}` }
export const tglPanjang = (iso) => { const d = fmtWita.format(new Date(iso)); const [y, m, dd] = d.split('-'); return `${Number(dd)} ${BULAN_ID[Number(m) - 1]} ${y}` }
const bersih = (s) => String(s || '').replace(/\s*\(.*\)\s*$/, '').trim()
const angka = (n) => Number(n || 0).toLocaleString('id-ID')
export const rupiah = (n) => `Rp ${Math.round(Number(n || 0)).toLocaleString('id-ID')}`

/** Hanya 4 arah tersumpah: Indonesia ⇄ Inggris, Indonesia ⇄ Belanda. */
export const ARAH_OTO = ['Indonesia → Inggris', 'Inggris → Indonesia', 'Indonesia → Belanda', 'Belanda → Indonesia']
export const arahOto = (x) => { const a = `${x.lang_from || ''} → ${x.lang_to || ''}`; return ARAH_OTO.includes(a) ? a : null }
const KODE_ARAH = { 'Indonesia → Inggris': 'ID-EN', 'Inggris → Indonesia': 'EN-ID', 'Indonesia → Belanda': 'ID-NL', 'Belanda → Indonesia': 'NL-ID' }
export const grupBahasa = (x) => (/belanda/i.test(`${x.lang_from} ${x.lang_to}`) ? 'Belanda' : 'Inggris')
const TIPE = (pr) => (/sameday/i.test(pr || '') ? 'Sameday' : /super|ekspres|speed|express/i.test(pr || '') ? 'Speed' : 'Reguler/Normal')
const hlmSub = (x) => (x.docs?.length ? x.docs.reduce((a, d) => a + (Number(d.pages) || 0), 0) : Number(x.pages) || 0) || 1

/** Semua baris otorisasi pada bulan `ym` (YYYY-MM), urut tanggal. */
export function barisOtorisasi(projects, ym, nameOf = (id) => id) {
  const out = []
  for (const p of projects || []) {
    if (p.cancelled || p.demo_perf) continue
    for (const x of p.sub_projects || []) {
      const at = x.data?.authorized_at
      if (x.cancelled || !at || !x.data?.authorized_by || kunciBulan(at) !== ym || !arahOto(x)) continue
      out.push({
        key: `${p.id}:${x.id}`, projectId: p.id, oto: x.data.authorized_by, otoNama: bersih(x.data.authorized_name || nameOf(x.data.authorized_by)),
        at, tgl: tglPanjang(at), inv: String(p.invoice_no || '').replace(/^INV-/i, ''), klien: p.customer?.name || '', dok: x.title || '',
        bhs: `${x.lang_from} - ${x.lang_to}`, arah: arahOto(x), grup: grupBahasa(x), tipe: TIPE(p.about?.priority), hlm: hlmSub(x),
      })
    }
  }
  return out.sort((a, b) => (a.at < b.at ? -1 : 1))
}

/** Ringkas per otorisator + kelompok bahasa. */
export function rekap(rows) {
  const m = new Map()
  for (const r of rows) {
    const k = `${r.oto}|${r.grup}`
    if (!m.has(k)) m.set(k, { k, oto: r.oto, nama: r.otoNama, grup: r.grup, rows: [], dok: 0, hlm: 0, cepat: 0 })
    const g = m.get(k); g.rows.push(r); g.dok += 1; g.hlm += r.hlm; if (r.tipe !== 'Reguler/Normal') g.cepat += r.hlm
  }
  return [...m.values()].sort((a, b) => a.nama.localeCompare(b.nama) || (a.grup === 'Inggris' ? -1 : 1))
}

const NAVY = [14, 21, 64]
const namaFile = (judul, ym) => `Laporan-Otorisasi-${judul.replace(/[^\w]+/g, '-')}-${labelBulan(ym).replace(' ', '-')}`

/** PDF berdesain: kepala navy, kotak ringkasan, tabel per kelompok bahasa. `grup` = daftar hasil rekap (bisa beberapa otorisator). */
export async function unduhPdf(grup, ym, tarifOf) {
  const { jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const perOrang = [...new Set(grup.map((g) => g.oto))].map((id) => grup.filter((g) => g.oto === id))
  perOrang.forEach((gs, idx) => {
    if (idx) doc.addPage()
    const nama = gs[0].nama
    doc.setFillColor(...NAVY); doc.rect(14, 12, W - 28, 24, 'F')
    doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text('LAPORAN OTORISASI', 18, 18.5)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(203, 213, 225); doc.text('247 Sworn Translator · ATLAS', W - 18, 18.5, { align: 'right' })
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text(nama, 18, 30)
    doc.setFontSize(12); doc.text(labelBulan(ym), W - 18, 30, { align: 'right' })
    const dok = gs.reduce((a, g) => a + g.dok, 0), hlm = gs.reduce((a, g) => a + g.hlm, 0)
    const biaya = gs.reduce((a, g) => a + tarifOf(g) * g.hlm, 0)
    const kotak = [['Total dokumen', angka(dok), ''], ['Total halaman', angka(hlm), ''], ...gs.map((g) => [g.grup, `${angka(g.hlm)} hlm`, `${g.dok} dokumen`]), ['Biaya', biaya ? rupiah(biaya) : 'Rp —', biaya ? '' : 'tarif belum diisi']]
    const lw = (W - 28) / kotak.length
    kotak.forEach(([l, v, s], i) => {
      const x = 14 + i * lw
      doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240); doc.rect(x, 40, lw - 2, 19, 'FD')
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(100, 116, 139); doc.text(l, x + 3, 45)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...NAVY); doc.text(v, x + 3, 52)
      if (s) { doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(148, 163, 184); doc.text(s, x + 3, 56.5) }
    })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(100, 116, 139)
    doc.text(`Terjemahan tersumpah Indonesia ⇄ Inggris / Belanda · Periode ${labelBulan(ym)} · Dibuat ${new Date().toLocaleDateString('id-ID')} dari ATLAS`.replace('⇄', '-'), 14, 64)
    let y = 70
    gs.forEach((g) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...NAVY); doc.text(g.grup, 14, y)
      doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139); doc.text(`— ${g.dok} dokumen · ${g.hlm} halaman${tarifOf(g) ? ` · ${rupiah(tarifOf(g))}/hlm = ${rupiah(tarifOf(g) * g.hlm)}` : ''}`, 14 + doc.getTextWidth(g.grup) + 2, y)
      autoTable(doc, {
        startY: y + 2, margin: { left: 14, right: 14 },
        head: [['No', 'Tanggal', 'No Invoice', 'Nama Klien', 'Dokumen', 'Arah', 'Hlm']],
        body: g.rows.map((r, i) => [i + 1, r.tgl, r.inv, r.klien, r.dok, KODE_ARAH[r.arah] || r.bhs, r.hlm]),
        foot: [['', '', '', '', '', 'Total', g.hlm]], showFoot: 'lastPage', showHead: 'everyPage',
        styles: { fontSize: 7.5, cellPadding: 1.6, lineColor: [226, 232, 240], lineWidth: { bottom: 0.2 } },
        headStyles: { fillColor: [238, 242, 247], textColor: [100, 116, 139], fontStyle: 'bold', fontSize: 7 },
        footStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [246, 248, 252] },
        columnStyles: { 0: { halign: 'center', cellWidth: 8 }, 1: { cellWidth: 27 }, 2: { font: 'courier', fontStyle: 'bold', cellWidth: 27 }, 3: { cellWidth: 40 }, 5: { cellWidth: 13 }, 6: { halign: 'right', cellWidth: 10 } },
        didDrawPage: () => { doc.setFontSize(7); doc.setTextColor(148, 163, 184); doc.text(`Laporan Otorisasi · ${nama} · ${labelBulan(ym)}`, 14, 290); doc.text(`Halaman ${doc.getNumberOfPages()}`, W - 14, 290, { align: 'right' }) },
      })
      y = doc.lastAutoTable.finalY + 9
    })
  })
  doc.save(`${namaFile(perOrang.length > 1 ? 'Semua' : perOrang[0][0].nama, ym)}.pdf`)
}

/** Excel berdesain: sheet Ringkasan + satu sheet per otorisator per bahasa (kolom sama dengan file lama). */
export async function unduhExcel(grup, ym, tarifOf) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook(); wb.creator = 'ATLAS'
  const navy = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E1540' } }
  const abu = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
  const kepala = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2F7' } }
  const zebra = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6F8FC' } }
  const garis = { style: 'thin', color: { argb: 'FFE2E8F0' } }; const kotak = { top: garis, left: garis, bottom: garis, right: garis }
  const ring = wb.addWorksheet('Ringkasan')
  ring.mergeCells('A1:F1'); ring.getCell('A1').value = `Laporan Otorisasi — ${labelBulan(ym)}`
  Object.assign(ring.getCell('A1'), { font: { bold: true, size: 16, color: { argb: 'FFFFFFFF' } }, fill: navy, alignment: { vertical: 'middle', indent: 1 } }); ring.getRow(1).height = 32
  ring.getCell('A2').value = `247 Sworn Translator · dibuat dari ATLAS ${new Date().toLocaleDateString('id-ID')}`; ring.getCell('A2').font = { size: 9, color: { argb: 'FF64748B' } }
  ring.addRow([]); const h = ring.addRow(['Otorisator', 'Bahasa', 'Dokumen', 'Halaman', 'Tarif / hlm', 'Biaya'])
  h.eachCell((c) => { c.font = { bold: true, color: { argb: 'FF3F4A73' } }; c.fill = kepala; c.border = kotak })
  grup.forEach((g) => {
    const r = ring.addRow([g.nama, g.grup, g.dok, g.hlm, tarifOf(g) || null, null])
    r.getCell(6).value = { formula: `IF(ISNUMBER(E${r.number}),E${r.number}*D${r.number},"")` }
    r.getCell(5).numFmt = r.getCell(6).numFmt = '"Rp "#,##0'
    r.eachCell({ includeEmpty: true }, (c) => { c.border = kotak; c.fill = abu })
  })
  const t = ring.addRow(['Total', '', grup.reduce((a, g) => a + g.dok, 0), grup.reduce((a, g) => a + g.hlm, 0), '', null])
  t.getCell(6).value = { formula: `SUM(F5:F${t.number - 1})` }; t.getCell(6).numFmt = '"Rp "#,##0'
  t.eachCell({ includeEmpty: true }, (c) => { c.fill = navy; c.font = { bold: true, color: { argb: 'FFFFFFFF' } } })
  ring.columns = [{ width: 24 }, { width: 12 }, { width: 11 }, { width: 11 }, { width: 14 }, { width: 16 }]
  const bln3 = labelBulan(ym).split(' ')
  grup.forEach((g) => {
    const judul = `Otorisasi ${g.grup === 'Inggris' ? '' : `${g.grup} `}${g.nama} ${labelBulan(ym)}`
    const ws = wb.addWorksheet(`Oto ${g.grup === 'Inggris' ? '' : `${g.grup} `}${g.nama} ${bln3[0].slice(0, 3)} ${bln3[1].slice(2)}`.slice(0, 31))
    ws.mergeCells('A1:G1'); ws.getCell('A1').value = judul
    Object.assign(ws.getCell('A1'), { font: { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }, fill: navy, alignment: { vertical: 'middle', indent: 1 } }); ws.getRow(1).height = 26
    const hh = ws.addRow(['No', 'Tanggal', 'No Invoice', 'Nama Klien', 'Dokumen', 'Bahasa/Product', 'Jml Halaman'])
    hh.eachCell((c) => { c.font = { bold: true, color: { argb: 'FF3F4A73' } }; c.fill = kepala; c.border = kotak })
    g.rows.forEach((r, i) => { const row = ws.addRow([i + 1, r.tgl, r.inv, r.klien, r.dok, r.bhs, r.hlm]); row.eachCell({ includeEmpty: true }, (c) => { c.border = kotak; if (i % 2) c.fill = zebra }) })
    const tt = ws.addRow(['Total', '', '', '', '', '', { formula: `SUM(G3:G${g.rows.length + 2})` }])
    tt.eachCell({ includeEmpty: true }, (c) => { c.fill = navy; c.font = { bold: true, color: { argb: 'FFFFFFFF' } } })
    ws.columns = [{ width: 6 }, { width: 20 }, { width: 17 }, { width: 30 }, { width: 34 }, { width: 22 }, { width: 13 }]
    ws.views = [{ state: 'frozen', ySplit: 2 }]
  })
  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a'); a.href = url; a.download = `${namaFile([...new Set(grup.map((g) => g.oto))].length > 1 ? 'Semua' : grup[0].nama, ym)}.xlsx`; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
