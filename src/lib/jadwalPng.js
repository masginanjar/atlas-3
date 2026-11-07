// ============================================================
//  UNDUH JADWAL SEBAGAI PNG UKURAN A4
//
//  Dibuat sebagai SVG lalu digambar ke canvas, jadi TIDAK perlu
//  pustaka tambahan dan tetap tajam saat dicetak.
//  A4 potret pada 150 dpi = 1240 x 1754 piksel.
// ============================================================

export const A4 = { w: 1240, h: 1754, margin: 40 }

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Potong teks yang terlalu panjang agar tidak keluar dari selnya. */
const potong = (s, maks) => {
  const t = String(s ?? '')
  return t.length <= maks ? t : `${t.slice(0, Math.max(1, maks - 1))}…`
}

/**
 * Bungkus teks jadi beberapa baris berdasarkan perkiraan lebar huruf.
 * Perkiraan ini cukup untuk nama orang; bukan pengukuran font sungguhan.
 */
function bungkus(teks, lebarPx, ukuran, maksBaris) {
  const perHuruf = ukuran * 0.52
  const muat = Math.max(4, Math.floor(lebarPx / perHuruf))
  const kata = String(teks ?? '').split(/\s+/).filter(Boolean)
  const baris = []
  let kini = ''
  for (const k of kata) {
    const coba = kini ? `${kini} ${k}` : k
    if (coba.length <= muat) { kini = coba; continue }
    if (kini) baris.push(kini)
    kini = k
    if (baris.length >= maksBaris) break
  }
  if (kini && baris.length < maksBaris) baris.push(kini)
  if (baris.length === maksBaris && kata.join(' ').length > baris.join(' ').length) {
    baris[maksBaris - 1] = potong(baris[maksBaris - 1], muat)
  }
  return baris.length ? baris : ['']
}

const teks = (x, y, s, { ukuran = 12, warna = '#111827', tebal = false, anchor = 'start' } = {}) =>
  `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${ukuran}"`
  + ` fill="${warna}"${tebal ? ' font-weight="700"' : ''} text-anchor="${anchor}">${esc(s)}</text>`

const kotak = (x, y, w, h, isi, garis = '#cbd5e1') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${isi}" stroke="${garis}" stroke-width="1"/>`

/** Kepala halaman: judul besar + sub judul, seperti lembar aslinya. */
function kepala(judul, sub, lebar, aksen) {
  const h = 64
  return kotak(A4.margin, A4.margin, lebar, h, aksen, aksen)
    + teks(A4.margin + 16, A4.margin + 27, sub, { ukuran: 13, warna: '#ffffff', tebal: true })
    + teks(A4.margin + 16, A4.margin + 48, judul, { ukuran: 22, warna: '#ffffff', tebal: true })
}

/**
 * Jadwal SATU CABANG: baris = shift, kolom = Senin..Minggu, minggu ditumpuk.
 * `minggu` = hasil mingguBulan(); `sel(iso, shiftKey)` mengembalikan teks sel.
 */
