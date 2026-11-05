// ============================================================
//  IMPOR DATA SISTEM LAMA — idempoten (aman dijalankan berulang).
//  • Proyek dikunci oleh No. Invoice (dasar, tanpa akhiran kategori lama).
//  • Subproyek dikunci oleh legacy_key (No. Invoice asli per baris lama).
//  • Hanya MENAMBAH yang belum ada & MENGISI kolom yang masih kosong;
//    nilai yang sudah terisi tidak pernah ditimpa — perbedaan dicatat.
//  • Master (vendor, lembaga, kurir, pengguna) dicocokkan dulu agar tidak ganda.
// ============================================================

/** Versi tanpa data pribadi (untuk demo publik): nama disamarkan, alamat/catatan/isi dokumen dihapus. */
const SAFE_LEGACY = ['Timestamp', 'No. Invoice', 'Status', 'Proses Terjemahan', 'Deadline Softcopy', 'Cabang', 'Print-out', 'Nama CS', 'Kategori',
  'Bahasa/Produk', 'Tipe Proses', 'Otorisasi', 'Deadline Penerjemah', 'Penerjemah', 'Jumlah Dokumen', 'Jumlah Halaman', 'Pengiriman Via', 'Proses Apostille', 'Tujuan Negara Apostille']
const initials = (name) => String(name || '').split(/\s+/).filter(Boolean).map((w) => `${w[0].toUpperCase()}***`).join(' ') || 'Pelanggan'
export function maskPayload(payload) {
  const label = { terjemahan: 'Terjemahan', apostille: 'Apostille', legalisasi: 'Legalisasi', jasa_lain: 'Jasa Lain' }
  return { ...payload, masked: true, projects: payload.projects.map((p) => ({
    ...p, customer_name: initials(p.customer_name), ship: null, notes: '',
    subs: p.subs.map((x) => {
      const n = Math.max(1, x.file_count || (x.docs?.length ?? 1))
      return { ...x, title: `${label[x.type] || x.type} · ${n} dokumen`, description: Array.from({ length: n }, (_, i) => `${i + 1}. Dokumen ${i + 1}`).join('\n'),
        docs: x.docs ? [{ desc: 'Dokumen 1', pages: x.docs[0].pages }] : null,
        legacy: Object.fromEntries(Object.entries(x.legacy).filter(([k]) => SAFE_LEGACY.includes(k))) }
    }),
  })) }
}

const empty = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
const norm = (s) => String(s || '').toLowerCase().replace(/^(pak|bapak|bu|ibu)\s+/, '').replace(/\s+/g, ' ').trim()
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const honor = (name) => name.replace(/^Pak\s+/i, 'Bapak ').replace(/^Bu\s+/i, 'Ibu ')

/** Isi kolom kosong saja. Mengembalikan jumlah kolom yang dilengkapi; beda nilai dicatat ke conflicts. */
function fill(target, src, path, log, where) {
  let n = 0
  for (const [k, v] of Object.entries(src)) {
    if (empty(v)) continue
    if (empty(target[k])) { target[k] = v; n++ }
    else if (typeof v !== 'object' && String(target[k]) !== String(v)) log.conflicts.push({ where, field: `${path}${k}`, existing: target[k], legacy: v })
  }
  log.filled += n
  return n
}

