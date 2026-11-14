// ATLAS — service worker (PWA). Tujuan: bisa dipasang seperti aplikasi & lebih cepat dibuka.
// Aman untuk update: halaman (index.html) SELALU diambil dari internet dulu (network-first),
// jadi versi baru langsung terpakai. Aset ber-hash (assets/…) aman disimpan (cache-first).
// Data (Supabase, API) TIDAK pernah disentuh/di-cache.
const CACHE = 'atlas-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k)
    await self.clients.claim()
  })())
})

const simpan = async (req, res) => { if (res && res.ok && res.type === 'basic') { const c = await caches.open(CACHE); c.put(req, res.clone()) } return res }

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // Supabase, Google, dll → langsung ke internet
  // Halaman: internet dulu, cadangan dari cache bila offline
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => simpan(new Request(new URL('./', self.registration.scope)), r)).catch(async () => (await caches.match(new URL('./', self.registration.scope))) || Response.error()))
    return
  }
  // Aset ber-hash, ikon, mesin OCR: cache dulu
  if (/\/(assets|icons|ocr)\//.test(url.pathname)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => simpan(req, r))))
  }
})
