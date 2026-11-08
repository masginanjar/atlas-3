// ============================================================
//  ROLE & CABANG — tambah cabang baru cukup di BRANCHES.
// ============================================================
export const BRANCHES = ['Bali', 'Jakarta', 'Surabaya', 'Semarang', 'Bandung', 'Yogyakarta', 'Makassar', 'Medan', 'Batam']

/** Cabang yang boleh diakses user: cabang utama + cabang tambahan (CS multi cabang / backup). */
export const branchesOf = (u) => (u?.branches?.length ? [...new Set([u.branch, ...u.branches])] : [u?.branch].filter(Boolean))
/** Petty cash: satu kas per cabang + satu kas APOSTILLE milik Direktur (untuk bayar apostille/legalisasi). */
export const APOSTILLE_FUND = 'Apostille'
export const pettyLabel = (k) => (k === APOSTILLE_FUND ? 'Petty Cash Apostille (Direktur)' : `Petty Cash ${k}`)
export function pettyAccountsOf(u) {
  if (['superadmin', 'admin_pusat', 'direktur', 'akunting'].includes(u?.role)) return [APOSTILLE_FUND, ...BRANCHES]
  if (u?.role === 'supervisor') return [APOSTILLE_FUND, ...branchesOf(u)]
  if (['penerjemah', 'proofreader', 'otorisator', 'staf_apostille'].includes(u?.role)) return []
  return branchesOf(u)
}
/** Bahasa asing sebuah sub project terjemahan (selain Indonesia). */
export const foreignLang = (s) => [s?.lang_from, s?.lang_to].find((l) => l && l !== 'Indonesia') || ''
/** Koordinator bahasa: semua order bahasa ini lewat 1 pintu (mis. Emma = Jepang). */
export const coordinatorFor = (users, lang) => (lang ? users.find((u) => u.coordinator_lang === lang && u.active !== false) : null)
export const isMultiBranch = (u) => branchesOf(u).length > 1
/** Penerjemah, Proofreader & Otorisator = freelance: tidak punya cabang, bekerja dari mana saja. */
export const FREELANCE_ROLES = ['penerjemah', 'proofreader', 'otorisator']
export const isFreelance = (u) => { const r = [...new Set([u?.base_role || u?.role, ...(u?.extra_roles || [])].filter(Boolean))]; return r.length > 0 && r.every((x) => FREELANCE_ROLES.includes(x)) }
/** Lokasi singkat untuk label: "Bali" / "Freelance". */
export const placeOf = (u) => (isFreelance(u) ? 'Freelance' : u?.branch || '—')
export const branchLabel = (u) => (isFreelance(u) ? 'Freelance (semua lokasi)' : isMultiBranch(u) ? `Multi Cabang (${branchesOf(u).join(', ')})` : u?.branch)

export const ROLES = {
  superadmin: { label: 'Superadmin' },
  admin_pusat: { label: 'Admin Kantor Pusat' },
  supervisor: { label: 'Direktur' }, // label tampilan: tugas direktur dikerjakan akun supervisor (permintaan 9 Nov 2026)
  cs: { label: 'CS Cabang' },
  direktur: { label: 'Direktur' },
  akunting: { label: 'Akunting' },
  penerjemah: { label: 'Penerjemah' },
  proofreader: { label: 'Proofreader' },
  otorisator: { label: 'Otorisator' },
  staf_apostille: { label: 'Staf Apostille' },
  // Helper: membantu CS & Staf Apostille, TERBATAS pada cabangnya sendiri.
  // Bukan Admin Kantor Pusat — tidak melihat cabang lain.
  helper: { label: 'Helper Cabang' },
}
/** Role pelaksana yang login & punya To-Do List sendiri. */
/** Label role; otorisator dibedakan Master / Staf Otorisasi. */
export const roleLabel = (u, role = u?.role) => (role === 'otorisator' ? (u?.otorisator_level === 'master' ? 'Master Otorisasi' : 'Staf Otorisasi') : ROLES[role]?.label ?? role)
/** Semua role yang dimiliki user (double job: role utama + extra_roles). */
export const rolesOf = (u) => [...new Set([u?.base_role || u?.role, ...(u?.extra_roles || [])].filter(Boolean))]
export const WORKER_ROLES = ['penerjemah', 'proofreader', 'otorisator', 'staf_apostille']

// Master data non-login. Penerjemah/Proofreader/Otorisator kini berupa PENGGUNA (role) dengan To-Do List.
export const PERSON_TYPES = {
  vendor: 'Vendor',
  lembaga: 'Lembaga Legalisasi',
}

