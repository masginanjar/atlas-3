// ============================================================
//  UPLOAD BUKTI TRANSFER MASSAL — analisis screenshot internet banking
//  Murni JS (tanpa DOM): gambar = { width, height, data: RGBA Uint8ClampedArray }.
//  OCR disuntikkan dari luar: ocr(gambar, { angka }) → Promise<string>.
//  Langkah: cari header tabel → kolom → baris (pita latar) → baca sel → cocokkan.
// ============================================================

// ---------- util piksel ----------
const px = (im, x, y) => { const i = (y * im.width + x) * 4; return [im.data[i], im.data[i + 1], im.data[i + 2]] }
const abu = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b
const jenuh = ([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b)
/** Warna "latar header": gelap atau berwarna kuat (biru BCA, hijau Mandiri, dll). */
const latarKuat = (c) => abu(c) < 170 && (jenuh(c) > 40 || abu(c) < 90)

/** Potong gambar (tanpa DOM). */
export function potong(im, x0, y0, x1, y1) {
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(im.width, Math.ceil(x1)); y1 = Math.min(im.height, Math.ceil(y1))
  const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0); const out = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) out.set(im.data.subarray(((y0 + y) * im.width + x0) * 4, ((y0 + y) * im.width + x0 + w) * 4), y * w * 4)
  return { width: w, height: h, data: out }
}

/** Siapkan sel untuk OCR: abu-abu, latar gelap dibalik jadi terang, diperbesar (teks ±40px), diberi tepi putih. */
export function siapOcr(im, skala) {
  const n = im.width * im.height; const g = new Float32Array(n); let sum = 0
  for (let i = 0; i < n; i++) { const v = abu([im.data[i * 4], im.data[i * 4 + 1], im.data[i * 4 + 2]]); g[i] = v; sum += v }
  const balik = sum / n < 140
  // Ambang Otsu → hitam-putih tegas (header berwarna & latar abu jadi bersih)
  const hist = new Array(256).fill(0); for (let i = 0; i < n; i++) hist[Math.round(g[i])]++
  let wB = 0, sB = 0, best = 0, ambang = 128; const sAll = hist.reduce((a, c, i) => a + c * i, 0)
  for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = n - wB; if (!wF) break; sB += t * hist[t]; const mB = sB / wB, mF = (sAll - sB) / wF; const v = wB * wF * (mB - mF) ** 2; if (v > best) { best = v; ambang = t } }
  const kontras = best / (n * n) > 100
  for (let i = 0; i < n; i++) g[i] = kontras ? (g[i] > ambang ? 255 : 0) : g[i]
  const s = skala || 3, pad = 12
  const W = im.width * s + pad * 2, H = im.height * s + pad * 2; const out = new Uint8ClampedArray(W * H * 4).fill(255)
  for (let y = 0; y < im.height * s; y++) for (let x = 0; x < im.width * s; x++) {
    let v = g[Math.floor(y / s) * im.width + Math.floor(x / s)]; if (balik) v = 255 - v
    const o = ((y + pad) * W + x + pad) * 4; out[o] = out[o + 1] = out[o + 2] = v
  }
  return { width: W, height: H, data: out }
}

// ---------- struktur tabel ----------
/** Cari pita header berwarna: baris-baris y yang ≥45% pikselnya berlatar kuat. */
export function cariHeader(im) {
  const step = Math.max(1, Math.floor(im.width / 400)); const kuat = []
  for (let y = 0; y < im.height; y++) {
    let k = 0, t = 0; for (let x = 0; x < im.width; x += step) { t++; if (latarKuat(px(im, x, y))) k++ }
    kuat.push(k / t)
  }
  let best = null
  for (let y = 0; y < im.height; y++) {
    if (kuat[y] < 0.45) continue
    let y1 = y; while (y1 + 1 < im.height && kuat[y1 + 1] >= 0.45) y1++
    const h = y1 - y + 1
    if (h >= 14 && (!best || h > best.y1 - best.y0)) best = { y0: y, y1: y1 + 1 }
    y = y1
  }
  if (!best) return null
  // Rentang x tabel = piksel kuat di tengah pita
  const ym = Math.floor((best.y0 + best.y1) / 2); let x0 = 0, x1 = im.width - 1
  while (x0 < im.width && !latarKuat(px(im, x0, ym))) x0++
  while (x1 > x0 && !latarKuat(px(im, x1, ym))) x1--
  return { ...best, x0, x1: x1 + 1 }
}

