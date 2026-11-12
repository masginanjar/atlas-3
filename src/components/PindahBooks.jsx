import { BookOpen, ArrowUpRight } from 'lucide-react'
import { useApp } from '../lib/store.jsx'

/** Peran tim penerjemahan tidak perlu ATLAS Books. */
const TANPA_BOOKS = ['penerjemah', 'proofreader', 'otorisator']

/** Alamat ATLAS Books diatur di app_settings 'atlas_books' ({ url }). Selama kosong, tombol tampil "Segera". */
export function useAtlasBooks() {
  const { user, data } = useApp()
  const url = ((data.app_settings || []).find((r) => r.key === 'atlas_books') || {}).url || ''
  const boleh = !!user && !TANPA_BOOKS.includes(user.role)
  return { boleh, url }
}

/** Tombol beralih ke ATLAS Books — untuk menu akun / menu aplikasi. */
export default function PindahBooks({ onPilih }) {
  const { boleh, url } = useAtlasBooks()
  if (!boleh) return null
  const isi = (
    <>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#EEEBFF] text-[#4B3FB5]"><BookOpen className="h-4 w-4" aria-hidden="true" /></span>
      <span className="min-w-0 flex-1">
        <b className="block text-[13px] leading-tight">Beralih ke ATLAS Books</b>
        <span className="block text-[11.5px] text-ink-mute">Tagihan, invoice &amp; keuangan</span>
      </span>
      {url ? <ArrowUpRight className="h-4 w-4 text-ink-mute" aria-hidden="true" /> : <span className="rounded-full bg-[#EEF0F5] px-2 py-0.5 text-[10.5px] font-bold text-[#4A4F6A]">Segera</span>}
    </>
  )
  const kelas = 'flex min-h-[48px] w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-ink'
  return url
    ? <a href={url} role="menuitem" onClick={onPilih} data-aksi="pindah-books" className={kelas + ' hover:bg-slate-50'}>{isi}</a>
    : <div role="menuitem" aria-disabled="true" data-aksi="pindah-books" title="ATLAS Books sedang disiapkan" className={kelas + ' cursor-default opacity-80'}>{isi}</div>
}
