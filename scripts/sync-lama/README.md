# Sinkron ATLAS lama → ATLAS Alfa (live Supabase)

Dipakai tugas terjadwal tiap jam. Folder ini tidak berisi data pelanggan (hanya skrip + contoh master).
Project Supabase: `cdeiirdxrxogspqmesik`. Kerjakan di folder sementara di luar repo (mis. /tmp/sync).

1. Buka `https://atlas.247sworntranslator.com/admin/projects` di browser bawaan Claude (sesi login pemilik).
   Bila yang terbuka halaman login → berhenti, laporkan "sesi ATLAS lama habis, perlu login ulang"; jangan mengetik kata sandi.
2. Jalankan isi `scrape.js` lewat javascript_tool, lalu `JSON.stringify(window.__scrape)` → simpan ke `scrape.json`
   (hasil tool besar disimpan ke file; baca & parse file itu, bukan menyalin ulang teksnya).
3. `python3 -I build-xlsx.py scrape.json projects.xlsx`
4. `python3 -I ../legacy/transform.py projects.xlsx payload.json mapping.csv`
5. `live-mem.json` = `live-mem.sample.json` dengan `live_invoices` diisi hasil
   `select json_agg(doc->>'invoice_no') from projects;` (MCP Supabase execute_sql).
6. `node run-import.mjs payload.json live-mem.json new-projects.json new-master.json` → bila `baru: 0`, selesai.
7. `python3 -I to-sql.py new-projects.json new-master.json out/` → jalankan `out/master.sql`, lalu setiap `out/projects-*.sql`,
   lalu `out/enrich.sql` lewat MCP Supabase execute_sql (boleh digabung dalam satu panggilan).
8. Laporkan singkat: jumlah project baru + nomor invoice + cabang. Jangan mengulang data pelanggan.
Semua INSERT memakai `on conflict (id) do nothing` → aman diulang; project yang sudah ada tidak disentuh.
Daftar ATLAS lama hanya memuat 100 entri terakhir, karena itu sinkron harus rutin.
