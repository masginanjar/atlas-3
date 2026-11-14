import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ============================================================
//  ATLAS ⇄ Everpro (pengiriman). Dipanggil dari ATLAS oleh staf yang login.
//  action: ongkir · jemput · pesan · resi · lacak · batal
//  Akses project lewat klien ATAS NAMA pengguna → RLS cabang tetap berlaku.
//  Kunci Everpro hanya di Secrets server (EVERPRO_CLIENT_KEY / _SECRET).
//  Uji baca-saja (ongkir/jemput/lacak) boleh dengan header x-uji-token.
// ============================================================
const BASE = "https://client-api.everpro.id";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-uji-token", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", ...CORS } });
const ZONA: Record<string, string> = { Bali: "Asia/Makassar", Makassar: "Asia/Makassar" };
const BOLEH_PESAN = ["superadmin", "direktur", "supervisor", "admin_pusat", "cs", "helper", "staf_apostille", "akunting"];

const hp = (s: unknown) => { let d = String(s ?? "").replace(/\D/g, ""); if (d.startsWith("0")) d = "62" + d.slice(1); else if (d.startsWith("8")) d = "62" + d; return d; };
const kodepos = (s: unknown) => (String(s ?? "").match(/\b\d{5}\b/) || [""])[0];

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

/** Daftar tarif (diurutkan termurah). */
async function tarif(t: string, asal: string, tujuan: string, beratKg: number, nilai: number) {
  const x = await ep(t, "/shipment/v2/rates", { method: "POST", body: JSON.stringify({ origin_postal_code: asal, destination_postal_code: tujuan, package_type_id: 1, shipment_type: "PICKUP", weight: beratKg, item_price: nilai }) });
  const d = x?.data ?? {}; const out: Record<string, unknown>[] = [];
  for (const grup of ["regular", "express", "same_day", "instant", "cargo"]) for (const it of (Array.isArray(d[grup]) ? d[grup] : [])) {
    out.push({ grup, kurir: it.logistic_name, layanan: it.rate_name ?? it.name, rate_code: it.rate_code ?? it.code ?? null, harga: Number(it.price) || 0, lama: `${it.min_duration ?? "?"}-${it.max_duration ?? "?"} ${it.duration_type ?? ""}`.trim(), jemput_hari_ini: it.is_available_pickup_today ?? null, logo: it.logistic_logo_url ?? it.logo_url ?? null });
  }
  return out.filter((r) => r.rate_code).sort((a, b) => Number(a.harga) - Number(b.harga)).slice(0, 30);
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

/** Alamat asal dari riwayat order Everpro (API tidak punya daftar alamat tersimpan). */
async function alamatAsal(t: string) {
  const peta = new Map<string, Record<string, unknown>>(); const contoh: unknown[] = [];
  const akhir = new Date(), awal = new Date(Date.now() - 180 * 864e5); const tg = (d: Date) => d.toISOString().slice(0, 10);
  for (let page = 1; page <= 10; page++) {
    const x = await ep(t, `/shipment/v1/orders?start_date=${tg(awal)}&end_date=${tg(akhir)}&page=${page}&limit=100`);
    const rows = Array.isArray(x?.data) ? x.data : (x?.data?.orders ?? x?.data?.data ?? x?.data?.items ?? []);
    if (page === 1 && rows[0]) contoh.push(Object.fromEntries(Object.entries(rows[0]).filter(([k]) => /shipper|origin|pickup/i.test(k))));
    for (const o of rows) {
      const alamat = String(o.shipper_address ?? "").trim(); if (!alamat) continue;
      const lok = o.shipper_location_detail ?? {};
      const k = alamat.toLowerCase();
      const ada = peta.get(k) as any;
      if (ada) { ada.jumlah++; continue; }
      peta.set(k, { nama: o.shipper_name ?? "", telp: o.shipper_phone_number ?? o.shipper_phone ?? "", alamat, catatan: o.shipper_address_note ?? "", kodepos: lok.postal_code ?? o.shipper_postal_code ?? "", kecamatan: lok.district_name ?? "", kelurahan: lok.sub_district_name ?? "", kota: lok.city_name ?? "", provinsi: lok.province_name ?? "", lokasi: typeof lok === "string" ? lok : "", jumlah: 1 });
    }
    const hal = x?.data?.pagination ?? x?.pagination ?? {}; if (!rows.length || (hal.total_page && page >= hal.total_page) || rows.length < 100) break;
  }
  const alamat = [...peta.values()].sort((a: any, b: any) => b.jumlah - a.jumlah) as any[];
  // Kode pos: dari teks alamat, atau dicari lewat lokasi (kelurahan, kecamatan, kota) di Everpro
  for (const a of alamat) {
    a.kodepos = a.kodepos || kodepos(a.alamat);
    if (a.kodepos || !a.lokasi) continue;
    try {
      const [kel, kec] = String(a.lokasi).split(",").map((x: string) => x.trim().toLowerCase());
      const r = await ep(t, `/location/v1/sub-districts?sub_district_name=${encodeURIComponent(kel)}`);
      const list = Array.isArray(r?.data) ? r.data : [];
      const sama = list.filter((x: any) => String(x.sub_district_name ?? "").toLowerCase() === kel);
      const pas = sama.length === 1 ? sama[0] : sama.find((x: any) => JSON.stringify(x).toLowerCase().includes(String(kec ?? "").replace(/\s+/g, " "))) ?? null;
      if (pas) { a.kodepos = String(pas.postal_code ?? ""); a.kelurahan = pas.sub_district_name ?? ""; } else if (sama.length) a.kandidat = sama.slice(0, 5);
      a.kecamatan = a.kecamatan || kec;
    } catch (_) { /* biarkan kosong */ }
  }
  return { alamat, contoh };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, alasan: "metode tidak didukung" }, 405);
  const URL_ = Deno.env.get("SUPABASE_URL")!, ANON = Deno.env.get("SUPABASE_ANON_KEY")!, SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(URL_, SR, { auth: { persistSession: false } });
  let b: Record<string, any> = {};
  try { b = await req.json(); } catch (_) { return json({ ok: false, alasan: "isi permintaan tidak valid" }, 400); }
  const aksi = String(b.aksi ?? "");

  // ---- siapa yang memanggil ----
  const uji = req.headers.get("x-uji-token") ?? "";
  let db = admin, user: Record<string, any> | null = null, ujiOk = false;
  if (uji) {
    const { data: cfg } = await admin.from("pembayaran_gateway_config").select("value").eq("key", "uji_token").maybeSingle();
    ujiOk = !!cfg?.value && uji.length >= 20 && uji === cfg.value;
    if (!ujiOk || !["ongkir", "jemput", "lacak", "asal", "struktur"].includes(aksi)) return json({ ok: false, alasan: "tidak diizinkan" }, 401);
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
    // Uji baca-saja (tanpa project)
    if (ujiOk) {
      if (aksi === "ongkir") return json({ ok: true, tarif: await tarif(t, String(b.asal), String(b.tujuan), Math.max(0.1, Number(b.berat_gram ?? 200) / 1000), Number(b.nilai ?? 100000)) });
      if (aksi === "jemput") return json({ ok: true, slot: await jadwalJemput(t, String(b.rate_code), String(b.zona ?? "Asia/Makassar")) });
      if (aksi === "lacak") return json({ ok: true, lacak: (await ep(t, `/shipment/v1/orders/${encodeURIComponent(String(b.nomor))}/track`)).data ?? null });
      if (aksi === "asal") return json({ ok: true, ...(await alamatAsal(t)) });
      if (aksi === "struktur") { const x = await ep(t, "/shipment/v1/orders?page=1&limit=1"); const o = (Array.isArray(x?.data) ? x.data : (x?.data?.orders ?? x?.data?.data ?? []))[0] ?? {}; return json({ ok: true, kunci: Object.keys(o), atas: Object.keys(x?.data ?? {}), status: { status: o.status, status_id: o.status_id, awb: o.awb_number, kurir: o.courier_detail ?? null, label: !!o.label_url } }); }
    }
    const PENGELOLA = ["superadmin", "direktur", "admin_pusat", "akunting", "supervisor"];
    if (aksi === "asal") {
      if (!["superadmin", "direktur", "admin_pusat"].includes(String(user?.role))) return json({ ok: false, alasan: "khusus Superadmin / Direktur / Admin Pusat" }, 403);
      const h = await alamatAsal(t); return json({ ok: true, alamat: h.alamat });
    }
    // Daftar semua kiriman di akun Everpro (halaman Pengiriman) — khusus pengelola
    if (aksi === "daftar") {
      if (!PENGELOLA.includes(String(user?.role))) return json({ ok: false, alasan: "khusus pengelola" }, 403);
      const tg = (d: Date) => d.toISOString().slice(0, 10);
      const q = new URLSearchParams({ start_date: String(b.dari || tg(new Date(Date.now() - 30 * 864e5))), end_date: String(b.sampai || tg(new Date())), page: String(Number(b.page) || 1), limit: String(Math.min(100, Number(b.limit) || 50)) });
      if (b.cari) q.set("search", String(b.cari).slice(0, 60));
      if (b.status_id) q.set("status_id", String(b.status_id));
      const x = await ep(t, `/shipment/v1/orders?${q}`);
      const rows = Array.isArray(x?.data) ? x.data : (x?.data?.orders ?? x?.data?.data ?? x?.data?.items ?? []);
      const nomor = rows.map((o: any) => o.client_order_no).filter(Boolean);
      const { data: proj } = nomor.length ? await admin.from("projects").select("id, invoice_no:doc->>invoice_no, client_order_no:doc->about->everpro->>client_order_no").in("doc->about->everpro->>client_order_no", nomor) : { data: [] };
      const peta = new Map((proj ?? []).map((r: any) => [r.client_order_no, { id: r.id, invoice_no: r.invoice_no }]));
      const out = rows.map((o: any) => ({
        client_order_no: o.client_order_no ?? "", no_everpro: o.shipment_order_no ?? "", awb: o.awb_number ?? "", status: o.status ?? "", status_id: o.status_id ?? null, label: o.label_url ?? "", jenis: o.shipment_type ?? "",
        kurir: typeof o.courier_detail === "string" ? o.courier_detail : (o.courier_detail?.logistic_name ?? ""), layanan: typeof o.courier_detail === "string" ? "" : (o.courier_detail?.rate_name ?? ""), logo: "",
        harga: Number(o.total_price ?? o.shipment_price ?? 0), batal_diminta: !!o.is_request_cancel_order,
        dibuat: o.order_date ?? "", jemput: o.pickup_time_date ?? "", penerima: o.receiver_name ?? "", tujuan: o.receiver_location_detail ?? "", pengirim: o.shipper_name ?? "", asal: o.shipper_location_detail ?? "",
        isi: o.package_desc ?? "", berat: o.weight ?? o.calculated_weight ?? null, project: peta.get(o.client_order_no) ?? null,
      }));
      return json({ ok: true, data: out, pagination: x?.data?.pagination ?? x?.pagination ?? null });
    }
    // Label / resi siap cetak (PDF) — satu atau banyak AWB
    if (aksi === "label" && Array.isArray(b.awbs)) {
      if (!PENGELOLA.includes(String(user?.role))) return json({ ok: false, alasan: "khusus pengelola" }, 403);
      const awbs = b.awbs.map(String).filter((x: string) => /^[A-Za-z0-9\-_.]{5,60}$/.test(x)).slice(0, 50);
      if (!awbs.length) return json({ ok: false, alasan: "pilih kiriman yang sudah punya resi" });
      const x = await ep(t, "/shipment/v1/orders/label/bulk", { method: "POST", body: JSON.stringify({ awb_numbers: awbs }) });
      return json({ ok: true, url: x?.data?.url ?? x?.data?.url_label_pdf ?? null, errors: x?.data?.errors ?? [] });
    }
    if (aksi === "lacak_awb") {
      if (!PENGELOLA.includes(String(user?.role))) return json({ ok: false, alasan: "khusus pengelola" }, 403);
      const n = String(b.nomor ?? ""); if (!/^[A-Za-z0-9\-_.]{5,60}$/.test(n)) return json({ ok: false, alasan: "nomor tidak valid" });
      return json({ ok: true, lacak: (await ep(t, `/shipment/v1/orders/${encodeURIComponent(n)}/track`)).data ?? null });
    }

    // Project dibaca ATAS NAMA pengguna (RLS cabang berlaku)
    const { data: pr, error: pe } = await db.from("projects").select("id, doc").eq("id", String(b.project_id ?? "")).maybeSingle();
    if (pe || !pr) return json({ ok: false, alasan: "project tidak ditemukan atau bukan cabang Anda" }, 404);
    const p = pr.doc as Record<string, any>;
    const about = p.about ?? {}, ship = p.customer?.ship ?? {};
    const asalCabang = String(about.print_location && about.print_location !== "vendor" ? about.print_location : p.branch ?? "Bali");
    const { data: setRow } = await admin.from("app_settings").select("doc").eq("doc->>key", "alamat_kirim").limit(1).maybeSingle();
    const pengirim = (setRow?.doc?.cabang ?? {})[asalCabang] ?? null;
    const zona = ZONA[asalCabang] ?? "Asia/Jakarta";
    const tujuanKp = kodepos(ship.zip) || kodepos(ship.street1);
    const berat = Math.max(0.1, Number(b.berat_gram ?? about.everpro?.berat_gram ?? 200) / 1000);
    const nilai = Math.max(10000, Number(b.nilai ?? 100000));
    const simpan = async (patch: Record<string, unknown>, catatan: string) => {
      const baru = { about: { ...about, ...patch }, history: [...(p.history ?? []), { at: new Date().toISOString(), by: user?.name ?? "ATLAS", action: catatan }] };
      const { error } = await db.rpc("app_patch", { tbl: "projects", row_id: pr.id, patch: baru });
      if (error) throw new Error("Gagal menyimpan ke project: " + error.message);
      return baru.about;
    };

    if (aksi === "ongkir") {
      if (!pengirim?.kodepos) return json({ ok: false, alasan: `Alamat pengirim cabang ${asalCabang} belum diisi (Setting → Kurir)` });
      if (!tujuanKp) return json({ ok: false, alasan: "Kode pos alamat pelanggan belum ada — lengkapi alamat pengiriman" });
      return json({ ok: true, asal: asalCabang, asal_kodepos: pengirim.kodepos, tujuan_kodepos: tujuanKp, tarif: await tarif(t, pengirim.kodepos, tujuanKp, berat, nilai) });
    }
    if (aksi === "jemput") return json({ ok: true, slot: await jadwalJemput(t, String(b.rate_code), zona) });

    const ev = about.everpro ?? {};
    if (aksi === "pesan") {
      if (!BOLEH_PESAN.includes(String(user?.role))) return json({ ok: false, alasan: "peran Anda tidak boleh memesan kurir" }, 403);
      if (ev.client_order_no && !["CANCELED", "BATAL"].includes(String(ev.status))) return json({ ok: false, alasan: "Kurir untuk project ini sudah dipesan" }, 409);
      if (!pengirim?.kodepos || !pengirim?.alamat || !pengirim?.telp) return json({ ok: false, alasan: `Alamat pengirim cabang ${asalCabang} belum lengkap (Setting → Kurir)` });
      const penerima = String(ship.attention || p.customer?.name || "").trim(), telp = hp(ship.phone || p.customer?.phone);
      if (penerima.length < 3 || telp.length < 10 || !tujuanKp || !String(ship.street1 || "").trim()) return json({ ok: false, alasan: "Alamat penerima belum lengkap (nama, No. HP, alamat, kode pos)" });
      const rate = String(b.rate_code ?? ""), harga = Math.round(Number(b.harga ?? 0)); if (!rate || !harga) return json({ ok: false, alasan: "Pilih layanan kurir dulu" });
      const jenis = b.jenis === "DROP" ? "DROP" : "PICKUP";
      const pickup = jenis === "PICKUP" ? Number(b.pickup_time ?? 0) : 0;
      if (jenis === "PICKUP" && !pickup) return json({ ok: false, alasan: "Pilih jadwal jemput" });
      const no = `ATLAS-${String(p.invoice_no || pr.id).replace(/[^A-Za-z0-9]/g, "").slice(-14)}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
      const body: Record<string, unknown> = {
        client_order_no: no, order_reference_id: no, package_desc: String(b.isi || "Dokumen terjemahan").slice(0, 100), package_price: nilai, package_type_id: 1,
        rate_code: rate, shipment_price: harga, shipment_type: jenis, weight: berat, package_count: 1,
        receiver_name: penerima.slice(0, 60), receiver_phone: telp, receiver_address: [ship.street1, ship.street2].filter(Boolean).join(", ").slice(0, 250), receiver_postal_code: tujuanKp,
        receiver_address_note: String(ship.note ?? "").slice(0, 100) || undefined, shipping_note: `Invoice ${p.invoice_no ?? ""}`.slice(0, 100),
        shipper_name: String(pengirim.nama || "247 Sworn Translator").slice(0, 60), shipper_phone: hp(pengirim.telp), shipper_address: String(pengirim.alamat).slice(0, 250), shipper_postal_code: String(pengirim.kodepos),
      };
      if (jenis === "PICKUP") body.pickup_time = pickup;
      const o = await ep(t, "/shipment/v1/orders", { method: "POST", body: JSON.stringify(body) });
      let awb: string | null = null;
      try { await ep(t, `/shipment/v1/orders/${encodeURIComponent(no)}/generate`, { method: "POST", body: "{}" }); } catch (_) { /* resi bisa menyusul lewat callback */ }
      try { const a = await ep(t, `/shipment/v1/orders/${encodeURIComponent(no)}/awb`); awb = a?.data?.awb_number ?? null; } catch (_) { /* belum ada */ }
      const info = { client_order_no: no, rate_code: rate, kurir: b.kurir ?? "", layanan: b.layanan ?? "", harga: Number(o?.data?.actual_price ?? harga), jenis, pickup_time: pickup || null, berat_gram: Math.round(berat * 1000), status: awb ? "WAITING" : "MENUNGGU_RESI", awb, dipesan_at: new Date().toISOString(), dipesan_oleh: user?.name, asal: asalCabang };
      const a2 = await simpan({ everpro: info, ...(awb ? { resi_no: awb } : {}), courier_name: `${info.kurir} ${info.layanan}`.trim() }, `Kurir Everpro dipesan: ${info.kurir} ${info.layanan} · ${no}${awb ? ` · resi ${awb}` : ""}`);
      return json({ ok: true, everpro: a2.everpro, resi: awb });
    }
    if (aksi === "resi") {
      if (!ev.client_order_no) return json({ ok: false, alasan: "Belum ada pesanan kurir" });
      const a = await ep(t, `/shipment/v1/orders/${encodeURIComponent(ev.client_order_no)}/awb`).catch(() => null);
      const awb = a?.data?.awb_number ?? null;
      if (!awb) return json({ ok: true, resi: null });
      const a2 = await simpan({ everpro: { ...ev, awb, status: ev.status === "MENUNGGU_RESI" ? "WAITING" : ev.status }, resi_no: awb }, `Resi Everpro terbit: ${awb}`);
      return json({ ok: true, resi: awb, everpro: a2.everpro });
    }
    if (aksi === "label") {
      if (!ev.awb) return json({ ok: false, alasan: "Resi belum terbit — label bisa dicetak setelah resi ada" });
      const x = await ep(t, `/shipment/v1/orders/${encodeURIComponent(ev.awb)}/label`);
      return json({ ok: true, url: x?.data?.url_label_pdf ?? null });
    }
    if (aksi === "lacak") {
      const kunci = ev.awb || ev.client_order_no; if (!kunci) return json({ ok: false, alasan: "Belum ada pesanan kurir" });
      const l = await ep(t, `/shipment/v1/orders/${encodeURIComponent(kunci)}/track`);
      return json({ ok: true, lacak: l?.data ?? null });
    }
    if (aksi === "batal") {
      if (!ev.client_order_no) return json({ ok: false, alasan: "Belum ada pesanan kurir" });
      await ep(t, `/shipment/v1/orders/${encodeURIComponent(ev.awb || ev.client_order_no)}/cancel`, { method: "POST", body: JSON.stringify({ cancel_reason: String(b.alasan || "Dibatalkan dari ATLAS").slice(0, 150) }) });
      const a2 = await simpan({ everpro: { ...ev, status: "CANCELED", dibatalkan_at: new Date().toISOString() }, resi_no: null }, `Pesanan kurir Everpro dibatalkan (${ev.client_order_no})`);
      return json({ ok: true, everpro: a2.everpro });
    }
    return json({ ok: false, alasan: "aksi tidak dikenal" }, 400);
  } catch (e) {
    return json({ ok: false, alasan: String((e as Error).message || e), detail: (e as any).detail ?? null }, 502);
  }
});
