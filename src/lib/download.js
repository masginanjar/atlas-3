// Simpan file ke perangkat pengguna.
// Di dalam artifact Claude memakai capability "downloads"; di web biasa memakai <a download>.
let cap
async function capability() {
  if (cap !== undefined) return cap
  if (!window.claude?.use) return (cap = null)
  cap = await Promise.race([window.claude.use('downloads'), new Promise((r) => setTimeout(() => r(null), 4000))]).catch(() => null)
  return cap
}

export async function saveBlob(filename, blob) {
  const d = await capability()
  if (d) {
    try { await d.save({ filename, data: blob }); return true }
    catch (e) { if (e?.code === 'declined') return false; throw new Error(e?.code === 'rejected_extension' ? 'Format file ini tidak bisa diunduh di pratinjau' : 'Unduhan tidak tersedia di pratinjau ini') }
  }
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return true
}

export function dataUrlToBlob(dataUrl) {
  const [head, b64] = dataUrl.split(',')
  const mime = head.match(/data:([^;]+)/)?.[1] || 'application/octet-stream'
  const bin = atob(b64); const u8 = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
  return new Blob([u8], { type: mime })
}
