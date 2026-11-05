// ============================================================
//  PEMBACA ITEM INVOICE ZOHO → isian awal project ATLAS (semua tetap bisa diedit CS).
//  Pola nyata yang ditangani:
//   name  "English ⇄ Indonesia ⇄ Inggris | NON Regular | Sworn" / "Spain ⇄ Indonesian | Sworn | Normal" / "Apostille" / "Legalisasi Kemenag" / "Delivery Fee"
//   desc  "IND-ENG SAME-DAY\n1. KTP Suwarni\n2. KTP Priambudi"  ·  "Terjemahan EN-ID\n1. Marriage Certificate"  ·  "1. Ijazah Chandra 2 hal"
//         "APOSTILLE NORMAL TUJUAN CHINA\n1. …"  ·  "Softcopy Only : email"  ·  "Self Pickup Kantor Jakarta"  ·  "Gosend Kantor Surabaya"
//   Delivery Fee: "Jenis Ekspedisi : JNT\nNama: …\nAlamat: …\nKec/kab/kota: …\nKode pos: …\nNomor hp: …"  atau bebas "Nama\nAlamat…\n08…"
// ============================================================

const LANG = {
  english: 'Inggris', inggris: 'Inggris', eng: 'Inggris', en: 'Inggris', ing: 'Inggris',
  indonesia: 'Indonesia', indonesian: 'Indonesia', ind: 'Indonesia', id: 'Indonesia', idn: 'Indonesia', bahasa: 'Indonesia',
  spanyol: 'Spanyol', spanish: 'Spanyol', spain: 'Spanyol', esp: 'Spanyol', es: 'Spanyol', spa: 'Spanyol',
  jepang: 'Jepang', japanese: 'Jepang', japan: 'Jepang', jp: 'Jepang', jpn: 'Jepang',
  mandarin: 'Mandarin', chinese: 'Mandarin', china: 'Mandarin', cn: 'Mandarin', zh: 'Mandarin', chn: 'Mandarin',
  korea: 'Korea', korean: 'Korea', kr: 'Korea', kor: 'Korea',
  jerman: 'Jerman', german: 'Jerman', germany: 'Jerman', de: 'Jerman', ger: 'Jerman', deutsch: 'Jerman',
  prancis: 'Prancis', perancis: 'Prancis', french: 'Prancis', france: 'Prancis', fr: 'Prancis', fra: 'Prancis',
  belanda: 'Belanda', dutch: 'Belanda', nl: 'Belanda', nld: 'Belanda',
  arab: 'Arab', arabic: 'Arab', ar: 'Arab', ara: 'Arab',
  italia: 'Italia', italian: 'Italia', italy: 'Italia', it: 'Italia', ita: 'Italia',
  rusia: 'Rusia', russian: 'Rusia', russia: 'Rusia', ru: 'Rusia', rus: 'Rusia',
  portugis: 'Portugis', portuguese: 'Portugis', pt: 'Portugis', por: 'Portugis',
  turki: 'Turki', turkish: 'Turki', tr: 'Turki', tur: 'Turki',
  thailand: 'Thailand', thai: 'Thailand', th: 'Thailand', tha: 'Thailand',
  vietnam: 'Vietnam', vietnamese: 'Vietnam', vi: 'Vietnam', vie: 'Vietnam',
  malaysia: 'Melayu', malay: 'Melayu', melayu: 'Melayu', ms: 'Melayu',
  hindi: 'Hindi', hi: 'Hindi', tagalog: 'Tagalog', filipino: 'Tagalog',
}
const langOf = (w = '') => LANG[w.trim().toLowerCase().replace(/[^a-z]/g, '')] || ''