// ============================================================
//  TIM PROOFREADER — satu identitas untuk pengguna biasa
//  Nama masing-masing proofreader hanya terlihat oleh manajemen
//  (dan oleh proofreader itu sendiri). Pembatasan dilakukan di
//  lapisan data (nameOf, daftar pilihan, Tim Aktif), bukan sekadar
//  disembunyikan di tampilan.
// ============================================================
export const PROOFREADER_TEAM = { id: 'tim-proofreader', lead: 'Muhammad Arifin', label: 'Tim Proofreader' }
export const proofreaderTeamName = () => `${PROOFREADER_TEAM.lead} · ${PROOFREADER_TEAM.label}`
/** Boleh melihat nama masing-masing proofreader? */
export const seeProofreaderIdentity = (u) => ['superadmin', 'admin_pusat', 'supervisor', 'direktur', 'akunting', 'penerjemah'].includes(u?.base_role || u?.role) // penerjemah: memilih proofreader sendiri sebelum kirim (permintaan 8 Nov 2026)
/** Nama yang boleh ditampilkan ke `viewer` untuk user `target`. */
export function displayNameFor(viewer, target) {
  if (!target) return undefined
  const isPr = (target.base_role || target.role) === 'proofreader'
  if (!isPr || viewer?.id === target.id || seeProofreaderIdentity(viewer)) return target.name
  return proofreaderTeamName()
}
/** Proofreader aktif dengan antrean paling sedikit — dipakai saat penerjemah mengirim ke Tim Proofreader. */
export function pickProofreader(users, projects = []) {
  const pool = users.filter((u) => u.role === 'proofreader' && u.active !== false)
  if (pool.length < 2) return pool[0]?.id || ''
  const load = Object.fromEntries(pool.map((u) => [u.id, 0]))
  for (const p of projects) for (const s of p.sub_projects || []) if (s.stage === 'proofread' && load[s.data?.proofreader] != null) load[s.data.proofreader] += 1
  return pool.slice().sort((a, b) => load[a.id] - load[b.id] || a.name.localeCompare(b.name))[0].id
}

// ============================================================
//  KODE CABANG PADA NOMOR INVOICE — 3 angka setelah "INV-".
//  Dipakai agar daftar Faktur tiap cabang tidak tercampur.
// ============================================================
export const BRANCH_CODES = {
  101: 'Bali', 202: 'Jakarta', 303: 'Bandung', 304: 'Yogyakarta',
  305: 'Surabaya', 306: 'Medan', 307: 'Semarang', 308: 'Makassar', 309: 'Batam',
  209: 'Batam', // Batam juga memakai awalan 209 (Zoho "Region 4")
}
/** Cabang dari nomor invoice ("INV-1012611057086" → "Bali"). null bila kodenya belum dikenal. */
export function branchOfInvoice(no) {
  const m = /^\s*INV-(\d{3})/i.exec(String(no || ''))
  return m ? BRANCH_CODES[Number(m[1])] || null : null
}
/** Kode 3 angka pada nomor invoice, untuk ditampilkan apa adanya. */
export const invoiceCode = (no) => (/^\s*INV-(\d{3})/i.exec(String(no || '')) || [])[1] || ''
/**
 * Nomor invoice untuk DITAMPILKAN — tanpa awalan "INV-", angkanya saja.
 * Nilai yang tersimpan tetap lengkap ("INV-1012611016951") supaya
 * pencocokan dengan Zoho, pencarian, dan kode cabang tidak terganggu.
 */
export const invoiceLabel = (no) => String(no ?? '').replace(/^\s*INV-/i, '')

