import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Kartu, KartuJudul, Chip, Kosong, Memuat, Statistik } from '../components/ui';
import { api, useApi } from '../lib/api';
import { tanggalPendek, waktuRelatif } from '../lib/utils';

const KATEGORI = [
  'Kualitas Pekerjaan',
  'Ketepatan Waktu',
  'Biaya',
  'Keselamatan Kerja (K3)',
  'Lingkungan',
  'Lainnya',
];
const PRIORITAS = ['Rendah', 'Sedang', 'Tinggi'];

export default function Pengaduan() {
  const [status, setStatus] = useState('');
  const [bukaForm, setBukaForm] = useState(false);
  const { data, loading, reload } = useApi(`/api/pengaduan?limit=50${status ? `&status=${status}` : ''}`);

  const items = data?.items || [];
  const hitung = (s) => items.filter((i) => i.status === s).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Pengaduan Masyarakat</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Layanan Aspirasi dan Penyampaian Keluhan Stakeholder
          </p>
        </div>
        <button onClick={() => setBukaForm(true)} className="tombol-utama">
          Sampaikan Keluhan
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Statistik label="Total keluhan" nilai={data?.total || 0} satuan="keluhan" tone="gov" />
        <Statistik label="Baru" nilai={hitung('Baru')} satuan="keluhan" sub="Perlu verifikasi" tone="red" />
        <Statistik label="Diproses" nilai={hitung('Diproses')} satuan="keluhan" tone="amber" />
        <Statistik label="Selesai" nilai={hitung('Selesai')} satuan="keluhan" tone="emerald" />
      </div>

      <Kartu className="p-4 flex flex-wrap gap-2">
        {['', 'Baru', 'Diproses', 'Selesai', 'Ditolak'].map((s) => (
          <button
            key={s || 'semua'}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition ${
              status === s ? 'bg-gov-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {s || 'Semua'}
          </button>
        ))}
      </Kartu>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Kartu className="lg:col-span-2">
          <KartuJudul judul="Daftar Keluhan" sub={data ? `${data.total} keluhan tercatat` : ''} aksi={<button onClick={reload} className="text-[11px] text-gov-700 font-semibold hover:underline">↻ Perbarui</button>} />
          {loading && !data ? (
            <Memuat />
          ) : items.length === 0 ? (
            <div className="p-6">
              <Kosong pesan="Belum ada keluhan masuk" sub="Keluhan masyarakat akan tampil di sini" />
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {items.map((k) => (
                <div key={k.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[10px] text-slate-400">{k.kode}</span>
                        <Chip
                          tone={
                            k.prioritas === 'Tinggi' ? 'red' : k.prioritas === 'Sedang' ? 'amber' : 'slate'
                          }
                        >
                          {k.prioritas}
                        </Chip>
                        <Chip tone="slate">{k.kategori}</Chip>
                        <Chip
                          tone={
                            k.status === 'Selesai' ? 'emerald' : k.status === 'Diproses' ? 'amber' : k.status === 'Ditolak' ? 'red' : 'blue'
                          }
                        >
                          {k.status}
                        </Chip>
                      </div>
                      <p className="text-[13px] text-slate-800 font-medium mt-1.5 leading-relaxed">{k.deskripsi}</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {k.nama_pelapor} · {k.kontak || '-'} · {k.lokasi || k.kecamatan} ·{' '}
                        {tanggalPendek(k.tanggal)}
                      </p>
                      {k.proyek_kode && (
                        <Link
                          to={`/proyek?detail=${k.proyek_kode}`}
                          className="text-[11.5px] text-gov-700 hover:underline mt-1 inline-block"
                        >
                          terkait proyek {k.proyek_nama} →
                        </Link>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-slate-400">{waktuRelatif(k.created_at)}</p>
                      {k.status === 'Baru' && (
                        <button
                          onClick={async () => {
                            await api.patch(`/api/pengaduan/${k.id}`, { status: 'Diproses' });
                            reload();
                          }}
                          className="mt-2 text-[11px] font-semibold text-gov-700 hover:underline"
                        >
                          Proses →
                        </button>
                      )}
                      {k.status === 'Diproses' && (
                        <button
                          onClick={async () => {
                            await api.patch(`/api/pengaduan/${k.id}`, { status: 'Selesai' });
                            reload();
                          }}
                          className="mt-2 text-[11px] font-semibold text-emerald-700 hover:underline"
                        >
                          Selesaikan ✓
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Kartu>

        <div className="space-y-4">
          <Kartu>
            <KartuJudul judul="Alur Penanganan" />
            <div className="p-4 space-y-3 text-[12px]">
              {[
                ['Pengaduan masuk', 'Masyarakat mengirim keluhan melalui formulir atau spontan'],
                ['Verifikasi', 'Perangkat daerah memverifikasi di lokasi proyek'],
                ['Tindak lanjut', 'Koordinator lapangan memproses dan menindaklanjuti keluhan'],
                ['Penyelesaian', 'Status diperbarui dan masyarakat diberi tanggapan'],
              ].map(([j, d], i) => (
                <div key={j} className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-gov-100 text-gov-700 text-[11px] font-bold grid place-items-center shrink-0">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-800">{j}</p>
                    <p className="text-[11.5px] text-slate-500">{d}</p>
                  </div>
                </div>
              ))}
            </div>
          </Kartu>

          <Kartu>
            <KartuJudul judul="Kategori Keluhan" />
            <div className="p-4 space-y-1.5">
              {KATEGORI.map((k) => {
                const n = items.filter((i) => i.kategori === k).length;
                return (
                  <div key={k} className="flex justify-between text-[11.5px]">
                    <span className="text-slate-600">{k}</span>
                    <span className="font-bold text-slate-800">{n}</span>
                  </div>
                );
              })}
            </div>
          </Kartu>
        </div>
      </div>

      {bukaForm && <FormKeluhan tutup={() => setBukaForm(false)} selesai={() => { setBukaForm(false); reload(); }} />}
    </div>
  );
}

function FormKeluhan({ tutup, selesai }) {
  const [f, setF] = useState({
    nama_pelapor: '',
    kontak: '',
    lokasi: '',
    kecamatan: 'Manggar',
    kategori: KATEGORI[0],
    prioritas: 'Sedang',
    deskripsi: '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sukses, setSukses] = useState(null);

  const ubah = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const kirim = async (e) => {
    e.preventDefault();
    if (!f.deskripsi.trim()) return setErr('Deskripsi keluhan wajib diisi');
    setBusy(true);
    setErr('');
    try {
      const r = await api.post('/api/pengaduan', f);
      setSukses(r);
    } catch (x) {
      setErr(x.message || 'Gagal mengirim');
    } finally {
      setBusy(false);
    }
  };

  if (sukses) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={tutup}>
        <div className="bg-white rounded-2xl shadow-pop w-full max-w-md p-6 text-center" onClick={(e) => e.stopPropagation()}>
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center mx-auto text-2xl">
            ✓
          </div>
          <h3 className="font-bold text-slate-800 mt-3">Keluhan Terkirim</h3>
          <p className="text-[12.5px] text-slate-500 mt-1.5">{sukses.pesan}</p>
          <p className="font-mono text-[12px] text-gov-700 font-semibold mt-2">{sukses.kode}</p>
          <button onClick={selesai} className="tombol-utama w-full justify-center mt-4">
            Selesai
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 overflow-y-auto" onClick={tutup}>
      <form
        onSubmit={kirim}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-pop w-full max-w-lg p-5 my-8"
      >
        <h3 className="font-bold text-slate-800 text-[15px]">Sampaikan Keluhan</h3>
        <p className="text-[11.5px] text-slate-500 mt-0.5 mb-4">
          Keluhan yang Anda kirim akan diverifikasi oleh Perangkat Daerah.
        </p>

        {err && <p className="text-[12px] text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{err}</p>}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Nama pelapor</label>
            <input className="input" value={f.nama_pelapor} onChange={ubah('nama_pelapor')} placeholder="Anonim" />
          </div>
          <div>
            <label className="label">Kontak</label>
            <input className="input" value={f.kontak} onChange={ubah('kontak')} placeholder="HP / email" />
          </div>
          <div>
            <label className="label">Kecamatan</label>
            <select className="input" value={f.kecamatan} onChange={ubah('kecamatan')}>
              {['Manggar', 'Damar', 'Dendang', 'Kelapa Kampit', 'Simpang Renggiang', 'Gantung', 'Simpang Pesak'].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Lokasi / alamat</label>
            <input className="input" value={f.lokasi} onChange={ubah('lokasi')} placeholder="Dusun / jalan" />
          </div>
          <div>
            <label className="label">Kategori</label>
            <select className="input" value={f.kategori} onChange={ubah('kategori')}>
              {KATEGORI.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Prioritas</label>
            <select className="input" value={f.prioritas} onChange={ubah('prioritas')}>
              {PRIORITAS.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Deskripsi keluhan *</label>
            <textarea
              className="input min-h-[90px]"
              value={f.deskripsi}
              onChange={ubah('deskripsi')}
              placeholder="Jelaskan Kronologi dan harapan penyelesaian"
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-4">
          <button type="button" onClick={tutup} className="tombol-sekunder">
            Batal
          </button>
          <button type="submit" disabled={busy} className="tombol-utama">
            {busy ? 'Mengirim...' : 'Kirim Keluhan'}
          </button>
        </div>
      </form>
    </div>
  );
}