// ============================================================
//  ATLAS Alfa — sinkron Zoho Books → Supabase (salinan invoice, item, pelanggan)
//  Dipanggil tiap jam oleh pg_cron (header x-sync-key), atau manual.
//  action=exchange : tukar grant code (Self Client) menjadi refresh token → disimpan di zoho_config
//  action=sync     : tarik invoice baru/berubah (semua organisasi) + lengkapi detail item
//  action=status   : ringkasan kondisi
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
// Kredensial: dari Secrets (Deno.env) atau tabel zoho_config (hanya service role yang bisa baca)
let CLIENT_ID = Deno.env.get("ZOHO_CLIENT_ID") || "";
let CLIENT_SECRET = Deno.env.get("ZOHO_CLIENT_SECRET") || "";
let SYNC_KEY = Deno.env.get("SYNC_KEY") || "";
async function loadCreds() {
  if (!SYNC_KEY) SYNC_KEY = (await cfg("sync_key")) || "";
  if (!CLIENT_ID) CLIENT_ID = (await cfg("client_id")) || "";
  if (!CLIENT_SECRET) CLIENT_SECRET = (await cfg("client_secret")) || "";
}

type Org = { id: string; name: string };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o, null, 1), { status, headers: { "content-type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function cfg(key: string) { const { data } = await sb.from("zoho_config").select("value").eq("key", key).maybeSingle(); return data?.value ?? null; }
async function setCfg(key: string, value: string) { await sb.from("zoho_config").upsert({ key, value, updated_at: new Date().toISOString() }); }

const DCS: Record<string, { acc: string; api: string }> = {
  com: { acc: "https://accounts.zoho.com", api: "https://www.zohoapis.com/books/v3" },
  in: { acc: "https://accounts.zoho.in", api: "https://www.zohoapis.in/books/v3" },
  eu: { acc: "https://accounts.zoho.eu", api: "https://www.zohoapis.eu/books/v3" },
  au: { acc: "https://accounts.zoho.com.au", api: "https://www.zohoapis.com.au/books/v3" },
  jp: { acc: "https://accounts.zoho.jp", api: "https://www.zohoapis.jp/books/v3" },
  sa: { acc: "https://accounts.zoho.sa", api: "https://www.zohoapis.sa/books/v3" },
  ca: { acc: "https://accounts.zohocloud.ca", api: "https://www.zohoapis.ca/books/v3" },
};

// ---------- OAuth ----------
async function exchangeCode(code: string) {
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error("ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET belum diisi di Secrets");
  const tried: string[] = [];
  for (const [dc, u] of Object.entries(DCS)) {
    const body = new URLSearchParams({ grant_type: "authorization_code", client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code });
    const r = await fetch(`${u.acc}/oauth/v2/token`, { method: "POST", body });
    const j = await r.json().catch(() => ({}));
    if (j.refresh_token) {
      await setCfg("refresh_token", j.refresh_token); await setCfg("dc", dc);
      await setCfg("access_token", j.access_token || ""); await setCfg("access_exp", String(Date.now() + 50 * 60 * 1000));
      return { ok: true, dc, scope: j.scope };
    }
    tried.push(`${dc}: ${j.error || r.status}`);
    if (j.error && j.error !== "invalid_client" && j.error !== "invalid_code") break; // kode salah/kedaluwarsa: tak perlu coba DC lain
  }
  throw new Error("Tukar kode gagal → " + tried.join(" | "));
}

async function accessToken(): Promise<{ token: string; api: string }> {
  const dc = (await cfg("dc")) || "com"; const u = DCS[dc] || DCS.com;
  const exp = Number(await cfg("access_exp") || 0); const cached = await cfg("access_token");
  if (cached && Date.now() < exp) return { token: cached, api: u.api };
  const rt = await cfg("refresh_token"); if (!rt) throw new Error("Belum terhubung ke Zoho (refresh_token kosong) — jalankan action=exchange dulu");
  const body = new URLSearchParams({ grant_type: "refresh_token", client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: rt });
  const r = await fetch(`${u.acc}/oauth/v2/token`, { method: "POST", body }); const j = await r.json();
  if (!j.access_token) throw new Error("Refresh token gagal: " + JSON.stringify(j));
  await setCfg("access_token", j.access_token); await setCfg("access_exp", String(Date.now() + 50 * 60 * 1000));
  return { token: j.access_token, api: u.api };
}

// ---------- Zoho API ----------
let calls = 0;
async function zget(path: string, params: Record<string, string>) {
  const { token, api } = await accessToken();
  const qs = new URLSearchParams(params).toString();
  for (let attempt = 0; attempt < 3; attempt++) {
    calls++;
    const r = await fetch(`${api}${path}?${qs}`, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
    if (r.status === 429) { await sleep(1500 * (attempt + 1)); continue; } // rate limit
    const j = await r.json().catch(() => ({}));
    if (!r.ok || (j.code && j.code !== 0)) throw new Error(`Zoho ${path} → ${r.status} ${j.message || ""}`);
    return j;
  }
  throw new Error(`Zoho ${path}: rate limit`);
}

const clean = (s: unknown) => (typeof s === "string" ? s.trim() : "");
const invRow = (i: any, org: Org) => ({
  zoho_id: i.invoice_id, invoice_no: i.invoice_number, customer_id: i.customer_id, customer_name: i.customer_name,
  date: i.date || null, due_date: i.due_date || null, total: i.total ?? 0, balance: i.balance ?? 0, status: i.status,
  org_id: org.id, org_name: org.name, synced_at: new Date().toISOString(),
  raw: { created_time: i.created_time, last_modified_time: i.last_modified_time, salesperson_name: i.salesperson_name, location_name: i.location_name, created_by: i.created_by },
});
const contactRowFromInvoice = (i: any, org: Org) => ({
  zoho_id: i.customer_id, name: i.customer_name, email: clean(i.email), phone: clean(i.phone) || clean(i.mobile),
  city: clean(i.shipping_address?.city) || clean(i.billing_address?.city), company: clean(i.company_name),
  org_id: org.id, org_name: org.name, contact_type: "customer", synced_at: new Date().toISOString(),
});

/** 1) Header invoice: semua yang berubah sejak watermark (per organisasi). */
async function syncHeaders(org: Org, sinceIso: string | null, sinceDate: string) {
  let page = 1, n = 0; const contacts = new Map<string, any>();
  for (;;) {
    const params: Record<string, string> = { organization_id: org.id, per_page: "200", page: String(page), sort_column: "last_modified_time", sort_order: "D" };
    if (sinceIso) params.last_modified_time = sinceIso; else { params.date_start = sinceDate; }
    const j = await zget("/invoices", params);
    const rows = (j.invoices || []).map((i: any) => invRow(i, org));
    for (const i of j.invoices || []) if (i.customer_id) contacts.set(i.customer_id, contactRowFromInvoice(i, org));
    if (rows.length) {
      // jangan timpa detail item yang sudah ada; tandai perlu refresh bila berubah
      const { error } = await sb.from("zoho_invoices").upsert(rows, { onConflict: "zoho_id" });
      if (error) throw new Error("upsert invoices: " + error.message);
      n += rows.length;
    }
    if (!j.page_context?.has_more_page || page >= 25) break;
    page++;
  }
  if (contacts.size) {
    // isi/segarkan pelanggan tanpa menghapus data lengkap yang sudah ada (ship dsb.)
    const ids = [...contacts.keys()];
    const { data: existing } = await sb.from("zoho_contacts").select("zoho_id,email,phone,city,company").in("zoho_id", ids);
    const ex = new Map((existing || []).map((e: any) => [e.zoho_id, e]));
    const rows = [...contacts.values()].map((c) => { const e = ex.get(c.zoho_id) || {}; return { ...c, email: c.email || e.email || "", phone: c.phone || e.phone || "", city: c.city || e.city || "", company: c.company || e.company || "" }; });
    const { error } = await sb.from("zoho_contacts").upsert(rows, { onConflict: "zoho_id" });
    if (error) throw new Error("upsert contacts: " + error.message);
  }
  return { invoices: n, contacts: contacts.size };
}

/** 2) Detail item: invoice yang belum punya detail, atau berubah setelah detail diambil. */
async function syncDetails(orgs: Org[], budget: number) {
  const { data: queue, error } = await sb.rpc("zoho_detail_queue", { p_limit: budget });
  if (error) throw new Error("queue: " + error.message);
  let done = 0; const perOrg: Record<string, number> = {};
  for (const q of queue || []) {
    const org = orgs.find((o) => o.id === q.org_id); if (!org) continue;
    if ((perOrg[org.id] || 0) >= 60) continue; // batas aman rate limit Zoho per organisasi per menit
    try {
      const j = await zget(`/invoices/${q.zoho_id}`, { organization_id: org.id });
      const inv = j.invoice || {};
      const items = (inv.line_items || []).map((it: any) => ({ name: it.name || "", description: it.description || "", unit: it.unit || "", quantity: it.quantity ?? 0, rate: it.rate ?? 0, item_total: it.item_total ?? 0 }));
      const cp = (inv.contact_persons_details || [])[0] || {};
      const contact = { mobile: cp.mobile || cp.phone || "", email: cp.email || inv.email || "", name: [cp.first_name, cp.last_name].filter(Boolean).join(" ") };
      const patch = { ...invRow(inv, org), line_items: items, contact, detail_synced_at: new Date().toISOString() };
      const { error: e2 } = await sb.from("zoho_invoices").upsert(patch, { onConflict: "zoho_id" });
      if (e2) throw new Error(e2.message);
      // nomor HP/email pelanggan dari invoice bila di kontak masih kosong
      if (inv.customer_id && (contact.mobile || contact.email)) {
        const { data: c } = await sb.from("zoho_contacts").select("phone,email").eq("zoho_id", inv.customer_id).maybeSingle();
        if (c && (!c.phone || !c.email)) await sb.from("zoho_contacts").update({ phone: c.phone || contact.mobile, email: c.email || contact.email }).eq("zoho_id", inv.customer_id);
      }
      done++; perOrg[org.id] = (perOrg[org.id] || 0) + 1;
    } catch (e) {
      await sb.from("zoho_invoices").update({ detail_synced_at: new Date().toISOString() }).eq("zoho_id", q.zoho_id); // tandai sudah dicoba; diulang bila invoice berubah lagi
      console.error("detail", q.zoho_id, String(e));
    }
    await sleep(60);
  }
  return { details: done, queued: (queue || []).length };
}

async function runSync(opts: { full?: boolean; budget?: number }) {
  const started = new Date();
  const orgs: Org[] = JSON.parse((await cfg("orgs")) || "[]");
  const sinceDate = (await cfg("since_date")) || "2026-11-01";
  const last = opts.full ? null : await cfg("last_sync");
  // watermark dikurangi 2 jam supaya perubahan yang terlambat tetap tertangkap
  const sinceIso = last ? toZohoTime(new Date(new Date(last).getTime() - 2 * 3600 * 1000)) : null;
  let inv = 0, con = 0; const notes: string[] = [];
  for (const org of orgs) {
    try { const r = await syncHeaders(org, sinceIso, sinceDate); inv += r.invoices; con += r.contacts; notes.push(`${org.name}: ${r.invoices} inv`); }
    catch (e) { notes.push(`${org.name}: GAGAL ${String(e).slice(0, 120)}`); }
  }
  await setCfg("last_sync", started.toISOString()); // watermark disimpan dulu: bila fungsi dihentikan saat ambil detail, antrean dilanjutkan run berikutnya
  const d = await syncDetails(orgs, opts.budget ?? 40);
  const note = `${notes.join(" · ")} · detail ${d.details}/${d.queued} · ${calls} panggilan`;
  await sb.from("sync_log").insert({ source: opts.full ? "zoho:auto (penuh)" : "zoho:auto", started_at: started.toISOString(), finished_at: new Date().toISOString(), contacts: con, invoices: inv, note, ok: !notes.some((n) => n.includes("GAGAL")) });
  return { invoices: inv, contacts: con, ...d, note };
}
const toZohoTime = (d: Date) => { // YYYY-MM-DDTHH:MM:SS+0800 (zona Zoho org = WITA/WIB; pakai UTC+8 aman karena ada selisih 2 jam)
  const t = new Date(d.getTime() + 8 * 3600 * 1000); const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}T${p(t.getUTCHours())}:${p(t.getUTCMinutes())}:${p(t.getUTCSeconds())}+0800`;
};

Deno.serve(async (req) => {
  const url = new URL(req.url);
  await loadCreds();
  const key = req.headers.get("x-sync-key") || url.searchParams.get("key") || "";
  if (!SYNC_KEY || key !== SYNC_KEY) return json({ error: "unauthorized" }, 401);
  const action = url.searchParams.get("action") || "sync";
  try {
    if (action === "exchange") {
      const code = url.searchParams.get("code") || Deno.env.get("ZOHO_GRANT_CODE") || "";
      if (!code) return json({ error: "code kosong" }, 400);
      return json(await exchangeCode(code));
    }
    if (action === "status") {
      const { data: log } = await sb.from("sync_log").select("*").order("id", { ascending: false }).limit(5);
      const { count: total } = await sb.from("zoho_invoices").select("*", { count: "exact", head: true });
      const { count: detailed } = await sb.from("zoho_invoices").select("*", { count: "exact", head: true }).not("line_items", "is", null);
      return json({ connected: !!(await cfg("refresh_token")), dc: await cfg("dc"), last_sync: await cfg("last_sync"), total, detailed, log });
    }
    const full = url.searchParams.get("full") === "1";
    const budget = Number(url.searchParams.get("budget") || 40);
    return json(await runSync({ full, budget }));
  } catch (e) {
    await sb.from("sync_log").insert({ source: "zoho:auto", finished_at: new Date().toISOString(), contacts: 0, invoices: 0, note: String(e).slice(0, 500), ok: false });
    return json({ error: String(e) }, 500);
  }
});