export const can = {
  seeAllBranches: (u) => ['superadmin', 'admin_pusat', 'supervisor', 'direktur', 'akunting'].includes(u?.role),
  seeProofreaderIdentity,
  openSettings: (u) => ['superadmin', 'admin_pusat', 'supervisor'].includes(u?.role),
  manageVendors: (u) => ['superadmin', 'admin_pusat', 'supervisor', 'akunting'].includes(u?.role),
  approveVendor: (u) => ['superadmin', 'direktur'].includes(u?.role),
  // Keuangan: sumber dana (ATS/PTI/PAL/ATI) & Tagihan Vendor hanya Superadmin, Direktur, Akunting
  seeFunding: (u) => ['superadmin', 'direktur', 'akunting'].includes(u?.role),
  // Keuangan semua cabang; Direktur hanya cabangnya (+ kas apostille miliknya)
  seeAllFinance: (u) => ['superadmin', 'admin_pusat', 'direktur', 'akunting'].includes(u?.role),
  // Data pelanggan & alamat pengiriman disembunyikan dari pelaksana penerjemahan (hanya nama pelanggan)
  seeCustomerDetail: (u) => !['penerjemah', 'proofreader', 'otorisator'].includes(u?.role),
  editProject: (u) => !WORKER_ROLES.includes(u?.role),
  editBiaya: (u) => ['superadmin', 'supervisor', 'direktur'].includes(u?.role),
  seeBiaya: (u) => ['superadmin', 'supervisor', 'direktur', 'akunting'].includes(u?.role),
  manageUsers: (u) => u?.role === 'superadmin',
  managePeople: (u) => ['superadmin', 'admin_pusat', 'supervisor'].includes(u?.role),
  topUpPettyCash: (u) => ['superadmin', 'direktur', 'akunting', 'cs', 'admin_pusat', 'supervisor'].includes(u?.role),
  deleteProject: (u) => u?.role === 'superadmin',
  processStage: (u, stage, sub, project) => canProcess(u, stage, sub, project),
}

const OVERRIDE = ['superadmin', 'admin_pusat', 'supervisor']
export const CLAIM_TTL = 30 * 60 * 1000 // kunci "sedang diproses" berlaku 30 menit

/** Klaim aktif pada sub project (otorisasi pool). */
export function activeClaim(sub) {
  const c = sub?.data?.claim
  return c && Date.now() - new Date(c.at).getTime() < CLAIM_TTL ? c : null
}

/**
 * Boleh memproses tahap ini?
 *  • stage.roles        : role yang diizinkan
 *  • stage.assignee     : hanya user yang ditugaskan (mis. data.translator) — Superadmin/Direktur boleh override
 *  • stage.printBranch  : hanya staf cabang lokasi Print
 *  • stage.claimable    : pool bersama; user lain tidak boleh bila sedang diklaim
 */
/** Lokasi print = 'Vendor' bila dicetak pihak eksternal (vendor) — tidak terikat cabang. */
export const PRINT_VENDOR = 'Vendor'
export const printAtVendor = (project) => project?.about?.print_location === PRINT_VENDOR
/** Cabang yang bertanggung jawab atas tahap print/scan: lokasi print, atau cabang asal bila dicetak vendor. */
export const printBranchOf = (project) => (project?.about?.print_location && project.about.print_location !== PRINT_VENDOR ? project.about.print_location : project?.branch)
export function canProcess(u, stage, sub, project) {
  if (!u || !stage || !stage.roles.includes(u.role)) return false
  if (u.role === 'superadmin') return true
  if (stage.assignee && sub && !OVERRIDE.includes(u.role) && sub.data?.[stage.assignee] && sub.data[stage.assignee] !== u.id) return false
  if (stage.printBranch && project && !branchesOf(u).includes(printBranchOf(project))) return false
  if (stage.claimable && sub) { const c = activeClaim(sub); if (c && c.by !== u.id) return false }
  return true
}

/** Filter data sesuai hak lihat user. */
export function scopeByBranch(user, rows, branchFilter) {
  let out = rows
  if (['penerjemah', 'proofreader'].includes(user.role)) {
    // pelaksana melihat project yang ditugaskan kepadanya (lintas cabang)
    const key = user.role === 'penerjemah' ? 'translator' : 'proofreader'
    return out.filter((r) => !r.sub_projects || r.sub_projects.some((x) => x.data?.[key] === user.id))
  }
  if (user.role === 'staf_apostille') return out.filter((r) => !r.sub_projects || r.sub_projects.some((x) =>
    x.data?.staff_apostille === user.id || (!x.data?.staff_apostille && ['ap_int', 'lg_int'].includes(x.flow) && r.branch === user.branch)))
  if (user.role === 'otorisator') return out.filter((r) => !r.sub_projects || r.sub_projects.some((x) => x.stage === 'otorisasi' || x.data?.authorized_by === user.id))
  if (!can.seeAllBranches(user)) {
    const mine = branchesOf(user)
    const lang = user.coordinator_lang
    out = out.filter((r) => mine.includes(r.branch) || mine.includes(r.about?.print_location)
      || (lang && (r.sub_projects || []).some((x) => x.type === 'terjemahan' && foreignLang(x) === lang)))
    if (branchFilter && branchFilter !== 'Semua' && mine.length > 1) out = out.filter((r) => r.branch === branchFilter || r.about?.print_location === branchFilter)
  } else if (branchFilter && branchFilter !== 'Semua') out = out.filter((r) => r.branch === branchFilter)
  return out
}
