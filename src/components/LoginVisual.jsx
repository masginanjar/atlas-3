import { gambarAktif } from '../config/loginTheme.js'

/** Ilustrasi bawaan — dipakai saat belum ada gambar atau gambar gagal dimuat.
 *  Tema: penerjemahan, dokumen, dan kerja tim. Murni bentuk dasar, tanpa merek. */
export function IlustrasiBawaan({ className = '' }) {
  return (
    <svg viewBox="0 0 420 460" className={className} role="img" aria-label="Ilustrasi penerjemahan dokumen dan kerja tim">
      <defs>
        <linearGradient id="lg-kertas" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#f3f4ff" />
        </linearGradient>
        <linearGradient id="lg-biru" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" /><stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>

      {/* bentuk abstrak lembut di belakang */}
      <circle cx="330" cy="92" r="78" fill="#c7d2fe" opacity=".55" />
      <circle cx="78" cy="372" r="62" fill="#ddd6fe" opacity=".6" />

      {/* dokumen sumber */}
      <g transform="rotate(-7 118 198)">
        <rect x="46" y="118" width="150" height="196" rx="14" fill="url(#lg-kertas)" stroke="#e0e7ff" strokeWidth="2" />
        <rect x="68" y="146" width="78" height="9" rx="4.5" fill="#c7d2fe" />
        <rect x="68" y="168" width="106" height="7" rx="3.5" fill="#e2e8f0" />
        <rect x="68" y="184" width="92" height="7" rx="3.5" fill="#e2e8f0" />
        <rect x="68" y="200" width="104" height="7" rx="3.5" fill="#e2e8f0" />
        <rect x="68" y="216" width="70" height="7" rx="3.5" fill="#e2e8f0" />
        <text x="68" y="268" fontFamily="system-ui, sans-serif" fontSize="30" fontWeight="700" fill="#6366f1">文</text>
        <text x="106" y="268" fontFamily="system-ui, sans-serif" fontSize="30" fontWeight="700" fill="#a5b4fc">ع</text>
      </g>

      {/* panah terjemahan */}
      <g>
        <circle cx="210" cy="212" r="27" fill="url(#lg-biru)" />
        <path d="M198 206h18m0 0-5-5m5 5-5 5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M222 220h-18m0 0 5-5m-5 5 5 5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>

      {/* dokumen hasil + stempel tersumpah */}
      <g transform="rotate(6 302 206)">
        <rect x="228" y="126" width="150" height="196" rx="14" fill="url(#lg-kertas)" stroke="#e0e7ff" strokeWidth="2" />
        <rect x="250" y="154" width="94" height="9" rx="4.5" fill="#c7d2fe" />
        <rect x="250" y="176" width="106" height="7" rx="3.5" fill="#e2e8f0" />
        <rect x="250" y="192" width="88" height="7" rx="3.5" fill="#e2e8f0" />
        <rect x="250" y="208" width="102" height="7" rx="3.5" fill="#e2e8f0" />
        <circle cx="330" cy="272" r="28" fill="none" stroke="#6366f1" strokeWidth="2.4" opacity=".75" />
        <path d="M318 272l8 8 16-17" stroke="#6366f1" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* kerja tim — tiga anggota */}
      <g transform="translate(96 338)">
        {[0, 76, 152].map((x, i) => (
          <g key={x} transform={`translate(${x} 0)`}>
            <circle cx="36" cy="22" r="17" fill={['#6366f1', '#8b5cf6', '#60a5fa'][i]} opacity=".92" />
            <path d="M8 74c0-16 13-28 28-28s28 12 28 28z" fill={['#6366f1', '#8b5cf6', '#60a5fa'][i]} opacity=".28" />
          </g>
        ))}
        <path d="M36 92h152" stroke="#c7d2fe" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 9" />
      </g>
    </svg>
  )
}

/**
 * Panel visual kanan. Dipakai halaman login dan pratinjau di Setting.
 * `gambar` = satu objek gambar terpilih (boleh null → ilustrasi bawaan).
 */
export default function LoginVisual({ tema, gambar, mini = false, onError }) {
  const g = gambar && gambar.src ? gambar : null
  const posisi = `${g?.posX ?? 50}% ${g?.posY ?? 50}%`
  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl" style={{ background: tema.panelBg }}>
      {g ? (
        <img src={g.src} alt={tema.panelJudul} onError={onError}
          className="absolute inset-0 h-full w-full"
          style={{ objectFit: tema.fit === 'fit' ? 'contain' : 'cover', objectPosition: posisi, transform: g.zoom && g.zoom !== 1 ? `scale(${g.zoom})` : undefined }} />
      ) : (
        <div className="absolute inset-0 grid place-items-center p-6">
          <IlustrasiBawaan className={mini ? 'h-full max-h-[150px] w-auto' : 'h-auto max-h-[62%] w-[82%]'} />
        </div>
      )}
      {Number(tema.overlay) > 0 && (
        <div aria-hidden className="absolute inset-0" style={{ background: `linear-gradient(to top, rgba(15,23,42,${Math.min(60, Number(tema.overlay)) / 100}), rgba(15,23,42,0) 62%)` }} />
      )}
      <div className={`absolute inset-x-0 bottom-0 ${mini ? 'p-3' : 'p-7 sm:p-9'}`}>
        <h2 className={`font-display font-extrabold tracking-tight ${mini ? 'text-[11px] leading-snug' : 'text-xl leading-snug sm:text-[26px]'}`}
          style={{ color: Number(tema.overlay) > 18 ? '#fff' : '#1e1b4b' }}>
          {tema.panelJudul}
        </h2>
        <p className={`${mini ? 'mt-1 text-[8px] leading-snug' : 'mt-2.5 text-[13px] leading-relaxed sm:text-sm'}`}
          style={{ color: Number(tema.overlay) > 18 ? 'rgba(255,255,255,.88)' : '#4c4b7a' }}>
          {tema.panelPesan}
        </p>
      </div>
    </div>
  )
}

export { gambarAktif }
