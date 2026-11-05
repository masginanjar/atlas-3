// DIBUAT OTOMATIS oleh sync-portal-fn.sh dari src/ — jangan diedit. Deploy berkas ini sebagai index.ts fungsi "portal-cek".

// supabase/functions/portal-cek/index.ts
import { createClient } from "jsr:@supabase/supabase-js@2";

// supabase/functions/portal-cek/config/workflows.js
var STAGE_KEYS = {
  "tr_int": [
    "cs_input",
    "pilih_penerjemah",
    "penerjemahan",
    "proofread",
    "otorisasi",
    "registrasi",
    "siap_print",
    "upload_scan",
    "siap_kirim"
  ],
  "tr_ext": [
    "pengajuan",
    "persetujuan",
    "pembayaran",
    "dibayar",
    "kirim",
    "dikirim"
  ],
  "tr_bill": [
    "order",
    "proses_vendor"
  ],
  "ap_int": [
    "cs_upload",
    "antrian",
    "diproses"
  ],
  "ap_ext": [
    "pengajuan",
    "persetujuan",
    "pembayaran",
    "dibayar",
    "kirim",
    "dikirim"
  ],
  "lg_int": [
    "cs_upload",
    "antrian",
    "diproses"
  ],
  "lg_ext": [
    "pengajuan",
    "persetujuan",
    "pembayaran",
    "dibayar",
    "kirim",
    "dikirim"
  ],
  "tr_nt": [
    "cs_input",
    "penerjemahan",
    "cs_final"
  ],
  "jl": [
    "proses",
    "cs_final"
  ]
};
var PAYMENT_TERMS = { "immediate": { "label": "Langsung bayar per order", "short": "Bayar per order" }, "invoice": { "label": "Bayar sesuai tagihan vendor", "short": "Sesuai tagihan" }, "monthly": { "label": "Tagihan bulanan (via koordinator)", "short": "Bulanan" } };
var DONE = "selesai";
function stageIndex(cat, key2) {
  if (key2 === DONE) return (STAGE_KEYS[cat] ?? []).length;
  return (STAGE_KEYS[cat] ?? []).indexOf(key2);
}
var termOf = (vendor) => PAYMENT_TERMS[vendor?.payment_term] ? vendor.payment_term : "immediate";
var isBilled = (vendor) => termOf(vendor) !== "immediate";
var deriveFlow = function deriveFlow2(sub, vendorRec) {
  const vendor = sub.executor_kind === "vendor" || sub.translator_kind === "vendor";
  switch (sub.type) {
    case "terjemahan":
      return vendor ? isBilled(vendorRec) ? "tr_bill" : "tr_ext" : "tr_int";
    case "terjemahan_nt":
      return "tr_nt";
    case "apostille":
      return vendor ? "ap_ext" : "ap_int";
    case "legalisasi":
      return vendor ? "lg_ext" : "lg_int";
    default:
      return "jl";
  }
};
var flowOf = (sub, project) => sub?.flow || project?.category || deriveFlow(sub || {});
var docListOf = (sub) => {
  const d = (sub?.docs || []).filter((x) => (x.desc || "").trim());
  if (d.length) return d.map((x) => x.desc.trim());
  const pts = String(sub?.description || "").split("\n").map((l) => l.replace(/^\s*\d+[.)]\s*/, "").trim()).filter(Boolean);
  return pts.length ? pts : [sub?.title || "Dokumen"];
};

// supabase/functions/portal-cek/lib/portalCore.js
function normPhone(v) {
  let d = String(v || "").replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("62")) d = "0" + d.slice(2);
  else if (d.startsWith("8")) d = "0" + d;
  return d.replace(/\D/g, "");
}
var maskEmail = (e) => {
  const [u, dmn] = String(e || "").split("@");
  if (!dmn) return "";
  return `${u.slice(0, 2)}${"\u2022".repeat(Math.max(2, u.length - 2))}@${dmn}`;
};
var isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || "").trim());

