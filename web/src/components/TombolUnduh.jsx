import { useState } from 'react';
import { unduh } from '../lib/api';

/**
 * Tombol unduh yang tetap membawa token sesi.
 *
 * <a href> biasa tidak dapat menyertakan header Authorization, sehingga
 * endpoint terproteksi akan membalas 401. Tombol ini mengambil berkas sebagai
 * Blob lebih dulu, lalu memulai unduhan lewat object URL.
 */
export function TombolUnduh({ ke, nama = 'unduhan.csv', className = 'tombol-sekunder', children }) {
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState('');

  const klik = async () => {
    setSibuk(true);
    setGalat('');
    try {
      await unduh(ke, nama);
    } catch (e) {
      setGalat(e.message);
    } finally {
      setSibuk(false);
    }
  };

  return (
    <>
      <button onClick={klik} disabled={sibuk} className={className} title={galat || undefined}>
        {children}
        {sibuk && <span className="text-[11px] opacity-70">…</span>}
      </button>
      {galat && <span className="text-[11px] text-red-600">{galat}</span>}
    </>
  );
}