/** Kolom = celah terang vertikal di dalam pita header. */
export function cariKolom(im, hd) {
  const terang = []
  for (let x = hd.x0; x < hd.x1; x++) {
    let k = 0, t = 0; for (let y = hd.y0 + 2; y < hd.y1 - 2; y++) { t++; if (!latarKuat(px(im, x, y)) && abu(px(im, x, y)) > 180) k++ }
    terang.push(k / Math.max(1, t) > 0.85)
  }
  const batas = [hd.x0]
  for (let i = 0; i < terang.length; i++) {
    if (!terang[i]) continue
    let j = i; while (j + 1 < terang.length && terang[j + 1]) j++
    const mid = hd.x0 + Math.round((i + j) / 2); if (mid - batas[batas.length - 1] > 12) batas.push(mid)
    i = j
  }
  if (hd.x1 - batas[batas.length - 1] > 12) batas.push(hd.x1)
  const kolom = []; for (let i = 0; i + 1 < batas.length; i++) kolom.push({ x0: batas[i], x1: batas[i + 1] })
  return kolom
}

/** Baris = pita warna latar (zebra abu/putih) di bawah header. Sela tipis (garis) digabung. */
export function cariBaris(im, hd) {
  const xs = []; const step = Math.max(2, Math.floor((hd.x1 - hd.x0) / 300))
  for (let x = hd.x0 + 4; x < hd.x1 - 4; x += step) xs.push(x)
  // Warna latar per y = modus (bukan median: baris teks bisa menggeser median)
  const latar = []
  for (let y = hd.y1; y < im.height; y++) {
    const hit = new Map(); for (const x of xs) { const q = Math.round(abu(px(im, x, y)) / 3) * 3; hit.set(q, (hit.get(q) || 0) + 1) }
    let mv = 0, mn = -1; for (const [q, n] of hit) if (n > mn) { mn = n; mv = q }
    latar.push(mv)
  }
  // segmen latar konstan; perubahan dihitung hanya bila bertahan ≥5px (teks tidak memotong pita)
  const seg = []; let s = 0
  for (let i = 1; i <= latar.length; i++) {
    if (i < latar.length) {
      if (Math.abs(latar[i] - latar[s]) <= 6) continue
      let tahan = true; for (let k = i; k < Math.min(latar.length, i + 5); k++) if (Math.abs(latar[k] - latar[s]) <= 6) { tahan = false; break }
      if (!tahan) continue
    }
    seg.push({ y0: hd.y1 + s, y1: hd.y1 + i, v: latar[s] }); s = i
  }
  const tebal = seg.filter((g) => g.y1 - g.y0 >= 12 && g.v > 200)
  // isi teks per segmen: buang pita kosong (tanpa teks gelap)
  const adaTeks = (g) => { let n = 0; for (let y = g.y0; y < g.y1; y += 2) for (let x = hd.x0; x < hd.x1; x += 3) if (abu(px(im, x, y)) < g.v - 70) n++; return n > 8 }
  return tebal.filter(adaTeks).map(({ y0, y1 }) => ({ y0, y1 }))
}

// ---------- klasifikasi kolom ----------
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 /]/g, ' ').replace(/\s+/g, ' ').trim()
export function jenisKolom(teks) {
  const t = norm(teks)
  if (!t) return null
  if (/^(ke |kepada|penerima|tujuan|to |beneficiary)|rekening tujuan|ke rekening/.test(t)) return 'ke'
  if (/^(dari|sumber|from)|rekening sumber|dari rekening|rekening asal/.test(t)) return 'dari'
  if (/jumlah|nominal|amount|total/.test(t)) return 'jumlah'
  if (/biaya|fee|admin/.test(t)) return 'biaya'
  if (/status/.test(t)) return 'status'
  if (/berita|keterangan|remark|catatan|deskripsi|description/.test(t)) return 'berita'
  if (/referensi|reference|ref/.test(t)) return 'ref'
  if (/tanggal transfer|tgl transfer|transfer date/.test(t)) return 'tgl'
  if (/tanggal|tgl|date|waktu/.test(t)) return 'tgl_lain'
  if (/alasan|reason/.test(t)) return 'alasan'
  return null
}