// supabase/functions/portal-cek/lib/portalCust.js
var ACCESS_DAYS = 14;
var REVIEW_URL = "https://g.page/r/Ccm_ctd83WbgEBM/review";
var PACK_NOTE = "Kami mengupayakan pengemasan dokumen sebaik mungkin sebelum diserahkan kepada kurir. Setelah penyerahan, proses pengantaran berada dalam penanganan pihak kurir. Jika terdapat kendala pengiriman, silakan hubungi kami untuk bantuan penelusuran.";
var STEP_ORDER = ["invoice", "work", "review", "ready", "sent", "arrived"];
var STEP_LABEL = {
  invoice: "Invoice Dibuat",
  work: "Proyek Dikerjakan",
  review: "Pengecekan Supervisi",
  ready: "Dokumen Selesai",
  sent: "Dokumen Dikirim",
  arrived: "Dokumen Tiba"
};
var STEP_LABEL_DIGITAL = { ...STEP_LABEL, sent: "Dokumen Digital Dikirim", arrived: "Dokumen Digital Diterima" };
var STEP_MAP = {
  tr_int: { cs_input: "invoice", pilih_penerjemah: "work", penerjemahan: "work", proofread: "review", otorisasi: "review", registrasi: "ready", siap_print: "ready", upload_scan: "ready", siap_kirim: "ready" },
  tr_nt: { cs_input: "invoice", penerjemahan: "work", cs_final: "ready" },
  jl: { proses: "work", cs_final: "ready" },
  ap_int: { cs_upload: "invoice", antrian: "work", diproses: "work", cs_final: "ready" },
  lg_int: { cs_upload: "invoice", antrian: "work", diproses: "work", cs_final: "ready" }
};
var VENDOR_FLOWS = ["tr_ext", "tr_bill", "ap_ext", "lg_ext"];
function stepKeysOf(sub, project) {
  const flow = flowOf(sub, project);
  const map = STEP_MAP[flow];
  const base = map ? [...new Set(Object.values(map))] : ["invoice", "work", "ready"];
  return STEP_ORDER.filter((k) => base.includes(k) || k === "sent" || k === "arrived");
}
var shipTypeOf = (project, couriers = []) => couriers.find((c) => c.id === project?.about?.courier)?.type ?? null;
var isDigital = (project, couriers) => shipTypeOf(project, couriers) === "softcopy";
var HANDOVER_KEYS = { pickup: "diambil", softcopy: "softcopy_dikirim", courier: "diserahkan_kurir", vendor: "resi" };
function handoverAt(sub, project, couriers) {
  const t = shipTypeOf(project, couriers);
  const d = sub.data?.delivery || {};
  if (t === "vendor") return d.resi || (project.about?.resi_no ? sub.data?.shipped_at || null : null);
  const k = HANDOVER_KEYS[t];
  const v = k ? d[k] : null;
  return typeof v === "string" ? v : v ? sub.data?.shipped_at || null : null;
}
function stampsOf(sub, project, couriers, link) {
  const h = sub.history || [];
  const at = (...acts) => h.find((x) => acts.some((a) => String(x.action || "").toLowerCase().includes(a)))?.at ?? null;
  const out = { invoice: project.created_at || null };
  const flow = flowOf(sub, project);
  if (flow === "tr_int") {
    out.work = sub.data?.assigned_at || at("tetapkan penerjemah", "pilih penerjemah") || null;
    out.review = sub.data?.translated_at || at("proofreader") || null;
    out.ready = sub.data?.registered_at || sub.data?.authorized_at || null;
  } else {
    out.work = at("diproses", "dikerjakan", "penerjemah") || null;
    out.ready = sub.data?.hasil_vendor || sub.data?.hasil_akhir || sub.data?.hasil_jasa || sub.data?.hasil_terjemahan ? at("selesai", "hasil") || null : null;
  }
  out.sent = handoverAt(sub, project, couriers);
  const rec = (link?.receipts || []).find((r) => r.sub_id === sub.id);
  out.arrived = rec?.at || sub.data?.arrived_at || null;
  return out;
}
function custStepOf(sub, project, couriers = [], link = null) {
  const flow = flowOf(sub, project);
  const keys = stepKeysOf(sub, project);
  const stamps = stampsOf(sub, project, couriers, link);
  const rec = (link?.receipts || []).find((r) => r.sub_id === sub.id);
  let key2;
  if (rec || sub.data?.arrived_at) key2 = "arrived";
  else if (stamps.sent) key2 = "sent";
  else if (sub.stage === DONE) key2 = "sent";
  else if (VENDOR_FLOWS.includes(flow)) key2 = sub.data?.hasil_vendor ? "ready" : "work";
  else key2 = STEP_MAP[flow]?.[sub.stage] || "work";
  if (!keys.includes(key2)) key2 = keys[Math.max(0, STEP_ORDER.indexOf(key2) - 1)] || keys[0];
  return { key: key2, index: keys.indexOf(key2), keys, stamps, done: key2 === "arrived" };
}
function orderStep(project, couriers = [], link = null) {
  const subs = project.sub_projects || [];
  const keys = STEP_ORDER.filter((k) => subs.some((s) => stepKeysOf(s, project).includes(k)));
  const labels = isDigital(project, couriers) ? STEP_LABEL_DIGITAL : STEP_LABEL;
  const steps = keys.map((k) => ({ key: k, label: labels[k] }));
  if (!subs.length) return { steps, index: 0, key: "invoice", stamps: {} };
  let min = Infinity;
  let key2 = "invoice";
  const stamps = {};
  for (const s of subs) {
    const st = custStepOf(s, project, couriers, link);
    const i = keys.indexOf(st.key);
    if (i >= 0 && i < min) {
      min = i;
      key2 = st.key;
    }
    for (const [k, v] of Object.entries(st.stamps)) if (v && (!stamps[k] || v > stamps[k])) stamps[k] = v;
  }
  return { steps, index: Math.max(0, min), key: key2, stamps };
}
function stepMessage(key2, digital) {
  if (key2 === "ready") return "Dokumen Anda sudah selesai.";
  if (key2 === "sent") return digital ? "Dokumen digital Anda sudah dikirim." : "Dokumen Anda telah diserahkan kepada kurir.";
  if (key2 === "arrived") return digital ? "Dokumen digital Anda telah diterima." : "Dokumen Anda telah tiba di tujuan.";
  const label = (digital ? STEP_LABEL_DIGITAL : STEP_LABEL)[key2] || "diproses";
  return `Dokumen Anda saat ini sedang dalam tahap ${label}.`;
}
var PUB_FIELDS = {
  tr_int: [
    { key: "hasil_terjemahan", kind: "draft", label: "Draft terjemahan", after: "penerjemahan" },
    { key: "hasil_proofread", kind: "draft", label: "Draft setelah pemeriksaan", after: "proofread" },
    { key: "file_final", kind: "final", label: "Hasil terjemahan final", after: "otorisasi" },
    { key: "scan_pdf", kind: "final", label: "Hasil terjemahan bercap (scan)", after: "upload_scan" }
  ],
  tr_nt: [{ key: "hasil_terjemahan", kind: "final", label: "Hasil terjemahan", after: "penerjemahan" }],
  ap_int: [{ key: "hasil_akhir", kind: "final", label: "Hasil apostille", done: true }],
  lg_int: [{ key: "hasil_akhir", kind: "final", label: "Hasil legalisasi", done: true }],
  tr_ext: [{ key: "hasil_vendor", kind: "final", label: "Hasil terjemahan", after: "pembayaran" }],
  tr_bill: [{ key: "hasil_vendor", kind: "final", label: "Hasil terjemahan", done: true }],
  ap_ext: [{ key: "hasil_vendor", kind: "final", label: "Hasil apostille", after: "pembayaran" }],
  lg_ext: [{ key: "hasil_vendor", kind: "final", label: "Hasil legalisasi", after: "pembayaran" }],
  jl: [{ key: "hasil_jasa", kind: "final", label: "Hasil layanan", after: "proses" }]
};
function publishableOf(project) {
  const out = [];
  for (const s of project.sub_projects || []) {
    const flow = flowOf(s, project);
    const idx = stageIndex(flow, s.stage);
    for (const f of PUB_FIELDS[flow] || []) {
      const file = s.data?.[f.key];
      if (!file) continue;
      if (f.done && s.stage !== DONE) continue;
      if (f.after && idx <= stageIndex(flow, f.after)) continue;
      out.push({ ref: `sub:${s.id}:${f.key}`, sub_id: s.id, kind: f.kind, label: f.label, title: s.title, name: file.name, file, at: file.uploaded_at || s.stage_at || null });
    }
    if (flow === "tr_int" && idx > stageIndex(flow, "otorisasi")) {
      (s.data?.file_final_list || []).slice(1).forEach((file, i) => file && out.push({
        ref: `sub:${s.id}:file_final_list:${i + 1}`,
        sub_id: s.id,
        kind: "final",
        label: `Hasil terjemahan final (dokumen ${i + 2})`,
        title: s.title,
        name: file.name,
        file,
        at: file.uploaded_at || s.stage_at || null
      }));
    }
  }
  return out;
}
function publishedOf(project, link) {
  const shared = new Set(link?.shared || []);
  const all = publishableOf(project).filter((d) => shared.has(d.ref));
  const seq = {};
  return all.map((d) => {
    const n = seq[`${d.sub_id}:${d.kind}`] = (seq[`${d.sub_id}:${d.kind}`] || 0) + 1;
    return { ...d, version: n };
  });
}
function resolvePublished(project, link, ref) {
  return publishedOf(project, link).find((d) => d.ref === ref)?.file ?? null;
}
function accessState(link, now = /* @__PURE__ */ new Date()) {
  if (!link) return "missing";
  if (link.revoked_at) return "revoked";
  if (!link.activated_at) return "off";
  if (link.expires_at && new Date(link.expires_at) <= now) return "expired";
  return "active";
}
var accessMessage = (link) => `Akses pesanan ini berlaku selama ${ACCESS_DAYS} hari, hingga ${fmtDateTime(link?.expires_at)}. Silakan unduh atau kirim dokumen ke email Anda sebelum akses berakhir.`;
function fmtDateTime(iso) {
  if (!iso) return "\u2014";
  try {
    return new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) + " WIB";
  } catch {
    return String(iso).slice(0, 16).replace("T", " ");
  }
}
var phonesOf = (project) => [...new Set([project?.customer?.phone, project?.customer?.ship?.phone].map(normPhone).filter((x) => x.length >= 8))];
var SERVICE_LABEL = { terjemahan: "Terjemahan Tersumpah", terjemahan_nt: "Terjemahan Non Tersumpah", apostille: "Apostille", legalisasi: "Legalisasi", jasa_lain: "Jasa Lain" };
var serviceSummary = (project) => [...new Set((project.sub_projects || []).map((s) => SERVICE_LABEL[s.type] || s.type))].join(" \xB7 ");
function lookupInvoices(phone, projects, links, now = /* @__PURE__ */ new Date()) {
  const p = normPhone(phone);
  if (p.length < 8) return [];
  const byProject = new Map((links || []).filter((l) => l.kind === "customer" && l.project_id).map((l) => [l.project_id, l]));
  return (projects || []).filter((pr) => phonesOf(pr).includes(p) && accessState(byProject.get(pr.id), now) === "active").map((pr) => ({
    project_id: pr.id,
    invoice: pr.invoice_no,
    date: pr.about?.received_at || (pr.created_at || "").slice(0, 10),
    service: serviceSummary(pr),
    expires_at: byProject.get(pr.id)?.expires_at || null,
    step: orderStep(pr, [], byProject.get(pr.id)).key
  })).sort((a, b) => String(b.date).localeCompare(String(a.date)));
}
function courierInfo(project, couriers = []) {
  const k = couriers.find((c) => c.id === project.about?.courier);
  const t = shipTypeOf(project, couriers);
  if (!k || t === "softcopy") return null;
  const resi = project.about?.resi_no || "";
  const sent = (project.sub_projects || []).map((s) => handoverAt(s, project, couriers)).filter(Boolean).sort()[0] || null;
  return { name: k.name, type: t, resi, track: resi && k.track_url ? String(k.track_url).replace("{resi}", encodeURIComponent(resi)) : "", sent_at: sent, status: project.about?.ship_status || "" };
}
function receiptGroups(project, link, couriers = []) {
  const docs2 = publishedOf(project, link);
  const out = [];
  for (const s of project.sub_projects || []) {
    const finals = docs2.filter((d) => d.sub_id === s.id && d.kind === "final");
    if (!finals.length) continue;
    const st = custStepOf(s, project, couriers, link);
    const rec = (link?.receipts || []).find((r) => r.sub_id === s.id);
    const regs = (s.data?.reg_numbers || []).filter((x) => String(x || "").trim());
    const single = String(s.data?.registration_no || "").trim();
    const regList = regs.length ? regs : single ? [single] : [];
    out.push({
      sub_id: s.id,
      title: s.title,
      docs: finals.map((d) => ({ ref: d.ref, name: d.name, label: d.label })),
      can: !rec && (st.key === "sent" || st.key === "arrived"),
      confirmed_at: rec?.at || null,
      reg_ready: regList.length > 0,
      reg_count: regList.length,
      reg_active: !!s.data?.reg_activated_at,
      reg_active_at: s.data?.reg_activated_at || null,
      reg_numbers: (link?.shared_regs || []).includes(s.id) ? regList : [],
      doc_count: docListOf(s).length
    });
  }
  return out;
}
var contactWa = (settings = []) => String((settings || []).find((s) => s.key === "portal")?.wa || "").replace(/\D/g, "");
function custOrderView(link, project, couriers = [], payStatus = null, settings = []) {
  const digital = isDigital(project, couriers);
  const step = orderStep(project, couriers, link);
  const docs2 = publishedOf(project, link).map((d) => ({ ref: d.ref, name: d.name, label: d.label, kind: d.kind, version: d.version, at: d.at, title: d.title }));
  return {
    invoice: project.invoice_no,
    service: serviceSummary(project),
    digital,
    expires_at: link.expires_at,
    access_message: accessMessage(link),
    greeting: "Halo Bapak/Ibu, terima kasih atas kepercayaan dan pesanan Anda.",
    step_key: step.key,
    step_index: step.index,
    steps: step.steps,
    stamps: step.stamps,
    step_message: stepMessage(step.key, digital),
    deadline: project.about?.deadline || null,
    docs: docs2,
    has_docs: docs2.length > 0,
    email_masked: maskEmail(project.customer?.email),
    has_email: isEmail(project.customer?.email),
    note: link.cust_note?.text ? { text: link.cust_note.text, at: link.cust_note.at } : null,
    pay: payStatus ? { label: payStatus.label, key: payStatus.key } : null,
    courier: digital ? null : courierInfo(project, couriers),
    pack_note: digital ? "" : PACK_NOTE,
    receipts: receiptGroups(project, link, couriers),
    review_url: REVIEW_URL,
    contact_wa: contactWa(settings)
  };
}
function confirmReceipt(link, project, subId, couriers = [], now = /* @__PURE__ */ new Date()) {
  if (accessState(link, now) !== "active") return { error: accessState(link, now) };
  const groups = receiptGroups(project, link, couriers);
  const g = groups.find((x) => x.sub_id === subId);
  if (!g) return { error: "not_found" };
  if (g.confirmed_at) return { already: true, link, group: g };
  if (!g.can) return { error: "not_ready" };
  if (!g.reg_ready) return { error: "no_register" };
  const at = now.toISOString();
  const rec = { sub_id: subId, at, refs: g.docs.map((d) => d.ref), via: "portal" };
  return {
    link: {
      ...link,
      receipts: [...link.receipts || [], rec],
      history: [...link.history || [], { at, by: "Pelanggan (portal)", action: `Konfirmasi penerimaan dokumen \xB7 ${g.title} \xB7 register diaktifkan` }]
    },
    sub_patch: { reg_activated_at: at, reg_activated_via: "portal", arrived_at: at },
    group: g
  };
}

