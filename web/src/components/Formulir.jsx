import { useEffect, useRef, useState } from 'react';
import { Modal } from './ui';
import { api } from '../lib/api';

/**
 * Formulir master data generik untuk halaman CRUD.
 *
 * `fields` describes each control so Proyek / Tenaga Kerja / Penyedia Jasa /
 * Pengguna can share validation, submit, and error handling.
 *
 * Field spec: { nama, label, tipe, opsi?, wajib?, [], required?, hint?, lebar? }
 */
export function fieldsDari(pakai) {
  return pakai.map((f) => (typeof f === 'string' ? { nama: f, label: f } : f));
}

export function Formulir({
  buka,
  tutup,
  judul,
  simpanLabel = 'Simpan',
  fields,
  nilaiAwal = {},
  onSimpan,
  kecil,
}) {
  const [nilai, setNilai] = useState({});
  const [galat, setGalat] = useState({});
  const [pesan, setPesan] = useState('');
  const [kirim, setKirim] = useState(false);
  const ref = useRef(null);
  // `nilaiAwal` dibuat ulang tiap render induk. Reset hanya saat dialog dibuka,
  // jika tidak input pengguna terhapus saat halaman memuat ulang data di belakang.
  const bukaSebelumnya = useRef(buka);

  useEffect(() => {
    if (buka && !bukaSebelumnya.current) {
      setNilai({ ...nilaiAwal });
      setGalat({});
      setPesan('');
      setKirim(false);
    }
    bukaSebelumnya.current = buka;
  }, [buka, nilaiAwal]);

  const set = (nama, v) => {
    setNilai((s) => ({ ...s, [nama]: v }));
    setGalat((s) => (s[nama] ? { ...s, [nama]: undefined } : s));
  };

  const validasi = () => {
    const g = {};
    for (const f of fields) {
      const v = nilai[f.nama];
      if (f.wajib && (v === undefined || v === null || String(v).trim() === '')) {
        g[f.nama] = `${f.label} wajib diisi`;
        continue;
      }
      if (f.min !== undefined && v !== '' && v !== undefined && v !== null && Number(v) < f.min) {
        g[f.nama] = `${f.label} minimal ${f.min}`;
      }
    }
    setGalat(g);
    return Object.keys(g).length === 0;
  };

  const kirimForm = async (e) => {
    e.preventDefault();
    setPesan('');
    if (!validasi()) return;
    setKirim(true);
    try {
      await onSimpan(nilai);
      tutup();
    } catch (err) {
      setPesan(err.message);
    } finally {
      setKirim(false);
    }
  };

  const kolom = kecil ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3';

  return (
    <Modal buka={buka} tutup={tutup} judul={judul} lebar={kecil ? 'max-w-lg' : 'max-w-3xl'}>
      <form onSubmit={kirimForm} ref={ref}>
        {pesan && (
          <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-[12px] text-red-700">
            {pesan}
          </div>
        )}

        <div className={`grid grid-cols-1 ${kolom} gap-3`}>
          {fields.map((f) => {
            const salah = !!galat[f.nama];
            const basis =
              'w-full rounded-lg border px-3 py-2 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-gov-500/25 focus:border-gov-500 disabled:bg-slate-50 disabled:text-slate-500';
            const kelas = `${basis} ${salah ? 'border-red-400' : 'border-slate-300'}`;
            const v = nilai[f.nama];
            const on = (val) => set(f.nama, val);

            let kontrol = null;
            if (f.tipe === 'select') {
              kontrol = (
                <select
                  value={v ?? ''}
                  onChange={(e) => on(e.target.value)}
                  className={kelas}
                  disabled={f.kunci}
                >
                  {f.opsi.map((o) => {
                    const val = typeof o === 'string' ? o : o.value;
                    const lab = typeof o === 'string' ? o : o.label;
                    return (
                      <option key={val} value={val}>
                        {lab}
                      </option>
                    );
                  })}
                </select>
              );
            } else if (f.tipe === 'textarea') {
              kontrol = (
                <textarea
                  value={v ?? ''}
                  onChange={(e) => on(e.target.value)}
                  rows={f.baris || 2}
                  className={`${kelas} resize-y`}
                  disabled={f.kunci}
                />
              );
            } else if (f.tipe === 'checkbox') {
              kontrol = (
                <label className="flex items-center gap-2 text-[13px] text-slate-700 py-2 select-none">
                  <input
                    type="checkbox"
                    checked={!!v}
                    onChange={(e) => on(e.target.checked ? 1 : 0)}
                    className="w-4 h-4 rounded border-slate-300 text-gov-600 focus:ring-gov-500/30"
                    disabled={f.kunci}
                  />
                  {f.label}
                </label>
              );
            } else {
              kontrol = (
                <input
                  type={f.tipe || 'text'}
                  value={v ?? ''}
                  onChange={(e) => on(f.bintang ? Number(e.target.value) || 0 : e.target.value)}
                  className={kelas}
                  placeholder={f.placeholder || ''}
                  step={f.bintang ? 'any' : undefined}
                  disabled={f.kunci}
                />
              );
            }

            if (f.tipe === 'checkbox') {
              return (
                <div key={f.nama} className="sm:col-span-1">
                  {kontrol}
                  {f.hint && <p className="text-[10px] text-slate-400 mt-0.5">{f.hint}</p>}
                </div>
              );
            }

            return (
              <div key={f.nama} className={f.lebar === 'penuh' ? 'sm:col-span-2 lg:col-span-3' : ''}>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  {f.label}
                  {f.wajib && <span className="text-red-500"> *</span>}
                </label>
                {kontrol}
                {salah ? (
                  <p className="text-[10px] text-red-600 mt-0.5">{galat[f.nama]}</p>
                ) : (
                  f.hint && <p className="text-[10px] text-slate-400 mt-0.5">{f.hint}</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
          <button type="button" onClick={tutup} className="tombol-kedua">
            Batal
          </button>
          <button type="submit" disabled={kirim} className="tombol-utama">
            {kirim ? 'Menyimpan…' : simpanLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Dialog konfirmasi sederhana untuk aksi hapus. */
export function Konfirmasi({ buka, tutup, judul = 'Hapus data?', pesan, onYa, labelYa = 'Hapus', sibuk }) {
  return (
    <Modal buka={buka} tutup={tutup} judul={judul} lebar="max-w-sm">
      <p className="text-[13px] text-slate-600 leading-relaxed">{pesan}</p>
      <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
        <button onClick={tutup} className="tombol-kedua">
          Batal
        </button>
        <button
          onClick={onYa}
          disabled={sibuk}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 text-white text-[13px] font-semibold px-4 py-2 hover:bg-red-700 disabled:opacity-60"
        >
          {sibuk ? 'Menghapus…' : labelYa}
        </button>
      </div>
    </Modal>
  );
}

/**
 * Tombol aksi baris tabel yang menghormati izin peran. `boleh` berasal dari
 * useAuth sehingga tombol otomatis hilang bagi role yang tidak berwenang.
 */
export function AksiBaris({ boleh, buat, ubah, hapus, target }) {
  return (
    <div className="flex items-center gap-1.5 justify-end">
      {boleh(`${ubah?.izin}:update`) && (
        <button
          onClick={() => ubah?.jalankan(target)}
          title="Ubah"
          className="w-7 h-7 rounded-md border border-slate-300 grid place-items-center text-slate-600 hover:bg-slate-50 hover:text-gov-700"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5">
            <path d="M4 20h4L20 8a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5 4 20z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      {boleh(`${hapus?.izin}:delete`) && (
        <button
          onClick={() => hapus?.jalankan(target)}
          title="Hapus"
          className="w-7 h-7 rounded-md border border-slate-300 grid place-items-center text-slate-600 hover:bg-red-50 hover:text-red-600"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5">
            <path d="M4 7h16" strokeLinecap="round" />
            <path d="M9.5 7V5h5v2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M6.5 7l.9 12a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

/** Membungkus pemanggilan API dengan pesan galat yang mudah ditampilkan. */
export async function coba(fn, setPesan) {
  try {
    setPesan('');
    await fn();
    return true;
  } catch (e) {
    setPesan(e.message);
    return false;
  }
}

export { api };
