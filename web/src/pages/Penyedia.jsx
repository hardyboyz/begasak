import { useState, useEffect } from 'react';
import {
  Kartu,
  KartuJudul,
  Chip,
  Kosong,
  Memuat,
  Statistik,
  ProgressBar,
  Modal,
} from '../components/ui';
import { GrafikBatang, GrafikDoughnut } from '../components/charts';
import { api, useApi } from '../lib/api';
import { useAuth } from '../lib/auth';
import { rupiahFmt, rupiahPenuh } from '../lib/utils';
import { IkonCari, IkonUnduh, IkonTambah } from '../components/icons';
import { TombolUnduh } from '../components/TombolUnduh';
import { Formulir, Konfirmasi, AksiBaris } from '../components/Formulir';

const HAL = [25, 50, 100];

export default function Penyedia() {
  const { boleh } = useAuth();
  const [mode, setMode] = useState(null);
  const [sunting, setSunting] = useState(null);
  const [hapus, setHapus] = useState(null);
  const [sibuk, setSibuk] = useState(false);
  const [notif, setNotif] = useState('');
  const [q, setQ] = useState('');
  const [kual, setKual] = useState('');
  const [badan, setBadan] = useState('');
  const [status, setStatus] = useState('');
  const [halaman, setHalaman] = useState(1);
  const [per, setPer] = useState(25);
  const [detail, setDetail] = useState(null);

  const params = new URLSearchParams({ limit: per, offset: (halaman - 1) * per });
  if (q) params.set('q', q);
  if (kual) params.set('kualifikasi', kual);
  if (badan) params.set('badan_usaha', badan);
  if (status) params.set('status', status);

  const { data, loading, reload } = useApi(`/api/penyedia?${params}`);
  const opsi = data?.opsi || {};

  useEffect(() => setHalaman(1), [q, kual, badan, status, per]);

  const totalHal = Math.ceil((data?.total || 0) / per);
  const r = data?.ringkasan || {};

  const skorWarna = (s) => (s >= 70 ? '#15803d' : s >= 40 ? '#ca8a04' : '#ea580c');

  const FIELDS = [
    { nama: 'nama', label: 'Nama perusahaan', wajib: true, lebar: 'penuh' },
    { nama: 'nib', label: 'NIB', hint: 'Nomor Induk Berusaha. Harus unik bila diisi.' },
    { nama: 'badan_usaha', label: 'Badan usaha', tipe: 'select', opsi: opsi.badan_usaha || ['PT', 'CV', 'Koperasi', 'Firma', 'Perorangan'] },
    { nama: 'kualifikasi', label: 'Kualifikasi', tipe: 'select', opsi: opsi.kualifikasi || ['Besar', 'Menengah', 'Kecil', 'Tidak Terisi'] },
    { nama: 'nama_pengusaha', label: 'Nama pengusaha' },
    { nama: 'jabatan_usaha', label: 'Jabatan pengusaha', hint: 'mis. Direktur, Proprietaris' },
    { nama: 'pekerjaan_utama', label: 'Pekerjaan utama' },
    { nama: 'kecamatan', label: 'Kecamatan' },
    { nama: 'tempat_usaha', label: 'Tempat usaha' },
    { nama: 'alamat', label: 'Alamat', tipe: 'textarea', lebar: 'penuh' },
    { nama: 'no_hp', label: 'Nomor HP' },
    { nama: 'email', label: 'Email', tipe: 'email' },
    { nama: 'website', label: 'Website' },
    { nama: 'tahun_mulai', label: 'Tahun mulai', tipe: 'number', bintang: true, min: 1900 },
    { nama: 'status_modal', label: 'Status modal' },
    { nama: 'kbli', label: 'Kode KBLI' },
    { nama: 'jaringan_usaha', label: 'Jaringan usaha' },
    { nama: 'sbu_aktif', label: 'SBU aktif', tipe: 'checkbox', hint: 'Menandakan pemegang SBU yang masih berlaku.' },
    { nama: 'skor_kemampuan', label: 'Skor kemampuan', tipe: 'number', bintang: true, min: 1, hint: 'Otomatis dibatasi 1-100.' },
    { nama: 'status', label: 'Status', tipe: 'select', opsi: ['Aktif', 'Nonaktif'] },
    { nama: 'sumber_data', label: 'Sumber data', tipe: 'select', opsi: ['Manual', 'API', 'Impor'] },
  ];

  return (
    <div className="space-y-5">
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Penyedia Jasa Konstruksi</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Data penyedia jasa terdaftar pada direktori perusahaan konstruksi tahun 2025
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={per} onChange={(e) => setPer(+e.target.value)} className="input w-auto text-[12px]">
            {HAL.map((h) => (
              <option key={h} value={h}>
                {h} / halaman
              </option>
            ))}
          </select>
          {boleh('penyedia:create') && (
            <button
              onClick={() => {
                setSunting(null);
                setMode('buat');
              }}
              className="tombol-utama"
            >
              <IkonTambah />
              Tambah Penyedia
            </button>
          )}
          <TombolUnduh ke="/api/laporan/ekspor?format=csv&data=penyedia" nama="begasak-penyedia.csv">
            <IkonUnduh />
            Ekspor
          </TombolUnduh>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Statistik label="Total penyedia" nilai={r.total || 0} satuan="perusahaan" tone="gov" />
        <Statistik
          label="SBU terverifikasi"
          nilai={r.bersertifikat || 0}
          satuan="perusahaan"
          sub={`${r.total ? Math.round((r.bersertifikat / r.total) * 100) : 0}% dari total`}
          tone="emerald"
        />
        <Statistik label="Status aktif" nilai={r.aktif || 0} satuan="perusahaan" tone="slate" />
        <Statistik
          label="Perlu verifikasi SBU"
          nilai={r.total - r.bersertifikat || 0}
          satuan="perusahaan"
          sub="Belum memiliki kualifikasi terverifikasi"
          tone={r.total - r.bersertifikat > 0 ? 'red' : 'emerald'}
        />
      </div>

      <Kartu className="p-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="label">Cari nama / NIB</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <IkonCari />
              </span>
              <input className="input pl-9" placeholder="nama / NIB / pengusaha" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Kualifikasi</label>
            <select className="input" value={kual} onChange={(e) => setKual(e.target.value)}>
              <option value="">Semua</option>
              {['Kecil', 'Menengah', 'Besar', 'Tidak Terisi'].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Badan usaha</label>
            <select className="input" value={badan} onChange={(e) => setBadan(e.target.value)}>
              <option value="">Semua</option>
              {['CV', 'PT', 'PT Persero', 'Tidak Terisi'].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Semua</option>
              {['Aktif', 'Nonaktif', 'Tidak Terisi'].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
        </div>
      </Kartu>

      <Kartu>
        <KartuJudul
          judul="Daftar Penyedia Jasa"
          sub={data ? `${data.total} penyedia terdaftar` : ''}
          aksi={
            totalHal > 1 && (
              <div className="flex items-center gap-1.5">
                <button className="tombol-sekunder !px-2.5 !py-1 text-[11px]" disabled={halaman === 1} onClick={() => setHalaman((h) => h - 1)}>
                  ‹
                </button>
                <span className="text-[11px] text-slate-500 tabular-nums px-1">
                  {halaman} / {totalHal}
                </span>
                <button className="tombol-sekunder !px-2.5 !py-1 text-[11px]" disabled={halaman === totalHal} onClick={() => setHalaman((h) => h + 1)}>
                  ›
                </button>
              </div>
            )
          }
        />
        {loading && !data ? (
          <Memuat />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabel">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nama Perusahaan</th>
                  <th>Badan usaha</th>
                  <th>Pemilik</th>
                  <th>Kualifikasi</th>
                  <th className="text-center">SBU</th>
                  <th>Kecamatan</th>
                  <th className="text-center">Paket</th>
                  <th className="text-right">Nilai kontrak</th>
                  <th className="text-center">Skor</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((p) => (
                  <tr key={p.id} className="cursor-pointer" onClick={() => setDetail(p)}>
                    <td className="font-mono text-[10.5px] text-slate-500">{p.kode}</td>
                    <td className="max-w-[240px]">
                      <p className="text-[12.5px] font-semibold text-slate-800 line-clamp-2">{p.nama}</p>
                      <p className="text-[10.5px] text-slate-400 line-clamp-1">{p.pekerjaan_utama || '-'}</p>
                    </td>
                    <td>
                      <Chip tone="slate">{p.badan_usaha || '-'}</Chip>
                    </td>
                    <td className="text-[11.5px] text-slate-600 max-w-[140px]">
                      <span className="line-clamp-1">{p.nama_pengusaha || '-'}</span>
                    </td>
                    <td>
                      <Chip tone={p.kualifikasi === 'Tidak Terisi' ? 'red' : p.kualifikasi === 'Menengah' ? 'violet' : 'gov'}>
                        {p.kualifikasi || '-'}
                      </Chip>
                    </td>
                    <td className="text-center">
                      {p.sbu_aktif ? (
                        <Chip tone="emerald">Aktif</Chip>
                      ) : (
                        <Chip tone="red">Belum</Chip>
                      )}
                    </td>
                    <td className="text-[11.5px]">{p.kecamatan || '-'}</td>
                    <td className="text-center text-[12px] font-semibold tabular-nums">
                      {p.proyek_ditugaskan || 0}
                    </td>
                    <td className="text-right text-[11.5px] font-medium">
                      {p.nilai_kontrak ? rupiahFmt(p.nilai_kontrak, true) : '-'}
                    </td>
                    <td className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className="text-[12px] font-bold tabular-nums"
                          style={{ color: skorWarna(p.skor_kemampuan || 0) }}
                        >
                          {p.skor_kemampuan || 0}
                        </span>
                        <div className="w-10">
                          <ProgressBar nilai={p.skor_kemampuan || 0} tinggi={4} warna={skorWarna(p.skor_kemampuan || 0)} />
                        </div>
                      </div>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <AksiBaris
                        boleh={boleh}
                        ubah={{
                          izin: 'penyedia',
                          jalankan: (x) => {
                            setSunting(x);
                            setMode('ubah');
                          },
                        }}
                        hapus={{ izin: 'penyedia', jalankan: (x) => setHapus(x) }}
                        target={p}
                      />
                    </td>
                  </tr>
                ))}
                {data?.items.length === 0 && (
                  <tr>
                    <td colSpan={11}>
                      <Kosong pesan="Tidak ada penyedia yang cocok" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Kartu>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Kartu>
          <KartuJudul judul="Sebaran per Badan Usaha" />
          <div className="p-4">
            <GrafikBatang
              data={hitung(data?.items || [], (p) => p.badan_usaha || 'Tidak Terisi')}
              tinggi={200}
              horizontal
            />
          </div>
        </Kartu>
        <Kartu>
          <KartuJudul judul="Sebaran per Kecamatan" />
          <div className="p-4">
            <GrafikBatang
              data={hitung(data?.items || [], (p) => p.kecamatan || 'Tidak Terisi')}
              tinggi={200}
              horizontal
            />
          </div>
        </Kartu>
      </div>

      {detail && <ModalPenyedia p={detail} tutup={() => setDetail(null)} />}

      <Formulir
        buka={!!mode}
        tutup={() => setMode(null)}
        judul={mode === 'ubah' ? `Ubah ${sunting?.nama || 'Penyedia'}` : 'Tambah Penyedia Jasa'}
        fields={FIELDS}
        nilaiAwal={
          sunting
            ? Object.fromEntries(FIELDS.map((f) => [f.nama, sunting[f.nama] ?? '']))
            : { status: 'Aktif', sumber_data: 'Manual', skor_kemampuan: 50, badan_usaha: 'CV' }
        }
        onSimpan={async (nilai) => {
          if (mode === 'ubah') {
            await api.patch(`/api/penyedia/${sunting.id}`, nilai);
            setNotif(`Berhasil memperbarui ${nilai.nama}.`);
          } else {
            const j = await api.post('/api/penyedia', nilai);
            setNotif(`Berhasil menambah penyedia ${j.penyedia.kode}.`);
          }
          reload();
        }}
      />

      <Konfirmasi
        buka={!!hapus}
        tutup={() => setHapus(null)}
        judul="Hapus penyedia?"
        pesan={
          <>
            <b>{hapus?.nama}</b> akan dihapus. Proyek dan tenaga kerja yang terkait tidak ikut terhapus,
            namun keduanya tidak lagi tertaut ke penyedia ini
            ({hapus?.proyek_ditugaskan || 0} proyek, {hapus?.tenaga || 0} tenaga).
          </>
        }
        sibuk={sibuk}
        onYa={async () => {
          setSibuk(true);
          try {
            await api.del(`/api/penyedia/${hapus.id}`);
            setNotif(`Berhasil menghapus ${hapus.nama}.`);
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

function hitung(items, ambil) {
  const m = new Map();
  items.forEach((i) => {
    const k = ambil(i);
    m.set(k, (m.get(k) || 0) + 1);
  });
  return [...m.entries()].map(([label, nilai]) => ({ label, nilai })).sort((a, b) => b.nilai - a.nilai);
}

function ModalPenyedia({ p, tutup }) {
  return (
    <Modal
      buka
      tutup={tutup}
      lebar="max-w-3xl"
      judul={
        <span className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[11px] text-slate-400">{p.kode}</span>
          <span>{p.nama}</span>
          {p.sbu_aktif ? <Chip tone="emerald">SBU aktif</Chip> : <Chip tone="red">SBU belum</Chip>}
        </span>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2.5 text-[12px]">
          <Baris label="Badan usaha" nilai={p.badan_usaha} />
          <Baris label="NIB" nilai={p.nib} mono />
          <Baris label="Nama pengusaha" nilai={p.nama_pengusaha} />
          <Baris label="Jenis kelamin" nilai={p.jenis_kelamin} />
          <Baris label="Kualifikasi" nilai={p.kualifikasi} />
          <Baris label="KBLI" nilai={p.kbli} />
          <Baris label="Pekerjaan utama" nilai={p.pekerjaan_utama} />
          <Baris label="Status" nilai={p.status} />
          <Baris label="Tempat usaha" nilai={p.tempat_usaha} />
          <Baris label="Kecamatan" nilai={p.kecamatan} />
          <Baris label="Jaringan usaha" nilai={p.jaringan_usaha} />
          <Baris label="Sumber data" nilai={p.sumber_data} />
        </div>
        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-slate-50">
            <p className="text-[10.5px] font-semibold uppercase text-slate-500">Skor kemampuan</p>
            <p className="text-3xl font-extrabold text-slate-900">{p.skor_kemampuan || 0}</p>
            <p className="text-[10.5px] text-slate-500 mt-1">
              Komposit dari kualifikasi, status SBU, dan rekam jejak supervisory findings.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50">
            <p className="text-[10.5px] font-semibold uppercase text-slate-500">Kinerja</p>
            <p className="text-lg font-extrabold text-slate-900">{p.proyek_ditugaskan || 0} paket</p>
            <p className="text-[11.5px] text-slate-500 mt-0.5">{rupiahPenuh(p.nilai_kontrak || 0)}</p>
          </div>
          {p.alamat && (
            <div className="p-3 rounded-lg border border-slate-200">
              <p className="text-[10.5px] font-semibold uppercase text-slate-500 mb-1">Alamat</p>
              <p className="text-[11.5px] text-slate-700 leading-relaxed">{p.alamat}</p>
            </div>
          )}
          {p.no_hp && (
            <div className="flex gap-2">
              {p.no_hp && (
                <a href={`tel:${p.no_hp}`} className="tombol-sekunder !text-[11px]">
                  {p.no_hp}
                </a>
              )}
              {p.email && (
                <a href={`mailto:${p.email}`} className="tombol-sekunder !text-[11px] truncate">
                  {p.email}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Baris({ label, nilai, mono }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-50 pb-1.5">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className={`text-slate-800 font-medium text-right truncate ${mono ? 'font-mono text-[11px]' : ''}`}>
        {nilai || '-'}
      </span>
    </div>
  );
}