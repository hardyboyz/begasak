import { useState } from 'react';
import { api, useApi } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Kartu, KartuJudul, Chip, Kosong, Memuat } from '../components/ui';
import { IkonCari, IkonPeta, IkonRefresh, IkonTambah } from '../components/icons';
import { Formulir, Konfirmasi, AksiBaris } from '../components/Formulir';

/** Koordinat ditampilkan sebagai DMS agar mudah dibaca, bukan angka desimal mentah. */
function dms(nilai, positif, negatif) {
  if (nilai === null || nilai === undefined || Number.isNaN(Number(nilai))) return '-';
  const angka = Math.abs(Number(nilai));
  const d = Math.floor(angka);
  const m = Math.floor((angka - d) * 60);
  const s = ((angka - d - m / 60) * 3600).toFixed(1);
  return `${d}°${String(m).padStart(2, '0')}'${s}" ${nilai < 0 ? negatif : positif}`;
}

function koordinat(lat, lng) {
  if (lat === null || lng === null || lat === undefined || lng === undefined) {
    return <span className="text-slate-400">Belum diisi</span>;
  }
  return (
    <span className="font-mono text-[11px] text-slate-600">
      {dms(lat, 'LU', 'LB')} · {dms(lng, 'BT', 'BB')}
    </span>
  );
}

