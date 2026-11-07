// ATLAS Alfa — Superadmin menetapkan kata sandi pengguna lain.
//
// Service role key TIDAK pernah ada di kode front-end. Fungsi ini berjalan di
// server Supabase; kuncinya diambil dari env rahasia milik project.
//
// Alur:
//   1. Front-end mengirim access token miliknya sendiri (Authorization: Bearer <jwt>).
//   2. Fungsi memverifikasi token itu ke Supabase Auth.
//   3. Fungsi membaca baris public.users milik email tersebut; hanya role
//      'superadmin' yang boleh lanjut.
//   4. Baru kemudian kata sandi target diubah memakai Admin API.
//
// Tidak ada jalan untuk menaikkan hak akses dari sisi browser: peran dibaca
// ulang dari database, bukan dari apa yang dikirim front-end.

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const URL_ = Deno.env.get("SUPABASE_URL")!
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } })

/** Kata sandi minimal: 8 karakter. */
const sandiValid = (p: unknown) => typeof p === "string" && p.length >= 8 && p.length <= 72

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (req.method !== "POST") return json({ error: "method" }, 405)

  try {
    const auth = req.headers.get("Authorization") || ""
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : ""
    if (!token || token === ANON) return json({ error: "Harus masuk sebagai Superadmin." }, 401)

    // 1. Siapa yang memanggil?
    const asUser = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } })
    const { data: me, error: meErr } = await asUser.auth.getUser()
    const email = me?.user?.email?.toLowerCase()
    if (meErr || !email) return json({ error: "Sesi tidak sah. Masuk ulang." }, 401)

    const admin = createClient(URL_, SERVICE)

    // 2. Perannya dibaca dari database, bukan dari front-end.
    const { data: rows } = await admin.from("users").select("id, doc").limit(2000)
    const akun = (rows || []).find((r: any) => String(r.doc?.email || "").toLowerCase() === email)
    if (!akun || akun.doc?.role !== "superadmin" || akun.doc?.active === false) {
      return json({ error: "Hanya Superadmin yang boleh mengubah kata sandi pengguna lain." }, 403)
    }

    const body = await req.json().catch(() => ({}))
    const target = String(body.email || "").trim().toLowerCase()
    const sandi = body.password
    if (!target) return json({ error: "Email pengguna belum diisi." }, 400)
    if (!sandiValid(sandi)) return json({ error: "Kata sandi minimal 8 karakter." }, 400)

    // 3. Pengguna target harus memang terdaftar di ATLAS.
    const targetRow = (rows || []).find((r: any) => String(r.doc?.email || "").toLowerCase() === target)
    if (!targetRow) return json({ error: "Email itu tidak terdaftar di ATLAS." }, 404)

    // 4. Cari akun login-nya, lalu ubah kata sandinya.
    let authUser: any = null
    for (let page = 1; page <= 20 && !authUser; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
      if (error) return json({ error: error.message }, 500)
      authUser = (data?.users || []).find((u: any) => String(u.email || "").toLowerCase() === target)
      if ((data?.users || []).length < 200) break
    }

    if (authUser) {
      const { error } = await admin.auth.admin.updateUserById(authUser.id, { password: sandi })
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true, dibuat: false, nama: targetRow.doc?.name || target })
    }

    // Belum punya akun login → sekalian dibuatkan dan langsung dikonfirmasi.
    const { error } = await admin.auth.admin.createUser({ email: target, password: sandi, email_confirm: true })
    if (error) return json({ error: error.message }, 500)
    return json({ ok: true, dibuat: true, nama: targetRow.doc?.name || target })
  } catch (e) {
    return json({ error: (e as Error).message || "Gagal memproses" }, 500)
  }
})
