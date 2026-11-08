# Sinkron ATLAS lama → ATLAS Alfa

Dipakai tugas terjadwal. Tidak ada data pelanggan di folder ini (hanya skrip + contoh master).

1. Scrape tabel `https://atlas.247sworntranslator.com/admin/projects` lewat browser bawaan Claude (sesi login pemilik) → `scrape.json`
2. `python3 -I build-xlsx.py scrape.json projects.xlsx`
3. `python3 -I ../legacy/transform.py projects.xlsx payload.json mapping.csv`
4. `live-mem.json` = `live-mem.sample.json` + `live_invoices` (hasil `select invoice_no from projects` di Supabase)
5. `node run-import.mjs payload.json live-mem.json new-projects.json new-master.json`
6. `python3 -I to-sql.py new-projects.json new-master.json out/` → jalankan `out/master.sql`, `out/projects-*.sql`, `out/enrich.sql` lewat MCP Supabase
Semua INSERT memakai `on conflict (id) do nothing` → aman diulang; project yang sudah ada tidak disentuh.