export default function Kecamatan() {
  const { boleh } = useAuth();
  const [cari, setCari] = useState('');

  const query = new URLSearchParams();
  if (cari) query.set('q', cari);
  const { data, loading, reload } = useApi(`/api/kecamatan?${query.toString()}`);

  const [mode, setMode] = useState(null);
  const [sunting, setSunting] = useState(null);
  const [hapus, setHapus] = useState(null);
  const [sibuk, setSibuk] = useState(false);
  const [notif, setNotif] = useState('');

  const items = data?.items || [];
  const totalPakai = items.reduce((a, k) => a + k.proyek + k.penyedia + k.pengaduan + k.peringatan, 0);

  const FIELDS = [
    {
      nama: 'nama',
      label: 'Nama kecamatan',
      wajib: true,
      hint: 'Nama ini dirujuk sebagai teks oleh proyek, penyedia, pengaduan, dan peringatan.',
    },
    { nama: 'lat', label: 'Lintang (lat)', tipe: 'number', hint: 'Desimal, positif berarti utara. Contoh: -2.8535' },
    { nama: 'lng', label: 'Bujur (lng)', tipe: 'number', hint: 'Desimal. Contoh: 107.7506' },
  ];

  const nilaiAwal = sunting
    ? { nama: sunting.nama, lat: sunting.lat ?? '', lng: sunting.lng ?? '' }
    : { nama: '', lat: '', lng: '' };

  const simpan = async (nilai) => {
    if (mode === 'ubah') {
      await api.patch(`/api/kecamatan/${sunting.id}`, nilai);
      setNotif(`Berhasil memperbarui kecamatan ${nilai.nama}.`);
    } else {
      await api.post('/api/kecamatan', nilai);
      setNotif(`Berhasil menambah kecamatan ${nilai.nama}.`);
    }
    reload();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Setup Kecamatan</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            {data?.total || 0} kecamatan terdaftar · titik koordinat pusat dipakai untuk pemetaan risiko
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={reload} className="tombol-sekunder">
            <IkonRefresh />
            Perbarui
          </button>
          {boleh('kecamatan:create') && (
            <button
              onClick={() => {
                setSunting(null);
                setMode('buat');
              }}
              className="tombol-utama"
            >
              <IkonTambah />
              Tambah Kecamatan
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

      <Kartu className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="label">Cari kecamatan</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <IkonCari />
              </span>
              <input
                className="input pl-9"
                placeholder="mis. Manggar, Damar, Kelapa Kampit..."
                value={cari}
                onChange={(e) => setCari(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-end">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {data ? `${data.cocok} dari ${data.total} kecamatan` : ' '}
              <br />
              {totalPakai.toLocaleString('id-ID')} data terelkasi ke kecamatan
            </p>
          </div>
        </div>
      </Kartu>

      <Kartu>
        <KartuJudul
          judul="Daftar Kecamatan"
          sub={
            data
              ? `Menampilkan ${data.cocok} dari ${data.total} kecamatan · ${totalPakai.toLocaleString(
                  'id-ID'
                )} data terkait`
              : ''
          }
        />
        <div className="overflow-x-auto">
          {loading && !data ? (
            <Memuat />
          ) : (
            <table className="tabel">
              <thead>
                <tr>
                  <th>Kecamatan</th>
                  <th>Koordinat Pusat</th>
                  <th className="text-right">Proyek</th>
                  <th className="text-right">Penyedia</th>
                  <th className="text-right">Pengaduan</th>
                  <th className="text-right">Peringatan</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {items.map((k) => {
                  const dipakai = k.proyek + k.penyedia + k.pengaduan + k.peringatan;
                  return (
                    <tr key={k.id}>
                      <td>
                        <p className="text-[12.5px] font-semibold text-slate-800 flex items-center gap-1.5">
                          <IkonPeta className="w-3.5 h-3.5 text-gov-600" />
                          {k.nama}
                        </p>
                        {dipakai > 0 ? (
                          <p className="text-[10.5px] text-slate-400 mt-0.5">
                            {dipakai.toLocaleString('id-ID')} data memakai nama ini
                          </p>
                        ) : (
                          <Chip tone="slate">Belum dipakai</Chip>
                        )}
                      </td>
                      <td>{koordinat(k.lat, k.lng)}</td>
                      <td className="text-right text-[12px] tabular-nums text-slate-600">{k.proyek}</td>
                      <td className="text-right text-[12px] tabular-nums text-slate-600">{k.penyedia}</td>
                      <td className="text-right text-[12px] tabular-nums text-slate-600">{k.pengaduan}</td>
                      <td className="text-right text-[12px] tabular-nums text-slate-600">{k.peringatan}</td>
                      <td>
                        <AksiBaris
                          boleh={boleh}
                          ubah={{
                            izin: 'kecamatan',
                            jalankan: (x) => {
                              setSunting(x);
                              setMode('ubah');
                            },
                          }}
                          hapus={{ izin: 'kecamatan', jalankan: (x) => setHapus(x) }}
                          target={k}
                        />
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <Kosong
                        pesan="Tidak ada kecamatan yang cocok"
                        sub={cari ? 'Ubah kata kunci pencarian' : 'Belum ada kecamatan terdaftar'}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </Kartu>

      <p className="text-[11px] text-slate-400 leading-relaxed">
        Mengubah nama kecamatan ikut memperbarui proyek, penyedia, pengaduan, dan peringatan yang
        merujuk nama tersebut. Kecamatan yang masih dipakai data tidak dapat dihapus.
      </p>

      <Formulir
        buka={!!mode}
        tutup={() => setMode(null)}
        judul={mode === 'ubah' ? `Ubah Kecamatan ${sunting?.nama || ''}` : 'Tambah Kecamatan Baru'}
        fields={FIELDS}
        nilaiAwal={nilaiAwal}
        onSimpan={simpan}
      />

      <Konfirmasi
        buka={!!hapus}
        tutup={() => setHapus(null)}
        judul="Hapus kecamatan?"
        pesan={
          <>
            Kecamatan <b>{hapus?.nama}</b> akan dihapus dari daftar setup. Tindakan ini tidak dapat
            dibatalkan.
          </>
        }
        sibuk={sibuk}
        onYa={async () => {
          setSibuk(true);
          try {
            await api.del(`/api/kecamatan/${hapus.id}`);
            setNotif(`Berhasil menghapus kecamatan ${hapus.nama}.`);
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