// supabase/functions/portal-cek/lib/pay.js
var PAY_STATES = {
  paid: { key: "paid", label: "Lunas", tone: "ok" },
  partial: { key: "partial", label: "Bayar Sebagian", tone: "warn" },
  unpaid: { key: "unpaid", label: "Belum Dibayar", tone: "due" },
  draft: { key: "draft", label: "Draft", tone: "mute" },
  void: { key: "void", label: "Dibatalkan", tone: "mute" },
  unknown: { key: "unknown", label: "Belum Tersedia", tone: "mute" }
};
function payStateOf(status) {
  const s = String(status || "").toLowerCase().replace(/[\s-]+/g, "_");
  if (!s) return PAY_STATES.unknown;
  if (s === "paid") return PAY_STATES.paid;
  if (s === "partially_paid" || s === "partial" || s === "partially") return PAY_STATES.partial;
  if (["sent", "unpaid", "overdue", "viewed"].includes(s)) return PAY_STATES.unpaid;
  if (s === "draft") return PAY_STATES.draft;
  if (["void", "voided", "cancelled", "canceled"].includes(s)) return PAY_STATES.void;
  return PAY_STATES.unknown;
}

// supabase/functions/portal-cek/index.ts
var URL_ = Deno.env.get("SUPABASE_URL");
var SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
var BUCKET = "files";
var SESSION_HOURS = 2;
var LOOKUP_MAX = 8;
var LOOKUP_WINDOW_MIN = 15;
var FILE_TTL = 600;
var db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
var json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
var enc = new TextEncoder();
var b64url = (b) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
var keyP = null;
var key = () => keyP ||= crypto.subtle.importKey("raw", enc.encode(SERVICE), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
async function sign(payload) {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  return `${body}.${b64url(await crypto.subtle.sign("HMAC", await key(), enc.encode(body)))}`;
}
async function open(token) {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (b64url(await crypto.subtle.sign("HMAC", await key(), enc.encode(body))) !== sig) return null;
  try {
    const p = JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/")));
    return p.exp > Date.now() ? p : null;
  } catch {
    return null;
  }
}
async function gate(ip) {
  const since = new Date(Date.now() - LOOKUP_WINDOW_MIN * 6e4).toISOString();
  const { count } = await db.from("portal_hits").select("*", { count: "exact", head: true }).eq("ip", ip).gte("at", since);
  return (count ?? 0) < LOOKUP_MAX;
}
var hit = (ip, ok) => db.from("portal_hits").insert({ ip, at: (/* @__PURE__ */ new Date()).toISOString(), ok }).then(() => {
}, () => {
});
var docs = async (table, ids) => {
  let q = db.from(table).select("doc");
  if (ids) q = q.in("id", ids);
  const { data } = await q;
  return (data || []).map((r) => r.doc);
};
var linkRow = async (pid) => {
  const { data } = await db.from("share_links").select("id,doc").eq("doc->>kind", "customer").eq("doc->>project_id", pid).limit(1);
  return data?.[0] || null;
};
async function payOf(invoiceNo) {
  const { data } = await db.from("zoho_invoices").select("status").eq("invoice_no", String(invoiceNo || "").toUpperCase()).limit(1);
  return payStateOf(data?.[0]?.status ?? null);
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const action = String(body.action || "");
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  try {
    if (action === "lookup") {
      if (!await gate(ip)) return json({ ok: false, error: "blocked" });
      const phone = normPhone(String(body.phone || ""));
      if (phone.length < 8) {
        hit(ip, false);
        return json({ ok: false, invoices: [] });
      }
      const [{ data: cand }, links] = await Promise.all([
        db.rpc("portal_find_projects", { tail: phone.slice(-9) }),
        docs("share_links")
      ]);
      const rows = lookupInvoices(phone, cand || [], links);
      hit(ip, rows.length > 0);
      if (!rows.length) return json({ ok: false, invoices: [] });
      const until = new Date(Date.now() + SESSION_HOURS * 36e5).toISOString();
      const session = await sign({ ids: rows.map((r) => r.project_id), exp: Date.parse(until) });
      return json({ ok: true, invoices: rows, session, until });
    }
    const sess = await open(typeof body.session === "string" ? body.session : null);
    if (!sess) return json({ error: "session" }, 401);
    const pid = String(body.project_id || "");
    if (!sess.ids.includes(pid)) return json({ error: "forbidden" }, 403);
    const [[project], row, couriers] = await Promise.all([docs("projects", [pid]), linkRow(pid), docs("couriers")]);
    const link = row?.doc ?? null;
    if (!project || !link) return json({ error: "missing" }, 404);
    const st = accessState(link);
    if (st !== "active") return json({ error: st }, 403);
    if (action === "order") return json(custOrderView(link, project, couriers, await payOf(project.invoice_no)));
    if (action === "file") {
      const f = resolvePublished(project, link, String(body.ref || ""));
      if (!f) return json({ error: "not_found" }, 404);
      if (!f.path) return f.url ? json({ url: f.url, name: f.name }) : json({ error: "not_found" }, 404);
      const { data, error } = await db.storage.from(f.bucket || BUCKET).createSignedUrl(f.path, FILE_TTL, { download: f.name });
      if (error || !data?.signedUrl) return json({ error: "not_found" }, 404);
      return json({ url: data.signedUrl, name: f.name });
    }
    if (action === "email") {
      const to = String(project.customer?.email || "");
      if (!to) return json({ error: "no_email" });
      const refs = Array.isArray(body.refs) ? body.refs : [];
      await db.from("share_log").insert({
        id: `sl-${crypto.randomUUID()}`,
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        doc: {
          project_id: pid,
          link_id: row.id,
          recipient_type: "customer",
          recipient_name: project.customer?.name || "",
          to: to.replace(/^(.{2}).*(@.*)$/, "$1***$2"),
          channel: "email",
          kind: "portal_email",
          sender: "Pelanggan (portal)",
          result: "not_configured",
          note: `Permintaan kirim ${refs.length} dokumen \u2014 layanan email belum terhubung`,
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        }
      });
      return json({ error: "not_configured" });
    }
    if (action === "confirm") {
      const subId = String(body.sub_id || "");
      const r = confirmReceipt(link, project, subId, couriers);
      if (r.error) return json({ error: r.error });
      if (r.already) return json({ ok: true, already: true });
      const subs = (project.sub_projects || []).map((s) => s.id === subId ? { ...s, data: { ...s.data, ...r.sub_patch } } : s);
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const up1 = await db.from("projects").update({ doc: { ...project, sub_projects: subs, updated_at: now }, updated_at: now }).eq("id", pid);
      if (up1.error) return json({ error: "failed" }, 500);
      const up2 = await db.from("share_links").update({ doc: r.link, updated_at: now }).eq("id", row.id);
      if (up2.error) return json({ error: "failed" }, 500);
      return json({ ok: true });
    }
    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("portal-cek", action, e);
    return json({ error: "server" }, 500);
  }
});