// ---------- baca nilai ----------
/** "Rp 2,182,500.00" / "Rp2.182.500" / "1.500.000,00" → 2182500 (angka bulat rupiah). */
export function bacaNominal(teks) {
  const s = String(teks || '').replace(/[Oo]/g, '0').replace(/[lI|]/g, '1').replace(/[Ss]/g, (m, i, all) => (/\d/.test(all[i - 1] || '') ? '5' : m))
  const m = s.match(/\d[\d.,\s]*\d|\d/g); if (!m) return null
  let best = null
  for (const raw of m) {
    let t = raw.replace(/\s/g, '')
    t = t.replace(/[.,](\d{2})$/, '') // sen
    t = t.replace(/[.,]/g, '')
    const v = Number(t); if (Number.isFinite(v) && (best === null || v > best)) best = v
  }
  return best
}

/** Nama rekening PT di mutasi bank (sering terpotong) → kode sumber dana. Cocok bila semua kata kunci ada (toleran 1 huruf salah baca). */
export const PT_BANK = [
  { code: 'ATS', kunci: ['aksara', 'translingua', 'sento'] },
  { code: 'ATI', kunci: ['aksara', 'inter'] },
  { code: 'PTI', kunci: ['penerjemah', 'tersumpah'] },
  { code: 'PAL', kunci: ['apostille', 'leg'] },
]
const jarak = (a, b) => { // Levenshtein kecil
  const m = a.length, n = b.length; if (Math.abs(m - n) > 2) return 9; let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur }
  return prev[n]
}
const adaKata = (kataTeks, k) => kataTeks.some((w) => w === k || (k.length >= 5 && (w.startsWith(k.slice(0, k.length)) || jarak(w.slice(0, k.length), k) <= 1)) || (k.length < 5 && w.startsWith(k)))
export const kodeDana = (teks) => {
  const w = String(teks || '').toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean)
  return (PT_BANK.find((p) => p.kunci.every((k) => adaKata(w, k))) || {}).code || null
}

export function bacaStatus(teks) {
  const t = norm(teks)
  if (/berhas|sukses|success|selesai|done|ok\b/.test(t)) return 'berhasil'
  if (/gagal|gaga|fail|ditolak|tolak|reject|batal|cancel/.test(t)) return 'gagal'
  if (/pending|proses|menunggu|tertunda|process/.test(t)) return 'pending'
  return null
}
const angkaRek = (teks) => { const m = String(teks || '').replace(/[\s-]/g, '').match(/\d{6,}/); return m ? m[0] : '' }
const namaRek = (teks) => String(teks || '').replace(/[({\[]\s*(rp|idr)\s*[)}\]]/gi, '').replace(/^[\d\s\-./|:]+/, '').replace(/^\/\s*/, '').replace(/\s+/g, ' ').trim()

/**
 * Baca satu screenshot. Hasil: { header, kolom, baris: [{ y0, y1, nominal, dari, dana, ke, rek, nama, status, tgl, berita, ref, teks }] }
 * onProgres(0..1) opsional.
 */
