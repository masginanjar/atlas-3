// ============================================================
//  TUGASKAN PENERJEMAH (CANVAS ATLAS)
//  Popup kecil saat menekan "Tetapkan" di daftar Project (kartu / tabel):
//  kapasitas tiap penerjemah PADA TANGGAL DEADLINE project ini, bisa
//  disematkan (pin) ke atas, pilih satu, lalu Tetapkan.
// ============================================================
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cx } from './ui.jsx'
import { useApp } from '../lib/store.jsx'
import { flowOf } from '../config/workflows.js'
import { invoiceLabel } from '../config/access.js'
import { kapasitasHarian } from './Kapasitas.jsx'
import { halamanSub } from '../pages/Dashboard.jsx'

const KUNCI_PIN = 'atlas-pin-penerjemah'
const muatPin = () => { try { return JSON.parse(localStorage.getItem(KUNCI_PIN) || '{}') || {} } catch { return {} } }
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export default function TugaskanPenerjemah({ p, sub, onClose = () => {}, onLainnya, inline }) {
  const { data, assignTranslator, notify } = useApp()
  const [pilih, setPilih] = useState('')
  const [pin, setPin] = useState(muatPin)
  const [sibuk, setSibuk] = useState(false)
  const dl = String(p.about?.deadline || '').slice(0, 10)
  const hari = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10)
  const besok = new Date(Date.now() + 32 * 3600e3).toISOString().slice(0, 10)
  const tglTeks = !dl ? 'tanpa deadline' : dl === hari ? 'Hari ini' : dl === besok ? 'Besok' : `${Number(dl.slice(8, 10))} ${BULAN[Number(dl.slice(5, 7)) - 1]}`

  useEffect(() => { if (inline) return undefined; const esc = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc) }, [onClose, inline])

  const baris = useMemo(() => {
    // halaman yang sedang dipegang tiap penerjemah dengan deadline di tanggal yang sama
    const pakai = {}
    for (const pr of data.projects) for (const x of pr.sub_projects || []) {
      const uid = x.data?.translator; const d = String(pr.about?.deadline || '').slice(0, 10)
      if (!uid || x.stage !== 'penerjemahan' || !d || (dl ? d !== dl : d !== hari)) continue
      pakai[uid] = (pakai[uid] || 0) + halamanSub(x, flowOf(x, pr))
    }
    return data.users.filter((u) => u.role === 'penerjemah' && u.active !== false).map((u) => {
      const isi = pakai[u.id] || 0; const maks = kapasitasHarian(u, data.kapasitas) || 1
      const pc = Math.round((isi / maks) * 100)
      const [bg, fg, ket] = pc >= 90 ? ['#FFD9E2', '#A3123E', 'Penuh'] : pc >= 65 ? ['#FFE7D1', '#9A3A06', 'Hampir penuh'] : ['#E2F5E8', '#17693A', 'Longgar']
      return { u, isi, maks, pc, bg, fg, ket }
    }).sort((a, b) => ((pin[b.u.id] ? 1 : 0) - (pin[a.u.id] ? 1 : 0)) || (a.isi / a.maks - b.isi / b.maks) || a.u.name.localeCompare(b.u.name))
  }, [data.projects, data.users, data.kapasitas, dl, hari, pin])

  const tukarPin = (id) => setPin((m) => { const n = { ...m, [id]: !m[id] }; try { localStorage.setItem(KUNCI_PIN, JSON.stringify(n)) } catch { /* abaikan */ } return n })
  const nama = (u) => u.display_name || u.name.split(' ')[0]
  const terpilih = baris.find((b) => b.u.id === pilih)

  const tetapkan = async () => {
    if (!pilih) return
    setSibuk(true)
    try {
      await assignTranslator(p, sub.id, { kind: 'internal', id: pilih })
      notify(`${invoiceLabel(p.invoice_no)}: masuk To-Do ${terpilih ? nama(terpilih.u) : ''}`)
      onClose()
    } catch (e) { notify(e.message, 'err'); setSibuk(false) }
  }

  const arah = [sub.lang_from, sub.lang_to].filter(Boolean).join(' → ')
  const isi = (
    <>
        <div className="flex items-baseline justify-between gap-2.5">
          <strong className="text-[13px] font-semibold">Kapasitas penerjemah</strong>
          <span className="whitespace-nowrap text-xs text-[#5E6380]">Deadline {tglTeks}</span>
        </div>
        <div role="radiogroup" aria-label="Pilih penerjemah" className={inline ? 'grid gap-1.5 sm:grid-cols-2 2xl:grid-cols-3' : 'flex flex-col gap-1'} data-daftar-kapasitas>
          {baris.map((b) => { const on = pilih === b.u.id; const dipin = !!pin[b.u.id]; return (
            <div key={b.u.id} className="grid grid-cols-[30px_minmax(0,1fr)] items-center gap-1">
              <button type="button" aria-pressed={dipin} onClick={() => tukarPin(b.u.id)} title={(dipin ? 'Lepas sematan ' : 'Sematkan di atas: ') + nama(b.u)} aria-label={(dipin ? 'Lepas sematan ' : 'Sematkan di atas: ') + nama(b.u)}
                className="grid h-[30px] w-[30px] place-items-center rounded-lg" style={{ color: dipin ? '#4169E1' : '#8A8FA8' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill={dipin ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 4h6l-1 6 3 3v2H7v-2l3-3-1-6z" /><path d="M12 15v6" /></svg>
              </button>
              <button type="button" role="radio" aria-checked={on} onClick={() => setPilih(b.u.id)} data-pilih-penerjemah={b.u.id}
                className={cx('grid grid-cols-[minmax(64px,84px)_minmax(0,1fr)_auto] items-center gap-x-2.5 rounded-[10px] border-2 px-2.5 text-left', inline ? 'min-h-[40px] sm:grid-cols-[76px_minmax(0,1fr)_auto]' : 'min-h-[44px] sm:grid-cols-[84px_minmax(0,1fr)_78px_100px]')}
                style={{ borderColor: on ? '#4169E1' : '#E7E8F0', background: on ? '#F3F6FF' : '#FFFFFF' }}>
                <span className="truncate text-[13px] font-bold">{nama(b.u)}</span>
                <span role="img" aria-label={`Terisi ${b.pc} persen`} className="block h-2 overflow-hidden rounded bg-[#EEF0F5]"><span className="block h-full rounded" style={{ width: `${Math.min(100, b.pc)}%`, background: b.fg }} /></span>
                {!inline && <span className="hidden whitespace-nowrap text-xs tabular-nums text-[#5E6380] sm:block">{b.isi}/{b.maks} Hal</span>}
                <span className="justify-self-end whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-bold" style={{ background: b.bg, color: b.fg }}>
                  <span className={inline ? '' : 'sm:hidden'}>{b.isi}/{b.maks}{inline ? '' : ' · '}</span>{!inline && b.ket}
                </span>
              </button>
            </div>
          ) })}
          {!baris.length && <p className="rounded-xl bg-[#F3F4F9] px-3 py-3 text-[13px] text-[#5E6380]">Belum ada penerjemah aktif.</p>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 pt-1" data-kaki-tugaskan>
          {onLainnya && <button type="button" onClick={onLainnya} className="mr-auto min-h-[44px] rounded-[10px] px-2 text-[13px] font-semibold text-[#0B5C8A] hover:underline">Vendor / koordinator…</button>}
          {!inline && <button type="button" onClick={onClose} className="min-h-[44px] rounded-[10px] border border-[#D9DBE7] bg-white px-4 text-[13px] font-semibold">Batal</button>}
          <button type="button" onClick={tetapkan} disabled={!pilih || sibuk} data-aksi="tetapkan-penerjemah"
            className="min-h-[44px] rounded-[10px] px-4 text-[13px] font-bold text-white disabled:cursor-not-allowed" style={{ background: pilih ? '#141B34' : '#A9AEC4' }}>
            {sibuk ? 'Menyimpan…' : terpilih ? `Tetapkan ${nama(terpilih.u)}` : 'Tetapkan'}
          </button>
        </div>
    </>
  )
  if (inline) return <div className="flex flex-col gap-2 p-3" data-tugaskan-inline>{isi}</div>
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-[#141B34]/30 p-2 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()} data-tugaskan-penerjemah>
      <div role="dialog" aria-modal="true" aria-labelledby="tg-judul" className="flex max-h-[90vh] w-[500px] max-w-full flex-col gap-3 overflow-y-auto rounded-2xl border border-[#DADDE8] bg-white p-[18px] text-[#141B34] shadow-[0_18px_48px_rgba(20,27,52,0.28)]">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 id="tg-judul" className="text-base font-medium">Tugaskan penerjemah</h2>
            <span className="break-words text-[13px] text-[#5E6380]">{invoiceLabel(p.invoice_no)} · {p.customer?.name || '—'}{arah && ` · ${arah}`}{sub.title && ` · ${sub.title}`}</span>
          </div>
          <button type="button" aria-label="Tutup" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] text-[#5E6380] hover:bg-[#F3F4F9]"><X className="h-[18px] w-[18px]" /></button>
        </div>
        {isi}
      </div>
    </div>, document.body)
}
