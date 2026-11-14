import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ============================================================
//  MODUL PENGIRIMAN (tabel kirim) ⇄ Everpro. Dipanggil dari ATLAS oleh staf yang login.
//  aksi: tarif · lokasi · jemput_cabang · pesan_kirim · sinkron_kirim · label_kirim · batal_kirim · sinkron_semua
//  Data dibaca/ditulis ATAS NAMA pengguna → RLS cabang tetap berlaku.
//  Kunci Everpro hanya di Secrets server (EVERPRO_CLIENT_KEY / _SECRET).
//  Uji baca-saja (tarif/lokasi/jemput_cabang) boleh dengan header x-uji-token.
// ============================================================
const BASE = "https://client-api.everpro.id";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-uji-token", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", ...CORS } });
const ZONA: Record<string, string> = { Bali: "Asia/Makassar", Makassar: "Asia/Makassar" };

const hp = (s: unknown) => { let d = String(s ?? "").replace(/\D/g, ""); if (d.startsWith("0")) d = "62" + d.slice(1); else if (d.startsWith("8")) d = "62" + d; return d; };

async function token() {
  const ck = (Deno.env.get("EVERPRO_CLIENT_KEY") ?? "").trim(), cs = (Deno.env.get("EVERPRO_CLIENT_SECRET") ?? "").trim();
  if (!ck || !cs) throw new Error("Kunci Everpro belum diisi di server");
  const r = await fetch(BASE + "/auth/v1/token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_key: ck, client_secret: cs }) });
  const x = await r.json().catch(() => ({}));
  const t = x?.data?.token ?? x?.token ?? x?.data?.access_token ?? x?.access_token;
  if (!t) throw new Error("Login Everpro gagal (" + r.status + ")");
  return t as string;
}
async function ep(t: string, path: string, init: RequestInit = {}) {
  const r = await fetch(BASE + path, { ...init, headers: { Authorization: "Bearer " + t, "Content-Type": "application/json", ...(init.headers || {}) } });
  const x = await r.json().catch(() => ({}));
  if (!r.ok) { const m = String(x?.message ?? x?.error ?? "").slice(0, 200); const e = new Error(`Everpro ${r.status}${m ? ": " + m : ""}`); (e as any).detail = JSON.stringify(x?.errors ?? x?.data ?? null).slice(0, 400); throw e; }
  return x;
}

async function jadwalJemput(t: string, rate: string, zona: string) {
  const x = await ep(t, `/shipment/v1/pickup-times?rate_codes=${encodeURIComponent(rate)}&timezone=${encodeURIComponent(zona)}`);
  const slot: { mulai: number; label: string }[] = [];
  for (const a of x?.data?.available_pickup_time ?? []) for (const h of a.pickup_time_list ?? []) for (const p of h.pickup_times ?? []) {
    if (p.condition === false || p.cut_off === true) continue;
    const mulai = typeof p.start_at === "number" ? p.start_at : Math.floor(Date.parse(String(p.start_at)) / 1000);
    const HARI: Record<string, string> = { Monday: "Senin", Tuesday: "Selasa", Wednesday: "Rabu", Thursday: "Kamis", Friday: "Jumat", Saturday: "Sabtu", Sunday: "Minggu" };
    if (mulai) slot.push({ mulai, label: `${HARI[h.day_name] ?? h.day_name ?? ""} ${h.date ?? ""} · ${p.time_range ?? ""}`.trim() });
  }
  return slot.slice(0, 12);
}

// ---------- Modul Pengiriman (tabel kirim) ----------
const OPS = ["superadmin", "direktur", "admin_pusat", "supervisor", "cs", "helper", "staf_apostille"];
const KEU = ["superadmin", "direktur", "admin_pusat"]; // fitur penting: batal, tarik semua data
/** status_id Everpro → tahap internal. Kode yang tidak dikenal → "perlu_dicek" (tidak dipaksa selesai). */
function tahapDariId(id: unknown): string {
  const n = Number(id);
  if ([100, 101, 102].includes(n)) return "diproses";
  if ([200, 201].includes(n)) return "dibuat";
  if (n === 202) return "gagal_resi";
  if ([300, 301].includes(n)) return "menunggu_jemput";
  if (n === 304) return "gagal_pickup";
  if ([302, 303, 400, 403, 404, 706].includes(n)) return "dikirim";
  if (n === 401) return "batal_diajukan";
  if (n === 402) return "retur_proses";
  if (n === 500) return "terkirim";
  if ([501, 704].includes(n)) return "gagal_kirim";
  if ([600, 602].includes(n)) return "kendala";
  if (n === 601) return "kendala_selesai";
  if ([700, 701].includes(n)) return "dibatalkan";
  if (n === 702) return "dikembalikan";
  if (n === 703) return "hilang_rusak";
  if (n === 705) return "force_majeure";
  return "perlu_dicek";
}
const tgPakai = (d: Date) => new Date(d.getTime() + 8 * 3600e3).toISOString().slice(0, 10);

/** Tarif lengkap untuk satu rute (dipakai Cek Ongkir & Buat Pengiriman). */
async function tarifLengkap(t: string, b: Record<string, any>) {
  const beratKg = Math.max(0.1, Number(b.berat_gram ?? 200) / 1000);
  const body: Record<string, unknown> = {
    origin_postal_code: String(b.asal_kodepos ?? ""), destination_postal_code: String(b.tujuan_kodepos ?? ""),
    package_type_id: 1, shipment_type: b.jenis === "DROP" ? "DROP" : "PICKUP", weight: beratKg, item_price: Math.max(0, Number(b.nilai ?? 0)),
  };
  if (b.asal_kel) body.origin_sub_district_name = String(b.asal_kel);
  if (b.tujuan_kel) body.destination_sub_district_name = String(b.tujuan_kel);
  for (const k of ["length", "width", "height"]) { const v = Math.round(Number(b[k] ?? 0)); if (v >= 1) body[k] = v; }
  if (b.cod) { body.is_cod = true; body.cod_price = Math.round(Number(b.cod_nilai ?? 0)); }
  if (b.asuransi) body.is_use_insurance = true;
  for (const k of ["origin_latitude", "origin_longitude", "destination_latitude", "destination_longitude"]) if (b[k] != null && b[k] !== "") body[k] = Number(b[k]);
  if (Array.isArray(b.rate_codes) && b.rate_codes.length) body.rate_codes = b.rate_codes.map(String);
  if (!/^\d{5}$/.test(String(body.origin_postal_code)) || !/^\d{5}$/.test(String(body.destination_postal_code))) throw new Error("Kode pos asal & tujuan harus 5 angka");
  const x = await ep(t, "/shipment/v2/rates", { method: "POST", body: JSON.stringify(body) });
  const d = x?.data ?? {}; const out: Record<string, unknown>[] = [];
  for (const grup of ["regular", "express", "same_day", "instant", "cargo", "vehicle"]) for (const it of (Array.isArray(d[grup]) ? d[grup] : [])) {
    const ongkir = Number(it.price) || 0, asur = b.asuransi ? Number(it.insurance_price) || 0 : 0, tambah = Number(it.surcharge) || 0;
    out.push({ grup, kurir: it.logistic_name, kode_kurir: it.logistic_code, layanan: it.rate_name ?? it.name, rate_code: it.rate_code, logo: it.logistic_logo_url ?? null,
      ongkir, asuransi: asur, asuransi_tersedia: it.insurance_price != null, biaya_tambahan: tambah, rincian_tambahan: it.surcharge_details ?? null,
      total: ongkir + asur + tambah, cashback: Number(it.cashback) || 0, min_hari: it.min_duration ?? null, max_hari: it.max_duration ?? null, satuan_durasi: it.duration_type ?? "",
      jemput_hari_ini: it.is_available_pickup_today ?? null, flat: !!it.is_flat_rate, kayu: !!it.is_use_wood_packing, berat_volume: it.volume_weight ?? null, berat_dihitung: it.weight ?? null });
  }
  return { tarif: out.filter((r) => r.rate_code), diambil_at: new Date().toISOString(), permintaan: { ...body, origin_latitude: undefined } };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, alasan: "metode tidak didukung" }, 405);
  const URL_ = Deno.env.get("SUPABASE_URL")!, ANON = Deno.env.get("SUPABASE_ANON_KEY")!, SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(URL_, SR, { auth: { persistSession: false } });
  let b: Record<string, any> = {};
  try { b = await req.json(); } catch (_) { return json({ ok: false, alasan: "isi permintaan tidak valid" }, 400); }
  const aksi = String(b.aksi ?? "");
  const uji = req.headers.get("x-uji-token") ?? "";
  let db = admin, user: Record<string, any> | null = null;
  if (uji) {
    const { data: cfg } = await admin.from("pembayaran_gateway_config").select("value").eq("key", "uji_token").maybeSingle();
    const ok = !!cfg?.value && uji.length >= 20 && uji === cfg.value;
    if (!ok || !["tarif", "lokasi", "jemput_cabang"].includes(aksi)) return json({ ok: false, alasan: "tidak diizinkan" }, 401);
  } else {
    const auth = req.headers.get("Authorization") ?? "";
    db = createClient(URL_, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: u } = await db.auth.getUser();
    if (!u?.user) return json({ ok: false, alasan: "silakan login ulang" }, 401);
    const { data: row } = await admin.from("users").select("id, doc, role, active").eq("auth_id", u.user.id).maybeSingle();
    user = row ? { ...row.doc, id: row.id, role: row.role ?? row.doc?.role, active: row.active ?? row.doc?.active } : null;
    if (!user || user.active === false) return json({ ok: false, alasan: "akun tidak dikenal" }, 403);
  }
  try {
    const t = await token();
    // ================= MODUL PENGIRIMAN (tabel kirim) =================
    const peran = String(user?.role ?? "");
    if (aksi === "tarif") return json({ ok: true, ...(await tarifLengkap(t, b)) });
    if (aksi === "lokasi") {
      const q = String(b.q ?? "").trim(), kp = String(b.kodepos ?? "").trim();
      if (!/^\d{5}$/.test(kp) && q.length < 3) return json({ ok: false, alasan: "Ketik minimal 3 huruf nama kelurahan, atau 5 angka kode pos" });
      const x = await ep(t, `/location/v1/sub-districts?${/^\d{5}$/.test(kp) ? "postal_code=" + kp : "sub_district_name=" + encodeURIComponent(q)}`);
      return json({ ok: true, data: (Array.isArray(x?.data) ? x.data : []).slice(0, 30) });
    }
    if (aksi === "jemput_cabang") return json({ ok: true, slot: await jadwalJemput(t, String(b.rate_code), ZONA[String(b.cabang)] ?? "Asia/Jakarta"), zona: ZONA[String(b.cabang)] ?? "Asia/Jakarta" });

    const bacaKirim = async (id: string) => {
      const { data, error } = await db.from("kirim").select("id, doc").eq("id", id).maybeSingle();
      if (error || !data) throw new Error("Pengiriman tidak ditemukan atau bukan cabang Anda");
      return data as { id: string; doc: Record<string, any> };
    };
    const patchKirim = async (id: string, patch: Record<string, unknown>) => {
      const { data, error } = await db.rpc("app_patch", { tbl: "kirim", row_id: id, patch });
      if (error) throw new Error("Gagal menyimpan pengiriman: " + error.message);
      return data;
    };
    const catat = (doc: Record<string, any>, aksiTeks: string) => [...(doc.riwayat ?? []), { at: new Date().toISOString(), by: user?.name ?? "ATLAS", aksi: aksiTeks }].slice(-200);
    /** Simpan peristiwa lacak ke kirim_event (anti dobel lewat `kunci`) & ringkas ke doc.timeline. */
    const simpanLacak = async (k: { id: string; doc: Record<string, any> }, data: any) => {
      const hist = Array.isArray(data?.tracking_history) ? data.tracking_history : [];
      const diterima = new Date().toISOString();
      const ev = hist.map((h: any) => ({ kirim_id: k.id, cabang: k.doc.cabang ?? "", waktu: h.date ?? null, status: h.status ?? "", keterangan: h.description ?? "", foto: Array.isArray(h.image_urls) ? h.image_urls.slice(0, 4) : [], sumber: "Everpro", diterima_at: diterima, kunci: `${k.id}|${h.date ?? ""}|${h.status ?? ""}|${String(h.description ?? "").slice(0, 60)}` }));
      const lama = new Map((k.doc.timeline ?? []).map((e: any) => [`${e.waktu}|${e.status}|${String(e.keterangan ?? "").slice(0, 60)}`, e]));
      for (const e of ev) {
        const kk = `${e.waktu}|${e.status}|${String(e.keterangan).slice(0, 60)}`; if (lama.has(kk)) continue;
        lama.set(kk, { waktu: e.waktu, status: e.status, keterangan: e.keterangan, foto: e.foto, diterima_at: diterima, sumber: "Everpro" });
        await admin.from("kirim_event").insert({ doc: e }).then(() => null, () => null); // kunci unik → tidak dobel
      }
      return [...lama.values()].sort((a: any, z: any) => String(z.waktu ?? "").localeCompare(String(a.waktu ?? ""))).slice(0, 80);
    };
    /** Cari order di Everpro lewat client_order_no (untuk cek hasil yang belum pasti / sinkron). */
    const cariOrder = async (no: string) => {
      const x = await ep(t, `/shipment/v1/orders?client_order_no=${encodeURIComponent(no)}&limit=5&start_date=2020-01-01&end_date=${tgPakai(new Date(Date.now() + 864e5))}`);
      const rows = x?.data?.orders ?? (Array.isArray(x?.data) ? x.data : []);
      return rows.find((o: any) => o.client_order_no === no) ?? null;
    };
    const dariOrder = (o: any) => ({
      status_everpro: o.status ?? "", status_id: o.status_id ?? null, tahap: tahapDariId(o.status_id),
      everpro: { client_order_no: o.client_order_no, no_everpro: o.shipment_order_no ?? "", awb: o.awb_number ?? "", label_url: o.label_url ?? "", batal_diminta: !!o.is_request_cancel_order },
      biaya_aktual: { ongkir: Number(o.shipment_price ?? 0), asuransi: Number(o.insurance_price ?? 0), diskon: Number(o.discount ?? 0), biaya_cod: Number(o.cod_fee ?? 0), total: Number(o.total_price ?? 0), cashback: Number(o.cashback ?? 0) },
      sumber_status: "Everpro", diperbarui_at: new Date().toISOString(),
    });

    if (aksi === "pesan_kirim") {
      if (!OPS.includes(peran)) return json({ ok: false, alasan: "Peran Anda tidak boleh membuat pengiriman" }, 403);
      const k = await bacaKirim(String(b.kirim_id ?? "")); const d = k.doc;
      if (!["draft", "siap", "diproses", "gagal_order"].includes(String(d.tahap))) return json({ ok: false, alasan: "Pengiriman ini sudah dibuat sebelumnya" }, 409);
      // 1) Hasil sebelumnya belum pasti? cek dulu di Everpro, jangan pesan ulang
      if (d.everpro?.client_order_no) {
        const ada = await cariOrder(d.everpro.client_order_no).catch(() => null);
        if (ada) { const u = dariOrder(ada); await patchKirim(k.id, { ...u, everpro: { ...d.everpro, ...u.everpro }, riwayat: catat(d, `Order ditemukan di Everpro (${ada.client_order_no}) — tidak dipesan ulang`) }); return json({ ok: true, sudah_ada: true, ...u }); }
      }
      // 2) validasi
      const pg = d.pengirim ?? {}, pn = d.penerima ?? {}, pk = d.paket ?? {}, kr = d.kurir ?? {};
      const salah: string[] = [];
      if (!/^\d{5}$/.test(String(pg.kodepos ?? ""))) salah.push("kode pos pengirim");
      if (!/^\d{5}$/.test(String(pn.kodepos ?? ""))) salah.push("kode pos penerima");
      if (String(pn.nama ?? "").trim().length < 3) salah.push("nama penerima");
      if (hp(pn.telp).length < 10 || hp(pn.telp).length > 15) salah.push("No. HP penerima");
      if (hp(pg.telp).length < 10 || hp(pg.telp).length > 15) salah.push("No. HP pengirim");
      if (String(pn.alamat ?? "").trim().length < 10) salah.push("alamat penerima");
      if (String(pg.alamat ?? "").trim().length < 10) salah.push("alamat pengirim");
      if (!(Number(pk.berat_gram) > 0)) salah.push("berat paket");
      if (!kr.rate_code) salah.push("layanan kurir");
      if (kr.jenis !== "DROP" && !Number(kr.pickup_time)) salah.push("jadwal jemput");
      if (salah.length) return json({ ok: false, alasan: "Belum lengkap: " + salah.join(", ") });
      // 3) cek ulang tarif sebelum memesan
      const ulang = await tarifLengkap(t, { asal_kodepos: pg.kodepos, asal_kel: pg.kelurahan, tujuan_kodepos: pn.kodepos, tujuan_kel: pn.kelurahan, berat_gram: pk.berat_gram, length: pk.p, width: pk.l, height: pk.t, jenis: kr.jenis, nilai: pk.nilai, asuransi: !!pk.asuransi, cod: !!pk.cod, cod_nilai: pk.cod_nilai, rate_codes: [kr.rate_code] });
      const r = ulang.tarif.find((x: any) => x.rate_code === kr.rate_code) as any;
      if (!r) return json({ ok: false, alasan: "Layanan kurir ini tidak tersedia lagi untuk rute tersebut — pilih ulang kurir" });
      if (Math.round(r.total) !== Math.round(Number(b.total_dilihat ?? kr.total ?? 0))) return json({ ok: false, berubah: true, alasan: `Tarif berubah: ${r.total} (sebelumnya ${b.total_dilihat ?? kr.total}). Periksa lalu konfirmasi ulang.`, tarif: r });
      // 4) kunci nomor order dulu (anti dobel), baru pesan
      const no = d.everpro?.client_order_no || `ATLAS-${String(d.kode || k.id).replace(/[^A-Za-z0-9]/g, "").slice(-12)}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
      await patchKirim(k.id, { tahap: "diproses", everpro: { ...(d.everpro ?? {}), client_order_no: no }, riwayat: catat(d, `Permintaan dikirim ke Everpro (${no})`) });
      const body: Record<string, unknown> = {
        client_order_no: no, order_reference_id: no, package_desc: String(pk.isi || "Dokumen").slice(0, 100), package_price: Math.max(0, Math.round(Number(pk.nilai ?? 0))), package_type_id: 1, package_count: Math.max(1, Number(pk.jumlah ?? 1)),
        rate_code: kr.rate_code, shipment_price: Math.round(r.ongkir), shipment_type: kr.jenis === "DROP" ? "DROP" : "PICKUP", weight: Math.max(0.1, Number(pk.berat_gram) / 1000),
        receiver_name: String(pn.nama).slice(0, 60), receiver_phone: hp(pn.telp), receiver_address: String(pn.alamat).slice(0, 250), receiver_postal_code: String(pn.kodepos), receiver_address_note: String(pn.catatan ?? "").slice(0, 100) || undefined,
        shipper_name: String(pg.nama || "247 Translator").slice(0, 60), shipper_phone: hp(pg.telp), shipper_address: String(pg.alamat).slice(0, 250), shipper_postal_code: String(pg.kodepos), shipper_address_note: String(pg.catatan ?? "").slice(0, 100) || undefined,
        shipping_note: String(d.catatan_kurir || (d.invoice_no ? `Invoice ${d.invoice_no}` : "")).slice(0, 100) || undefined,
      };
      for (const [k2, v] of [["length", pk.p], ["width", pk.l], ["height", pk.t]] as const) if (Number(v) >= 1) body[k2] = Math.round(Number(v));
      if (pk.asuransi) { body.is_use_insurance = true; body.insurance_price = Math.round(r.asuransi); }
      if (pk.cod) { body.is_cod = true; body.cod_price = Math.round(Number(pk.cod_nilai ?? 0)); }
      if (kr.jenis !== "DROP") body.pickup_time = Number(kr.pickup_time);
      let o: any;
      try { o = await ep(t, "/shipment/v1/orders", { method: "POST", body: JSON.stringify(body) }); }
      catch (e) {
        // hasil tidak pasti → cek keberadaan order sebelum menyatakan gagal
        const ada = await cariOrder(no).catch(() => null);
        if (!ada) { await patchKirim(k.id, { tahap: "gagal_order", galat: String((e as Error).message).slice(0, 300), riwayat: catat(d, "Pembuatan order gagal: " + String((e as Error).message).slice(0, 150)) }); throw e; }
        o = { data: { actual_price: ada.total_price } };
      }
      let awb: string | null = null;
      try { await ep(t, `/shipment/v1/orders/${encodeURIComponent(no)}/generate`, { method: "POST", body: "{}" }); } catch (_) { /* resi bisa menyusul (callback AWB) */ }
      try { const a = await ep(t, `/shipment/v1/orders/${encodeURIComponent(no)}/awb`); awb = a?.data?.awb_number ?? null; } catch (_) { /* belum ada */ }
      const sekarang = new Date().toISOString();
      const patch = {
        tahap: awb ? "menunggu_jemput" : "dibuat", status_everpro: awb ? "WAITING" : "", sumber_status: "Everpro", diperbarui_at: sekarang, dipesan_at: sekarang, dipesan_oleh: user?.name ?? "",
        everpro: { ...(d.everpro ?? {}), client_order_no: no, awb: awb ?? "" },
        biaya: { ongkir: r.ongkir, asuransi: r.asuransi, biaya_tambahan: r.biaya_tambahan, total: r.total, cashback_estimasi: r.cashback, tarif_at: ulang.diambil_at, dibayar_everpro: Number(o?.data?.actual_price ?? 0) || null },
        riwayat: catat({ riwayat: [...(d.riwayat ?? []), { at: sekarang, by: user?.name ?? "ATLAS", aksi: `Permintaan dikirim ke Everpro (${no})` }] }, `Order berhasil dibuat di Everpro${awb ? ` · resi ${awb}` : " · menunggu resi"}`),
      };
      await patchKirim(k.id, patch);
      if (d.project_id && d.jenis_kirim === "keluar") {
        const { data: pr } = await db.from("projects").select("id, doc").eq("id", String(d.project_id)).maybeSingle();
        if (pr) { const ab = pr.doc?.about ?? {}; await db.rpc("app_patch", { tbl: "projects", row_id: pr.id, patch: { about: { ...ab, ...(awb ? { resi_no: awb } : {}), courier_name: `${kr.kurir ?? ""} ${kr.layanan ?? ""}`.trim() }, history: [...(pr.doc?.history ?? []), { at: sekarang, by: user?.name ?? "ATLAS", action: `Pengiriman Everpro dibuat: ${kr.kurir ?? ""} ${kr.layanan ?? ""} · ${no}${awb ? ` · resi ${awb}` : ""}` }] } }); }
      }
      return json({ ok: true, ...patch });
    }

    if (aksi === "sinkron_kirim") {
      const k = await bacaKirim(String(b.kirim_id ?? "")); const d = k.doc;
      const no = d.everpro?.client_order_no; if (!no) return json({ ok: false, alasan: "Belum ada order Everpro untuk pengiriman ini" });
      const o = await cariOrder(no);
      if (!o) return json({ ok: false, alasan: "Order belum ditemukan di Everpro — coba lagi beberapa saat" });
      const u: Record<string, any> = dariOrder(o);
      if (o.awb_number) { try { const tr = await ep(t, `/shipment/v1/orders/${encodeURIComponent(o.awb_number)}/track`); u.timeline = await simpanLacak(k, tr?.data); u.lacak_url = tr?.data?.tracking_url ?? ""; u.dikirim_at = tr?.data?.dispatch_at ?? null; u.diterima_at = tr?.data?.delivered_at ?? null; } catch (_) { /* lacak belum ada */ } }
      if (["menunggu_jemput", "dikirim"].includes(String(d.tahap)) && u.tahap === "dibuat") u.tahap = d.tahap; // jangan mundur
      u.everpro = { ...(d.everpro ?? {}), ...u.everpro };
      if (d.tahap !== u.tahap) u.riwayat = catat(d, `Status diperbarui dari Everpro: ${o.status ?? u.tahap}`);
      await patchKirim(k.id, u);
      return json({ ok: true, ...u });
    }

    if (aksi === "label_kirim") {
      if (!OPS.includes(peran)) return json({ ok: false, alasan: "Peran Anda tidak boleh mencetak label" }, 403);
      const ids = (Array.isArray(b.kirim_ids) ? b.kirim_ids : []).map(String).slice(0, 50);
      const rows: { id: string; doc: Record<string, any> }[] = [];
      for (const id of ids) { try { rows.push(await bacaKirim(id)); } catch (_) { /* lewati */ } }
      const siap = rows.filter((r) => r.doc.everpro?.awb && !["dibatalkan", "batal_diajukan"].includes(String(r.doc.tahap)));
      if (!siap.length) return json({ ok: false, alasan: "Belum ada pengiriman terpilih yang punya resi" });
      let url: string | null = null, gagal: unknown[] = [];
      if (siap.length === 1) { const x = await ep(t, `/shipment/v1/orders/${encodeURIComponent(siap[0].doc.everpro.awb)}/label`); url = x?.data?.url_label_pdf ?? null; }
      else { const x = await ep(t, "/shipment/v1/orders/label/bulk", { method: "POST", body: JSON.stringify({ awb_numbers: siap.map((r) => r.doc.everpro.awb) }) }); url = x?.data?.url ?? x?.data?.url_label_pdf ?? null; gagal = x?.data?.errors ?? []; }
      if (!url) return json({ ok: false, alasan: "Everpro belum memberikan file label — coba lagi" });
      const at = new Date().toISOString();
      for (const r of siap) await patchKirim(r.id, { label_log: [...(r.doc.label_log ?? []), { at, by: user?.name ?? "", jenis: siap.length > 1 ? "massal" : "tunggal", jumlah: siap.length }].slice(-30), label_terakhir_at: at }).catch(() => null);
      return json({ ok: true, url, jumlah: siap.length, dilewati: rows.length - siap.length, gagal });
    }

    if (aksi === "batal_kirim") {
      if (!KEU.includes(peran)) return json({ ok: false, alasan: "Pembatalan khusus Superadmin, Direktur & Admin Pusat" }, 403);
      const k = await bacaKirim(String(b.kirim_id ?? "")); const d = k.doc; const id = d.everpro?.awb || d.everpro?.client_order_no;
      if (!id) return json({ ok: false, alasan: "Belum ada order Everpro" });
      const alasan = String(b.alasan || "").trim(); if (alasan.length < 5) return json({ ok: false, alasan: "Tulis alasan pembatalan (min. 5 huruf)" });
      await ep(t, `/shipment/v1/orders/${encodeURIComponent(id)}/cancel`, { method: "POST", body: JSON.stringify({ cancel_reason: alasan.slice(0, 150) }) });
      await patchKirim(k.id, { tahap: "batal_diajukan", batal: { alasan, diajukan_at: new Date().toISOString(), oleh: user?.name ?? "" }, riwayat: catat(d, `Pembatalan diajukan ke Everpro: ${alasan}`) });
      return json({ ok: true, tahap: "batal_diajukan" });
    }

    if (aksi === "sinkron_semua") {
      if (!KEU.includes(peran)) return json({ ok: false, alasan: "Khusus Superadmin, Direktur & Admin Pusat" }, 403);
      const dari = String(b.dari || tgPakai(new Date(Date.now() - 30 * 864e5))), sampai = String(b.sampai || tgPakai(new Date()));
      const { data: setRow } = await admin.from("app_settings").select("doc").eq("id", "alamat_kirim").maybeSingle();
      const cab = Object.entries((setRow?.doc?.cabang ?? {}) as Record<string, any>);
      const tebakCabang = (o: any) => { const kp = String(o.shipper_location_detail ?? "") + " " + String(o.shipper_address ?? ""); const ph = hp(o.shipper_phone_number); const c = cab.find(([, a]) => (a?.telp && hp(a.telp) === ph) || (a?.kodepos && kp.includes(String(a.kodepos)))); return c ? c[0] : ""; };
      let baru = 0, ubah = 0, halaman = 0;
      for (let page = 1; page <= 20; page++) {
        const x = await ep(t, `/shipment/v1/orders?start_date=${dari}&end_date=${sampai}&page=${page}&limit=50`);
        const rows = x?.data?.orders ?? (Array.isArray(x?.data) ? x.data : []); halaman = page;
        const nomor = rows.map((o: any) => o.client_order_no).filter(Boolean);
        const { data: ada } = nomor.length ? await admin.from("kirim").select("id, doc").in("doc->everpro->>client_order_no", nomor) : { data: [] };
        const peta = new Map((ada ?? []).map((r: any) => [r.doc?.everpro?.client_order_no, r]));
        for (const o of rows) {
          const u: Record<string, any> = dariOrder(o); const lama: any = peta.get(o.client_order_no);
          if (lama) {
            if (lama.doc.tahap === u.tahap && lama.doc.everpro?.awb === u.everpro.awb && lama.doc.biaya_aktual?.total === u.biaya_aktual.total) continue;
            await admin.from("kirim").update({ doc: { ...lama.doc, ...u, everpro: { ...(lama.doc.everpro ?? {}), ...u.everpro } }, updated_at: new Date().toISOString() }).eq("id", lama.id); ubah++;
          } else {
            await admin.from("kirim").insert({ doc: { ...u, kode: o.client_order_no, sumber: "Everpro", cabang: tebakCabang(o), jenis_kirim: "lainnya", dibuat_at: o.order_date ?? null,
              pengirim: { nama: o.shipper_name ?? "", telp: o.shipper_phone_number ?? "", alamat: o.shipper_address ?? "", lokasi: o.shipper_location_detail ?? "" },
              penerima: { nama: o.receiver_name ?? "", telp: o.receiver_phone_number ?? "", alamat: o.receiver_address ?? "", lokasi: o.receiver_location_detail ?? "", catatan: o.receiver_address_note ?? "" },
              paket: { isi: o.package_desc ?? "", berat_gram: Math.round(Number(o.weight ?? 0) * 1000) || null, nilai: Number(o.package_price ?? 0), cod: !!o.is_cod },
              kurir: { kurir: typeof o.courier_detail === "string" ? o.courier_detail : (o.courier_detail?.logistic_name ?? ""), jenis: o.shipment_type ?? "", pickup_tanggal: o.pickup_time_date ?? "" },
              riwayat: [{ at: new Date().toISOString(), by: user?.name ?? "ATLAS", aksi: "Ditarik dari Everpro (sinkron)" }] } }); baru++;
          }
        }
        const hal = x?.data?.pagination ?? {}; if (!rows.length || rows.length < 50 || (hal.total_page && page >= hal.total_page)) break;
      }
      const info = { at: new Date().toISOString(), oleh: user?.name ?? "", dari, sampai, baru, ubah };
      await admin.from("app_settings").upsert({ id: "kirim_sinkron", doc: { key: "kirim_sinkron", ...info } });
      return json({ ok: true, ...info, halaman });
    }

    return json({ ok: false, alasan: "aksi tidak dikenal" }, 400);
  } catch (e) {
    return json({ ok: false, alasan: String((e as Error).message || e), detail: (e as any).detail ?? null }, 502);
  }
});
