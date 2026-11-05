// Zoho Books API v3 — token di-refresh otomatis dari ZOHO_REFRESH_TOKEN.
const DC = process.env.ZOHO_DC || 'com'
let cache = { token: null, exp: 0 }

async function accessToken() {
  if (cache.token && Date.now() < cache.exp) return cache.token
  const body = new URLSearchParams({
    refresh_token: process.env.ZOHO_REFRESH_TOKEN, client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET, grant_type: 'refresh_token',
  })
  const r = await fetch(`https://accounts.zoho.${DC}/oauth/v2/token`, { method: 'POST', body })
  const j = await r.json()
  if (!j.access_token) throw new Error('Gagal mendapat token Zoho: ' + (j.error || r.status))
  cache = { token: j.access_token, exp: Date.now() + (Number(j.expires_in || 3600) - 120) * 1000 }
  return cache.token
}

export async function zohoGet(path, params = {}) {
  const qs = new URLSearchParams({ organization_id: process.env.ZOHO_ORG_ID, ...params })
  const r = await fetch(`https://www.zohoapis.${DC}/books/v3${path}?${qs}`, {
    headers: { Authorization: `Zoho-oauthtoken ${await accessToken()}` },
  })
  const j = await r.json()
  if (j.code !== 0) throw new Error('Zoho: ' + (j.message || r.status))
  return j
}
