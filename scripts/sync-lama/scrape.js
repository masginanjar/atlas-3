// Jalankan di halaman https://atlas.247sworntranslator.com/admin/projects (browser bawaan Claude, sudah login).
// Membaca tabel Livewire (maks. 100 entri terakhir, 50/halaman), berhenti saat Timestamp < SEJAK.
// Hasil: window.__scrape (array baris) — ambil dengan JSON.stringify(window.__scrape).
const SEJAK = '2026-11-01'
const w = Livewire.all().find((c) => c.name.includes('list-projects'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const extract = () => {
  const t = document.querySelector('table.fi-ta-table'); if (!t) return []
  const heads = [...t.querySelectorAll('thead th')].map((h) => h.textContent.trim()); const seen = {}
  const keys = heads.map((h) => { seen[h] = (seen[h] || 0) + 1; return seen[h] > 1 ? `${h}_${seen[h]}` : h })
  return [...t.querySelectorAll('tbody tr')].map((tr) => {
    const o = {}
    ;[...tr.querySelectorAll('td')].forEach((td, i) => { const k = keys[i]; if (!k || k.startsWith('Select')) return; const s = td.querySelector('select'); o[k] = s ? (s.selectedOptions[0]?.textContent.trim() || '') : td.innerText.replace(/\s+/g, ' ').trim() })
    const m = /records\.([0-9a-f-]{36})/.exec(tr.getAttribute('wire:key') || ''); o.__id = m ? m[1] : ''
    if (o['Penerjemah/Vendor'] === 'Select an option') o['Penerjemah/Vendor'] = ''
    return o
  })
}
await w.$wire.set('tableRecordsPerPage', 50); await sleep(2500)
await w.$wire.call('gotoPage', 1, 'page'); await sleep(3000)
const all = []; let stop = false
for (let p = 1; p <= 20 && !stop; p++) {
  if (p > 1) { await w.$wire.call('gotoPage', p, 'page'); await sleep(3000) }
  let rows = extract(); let tries = 0; while (!rows.length && tries++ < 4) { await sleep(1500); rows = extract() }
  if (!rows.length) break
  let added = 0
  for (const r of rows) { const m = /^(\d{2})-(\d{2})-(\d{4})/.exec(r.Timestamp || ''); const iso = m ? `${m[3]}-${m[2]}-${m[1]}` : ''; if (iso && iso < SEJAK) { stop = true; break } if (!all.some((x) => x.__id === r.__id)) { all.push(r); added++ } }
  if (!added) break
}
window.__scrape = all
;({ n: all.length, first: all[0]?.Timestamp, last: all[all.length - 1]?.Timestamp })
