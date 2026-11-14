import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Penerima kabar (callback) dari Everpro: nomor resi (AWB) dan status paket.
// Tanpa JWT karena dipanggil pihak luar; keasliannya dicek lewat header x-everpro-key
// yang harus sama dengan EVERPRO_CALLBACK_KEY. Kabar yang tidak cocok ditolak.
// Semua kabar dicatat ke kirim_status_log, lalu project ATLAS yang cocok diperbarui:
//  · resi terbit  → about.resi_no + about.everpro.awb, CS diberi tahu
//  · status baru  → about.everpro.status (+ riwayat)
//  · DELIVERED    → tahap kirim (Siap Kirim / Dokumen Dikirim) otomatis Selesai

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const LABEL: Record<string, string> = { WAITING: "Menunggu dijemput", "FAILED PICKUP": "Gagal dijemput", PICKEDUP: "Sudah dijemput kurir", "IN PROCESS RETURN": "Proses retur", DELIVERED: "Diterima pelanggan", REJECTED: "Ditolak", "IN TROUBLE": "Bermasalah", CANCELED: "Dibatalkan", RETURN: "Diretur", "LOST/BROKEN": "Hilang/rusak", "FORCE MAJEURE": "Force majeure" };
const TAHAP_KIRIM = ["siap_kirim", "kirim", "dikirim"];

function sama(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
function ambil(o: unknown, kunci: string[]): string | null {
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  for (const k of kunci) if (typeof r[k] === "string" || typeof r[k] === "number") return String(r[k]).slice(0, 120);
  for (const k of ["data", "order", "shipment", "tracking"]) { const v = ambil(r[k], kunci); if (v) return v; }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false }, 405);
  const kunci = (Deno.env.get("EVERPRO_CALLBACK_KEY") ?? "").trim();
  const masuk = (req.headers.get("x-everpro-key") ?? "").trim();
  if (!kunci || !masuk || !sama(kunci, masuk)) return json({ ok: false, alasan: "tidak diizinkan" }, 401);

  const teks = await req.text();
  if (teks.length > 200000) return json({ ok: false, alasan: "terlalu besar" }, 413);
  let body: unknown = null;
  try { body = JSON.parse(teks); } catch (_) { return json({ ok: false, alasan: "bukan JSON" }, 400); }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const resi = ambil(body, ["awb_number", "awb", "waybill"]);
  const orderNo = ambil(body, ["client_order_no", "order_number", "order_no", "reference"]);
  const status = ambil(body, ["tracking_code", "status", "shipment_status", "tracking_status", "status_name"]);
  const { error } = await db.from("kirim_status_log").insert({ sumber: "everpro", jenis: ambil(body, ["type", "event", "callback_type"]) ?? (status ? "tracking" : "awb"), resi, order_ref: orderNo, status, raw: body });
  if (error) return json({ ok: false, alasan: "gagal menyimpan" }, 500);

  // ---- perbarui project yang cocok (tidak menggagalkan callback bila tidak ketemu) ----
  try {
    let q = db.from("projects").select("id, doc");
    q = orderNo ? q.eq("doc->about->everpro->>client_order_no", orderNo) : q.eq("doc->about->everpro->>awb", String(resi ?? "-"));
    const { data: rows } = await q.limit(1);
    const row = rows?.[0];
    if (row) {
      const p = row.doc as Record<string, any>; const about = p.about ?? {}; const ev = about.everpro ?? {};
      const now = new Date().toISOString(); const by = "ATLAS (Everpro)";
      const evBaru = { ...ev, ...(resi ? { awb: resi } : {}), ...(status ? { status, status_at: now } : {}) };
      if (resi && (!ev.status || ev.status === "MENUNGGU_RESI") && !status) evBaru.status = "WAITING";
      const riwayat = [...(p.history ?? [])];
      if (resi && resi !== ev.awb) riwayat.push({ at: now, by, action: `Resi terbit: ${resi}` });
      if (status && status !== ev.status) riwayat.push({ at: now, by, action: `Status kiriman: ${LABEL[status] ?? status}` });
      let subs = p.sub_projects ?? [];
      if (status === "DELIVERED") {
        subs = subs.map((s: any) => TAHAP_KIRIM.includes(s.stage)
          ? { ...s, stage: "selesai", stage_at: now, data: { ...(s.data ?? {}), delivery: { ...(s.data?.delivery ?? {}), type: "courier", diserahkan_kurir: s.data?.delivery?.diserahkan_kurir ?? now, diterima_pelanggan: now } }, history: [...(s.history ?? []), { at: now, by, action: "Paket diterima pelanggan (Everpro) → Selesai" }] }
          : s);
      } else if (status === "PICKEDUP") {
        subs = subs.map((s: any) => TAHAP_KIRIM.includes(s.stage) ? { ...s, data: { ...(s.data ?? {}), delivery: { ...(s.data?.delivery ?? {}), type: "courier", diserahkan_kurir: s.data?.delivery?.diserahkan_kurir ?? now } } } : s);
      }
      const doc = { ...p, about: { ...about, everpro: evBaru, ...(resi ? { resi_no: resi } : {}) }, history: riwayat, sub_projects: subs };
      await db.from("projects").update({ doc, updated_at: now }).eq("id", row.id);
      const ke = p.created_by;
      if (ke && ((resi && resi !== ev.awb) || ["DELIVERED", "FAILED PICKUP", "REJECTED", "IN TROUBLE", "RETURN", "LOST/BROKEN", "CANCELED"].includes(String(status)))) {
        const teksN = resi && resi !== ev.awb ? `Resi terbit ${resi} — kirim ke pelanggan` : `Kiriman: ${LABEL[String(status)] ?? status}`;
        await db.from("notifications").insert({ doc: { to_user: ke, kind: "kirim", text: `${p.invoice_no ?? ""}: ${teksN}`, project_id: row.id, by, read_by: [], created_at: now } });
      }
    }
  } catch (_) { /* kabar sudah tercatat di log */ }
  return json({ ok: true });
});
