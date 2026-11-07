import { ChevronRight, Folder, FolderOpen, FileText, HardDrive, Trash2 } from 'lucide-react'
import { cx } from './ui.jsx'
import { labelProject } from '../lib/dokumen.js'

/**
 * Pohon folder di sisi kiri.
 * Cabang → Project → nama berkas. Panah membuka cabangnya tanpa memindahkan
 * folder yang sedang ditampilkan di area utama; nama folder yang diklik baru
 * memindahkannya. Isi cabang dibuat hanya saat dibuka, jadi tetap ringan
 * walaupun folder berisi banyak berkas.
 * Jumlah berkas/project di tiap folder hanya ditampilkan untuk peran yang
 * memang perlu melihat perbandingan antar cabang (tampilJumlah).
 */
export default function PohonFolder({
  cabangList, isiCabang, isiProject, buka, onToggle, aktif, onPilihCabang, onPilihProject, onPilihAkar,
  onPilihBerkas, trashN, onPilihTrash, tampilJumlah = true,
}) {
  const Panah = ({ terbuka, onClick, label }) => (
    <button type="button" onClick={onClick} aria-label={`${terbuka ? 'Tutup' : 'Buka'} ${label}`} aria-expanded={terbuka}
      className="grid h-6 w-6 shrink-0 place-items-center rounded text-ink-mute transition hover:bg-slate-200 hover:text-ink">
      <ChevronRight className={cx('h-3.5 w-3.5 transition-transform', terbuka && 'rotate-90')} />
    </button>
  )

  return (
    <nav aria-label="Pohon folder" className="min-w-0 text-[13px]">
      <button type="button" data-pohon="akar" onClick={onPilihAkar}
        className={cx('flex w-full min-h-[32px] items-center gap-1.5 rounded-lg px-2 text-left font-semibold transition',
          aktif.jenis === 'akar' ? 'bg-brand-soft text-brand' : 'text-ink hover:bg-slate-100')}>
        <HardDrive className="h-4 w-4 shrink-0" />
        <span className="min-w-0 truncate">Semua Cabang</span>
      </button>

      <ul className="mt-0.5 space-y-0.5">
        {cabangList.map((c) => {
          const kunciC = `c:${c.nama}`
          const terbukaC = buka.has(kunciC)
          return (
            <li key={c.nama}>
              <div className={cx('flex min-h-[32px] items-center gap-0.5 rounded-lg pl-1 pr-1.5',
                aktif.jenis === 'cabang' && aktif.cabang === c.nama ? 'bg-brand-soft' : 'hover:bg-slate-100')}>
                <Panah terbuka={terbukaC} label={`folder ${c.nama}`} onClick={() => onToggle(kunciC)} />
                <button type="button" data-pohon="cabang" onClick={() => onPilihCabang(c.nama)}
                  className={cx('flex min-w-0 flex-1 items-center gap-1.5 text-left',
                    aktif.jenis === 'cabang' && aktif.cabang === c.nama ? 'font-bold text-brand' : 'text-ink')}>
                  {terbukaC ? <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" /> : <Folder className="h-4 w-4 shrink-0 text-amber-500" />}
                  <span className="min-w-0 truncate">{c.nama}</span>
                </button>
                {tampilJumlah && <span className="shrink-0 text-[10px] tabular-nums text-ink-mute" data-jml-cabang>{c.n}</span>}
              </div>

              {terbukaC && (
                <ul className="ml-3 border-l border-slate-200 pl-1">
                  {isiCabang(c.nama).map((g) => {
                    const kunciP = `p:${g.p.id}`
                    const terbukaP = buka.has(kunciP)
                    return (
                      <li key={g.p.id}>
                        <div className={cx('flex min-h-[32px] items-center gap-0.5 rounded-lg pl-1 pr-1.5',
                          aktif.jenis === 'project' && aktif.projectId === g.p.id ? 'bg-brand-soft' : 'hover:bg-slate-100')}>
                          <Panah terbuka={terbukaP} label={`folder ${labelProject(g.p)}`} onClick={() => onToggle(kunciP)} />
                          <button type="button" data-pohon="project" onClick={() => onPilihProject(c.nama, g.p.id)} title={labelProject(g.p)}
                            className={cx('flex min-w-0 flex-1 items-center gap-1.5 text-left',
                              aktif.jenis === 'project' && aktif.projectId === g.p.id ? 'font-bold text-brand' : 'text-ink-soft')}>
                            {terbukaP ? <FolderOpen className="h-4 w-4 shrink-0 text-sky-500" /> : <Folder className="h-4 w-4 shrink-0 text-sky-500" />}
                            <span className="min-w-0 truncate">{labelProject(g.p)}</span>
                          </button>
                          {tampilJumlah && <span className="shrink-0 text-[10px] tabular-nums text-ink-mute" data-jml-project>{g.n}</span>}
                        </div>

                        {terbukaP && (
                          <ul className="ml-3 border-l border-slate-200 pl-1">
                            {isiProject(g.p.id).map((f) => (
                              <li key={f.key}>
                                <button type="button" data-pohon="berkas" onClick={() => onPilihBerkas(c.nama, g.p.id, f)} title={f.name}
                                  className="flex min-h-[32px] w-full items-center gap-1.5 rounded-lg px-1.5 text-left text-ink-mute transition hover:bg-slate-100 hover:text-ink">
                                  <FileText className="h-3.5 w-3.5 shrink-0" />
                                  <span className="min-w-0 truncate text-[12px]">{f.name}</span>
                                </button>
                              </li>
                            ))}
                            {isiProject(g.p.id).length === 0 && (
                              <li className="px-2 py-1 text-[11px] text-ink-mute">folder kosong</li>
                            )}
                          </ul>
                        )}
                      </li>
                    )
                  })}
                  {isiCabang(c.nama).length === 0 && <li className="px-2 py-1 text-[11px] text-ink-mute">belum ada project</li>}
                </ul>
              )}
            </li>
          )
        })}
      </ul>

      {trashN > 0 && (
        <button type="button" data-pohon="trash" onClick={onPilihTrash}
          className={cx('mt-2 flex min-h-[32px] w-full items-center gap-1.5 rounded-lg border-t border-slate-200 px-2 pt-2 text-left transition',
            aktif.jenis === 'trash' ? 'font-bold text-rose-700' : 'text-ink-soft hover:bg-slate-100')}>
          <Trash2 className="h-4 w-4 shrink-0 text-rose-500" />
          <span className="min-w-0 flex-1 truncate">Trash</span>
          {tampilJumlah && <span className="shrink-0 text-[10px] tabular-nums text-ink-mute" data-jml-trash>{trashN}</span>}
        </button>
      )}
    </nav>
  )
}
