import { useState } from 'react';
import { api, useApi } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Kartu, KartuJudul, Chip, Kosong, Memuat } from '../components/ui';
import { IkonCari, IkonRefresh, IkonTambah } from '../components/icons';
import { Formulir, Konfirmasi, AksiBaris } from '../components/Formulir';
import { waktuRelatif } from '../lib/utils';

const WARNA = {
  Administrator: 'gov',
  'Perangkat Daerah': 'blue',
  'Penyedia Jasa': 'green',
  'Asosiasi Profesi': 'violet',
  Masyarakat: 'slate',
};

const WARNA_BULAN = {
  Administrator: 'bg-slate-700',
  'Perangkat Daerah': 'bg-gov-700',
  'Penyedia Jasa': 'bg-emerald-600',
  'Asosiasi Profesi': 'bg-violet-600',
  Masyarakat: 'bg-slate-600',
};

export default function Pengguna() {
  const { pengguna: saya, boleh } = useAuth();
  const [cari, setCari] = useState('');
  const [peran, setPeran] = useState('');
  const [page, setPage] = useState(1);
  const per = 20;

  const query = new URLSearchParams({ limit: per, offset: (page - 1) * per });
  if (cari) query.set('q', cari);
  if (peran) query.set('peran', peran);

  const { data, loading, reload } = useApi(`/api/pengguna?${query.toString()}`);
  const { data: petaPeran } = useApi('/api/auth/peran');

  const [mode, setMode] = useState(null);
  const [sunting, setSunting] = useState(null);
  const [hapus, setHapus] = useState(null);
  const [sibuk, setSibuk] = useState(false);
  const [notif, setNotif] = useState('');

  const totalHalaman = Math.ceil((data?.total || 0) / per);
  // Deskripsi peran berasal dari server agar tidak melenceng dari definisi RBAC.
  const daftarPeran = (petaPeran?.peran || []).map((p) => p.nilai);
  const ket = Object.fromEntries((petaPeran?.peran || []).map((p) => [p.nilai, p.keterangan]));

  const FIELDS = [
    { nama: 'username', label: 'Username', wajib: true, hint: '3-40 karakter: huruf, angka, titik, garis.' },
    { nama: 'nama', label: 'Nama lengkap', wajib: true },
    {
      nama: 'peran',
      label: 'Peran',
      tipe: 'select',
      opsi: daftarPeran,
      wajib: true,
      hint: ket[mode === 'ubah' ? sunting?.peran : 'Perangkat Daerah'] || '',
    },
    { nama: 'satker', label: 'Satuan kerja' },
    { nama: 'email', label: 'Email', tipe: 'email' },
    { nama: 'telepon', label: 'Telepon' },
    { nama: 'organisasi', label: 'Organisasi' },
    ...(mode === 'ubah'
      ? [
          { nama: 'password', label: 'Kata sandi baru', tipe: 'password', hint: 'Minimal 6 karakter. Kosongkan bila tidak diubah.' },
          { nama: 'passwordLama', label: 'Kata sandi lama', tipe: 'password', hint: 'Wajib diisi bila mengganti kata sandi.' },
        ]
      : [{ nama: 'password', label: 'Kata sandi', tipe: 'password', wajib: true, hint: 'Minimal 6 karakter.' }]),
  ];

  const nilaiAwal = sunting
    ? Object.fromEntries(FIELDS.map((f) => [f.nama, sunting[f.nama] ?? '']))
    : { peran: 'Perangkat Daerah', aktif: 1 };

  const simpan = async (nilai) => {
    const bersih = { ...nilai };
    // Jangan kirim kata sandi kosong — backend memverifikasi hash secara terpisah.
    if (!bersih.password) {
      delete bersih.password;
      delete bersih.passwordLama;
    }
    if (mode === 'ubah') {
      await api.patch(`/api/pengguna/${sunting.id}`, bersih);
      setNotif(`Berhasil memperbarui akun ${bersih.username || sunting.username}.`);
    } else {
      await api.post('/api/pengguna', bersih);
      setNotif(`Berhasil membuat akun ${bersih.username}.`);
    }
    reload();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Manajemen Pengguna</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            {data?.total || 0} akun terdaftar · hak akses mengikuti peran yang dipilih
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={reload} className="tombol-sekunder">
            <IkonRefresh />
            Perbarui
          </button>
          {boleh('pengguna:create') && (
            <button
              onClick={() => {
                setSunting(null);
                setMode('buat');
              }}
              className="tombol-utama"
            >
              <IkonTambah />
              Tambah Pengguna
            </button>
          )}
        </div>
      </div>

      {notif && (
        <div
          className={`rounded-lg px-3 py-2.5 text-[12px] border ${
            notif.startsWith('Berhasil')
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {notif}
        </div>
      )}

      {/* Matriks hak akses */}
      <Kartu className="p-4">
        <p className="text-[12px] font-bold text-slate-700 mb-2.5">Hak Akses per Peran</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {daftarPeran.map((r) => (
            <div key={r} className="rounded-lg border border-slate-200 px-3 py-2">
              <Chip tone={WARNA[r] || 'slate'}>{r}</Chip>
              <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                {ket[r] || 'Hak akses ditentukan oleh administrator sistem.'}
              </p>
            </div>
          ))}
        </div>
      </Kartu>

      <Kartu className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="label">Cari pengguna</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <IkonCari />
              </span>
              <input
                className="input pl-9"
                placeholder="mis. admin, cv.mitra, DPURPK..."
                value={cari}
                onChange={(e) => {
                  setCari(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
          <div>
            <label className="label">Peran</label>
            <select
              className="input"
              value={peran}
              onChange={(e) => {
                setPeran(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua</option>
              {daftarPeran.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
      </Kartu>

      <Kartu>
        <KartuJudul
          judul="Daftar Akun"
          sub={data ? `Menampilkan ${data.items.length} dari ${data.total} akun` : ''}
          aksi={
            totalHalaman > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  className="tombol-sekunder !px-2.5 !py-1 text-[11px]"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  ‹
                </button>
                <span className="text-[11px] text-slate-500 tabular-nums px-1">
                  {page} / {totalHalaman}
                </span>
                <button
                  className="tombol-sekunder !px-2.5 !py-1 text-[11px]"
                  disabled={page === totalHalaman}
                  onClick={() => setPage((p) => p + 1)}
                >
                  ›
                </button>
              </div>
            )
          }
        />
        <div className="overflow-x-auto">
          {loading && !data ? (
            <Memuat />
          ) : (
            <table className="tabel">
              <thead>
                <tr>
                  <th>Pengguna</th>
                  <th>Peran</th>
                  <th>Satuan kerja / Organisasi</th>
                  <th>Status</th>
                  <th>Masuk terakhir</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((u) => (
                  <tr key={u.id} className={u.aktif ? '' : 'opacity-60'}>
                    <td>
                      <p className="text-[12.5px] font-semibold text-slate-800">{u.nama}</p>
                      <p className="text-[10.5px] font-mono text-slate-400">{u.username}</p>
                      {u.email && <p className="text-[10.5px] text-slate-400">{u.email}</p>}
                    </td>
                    <td>
                      <Chip tone={WARNA[u.peran] || 'slate'}>{u.peran}</Chip>
                    </td>
                    <td className="max-w-[220px]">
                      <p className="text-[11.5px] text-slate-600 line-clamp-2">{u.satker || '-'}</p>
                      <p className="text-[10.5px] text-slate-400 line-clamp-2">{u.organisasi || ''}</p>
                    </td>
                    <td>
                      {u.aktif ? (
                        <Chip tone="green">Aktif</Chip>
                      ) : (
                        <Chip tone="slate">Nonaktif</Chip>
                      )}
                      {u.sesi_aktif > 0 && (
                        <p className="text-[10px] text-emerald-600 mt-0.5">{u.sesi_aktif} sesi aktif</p>
                      )}
                    </td>
                    <td className="text-[11px] text-slate-500">
                      {u.terakhir_masuk ? waktuRelatif(new Date(`${u.terakhir_masuk}Z`)) : 'Belum pernah'}
                    </td>
                    <td>
                      <AksiBaris
                        boleh={boleh}
                        ubah={{
                          izin: 'pengguna',
                          jalankan: (x) => {
                            setSunting(x);
                            setMode('ubah');
                          },
                        }}
                        hapus={{ izin: 'pengguna', jalankan: (x) => setHapus(x) }}
                        target={u}
                      />
                    </td>
                  </tr>
                ))}
                {data?.items.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <Kosong pesan="Tidak ada akun yang cocok" sub="Ubah kata kunci atau filter peran" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </Kartu>

      <Formulir
        buka={!!mode}
        tutup={() => setMode(null)}
        judul={mode === 'ubah' ? `Ubah Akun ${sunting?.username || ''}` : 'Tambah Pengguna Baru'}
        fields={FIELDS}
        nilaiAwal={nilaiAwal}
        onSimpan={simpan}
      />

      <Konfirmasi
        buka={!!hapus}
        tutup={() => setHapus(null)}
        judul="Hapus pengguna?"
        pesan={
          <>
            Akun <b>{hapus?.username}</b> akan dihapus permanen dan seluruh sesinya dicabut. Akun tidak
            dapat digunakan kembali.
          </>
        }
        sibuk={sibuk}
        onYa={async () => {
          setSibuk(true);
          try {
            await api.del(`/api/pengguna/${hapus.id}`);
            setNotif(`Berhasil menghapus akun ${hapus.username}.`);
            setHapus(null);
            reload();
          } catch (e) {
            setNotif(`Gagal menghapus: ${e.message}`);
          } finally {
            setSibuk(false);
          }
        }}
      />
    </div>
  );
}