const COURIER_WORDS = [
  ['jnt', 'J&T'], ['j&t', 'J&T'], ['j & t', 'J&T'], ['jne', 'JNE'], ['gosend', 'Gojek'], ['gojek', 'Gojek'], ['go-send', 'Gojek'], ['grab', 'Grab'],
  ['sicepat', 'SiCepat'], ['anteraja', 'AnterAja'], ['tiki', 'TIKI'], ['lion parcel', 'Lion Parcel'], ['ninja', 'Ninja'], ['pos indonesia', 'POS'], ['dhl', 'DHL'], ['fedex', 'FedEx'], ['ems', 'EMS'],
  ['self pickup', 'Diambil di Kantor'], ['self pick up', 'Diambil di Kantor'], ['pick up', 'Diambil di Kantor'], ['pickup', 'Diambil di Kantor'], ['ambil sendiri', 'Diambil di Kantor'], ['diambil', 'Diambil di Kantor'],
  ['softcopy', 'Softcopy Saja'], ['soft copy', 'Softcopy Saja'], ['soft-copy', 'Softcopy Saja'],
]
/** Nama kurir dari teks bebas ("Gosend Kantor Surabaya" → Gojek; "Softcopy Only" → Softcopy Saja). */
export function courierFromText(text = '') {
  const t = text.toLowerCase()
  const hit = COURIER_WORDS.find(([k]) => t.includes(k))
  return hit ? hit[1] : ''
}
/** Cabang/kantor yang disebut ("Self Pickup Kantor Jakarta" → Jakarta). */
const officeOf = (text = '') => (text.match(/kantor\s+([A-Za-z]+)/i) || text.match(/pick\s*-?\s*up\s+([A-Za-z]+)/i) || [])[1]?.replace(/^\w/, (c) => c.toUpperCase()) || ''

/** Prioritas dari kata kunci harga: SAME-DAY → Sameday; Speed 100% / Express → Super Ekspres; Speed 50% → Ekspres. */
export function priorityFromText(text = '') {
  const t = text.toLowerCase()
  if (/same\s*-?\s*day/.test(t)) return 'Sameday'
  if (/speed\s*100|super\s*ekspres|super\s*express|express|ekspres|kilat/.test(t)) return 'Super Ekspres'
  if (/speed\s*(50|75)/.test(t)) return 'Ekspres'
  return ''
}

const DOC_LINE = /^(\d+)\s*[.)]\s*(.+)$/
const PAGES_TAIL = /\(?\s*(\d+)\s*(?:hal(?:aman)?|hlm|lembar|pages?|pgs?)\b\.?\s*\)?\s*$/i
const isDirectionLine = (l) => /^(terjemahan\s+)?[A-Za-z]{2,10}\s*[-–>→]+\s*[A-Za-z]{2,10}(\s+.*)?$/i.test(l) && !DOC_LINE.test(l)