function tataCabang({ judul, sub, minggu, baris, sel, libur, aksen = '#1d4ed8', hariPendek, padBaris = 0 }) {
  const lebar = A4.w - A4.margin * 2
  const kolLabel = 110
  const kolHari = (lebar - kolLabel) / 7
  let y = A4.margin + 64 + 14
  let out = kepala(judul, sub, lebar, aksen)

  const tinggiBaris = 22
  for (const mg of minggu) {
    // baris tanggal
    out += kotak(A4.margin, y, kolLabel, tinggiBaris, '#f1f5f9')
    mg.forEach((h, i) => {
      const x = A4.margin + kolLabel + i * kolHari
      out += kotak(x, y, kolHari, tinggiBaris, h.bulanIni ? '#e2e8f0' : '#f8fafc')
      out += teks(x + kolHari / 2, y + 15, h.tanggal, {
        ukuran: 11, tebal: true, anchor: 'middle',
        warna: h.bulanIni ? '#0f172a' : '#94a3b8',
      })
    })
    y += tinggiBaris

    // satu baris per shift
    for (const b of baris) {
      const isi = mg.map((h) => sel(h.iso, b.key))
      const maksBaris = Math.max(1, ...isi.map((t) => bungkus(t, kolHari - 8, 10, 3).length))
      const tinggi = Math.max(20, 8 + maksBaris * 12) + padBaris

      out += kotak(A4.margin, y, kolLabel, tinggi, '#f8fafc')
      out += teks(A4.margin + 8, y + 14, b.label, { ukuran: 11, tebal: true, warna: '#334155' })

      mg.forEach((h, i) => {
        const x = A4.margin + kolLabel + i * kolHari
        out += kotak(x, y, kolHari, tinggi, h.akhirPekan ? '#fff7ed' : '#ffffff')
        bungkus(isi[i] || '-', kolHari - 8, 10, 3).forEach((t, k) => {
          out += teks(x + kolHari / 2, y + 14 + k * 12, t, {
            ukuran: 10, anchor: 'middle', warna: isi[i] ? '#0f172a' : '#cbd5e1',
          })
        })
      })
      y += tinggi
    }

    // baris libur
    const isiLibur = mg.map((h) => libur(h.iso))
    const maksL = Math.max(1, ...isiLibur.map((t) => bungkus(t, kolHari - 8, 10, 3).length))
    const tL = Math.max(20, 8 + maksL * 12) + padBaris
    out += kotak(A4.margin, y, kolLabel, tL, '#fee2e2')
    out += teks(A4.margin + 8, y + 14, 'Libur', { ukuran: 11, tebal: true, warna: '#991b1b' })
    mg.forEach((h, i) => {
      const x = A4.margin + kolLabel + i * kolHari
      out += kotak(x, y, kolHari, tL, '#fef2f2')
      bungkus(isiLibur[i] || '', kolHari - 8, 10, 3).forEach((t, k) => {
        out += teks(x + kolHari / 2, y + 14 + k * 12, t, { ukuran: 10, anchor: 'middle', warna: '#b91c1c' })
      })
    })
    y += tL + 8
    if (y > A4.h - 120) break // halaman penuh
  }

  // nama hari di bawah, supaya kolom tetap terbaca
  const yh = Math.min(y + 4, A4.h - A4.margin - 40)
  hariPendek.forEach((n, i) => {
    out += teks(A4.margin + kolLabel + i * kolHari + kolHari / 2, yh + 12, n,
      { ukuran: 10, anchor: 'middle', warna: '#64748b', tebal: true })
  })
  return { svg: out, tinggi: y, jumlahBaris: minggu.length * (baris.length + 1) }
}

/**
 * Jadwal satu cabang. Ditata dua kali: pertama untuk mengukur, kedua untuk
 * meratakan sisa ruang ke setiap baris supaya kertas A4 terisi penuh.
 */
export function svgJadwalCabang(opsi) {
  const ukur = tataCabang(opsi)
  const sisa = (A4.h - A4.margin - 40) - ukur.tinggi
  const pad = sisa > 0 && ukur.jumlahBaris ? Math.min(14, sisa / ukur.jumlahBaris) : 0
  return (pad > 1 ? tataCabang({ ...opsi, padBaris: pad }) : ukur).svg
}