export async function bacaScreenshot(im, ocr, onProgres) {
  const hd = cariHeader(im)
  if (!hd) throw new Error('Tabel transaksi tidak dikenali (header kolom tidak ditemukan).')
  const kolom = cariKolom(im, hd)
  const baris = cariBaris(im, hd)
  if (!kolom.length || !baris.length) throw new Error('Baris transaksi tidak ditemukan di screenshot.')
  const total = kolom.length + baris.length * 6; let selesai = 0; const maju = () => onProgres?.(++selesai / total)
  for (const k of kolom) { k.judul = (await ocr(siapOcr(potong(im, k.x0 + 2, hd.y0 + 2, k.x1 - 2, hd.y1 - 2)), {})).replace(/\s+/g, ' ').trim(); k.jenis = jenisKolom(k.judul); maju() }
  if (!kolom.some((k) => k.jenis === 'jumlah')) throw new Error('Kolom nominal (Jumlah/Nominal) tidak ditemukan.')
  const perlu = ['jumlah', 'dari', 'ke', 'status', 'tgl', 'berita', 'ref']
  for (const b of baris) {
    for (const j of perlu) {
      let k = kolom.find((x) => x.jenis === j)
      if (!k && j === 'tgl') k = kolom.filter((x) => x.jenis === 'tgl_lain').pop()
      if (!k) continue
      const t = (await ocr(siapOcr(potong(im, k.x0 + 2, b.y0 + 1, k.x1 - 2, b.y1 - 1)), { angka: j === 'jumlah' })).replace(/\s+/g, ' ').trim()
      b[j] = t; maju()
    }
    b.nominal = bacaNominal(b.jumlah)
    b.dana = kodeDana(b.dari)
    b.rek = angkaRek(b.ke); b.nama = namaRek(String(b.ke || '').split('/').slice(1).join('/') || (b.rek ? '' : b.ke))
    b.statusTrx = bacaStatus(b.status) || (kolom.some((x) => x.jenis === 'status') ? null : 'berhasil')
    b.sendiri = !!kodeDana(b.ke) || /rekening sendiri|antar rekening/i.test(`${b.ke} ${b.berita}`)
  }
  return { header: hd, kolom, baris }
}

// ---------- pencocokan ----------
const digit = (s) => String(s || '').replace(/\D/g, '')
const kata = (s) => norm(s).split(' ').filter((w) => w.length >= 3)

/**
 * Cocokkan baris ke pengajuan. kandidat = pengajuan status 'disetujui' tanpa bukti.
 * Hasil per baris: { status: 'cocok'|'pilih'|'tidak'|'gagal'|'sendiri', pilihan: [req], req, yakin }
 */
export function cocokkan(baris, kandidat, invoiceOf = () => '') {
  const dipakai = new Set()
  const hasil = baris.map((b) => {
    if (b.statusTrx === 'gagal' || b.statusTrx === 'pending') return { status: 'gagal', pilihan: [] }
    if (b.sendiri) return { status: 'sendiri', pilihan: [] }
    if (!b.nominal) return { status: 'tidak', pilihan: [], alasan: 'Nominal tidak terbaca' }
    const sama = kandidat.filter((r) => Number(r.amount) === b.nominal && (!b.dana || !r.sumber_dana || r.sumber_dana === b.dana))
    const skor = (r) => {
      let s = 50
      if (b.dana && r.sumber_dana === b.dana) s += 15
      const rek = digit(r.recipient?.number); if (rek && b.rek && (rek === b.rek || rek.endsWith(b.rek.slice(-6)))) s += 25
      const nm = kata(r.recipient?.holder); if (nm.length && kata(b.nama).some((w) => nm.includes(w))) s += 10
      const inv = digit(invoiceOf(r)); if (inv && digit(b.berita).includes(inv)) s += 15
      return Math.min(99, s)
    }
    const urut = sama.map((r) => ({ r, s: skor(r) })).sort((a, b2) => b2.s - a.s)
    if (!urut.length) return { status: 'tidak', pilihan: [], alasan: b.dana ? `Tidak ada pengajuan ${b.dana} senilai ini` : 'Tidak ada pengajuan senilai ini' }
    // Lebih dari satu kandidat → pilih manual, kecuali rekening penerima jelas membedakan
    if (urut.length > 1 && !(urut[0].s >= 75 && urut[0].s - urut[1].s >= 20)) return { status: 'pilih', pilihan: urut.map((x) => x.r), alasan: `${urut.length} pengajuan bernominal sama — kemungkinan duplikat` }
    return { status: 'cocok', pilihan: urut.map((x) => x.r), req: urut[0].r, yakin: urut[0].s }
  })
  // Satu pengajuan tidak boleh dipasangkan ke dua baris
  hasil.forEach((h) => { if (h.status !== 'cocok') return; if (dipakai.has(h.req.id)) { h.status = 'pilih'; h.alasan = 'Pengajuan ini sudah dipasangkan ke baris lain'; h.req = null } else dipakai.add(h.req.id) })
  return hasil
}
