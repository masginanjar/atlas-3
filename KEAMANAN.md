# Aturan keamanan repo ATLAS

Repo ini **publik** (GitHub Pages butuh repo publik di paket gratis).
Siapa pun bisa membaca dan mengunduh isinya, termasuk riwayat Git.

## Jangan pernah di-commit

1. **Data pelanggan asli** — nama, nomor HP, alamat, email, kota/kode pos.
   Satu-satunya payload impor yang boleh masuk Git adalah
   `src/lib/legacy/payload-*.masked.json`. Dump aslinya disimpan di luar
   Git. Pola berkasnya sudah dikunci di `.gitignore` — jangan dilonggarkan.
2. **Kunci rahasia** — `service_role` key Supabase, secret Zoho, token
   apa pun. Kode front-end ikut terkirim ke browser, jadi kunci rahasia
   di sana sama dengan dipublikasikan.
   Yang boleh ada di kode/workflow hanya kunci **publishable**
   (`sb_publishable_…`), yang memang dirancang untuk publik.
3. **Berkas ekspor** — `.xlsx`, `.csv`, backup JSON dari sistem lama.

Kalau sesuatu sudah ter-commit, menghapusnya di commit baru **tidak cukup**:
berkasnya masih bisa diunduh dari riwayat. Riwayatnya harus ditulis ulang
(`git filter-repo --invert-paths`) lalu force-push.

## Pengamanan data ada di database, bukan di UI

Menyembunyikan tombol atau menu **tidak** mengamankan data — siapa pun bisa
memanggil API Supabase langsung dengan kunci publishable. Semua pembatasan
wajib ada di RLS:

- `anon` (pengunjung tanpa login) tidak boleh membaca tabel apa pun.
- Peran `cs` dan `staf_apostille` dibatasi cabangnya sendiri, untuk
  **SELECT, INSERT, dan UPDATE**. Peran lain lolos lewat `app_sees_all()`.
- Fungsi `SECURITY DEFINER` yang hanya dipakai cron atau Edge Function
  (`zoho_sync_call`, `zoho_detail_queue`, `portal_hits_sweep`) tidak boleh
  punya `EXECUTE` untuk `PUBLIC`/`anon`/`authenticated`.

**Pengecualian penting:** fungsi pembantu `app_user()`, `app_role()`,
`app_branches()`, `app_sees_all()`, `app_is_staff()`, `app_user_id()`
**harus** tetap bisa di-`EXECUTE` oleh `authenticated`. Ekspresi RLS
dievaluasi dengan hak pemanggil, jadi mencabutnya akan mematikan seluruh
RLS. Linter Supabase menandainya sebagai peringatan — itu wajar untuk
desain ini dan jangan "diperbaiki". Keenam fungsi itu hanya mengembalikan
data pemanggilnya sendiri.

## Setelah mengubah RLS, uji per peran

Jangan hanya cek sebagai Superadmin. Simulasikan pengguna sungguhan:

```sql
perform set_config('request.jwt.claims',
  json_build_object('sub', <auth_id>, 'role','authenticated')::text, true);
set local role authenticated;
-- lalu: bisa baca/ubah data cabangnya sendiri?
--       tertolak untuk data cabang lain?
```

Uji juga lewat `app_patch()`, karena itu jalur tulis yang dipakai aplikasi.
Fungsi itu `SECURITY INVOKER`, jadi RLS tetap berlaku — biarkan begitu.
