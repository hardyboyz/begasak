/**
 * Logo resmi BEGASAK. Sumber: `src/images/logo.png` (RGBA transparan,
 * 2000x2466). Agar bundel tetap ringan, komponen ini memakai turunan yang sudah
 * diperkecil di `public/logo.png` (415x512) lewat jalur absolut.
 *
 * Rasio logo lebih tinggi dari lebar (0.811), jadi `object-contain` dipakai agar
 * logo tidak terpotong dan tidak meregang.
 */
export default function LogoMerek({ className = 'w-10 h-10', alt = 'Logo BEGASAK' }) {
  return <img src="/logo.png" alt={alt} className={`object-contain ${className}`} />;
}