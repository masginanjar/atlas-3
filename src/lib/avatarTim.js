// Foto profil tim (dari Pak, 9 Nov 2026). Dipakai bila akun belum punya foto unggahan.
import sabrina from '../assets/avatar/sabrina.webp'
import nihaya from '../assets/avatar/nihaya.webp'
import destri from '../assets/avatar/destri.webp'
import nikita from '../assets/avatar/nikita.webp'
import rosyada from '../assets/avatar/rosyada.webp'
import indah from '../assets/avatar/indah.webp'
import rika from '../assets/avatar/rika.webp'
import naomi from '../assets/avatar/naomi.webp'
import solicin from '../assets/avatar/solicin.webp'
import wahyu from '../assets/avatar/wahyu.webp'
import khrisna from '../assets/avatar/khrisna.webp'
import ninda from '../assets/avatar/ninda.webp'
import emma from '../assets/avatar/emma.webp'
import rhania from '../assets/avatar/rhania.webp'
import aina from '../assets/avatar/aina.webp'
import nabila from '../assets/avatar/nabila.webp'
import santi from '../assets/avatar/santi.webp'
import gean from '../assets/avatar/gean.webp'
import debby from '../assets/avatar/debby.webp'

/** Nama depan (huruf kecil) → foto. */
export const FOTO_TIM = { sabrina, nihaya, destri, nikita, rosyada, indah, rika, naomi, solicin, sholichin: solicin, wahyu, khrisna, ninda, emma, ema: emma, rhania, aina, nabila, santi, gean, debby }
export const fotoTim = (nama = '') => FOTO_TIM[String(nama).trim().split(/[\s(]/)[0].toLowerCase()] || null