/** Jadwal SATU PERUSAHAAN: baris = cabang, isinya siapa yang libur. */
function tataPerusahaan({ judul, sub, minggu, cabangList, liburSel, aksen = '#166534', hariPendek, padBaris = 0 }) {
  const lebar = A4.w - A4.margin * 2
  const kolLabel = 96
  const kolHari = (lebar - kolLabel) / 7
  let y = A4.margin + 64 + 14
  let out = kepala(judul, sub, lebar, aksen)

  for (const mg of minggu) {
    out += kotak(A4.margin, y, kolLabel, 20, '#f1f5f9')
    out += teks(A4.margin + 8, y + 14, 'Cabang', { ukuran: 10, tebal: true, warna: '#334155' })
    mg.forEach((h, i) => {
      const x = A4.margin + kolLabel + i * kolHari
      out += kotak(x, y, kolHari, 20, h.bulanIni ? '#e2e8f0' : '#f8fafc')
      out += teks(x + kolHari / 2, y + 14, h.tanggal,
        { ukuran: 11, tebal: true, anchor: 'middle', warna: h.bulanIni ? '#0f172a' : '#94a3b8' })
    })
    y += 20

    for (const cabang of cabangList) {
      const isi = mg.map((h) => liburSel(h.iso, cabang))
      const maks = Math.max(1, ...isi.map((t) => bungkus(t, kolHari - 6, 9, 2).length))
      const tinggi = Math.max(18, 6 + maks * 11) + padBaris
      out += kotak(A4.margin, y, kolLabel, tinggi, '#f8fafc')
      out += teks(A4.margin + 8, y + 12, potong(cabang, 12), { ukuran: 10, tebal: true, warna: '#334155' })
      mg.forEach((h, i) => {
        const x = A4.margin + kolLabel + i * kolHari
        const ada = !!isi[i]
        out += kotak(x, y, kolHari, tinggi, ada ? '#fef2f2' : (h.akhirPekan ? '#fff7ed' : '#ffffff'))
        bungkus(isi[i] || '', kolHari - 6, 9, 2).forEach((t, k) => {
          out += teks(x + kolHari / 2, y + 12 + k * 11, t, { ukuran: 9, anchor: 'middle', warna: '#b91c1c' })
        })
      })
      y += tinggi
    }
    y += 8
    if (y > A4.h - 100) break
  }

  const yh = Math.min(y + 4, A4.h - A4.margin - 40)
  hariPendek.forEach((n, i) => {
    out += teks(A4.margin + kolLabel + i * kolHari + kolHari / 2, yh + 12, n,
      { ukuran: 10, anchor: 'middle', warna: '#64748b', tebal: true })
  })
  return { svg: out, tinggi: y, jumlahBaris: minggu.length * cabangList.length }
}

export function svgJadwalPerusahaan(opsi) {
  const ukur = tataPerusahaan(opsi)
  const sisa = (A4.h - A4.margin - 40) - ukur.tinggi
  const pad = sisa > 0 && ukur.jumlahBaris ? Math.min(12, sisa / ukur.jumlahBaris) : 0
  return (pad > 1 ? tataPerusahaan({ ...opsi, padBaris: pad }) : ukur).svg
}

/** Bungkus potongan SVG jadi dokumen SVG utuh seukuran A4. */
export const dokumenSvg = (isi) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${A4.w}" height="${A4.h}" viewBox="0 0 ${A4.w} ${A4.h}">`
  + `<rect width="${A4.w}" height="${A4.h}" fill="#ffffff"/>${isi}</svg>`

/**
 * Ubah SVG jadi berkas PNG dan unduh.
 * Digambar ke canvas 2x supaya tetap tajam saat dicetak di kertas A4.
 */
export async function unduhPng(svg, namaFile, skala = 2) {
  const blobSvg = new Blob([dokumenSvg(svg)], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blobSvg)
  try {
    const img = new Image()
    img.decoding = 'sync'
    await new Promise((res, rej) => {
      img.onload = res
      img.onerror = () => rej(new Error('Gagal menggambar jadwal'))
      img.src = url
    })
    const c = document.createElement('canvas')
    c.width = A4.w * skala
    c.height = A4.h * skala
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(img, 0, 0, c.width, c.height)
    const blob = await new Promise((res) => c.toBlob(res, 'image/png'))
    if (!blob) throw new Error('Gagal membuat PNG')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = namaFile.endsWith('.png') ? namaFile : `${namaFile}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 10000)
    return true
  } finally {
    URL.revokeObjectURL(url)
  }
}
