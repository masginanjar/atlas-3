// ============================================================
//  UBAH NAMA FILE SEBELUM UPLOAD + CEGAH NAMA KEMBAR
//  Dipakai di semua tempat upload file project (semua role).
//  Aturan diatur di Setting → File (Superadmin / Admin Pusat).
// ============================================================
import { useRef, useState } from 'react'
import { FileText, AlertTriangle, Upload } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { Button, Sheet, cx } from './ui.jsx'
import { kb } from '../lib/format.js'

export const DEFAULT_FILE_RULES = { dup_policy: 'suffix', prefix_invoice: false }
export const fileRulesOf = (data) => ({ ...DEFAULT_FILE_RULES, ...((data.app_settings || []).find((r) => r.key === 'files') || {}) })

const splitExt = (n) => { const m = String(n).match(/^(.*?)(\.[^.]+)?$/); return [m[1] || '', m[2] || ''] }
const norm = (n) => String(n).trim().toLowerCase()
const clean = (n) => String(n).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim()

/** Nama unik: "nama (2).pdf", "nama (3).pdf", … */
export function uniqueName(name, taken) {
  if (!taken.has(norm(name))) return name
  const [base, ext] = splitExt(name)
  for (let i = 2; i < 999; i++) { const c = `${base} (${i})${ext}`; if (!taken.has(norm(c))) return c }
  return `${base}-${Date.now()}${ext}`
}

/** Usulan nama awal sesuai aturan (prefix no. invoice + nama unik). */
function propose(files, existing, rules, invoice) {
  const taken = new Set(existing.map(norm))
  return files.map((file) => {
    let n = clean(file.name)
    if (rules.prefix_invoice && invoice && !n.startsWith(`${invoice}_`)) n = `${invoice}_${n}`
    if (rules.dup_policy === 'suffix') n = uniqueName(n, taken)
    taken.add(norm(n))
    return { file, name: n }
  })
}

/**
 * Hook: const [review, dialog] = useUploadNamer({ existing: [...nama], invoice })
 *   const items = await review(fileList) → [{ file, name }] atau null (dibatalkan)
 */
export function useUploadNamer({ existing = [], invoice } = {}) {
  const { data } = useApp()
  const rules = fileRulesOf(data)
  const [rows, setRows] = useState(null)
  const resolver = useRef(null)

  const review = (fileList) => {
    const files = [...(fileList || [])]
    if (!files.length) return Promise.resolve(null)
    setRows(propose(files, existing, rules, invoice).map((r) => { const [base, ext] = splitExt(r.name); return { ...r, base, ext } }))
    return new Promise((res) => { resolver.current = res })
  }
  const close = (val) => { resolver.current?.(val); resolver.current = null; setRows(null) }

  // validasi nama kembar (dengan file lama & antar file baru)
  const taken = new Set(existing.map(norm))
  const errs = (rows || []).map((r, i) => {
    const n = `${clean(r.base)}${r.ext}`
    if (!clean(r.base)) return 'Nama tidak boleh kosong'
    if (taken.has(norm(n))) return 'Nama sudah dipakai di File Project'
    if ((rows || []).some((o, j) => j < i && norm(`${clean(o.base)}${o.ext}`) === norm(n))) return 'Sama dengan file lain di daftar ini'
    return null
  })
  const fixAll = () => {
    const t = new Set(existing.map(norm))
    setRows((rs) => rs.map((r) => { const n = uniqueName(`${clean(r.base) || 'file'}${r.ext}`, t); t.add(norm(n)); const [base] = splitExt(n); return { ...r, base } }))
  }

  const dialog = (
    <Sheet open={!!rows} onClose={() => close(null)} title={`Nama file sebelum upload (${rows?.length || 0})`}
      footer={<>
        <Button variant="outline" className="flex-1" onClick={() => close(null)}>Batal</Button>
        <Button className="flex-[2]" disabled={errs.some(Boolean)} onClick={() => close(rows.map((r) => ({ file: r.file, name: `${clean(r.base)}${r.ext}` })))}><Upload className="h-4 w-4" />Upload {rows?.length} file</Button>
      </>}>
      {rows && <div className="space-y-2">
        <p className="text-xs text-ink-mute">Ubah nama bila perlu — ekstensi file tetap. {rules.dup_policy === 'suffix' ? 'Nama yang sudah ada otomatis diberi nomor (2), (3)…' : 'Nama yang sudah ada harus diganti dulu.'}</p>
        {rows.map((r, i) => (
          <div key={i} className={cx('rounded-xl p-2.5 ring-1', errs[i] ? 'bg-rose-50 ring-rose-200' : 'bg-slate-50 ring-slate-200')}>
            <p className="mb-1 flex items-center gap-1.5 truncate text-[11px] text-ink-mute"><FileText className="h-3.5 w-3.5 shrink-0" />Asli: {r.file.name} · {kb(r.file.size || 0)}</p>
            <div className="flex items-center rounded-lg bg-white ring-1 ring-slate-300 focus-within:ring-2 focus-within:ring-brand">
              <input value={r.base} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, base: e.target.value } : x)))}
                className="min-w-0 flex-1 rounded-l-lg bg-transparent px-2.5 py-2 text-sm font-semibold focus:outline-none" aria-label={`Nama file ${i + 1}`} />
              {r.ext && <span className="shrink-0 px-2.5 text-sm text-ink-mute">{r.ext}</span>}
            </div>
            {errs[i] && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-rose-600"><AlertTriangle className="h-3.5 w-3.5" />{errs[i]}</p>}
          </div>
        ))}
        {errs.some(Boolean) && <button type="button" onClick={fixAll} className="text-xs font-semibold text-brand underline">Beri nomor otomatis untuk nama yang kembar</button>}
      </div>}
    </Sheet>
  )
  return [review, dialog, rules]
}

/** Cek nama kembar untuk ganti nama file yang sudah ada. */
export const nameTaken = (name, existing) => existing.some((n) => norm(n) === norm(name))