/** Baris bernomor → dokumen; "Ijazah Chandra 2 hal" → pages 2. Baris lain dikembalikan sebagai `notes`. */
export function parseDocs(description = '', fallbackPages = 0) {
  const lines = description.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const docs = []; const notes = []
  lines.forEach((l, i) => {
    const m = l.match(DOC_LINE)
    if (m) {
      let desc = m[2].trim(); let pages
      const pm = desc.match(PAGES_TAIL)
      if (pm) { pages = Number(pm[1]); desc = desc.slice(0, pm.index).trim().replace(/[-–,:(]\s*$/, '').trim() }
      if (desc) docs.push({ desc, pages })
    } else if (!(i === 0 && isDirectionLine(l))) notes.push(l)
  })
  if (!docs.length) {
    // tanpa penomoran: baris selain arah bahasa & keterangan kirim dianggap 1 dokumen
    const cand = notes.filter((l) => !courierFromText(l) && !/@/.test(l) && !/^\(?(soft|self|pick|gosend|kantor)/i.test(l))
    if (cand.length) docs.push({ desc: cand.join(' ').slice(0, 120), pages: undefined })
  }
  const known = docs.reduce((a, d) => a + (d.pages || 0), 0)
  const unknown = docs.filter((d) => !d.pages)
  if (unknown.length && fallbackPages > known) { const each = Math.max(1, Math.floor((fallbackPages - known) / unknown.length)); unknown.forEach((d) => (d.pages = each)) }
  return { docs: docs.map((d) => ({ desc: d.desc, pages: d.pages || 1 })), notes }
}

/** Arah bahasa. Baris pertama deskripsi ("IND-ENG", "Spanish - IND", "Terjemahan EN-ID") lebih dipercaya daripada nama item. */
export function parseLang(name = '', description = '') {
  const first = (description.split(/\r?\n/).map((l) => l.trim()).find(Boolean) || '').replace(/^terjemahan\s+/i, '')
  const m = first.match(/^([A-Za-z]{2,10})\s*[-–>→]+\s*([A-Za-z]{2,10})\b/)
  if (m) { const a = langOf(m[1]), b = langOf(m[2]); if (a && b) return { lang_from: a, lang_to: b, sure: true } }
  const parts = name.split(/⇄|<->|<>|->|→|↔/).map((s) => s.replace(/\|.*$/, '').trim()).map(langOf).filter(Boolean)
  const uniq = [...new Set(parts)]
  if (uniq.length >= 2) {
    // "English ⇄ Indonesia ⇄ Inggris": arah tidak pasti → anggap dokumen Indonesia diterjemahkan ke bahasa asing
    const foreign = uniq.find((l) => l !== 'Indonesia') || uniq[1]
    return { lang_from: 'Indonesia', lang_to: foreign, sure: false }
  }
  return { lang_from: '', lang_to: '', sure: false }
}

const takeLabeled = (lines, re) => { const l = lines.find((x) => re.test(x)); return l ? l.replace(re, '').trim() : '' }
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/
const cleanPhone = (p = '') => p.replace(/\(.*?\)/g, '').replace(/[^\d+]/g, '').replace(/^\+?62(0)?/, '0').replace(/^\+1/, '+1')

/** Alamat dari deskripsi Delivery Fee → bentuk `ship` ATLAS + kurir. */
export function parseShipping(description = '') {
  const lines = description.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const out = { courier: '', attention: '', street1: '', street2: '', city: '', state: '', zip: '', phone: '', office: '' }
  out.courier = takeLabeled(lines, /^(jenis\s*)?(ekspedisi|kurir|pengiriman|courier)\s*[:：]\s*/i)
  out.attention = takeLabeled(lines, /^(nama(\s*penerima)?|penerima|name|attn)\s*[:：]\s*/i)
  out.street1 = takeLabeled(lines, /^(alamat|address)\s*[:：]\s*/i)
  out.city = takeLabeled(lines, /^(kec\.?\s*\/?\s*kab\.?\s*\/?\s*kota|kec\/?kab\/?kota|kota\s*\/?\s*kab(upaten)?|kota|kabupaten|kecamatan|city)\s*[:：]\s*/i)
  out.zip = takeLabeled(lines, /^(kode\s*pos|kodepos|zip|postal(\s*code)?)\s*[:：]\s*/i)
  out.phone = takeLabeled(lines, /^(nomor\s*hp|no\.?\s*hp|hp|telp|telepon|phone|wa|whatsapp|nomor\s*telepon)\s*[:：]\s*/i)
  const labeled = !!(out.attention || out.street1 || out.phone || out.city)
  if (labeled) {
    // baris tanpa label di antara label (mis. "Kebon Jeruk, Jakarta Barat" setelah Alamat) → sambung ke alamat; nomor HP di baris berikutnya
    const idxPhoneLabel = lines.findIndex((x) => /^(nomor\s*hp|no\.?\s*hp|hp|telp|phone)\s*[:：]\s*$/i.test(x))
    if (!out.phone && idxPhoneLabel >= 0 && lines[idxPhoneLabel + 1]) out.phone = lines[idxPhoneLabel + 1]
    const free = lines.filter((x, i) => !/[:：]/.test(x) && i !== idxPhoneLabel + 1 && !(PHONE_RE.test(x) && x.replace(/\D/g, '').length >= 9))
    if (free.length && out.street1) out.street1 = [out.street1, ...free].join(', ')
    if (!out.attention) { const n = lines.find((x) => !/[:：]/.test(x) && !PHONE_RE.test(x)); if (n && !free.includes(n)) out.attention = n }
  } else {
    // format bebas: nama / alamat (1–n baris) / nomor hp — abaikan baris kurir
    const rest = lines.filter((l) => !/^(jenis\s*)?(ekspedisi|kurir)/i.test(l))
    const phoneIdx = rest.findIndex((l) => l.replace(/\D/g, '').length >= 9 && /^[+\d][\d\s().-]*$/.test(l))
    if (phoneIdx >= 0) out.phone = rest[phoneIdx]
    const body = rest.filter((_, i) => i !== phoneIdx)
    if (body.length === 1 && courierFromText(body[0])) { out.courier = out.courier || body[0]; out.office = officeOf(body[0]) }
    else if (body.length) { out.attention = body[0]; out.street1 = body.slice(1).join(', ') }
  }
  if (!out.zip) { const z = `${out.street1} ${out.city}`.match(/\b(\d{5})\b/); if (z) out.zip = z[1] }
  if (!out.phone) { const pm = description.match(PHONE_RE); if (pm && pm[1].replace(/\D/g, '').length >= 9 && !/\b\d{5}\b/.test(pm[1].trim()) ) out.phone = pm[1] }
  out.phone = cleanPhone(out.phone)
  out.courier = courierFromText(out.courier) || courierFromText(description) || (out.courier ? out.courier : '')
  if (!out.office) out.office = officeOf(description)
  if (/^(jakarta|bali|denpasar|surabaya|semarang|makassar|bandung|medan|yogyakarta|jogja)$/i.test(out.attention)) out.attention = ''
  return out
}

const isDelivery = (it) => /delivery|ongkir|pengiriman|kurir|shipping|ekspedisi/i.test(it.name || '')
const isApostille = (it) => /apostille/i.test(it.name || '')
const isLegalisasi = (it) => /legalis/i.test(it.name || '')
const isTranslation = (it) => /⇄|<->|->|→|sworn|tersumpah|terjemah|translat|regular|reguler/i.test(it.name || '')
const isOther = (it) => /print|hard\s*copy|rangkap|akomodasi|materai|biaya|fee\b|cetak|scan|notaris\s*fee/i.test(it.name || '')
const INSTITUTION = [[/kemenag/i, 'Kemenag'], [/kemenkumham|kumham/i, 'Kemenkumham'], [/kemlu|kementerian luar/i, 'Kemlu'], [/notaris/i, 'Notaris'], [/kedutaan|embassy|kbri/i, 'Kedutaan'], [/dikti|kemdikbud|kemendikbud/i, 'Kemdikbud'], [/pengadilan/i, 'Pengadilan']]
const COUNTRY_ALIAS = { china: 'Tiongkok', tiongkok: 'Tiongkok', rrc: 'Tiongkok', usa: 'Amerika Serikat', us: 'Amerika Serikat', amerika: 'Amerika Serikat', uk: 'Inggris (Britania Raya)', inggris: 'Inggris (Britania Raya)', england: 'Inggris (Britania Raya)', korea: 'Korea Selatan', belanda: 'Belanda', netherlands: 'Belanda', holland: 'Belanda', jerman: 'Jerman', germany: 'Jerman', jepang: 'Jepang', japan: 'Jepang', australia: 'Australia', spanyol: 'Spanyol', spain: 'Spanyol', prancis: 'Prancis', perancis: 'Prancis', france: 'Prancis', italia: 'Italia', italy: 'Italia', turki: 'Turki', turkey: 'Turki', singapura: 'Singapura', singapore: 'Singapura', malaysia: 'Malaysia', taiwan: 'Taiwan', hongkong: 'Hong Kong', kanada: 'Kanada', canada: 'Kanada', swiss: 'Swiss', switzerland: 'Swiss', belgia: 'Belgia', belgium: 'Belgia', portugal: 'Portugal', rusia: 'Rusia', russia: 'Rusia', india: 'India', filipina: 'Filipina', philippines: 'Filipina', vietnam: 'Vietnam', thailand: 'Thailand', qatar: 'Qatar', kuwait: 'Kuwait', uae: 'Uni Emirat Arab', dubai: 'Uni Emirat Arab', mesir: 'Mesir', egypt: 'Mesir', brasil: 'Brasil', brazil: 'Brasil', meksiko: 'Meksiko', mexico: 'Meksiko', austria: 'Austria', ceko: 'Ceko', denmark: 'Denmark', finlandia: 'Finlandia', irlandia: 'Irlandia', ireland: 'Irlandia', norwegia: 'Norwegia', norway: 'Norwegia', polandia: 'Polandia', poland: 'Polandia', swedia: 'Swedia', sweden: 'Swedia', 'selandia baru': 'Selandia Baru', 'new zealand': 'Selandia Baru', nz: 'Selandia Baru', brunei: 'Brunei Darussalam', 'arab saudi': 'Arab Saudi', saudi: 'Arab Saudi' }
const countryOf = (text = '') => {
  const m = text.match(/(?:tujuan|negara|country|untuk|to)\s*[:：]?\s*([A-Za-z][A-Za-z ]{1,30})/i)
  const raw = (m?.[1] || '').trim().toLowerCase().replace(/\s+(normal|express|ekspres|speed.*)$/i, '')
  return COUNTRY_ALIAS[raw] || (raw ? raw.replace(/\b\w/g, (c) => c.toUpperCase()) : '')
}

/**
 * Hasil utama dari line_items invoice Zoho:
 *  { subs:[{type, lang_from, lang_to, docs, pages, description, country, institution, notes}], ship, courier, office, priority, email, others, hints }
 */
export function parseInvoiceItems(items = []) {
  const subs = []; const others = []; const hints = []
  let ship = null; let courier = ''; let office = ''; let priority = ''; let email = ''
  const noteHint = (lines) => {
    for (const l of lines) {
      const em = l.match(/[\w.+-]+@[\w-]+\.[\w.]+/); if (em) email = email || em[0]
      const c = courierFromText(l); if (c) { courier = courier || c; office = office || officeOf(l); hints.push(l) }
    }
  }
  for (const it of items) {
    const name = it.name || '', description = it.description || ''
    const qty = Number(it.quantity) || 0
    const pr = priorityFromText(`${name}\n${description.split('\n')[0] || ''}`); if (pr && !priority) priority = pr
    if (isDelivery(it)) { ship = parseShipping(description); courier = ship.courier || courier; office = ship.office || office; continue }
    if (!name.trim() && description.trim()) { noteHint([description]); others.push({ name: '', description, qty, rate: it.rate }); continue } // baris tanpa item: biasanya keterangan kirim
    if (isOther(it) && !isApostille(it) && !isLegalisasi(it)) { others.push({ name, description, qty, rate: it.rate }); noteHint(description.split('\n')); continue } // cetak ulang, fee, dsb. → catatan
    if (isApostille(it) || isLegalisasi(it)) {
      const { docs, notes } = parseDocs(description, qty)
      noteHint(notes)
      const type = isApostille(it) ? 'apostille' : 'legalisasi'
      const institution = (INSTITUTION.find(([re]) => re.test(`${name} ${description.split('\n')[0] || ''}`)) || [])[1] || ''
      subs.push({ type, lang_from: '', lang_to: '', docs, pages: docs.length ? Math.max(docs.length, qty || 0) : qty, description: docs.map((d, i) => `${i + 1}. ${d.desc}`).join('\n'),
        country: type === 'apostille' ? countryOf(description) : '', institution, notes: notes.filter((n) => !courierFromText(n)).join(' · '), zoho_item: name, zoho_qty: qty, zoho_rate: it.rate })
      continue
    }
    if (isTranslation(it) || /page|hal/i.test(it.unit || '')) {
      const { lang_from, lang_to, sure } = parseLang(name, description)
      const nonReg = /non\s*-?\s*reg/i.test(name) || /non\s*-?\s*reg/i.test(description.split('\n')[0] || '')
      const sworn = !/non\s*sworn|tidak\s*tersumpah|non\s*tersumpah|unsworn/i.test(name)
      const { docs: d0, notes } = parseDocs(description, qty)
      noteHint(notes)
      const docs = d0.map((d) => ({ ...d, kind: nonReg ? 'non_reguler' : 'reguler' }))
      subs.push({ type: sworn ? 'terjemahan' : 'terjemahan_nt', lang_from, lang_to, lang_sure: sure, docs, pages: docs.reduce((a, d) => a + d.pages, 0) || qty,
        description: docs.map((d, i) => `${i + 1}. ${d.desc}`).join('\n'), notes: notes.filter((n) => !courierFromText(n) && !/@/.test(n)).join(' · '), zoho_item: name, zoho_qty: qty, zoho_rate: it.rate })
      continue
    }
    others.push({ name, description, qty, rate: it.rate })
    noteHint(description.split('\n'))
  }
  // Sub project terjemahan dengan bahasa & jenis sama digabung (nomor dokumen di Zoho sering berlanjut antar item)
  const merged = []
  for (const s of subs) {
    const prev = merged[merged.length - 1]
    if (prev && s.type === prev.type && s.type.startsWith('terjemahan') && prev.lang_from === s.lang_from && prev.lang_to === s.lang_to) {
      prev.docs = [...prev.docs, ...s.docs]; prev.pages = prev.docs.reduce((a, d) => a + d.pages, 0)
      prev.description = prev.docs.map((d, i) => `${i + 1}. ${d.desc}`).join('\n'); prev.notes = [prev.notes, s.notes].filter(Boolean).join(' · ')
    } else merged.push({ ...s })
  }
  const hasAddress = !!(ship && (ship.street1 || ship.city || ship.zip))
  if (hasAddress && !ship.courier) courier = '' // ada alamat kirim tapi kurir belum disebut → biarkan CS memilih
  return { subs: merged, ship, courier, office, priority, email, others, hints, hasAddress }
}
