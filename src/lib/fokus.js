// Mode fokus: menyembunyikan baris alat (judul, tab, pencarian, filter) di semua halaman
// supaya layar penuh untuk data. Tersimpan per perangkat; dipakai lewat atribut data-alat.
import { useSyncExternalStore } from 'react'
const KEY = 'atlas-fokus'
const baca = () => { try { return localStorage.getItem(KEY) === '1' } catch { return false } }
let nilai = baca()
const dengar = new Set()
const terapkan = () => { document.documentElement.dataset.fokus = nilai ? '1' : '0' }
terapkan()
export const setFokus = (v) => { nilai = !!v; try { localStorage.setItem(KEY, nilai ? '1' : '0') } catch { /* abaikan */ } terapkan(); dengar.forEach((f) => f()) }
export const toggleFokus = () => setFokus(!nilai)
export const useFokus = () => useSyncExternalStore((f) => { dengar.add(f); return () => dengar.delete(f) }, () => nilai, () => false)