export function applyLegacyImport(mem, payload, { now = new Date().toISOString() } = {}) {
  const log = { source: payload.source, at: now, projects_added: 0, subs_added: 0, filled: 0, projects_existing: 0, subs_existing: 0,
    master_added: [], conflicts: [], review_subs: [] }
  mem.people ||= []; mem.couriers ||= []; mem.projects ||= []

  // ---------- master data ----------
  const findVendor = (ref) => {
    const vs = mem.people.filter((p) => p.type === 'vendor')
    const exact = vs.filter((p) => norm(p.name) === norm(ref.key))
    if (exact.length === 1) return exact[0]
    const first = norm(ref.key).split(' ')[0]
    const loose = vs.filter((p) => norm(p.name).split(' ')[0] === first)
    return loose.length === 1 ? loose[0] : null
  }
  const vendorOf = (ref) => {
    let v = findVendor(ref)
    if (!v) {
      v = { id: `legacy-vendor-${slug(ref.key)}`, name: honor(ref.name), type: 'vendor', branch: 'Semua', phone: '', address: '', contact: '',
        languages: ref.lang ? [ref.lang] : [], services: [], accounts: [], legacy: true, created_at: now,
        notes: 'Ditambahkan dari impor sistem lama — lengkapi kontak, layanan/tarif & rekening.' }
      mem.people.push(v); log.master_added.push(`Vendor: ${v.name}${ref.lang ? ` (${ref.lang})` : ''}`)
    } else if (ref.lang && (v.languages || []).length && !v.languages.includes(ref.lang)) {
      log.conflicts.push({ where: `Vendor ${v.name}`, field: 'bahasa', existing: v.languages.join(', '), legacy: ref.lang })
    }
    return v
  }
  const lembagaOf = (name) => {
    if (!name) return null
    let l = mem.people.find((p) => p.type === 'lembaga' && norm(p.name) === norm(name))
    if (!l) { l = { id: `legacy-lembaga-${slug(name)}`, name, type: 'lembaga', branch: 'Semua', phone: '', legacy: true, created_at: now }; mem.people.push(l); log.master_added.push(`Lembaga: ${name}`) }
    return l
  }
  const courierOf = (name) => {
    if (!name) return null
    let k = mem.couriers.find((c) => norm(c.name) === norm(name))
    if (!k) {
      const order = Math.max(0, ...mem.couriers.map((c) => Number(c.order) || 0)) + 1
      k = { id: `legacy-courier-${slug(name)}`, name, type: 'courier', icon: 'truck', color: '#64748b', logo: '', order, legacy: true, created_at: now }
      mem.couriers.push(k); log.master_added.push(`Kurir: ${name}`)
    }
    return k
  }
  const csOf = (raw) => {
    if (!raw) return null
    const key = raw.toLowerCase()
    const hits = mem.users.filter((u) => u.name.toLowerCase().split(/[\s(]/)[0] === key)
    return hits.find((u) => u.role === 'cs') ?? (hits.length === 1 ? hits[0] : null)
  }
  const translatorOf = (name) => mem.users.find((u) => u.role === 'penerjemah' && norm(u.name) === norm(name)) ?? null

  // ---------- proyek & subproyek ----------
  for (const p of payload.projects) {
    const cs = csOf(p.cs_raw)
    const courier = courierOf(p.courier_name)
    const created = p.received_at ? new Date(`${p.received_at}T00:00:00+08:00`).toISOString() : now
    const ship = p.ship ? (({ raw, ...s }) => s)(p.ship) : null
    const about = {
      deadline: p.deadline ? new Date(p.deadline).toISOString() : null, priority: p.priority, received_at: p.received_at,
      print_location: p.print_location, cs_name: cs?.name ?? p.cs_raw, courier: courier?.id ?? null, notes: p.notes,
    }
    const legacyAbout = { legacy_print: p.print_raw, legacy_cs: p.cs_raw, legacy_courier: p.courier_raw, legacy_ship_raw: p.ship?.raw ?? '' }

    let proj = mem.projects.find((x) => String(x.invoice_no).trim() === String(p.invoice_no).trim())
    const isNew = !proj
    if (isNew) {
      proj = { id: `legacy-${slug(p.invoice_no)}`, invoice_no: p.invoice_no, branch: p.branch,
        customer: { zoho_id: null, name: p.customer_name, email: '', phone: '', city: '', ...(ship ? { ship } : {}), legacy: true },
        about: { ...about, ...legacyAbout }, sub_projects: [], created_by: cs?.id ?? null, created_at: created,
        legacy: { source: payload.source, imported_at: now, masked: !!payload.masked } }
      mem.projects.push(proj); log.projects_added++
    } else if (proj.legacy) {
      log.projects_existing++ // sudah diimpor sebelumnya — tidak diubah lagi
      if (proj.legacy.masked && !payload.masked) { // versi publik tersamar → lengkapi dengan data asli
        if (proj.customer?.legacy) { proj.customer.name = p.customer_name; if (ship) proj.customer.ship = ship }
        proj.about.notes = p.notes; proj.about.legacy_ship_raw = p.ship?.raw ?? ''
        for (const s of p.subs) {
          const x = proj.sub_projects.find((y) => y.legacy_key === s.legacy_key)
          if (!x) continue
          Object.assign(x, { title: s.title, description: s.description }); if (s.docs) x.docs = s.docs; else delete x.docs
          x.data = { ...x.data, legacy: s.legacy }
        }
        proj.legacy.masked = false; log.unmasked = (log.unmasked || 0) + 1
      }
    } else {
      log.projects_existing++
      const where = `Proyek ${p.invoice_no}`
      fill(proj, { branch: p.branch, created_by: cs?.id ?? null }, '', log, where)
      proj.customer ||= {}
      fill(proj.customer, { name: p.customer_name }, 'customer.', log, where)
      if (ship) { proj.customer.ship ||= {}; fill(proj.customer.ship, ship, 'customer.ship.', log, where) }
      proj.about ||= {}
      fill(proj.about, about, 'about.', log, where)
      fill(proj.about, legacyAbout, 'about.', log, where)
    }

    for (const s of p.subs) {
      const tr = s.translator_ref
      let translator = '', translatorKind = '', executorKind = '', executorId = ''
      const data = { legacy: s.legacy, legacy_row: s.legacy_row, legacy_invoice: s.legacy_key, ...(s.deadline ? { deadline_sub: s.deadline } : {}),
        ...(s.legacy_note ? { legacy_note: s.legacy_note } : {}), ...(s.priority_raw ? { legacy_priority: s.priority_raw } : {}) }
      if (tr.kind === 'user') { const u = translatorOf(tr.name); if (u) { translator = u.id; translatorKind = 'translator'; data.translator = u.id } }
      if (tr.kind === 'vendor') {
        const v = vendorOf(tr); data.vendor = v.id; executorKind = 'vendor'; executorId = v.id
        if (s.type === 'terjemahan') { translator = v.id; translatorKind = 'vendor' }
      }
      if (tr.kind === 'office' && s.type !== 'terjemahan') executorKind = 'staff'
      const lembaga = lembagaOf(s.institution_name)
      const sub = {
        id: `legacy-s-${slug(s.legacy_key)}`, legacy_key: s.legacy_key, type: s.type, flow: s.flow, stage: s.stage, title: s.title,
        description: s.description, ...(s.file_count != null ? { file_count: s.file_count } : {}), ...(s.pages != null ? { pages: s.pages } : {}),
        ...(s.docs ? { docs: s.docs } : {}), lang_from: s.lang_from, lang_to: s.lang_to, country: s.country, institution: lembaga?.id ?? '',
        translator, translator_kind: translatorKind, executor_kind: executorKind, executor_id: executorId, data,
        history: [{ at: now, by: 'Impor sistem lama', action: `Diimpor dari baris ${s.legacy_row} (${s.legacy_key}) · status lama: ${s.legacy.Status || '—'} / ${s.legacy['Proses Terjemahan'] || '—'}` }],
      }
      proj.sub_projects ||= []
      let existing = proj.sub_projects.find((x) => x.legacy_key === s.legacy_key)
      if (!existing && !isNew && !proj.legacy) {
        // proyek dibuat di sistem baru: cocokkan subproyek hanya bila pasti (jenis + bahasa sama, tepat satu kandidat)
        const cands = proj.sub_projects.filter((x) => !x.legacy_key && x.type === s.type && (s.type !== 'terjemahan' || (x.lang_from === s.lang_from && x.lang_to === s.lang_to)))
        if (cands.length === 1) existing = cands[0]
        else if (cands.length > 1) { log.review_subs.push({ invoice: p.invoice_no, legacy_key: s.legacy_key, issue: `${cands.length} subproyek ${s.type} serupa sudah ada — tidak ditambahkan, perlu dicek manual` }); continue }
      }
      if (existing && String(existing.id).startsWith('legacy-s-')) { log.subs_existing++; continue } // sudah diimpor sebelumnya
      if (existing) {
        log.subs_existing++
        const where = `Subproyek ${s.legacy_key}`
        existing.legacy_key ||= s.legacy_key
        fill(existing, { title: sub.title, description: sub.description, file_count: sub.file_count, pages: sub.pages, lang_from: sub.lang_from, lang_to: sub.lang_to, country: sub.country, institution: sub.institution, translator: sub.translator, translator_kind: sub.translator_kind, executor_kind: sub.executor_kind, executor_id: sub.executor_id }, '', log, where)
        existing.data ||= {}
        fill(existing.data, data, 'data.', log, where)
        if (existing.stage !== sub.stage) log.conflicts.push({ where, field: 'tahap', existing: existing.stage, legacy: sub.stage })
      } else {
        proj.sub_projects.push(sub); log.subs_added++
      }
    }
  }
  log.changed = log.projects_added + log.subs_added + log.filled + log.master_added.length + (log.unmasked || 0) > 0
  return log
}
