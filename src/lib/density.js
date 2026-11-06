import { useEffect, useState } from 'react'

// ============================================================
//  KEPADATAN TAMPILAN — jarak atas-bawah tiap baris daftar/tabel.
//  Pilihannya: Rapat / Normal / Lega. Tersimpan per perangkat.
//  Berkas terpisah supaya bisa dipakai App dan halaman mana pun
//  tanpa saling impor (menghindari impor melingkar).
// ============================================================
export const DENSITIES = [['compact', 'Rapat'], ['comfortable', 'Normal'], ['lega', 'Lega']]

const read = () => { try { return localStorage.getItem('atlas-density') || 'comfortable' } catch { return 'comfortable' } }

/** [kepadatan, set] — perubahan disiarkan agar semua tombolnya ikut berubah. */
export function useDensity() {
  const [d, setD] = useState(read)
  useEffect(() => {
    const f = () => setD(read())
    window.addEventListener('atlas-density', f)
    return () => window.removeEventListener('atlas-density', f)
  }, [])
  useEffect(() => { document.documentElement.dataset.density = d }, [d])
  const set = (v) => {
    try { localStorage.setItem('atlas-density', v) } catch { /* abaikan */ }
    setD(v)
    window.dispatchEvent(new Event('atlas-density'))
  }
  return [d, set]
}
