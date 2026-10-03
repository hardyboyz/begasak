import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Kartu,
  KartuJudul,
  BadgeLevel,
  Chip,
  Kosong,
  Memuat,
  Statistik,
  ProgressBar,
  Modal,
} from '../components/ui';
import { GrafikRadar } from '../components/charts';
import { api, useApi } from '../lib/api';
import { useAuth } from '../lib/auth';
import { rupiahFmt, rupiahPenuh, tanggalPendek, levelTone } from '../lib/utils';
import { IkonCari, IkonRefresh, IkonTambah } from '../components/icons';
import { Formulir, Konfirmasi, AksiBaris } from '../components/Formulir';

const STATUS = ['Semua', 'Berjalan', 'Selesai', 'Belum Mulai'];
const METODE = ['Semua', 'Tender', 'Pengadaan Langsung', 'Dikecualikan', 'Tidak Diisi', '-'];

export default function Proyek() {
  const [params, setParams] = useSearchParams();
  const detail = params.get('detail');
  const { boleh } = useAuth();

  const [mode, setMode] = useState(null); // 'buat' | 'ubah'
  const [sunting, setSunting] = useState(null);
  const [hapus, setHapus] = useState(null);
  const [sibuk, setSibuk] = useState(false);
  const [notif, setNotif] = useState('');

  const KOLOM = [
    { nama: 'nama', label: 'Nama proyek', wajib: true, lebar: 'penuh' },
    { nama: 'sumber_pendanaan', label: 'Sumber pendanaan', tipe: 'select', opsi: ['APBD', 'Non APBD'] },
    { nama: 'status', label: 'Status', tipe: 'select', opsi: ['Berjalan', 'Belum Mulai', 'Selesai'] },
    { nama: 'metode_pengadaan', label: 'Metode pengadaan', tipe: 'select', opsi: ['Tender', 'Pengadaan Langsung', 'Dikecualikan'] },
    { nama: 'jenis_pekerjaan', label: 'Jenis pekerjaan', tipe: 'select', opsi: ['Jalan', 'Jembatan', 'Buildings', 'Irigasi', 'Air Bersih', 'Lainnya'] },
    {
      nama: 'kecamatan',
      label: 'Kecamatan',
      placeholder: 'mis. Belimbing',
      hint: 'Nama kecamatan sesuai wilayah kerja DPURPK.',
    },
    { nama: 'lokasi_mentioned', label: 'Detail lokasi' },
    { nama: 'pagu', label: 'Pagu (Rp)', tipe: 'number', bintang: true, min: 0 },
    { nama: 'nilai_kontrak', label: 'Nilai kontrak (Rp)', tipe: 'number', bintang: true, min: 0 },
    { nama: 'progres', label: 'Progres (%)', tipe: 'number', bintang: true, min: 0, hint: 'Nilai otomatis dibatasi 0-100.' },
    { nama: 'operator', label: 'Operator', tipe: 'number', bintang: true, min: 0 },
    { nama: 'teknisi_analis', label: 'Teknisi / Analis', tipe: 'number', bintang: true, min: 0 },
    { nama: 'jumlah_tenaga', label: 'Total tenaga kerja', tipe: 'number', bintang: true, min: 0 },
    { nama: 'tanggal_mulai', label: 'Tanggal mulai', tipe: 'date' },
    { nama: 'tanggal_rencana_selesai', label: 'Rencana selesai', tipe: 'date' },
  ];

  const [cari, setCari] = useState('');
  const [kec, setKec] = useState('Semua');
  const [status, setStatus] = useState('Semua');
  const [metode, setMetode] = useState('Semua');
  const [level, setLevel] = useState('Semua');
  const [page, setPage] = useState(1);
  const per = 25;

  const { data: meta } = useApi('/api/meta');
  const query = new URLSearchParams({
    limit: per,
    offset: (page - 1) * per,
  });
  if (cari) query.set('q', cari);
  if (kec !== 'Semua') query.set('kecamatan', kec);
  if (status !== 'Semua') query.set('status', status);
  if (metode !== 'Semua') query.set('metode', metode);
  if (level !== 'Semua') query.set('level', level);

  const { data, loading, reload } = useApi(`/api/proyek?${query.toString()}`);

  useEffect(() => setPage(1), [cari, kec, status, metode, level]);

  const totalHalaman = Math.ceil((data?.total || 0) / per);

  const bukaDetail = (kode) => {
    const n = new URLSearchParams(params);
    n.set('detail', kode);
    setParams(n);
  };
  const tutupDetail = () => {
    const n = new URLSearchParams(params);
    n.delete('detail');
    setParams(n, { replace: true });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Data Proyek Konstruksi</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            {data?.total || 0} proyek dari DATA BIKON 2025 · DPURPK Kabupaten Belitung Timur
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={reload} className="tombol-sekunder">
            <IkonRefresh />
            Perbarui
          </button>
          {boleh('proyek:create') && (
            <button
              onClick={() => {
                setSunting(null);
                setMode('buat');
              }}
              className="tombol-utama"
            >
              <IkonTambah />
              Tambah Proyek
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2">
            <label className="label">Cari proyek / lokasi</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <IkonCari />
              </span>
              <input
                className="input pl-9"
                placeholder="mis. drainase, Belubi, kelubi..."
                value={cari}
                onChange={(e) => setCari(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label">Kecamatan</label>
            <select className="input" value={kec} onChange={(e) => setKec(e.target.value)}>
              <option>Semua</option>
              {(meta?.kecamatan || []).map((k) => (
                <option key={k.nama}>{k.nama}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Metode</label>
            <select className="input" value={metode} onChange={(e) => setMetode(e.target.value)}>
              {METODE.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Level risiko</label>
            <select className="input" value={level} onChange={(e) => setLevel(e.target.value)}>
              {['Semua', 'Ekstrem', 'Tinggi', 'Sedang', 'Rendah'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </Kartu>

      <Kartu>
        <KartuJudul
          judul="Daftar Proyek"
          sub={data ? `Menampilkan ${data.items.length} dari ${data.total} proyek` : ''}
          aksi={
            data && totalHalaman > 1 && (
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
                  <th>Proyek</th>
                  <th>Lokasi / Satker</th>
                  <th>Metode</th>
                  <th className="text-right">Kebutuhan TKK</th>
                  <th className="text-right">Pagu</th>
                  <th className="text-right">Nilai kontrak</th>
                  <th className="text-right">Progres</th>
                  <th className="text-center">Risiko</th>
                  <th className="text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((p) => (
                  <tr key={p.kode} className="cursor-pointer" onClick={() => bukaDetail(p.kode)}>
                    <td className="max-w-[280px]">
                      <p className="font-mono text-[10px] text-slate-400">{p.kode}</p>
                      <p className="text-[12.5px] font-semibold text-slate-800 line-clamp-2">{p.nama}</p>
                      <div className="flex gap-1.5 mt-1">
                        <Chip tone="slate">{p.jenis_pekerjaan}</Chip>
                        {p.sumber_pendanaan === 'Non APBD' && <Chip tone="blue">Non APBD</Chip>}
                      </div>
                    </td>
                    <td className="max-w-[160px]">
                      <p className="text-[12px] font-medium text-slate-700">{p.kecamatan}</p>
                      <p className="text-[10.5px] text-slate-400 line-clamp-2">
                        {p.lokasi_mentioned || p.satker}
                      </p>
                    </td>
                    <td>
                      <Chip tone={String(p.metode_pengadaan).includes('Tender') ? 'gov' : 'slate'}>
                        {p.metode_pengadaan}
                      </Chip>
                    </td>
                    <td className="text-right">
                      <p className="text-[12px] font-semibold tabular-nums">{p.jumlah_tenaga}</p>
                      <p className="text-[10px] text-slate-400">
                        {p.tenaga_ditugaskan || 0} ditugaskan
                      </p>
                    </td>
                    <td className="text-right text-[12px] font-semibold">{rupiahFmt(p.pagu, true)}</td>
                    <td className="text-right text-[11.5px] text-slate-500">
                      {rupiahFmt(p.nilai_kontrak, true)}
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16">
                          <ProgressBar nilai={p.progres} tinggi={5} />
                        </div>
                        <span className="text-[11px] tabular-nums w-8 text-right">{p.progres}%</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">{p.status}</p>
                    </td>
                    <td className="text-center">
                      {p.level ? <BadgeLevel level={p.level} size="xs" /> : <span className="text-slate-300">-</span>}
                      {p.temuan_terbuka > 0 && (
                        <p className="text-[10px] text-red-600 font-semibold mt-0.5">
                          {p.temuan_terbuka} temuan
                        </p>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          to={`/proyek?detail=${p.kode}`}
                          className="text-[11px] font-semibold text-gov-700 hover:underline"
                        >
                          Detail
                        </Link>
                        <AksiBaris
                          boleh={boleh}
                          ubah={{ izin: 'proyek', jalankan: (x) => {
                            setSunting(x);
                            setMode('ubah');
                          } }}
                          hapus={{ izin: 'proyek', jalankan: (x) => setHapus(x) }}
                          target={p}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {data?.items.length === 0 && (
                  <tr>
                    <td colSpan={9}>
                      <Kosong pesan="Tidak ada proyek yang cocok" sub="Ubah kata kunci atau filter" />
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
        judul={mode === 'ubah' ? `Ubah Proyek ${sunting?.kode || ''}` : 'Tambah Proyek Baru'}
        fields={KOLOM}
        nilaiAwal={
          sunting
            ? Object.fromEntries(
                KOLOM.map((f) => [
                  f.nama,
                  sunting[f.nama] === null || sunting[f.nama] === undefined ? '' : sunting[f.nama],
                ])
              )
            : {
                sumber_pendanaan: 'APBD',
                status: 'Berjalan',
                metode_pengadaan: 'Pengadaan Langsung',
                jenis_pekerjaan: 'Jalan',
                progres: 0,
              }
        }
        onSimpan={async (nilai) => {
          if (mode === 'ubah') {
            await api.patch(`/api/proyek/${sunting.id}`, nilai);
            setNotif(`Berhasil memperbarui proyek ${sunting.kode}.`);
          } else {
            const j = await api.post('/api/proyek', nilai);
            setNotif(`Berhasil menambah proyek ${j.proyek.kode}.`);
          }
          reload();
        }}
      />

      <Konfirmasi
        buka={!!hapus}
        tutup={() => setHapus(null)}
        judul="Hapus proyek?"
        pesan={
          <>
            Proyek <b>{hapus?.kode}</b> beserta catatan pengawasan, temuan, dan penilaian risikonya akan
            dihapus permanen. Tindakan ini tidak dapat dibatalkan.
          </>
        }
        sibuk={sibuk}
        onYa={async () => {
          setSibuk(true);
          try {
            const j = await api.del(`/api/proyek/${hapus.id}`);
            setNotif(`Berhasil menghapus proyek ${j.kode}.`);
            setHapus(null);
            reload();
          } catch (e) {
            setNotif(`Gagal menghapus: ${e.message}`);
          } finally {
            setSibuk(false);
          }
        }}
      />

      {detail && <ModalProyek kode={detail} tutup={tutupDetail} />}
    </div>
  );
}

function ModalProyek({ kode, tutup }) {
  const { data, loading, reload } = useApi(`/api/proyek/${kode}`);
  if (loading && !data)
    return (
      <Modal buka tutup={tutup} judul="Memuat data proyek..." lebar="max-w-5xl">
        <Memuat baris={8} />
      </Modal>
    );
  if (!data) return null;

  const p = data.proyek;
  const t = levelTone(data.level);
  const radar = data.detail.map((d) => ({ label: d.kode, nilai: d.nilai }));

  return (
    <Modal
      buka
      tutup={tutup}
      lebar="max-w-6xl"
      judul={
        <span className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[11px] text-slate-400">{p.kode}</span>
          <span>{p.nama}</span>
          <BadgeLevel level={data.level} />
        </span>
      }
    >
      {/* RINGKASAN */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="p-3 rounded-lg bg-slate-50">
          <p className="text-[10.5px] text-slate-500 font-semibold uppercase">Nilai pagu</p>
          <p className="text-base font-extrabold text-slate-900">{rupiahPenuh(p.pagu)}</p>
        </div>
        <div className="p-3 rounded-lg bg-slate-50">
          <p className="text-[10.5px] text-slate-500 font-semibold uppercase">Nilai kontrak</p>
          <p className="text-base font-extrabold text-slate-900">{rupiahPenuh(p.nilai_kontrak)}</p>
        </div>
        <div className="p-3 rounded-lg bg-slate-50">
          <p className="text-[10.5px] text-slate-500 font-semibold uppercase">Progres fisik</p>
          <p className="text-base font-extrabold text-slate-900">
            {p.progres}%
            <span className="text-[11px] font-semibold text-slate-400 ml-1">
              (rencana {data.indikator.progres_harapan}%)
            </span>
          </p>
        </div>
        <div className="p-3 rounded-lg" style={{ background: t.chip }}>
          <p className="text-[10.5px] font-semibold uppercase" style={{ color: t.titik }}>
            Skor risiko
          </p>
          <p className="text-base font-extrabold" style={{ color: t.titik }}>
            {data.skor}/100 · {data.level}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* INDIKATOR */}
          <div>
            <h4 className="text-[13px] font-bold text-slate-800 mb-2">Rincian Indikator Risiko</h4>
            <div className="space-y-2">
              {data.detail.map((d) => (
                <div key={d.kode} className="flex items-start gap-3">
                  <span className="w-24 text-[11px] font-semibold text-slate-500 pt-1 shrink-0">{d.label}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-[11px] mb-0.5">
                      <span className="text-slate-600">{d.catatan}</span>
                      <span className="font-bold tabular-nums" style={{ color: d.nilai > 60 ? '#b91c1c' : d.nilai > 35 ? '#ca8a04' : '#15803d' }}>
                        {d.nilai}
                      </span>
                    </div>
                    <ProgressBar
                      nilai={d.nilai}
                      tinggi={6}
                      warna={d.nilai > 60 ? '#b91c1c' : d.nilai > 35 ? '#ca8a04' : '#15803d'}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-slate-500 bg-slate-50 rounded-lg p-2.5">
              <span className="font-semibold">Rekomendasi DSS:</span> {data.aksi}
              {data.risiko?.mitigasi && data.risiko.mitigasi !== 'Pemantauan rutin' && (
                <>
                  {' '}
                  <br />
                  <span className="font-semibold">Mitigasi:</span> {data.risiko.mitigasi}
                </>
              )}
            </p>
          </div>

          {/* TEMUAN */}
          <div>
            <h4 className="text-[13px] font-bold text-slate-800 mb-2">
              Temuan Supervisi ({data.temuan.length})
            </h4>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {data.temuan.length === 0 && <p className="text-[12px] text-slate-400">Belum ada temuan.</p>}
              {data.temuan.map((x) => (
                <div key={x.id} className="p-2.5 rounded-lg border border-slate-200">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[12px] font-medium text-slate-700">{x.deskripsi}</p>
                    <div className="flex gap-1 shrink-0">
                      <BadgeLevel
                        level={x.tingkat === 'Ekstrem' ? 'Ekstrem' : x.tingkat === 'Tinggi' ? 'Tinggi' : x.tingkat === 'Sedang' ? 'Sedang' : 'Rendah'}
                        size="xs"
                      />
                      <Chip tone={x.status === 'Ditutup' ? 'emerald' : 'amber'}>{x.status}</Chip>
                    </div>
                  </div>
                  <p className="text-[10.5px] text-slate-400 mt-1">
                    {x.kategori} · {tanggalPendek(x.tanggal)} · {x.pelapor}
                    {x.tenggat && ` · tenggat ${tanggalPendek(x.tenggat)}`}
                  </p>
                  {x.tindakan && <p className="text-[11px] text-gov-700 mt-0.5">→ {x.tindakan}</p>}
                  <AksiTemuan id={x.id} status={x.status} reload={reload} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {/* RADAR */}
          <div>
            <h4 className="text-[13px] font-bold text-slate-800 mb-2">Profil Risiko</h4>
            <RadarMini data={radar} />
          </div>

          {/* INFO */}
          <div className="p-3 rounded-lg bg-slate-50 space-y-1.5 text-[11.5px]">
            <Baris label="Kecamatan" nilai={p.kecamatan} />
            <Baris label="Satker" nilai={p.satker} />
            <Baris label="Metode" nilai={p.metode_pengadaan} />
            <Baris label="Jenis" nilai={p.jenis_pengadaan} />
            <Baris label="Sumber dana" nilai={p.sumber_pendanaan} />
            <Baris label="Mulai" nilai={tanggalPendek(p.tanggal_mulai)} />
            <Baris label="Rencana selesai" nilai={tanggalPendek(p.tanggal_rencana_selesai)} />
            <Baris label="Status" nilai={p.status} />
            <Baris label="Kebutuhan" nilai={`${p.jumlah_tenaga} org (${p.operator} op + ${p.teknisi_analis} T/A)`} />
            <Baris label="Supervisi" nilai={`${data.indikator.jumlah_penghawasan} catatan`} />
          </div>

          {data.penyedia && (
            <div className="p-3 rounded-lg border border-slate-200">
              <p className="text-[11px] font-bold text-slate-700 mb-1">Penyedia Jasa</p>
              <p className="text-[12.5px] font-semibold text-slate-800">{data.penyedia.nama}</p>
              <p className="text-[11px] text-slate-500">
                {data.penyedia.badan_usaha} · {data.penyedia.kualifikasi} · {data.penyedia.kecamatan}
              </p>
              <div className="flex gap-1.5 mt-1.5">
                <Chip tone={data.penyedia.sbu_aktif ? 'emerald' : 'red'}>
                  {data.penyedia.sbu_aktif ? 'SBU aktif' : 'SBU tidak terverifikasi'}
                </Chip>
                <Chip tone="slate">{data.penyedia.status}</Chip>
              </div>
            </div>
          )}

          {/* PENUGASAN */}
          <div>
            <h4 className="text-[13px] font-bold text-slate-800 mb-1.5">
              Tenaga Bersertifikat ({data.penugasan.length}/{p.jumlah_tenaga})
            </h4>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {data.penugasan.length === 0 && (
                <p className="text-[11.5px] text-red-600">Belum ada tenaga bersertifikat ditugaskan.</p>
              )}
              {data.penugasan.map((x) => (
                <div key={x.id} className="flex items-center justify-between gap-2 text-[11px] py-1 border-b border-slate-50">
                  <span className="text-slate-700 truncate">{x.nama}</span>
                  <span className="text-slate-400 shrink-0">{x.kualifikasi}</span>
                </div>
              ))}
            </div>
          </div>

          {/* PERINGATAN */}
          {data.peringatan.length > 0 && (
            <div>
              <h4 className="text-[13px] font-bold text-slate-800 mb-1.5">
                Peringatan Dini ({data.peringatan.length})
              </h4>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {data.peringatan.map((x) => (
                  <div key={x.id} className="p-2 rounded-lg bg-orange-50/60">
                    <div className="flex items-start gap-1.5">
                      <BadgeLevel level={x.level} size="xs" />
                      <p className="text-[11px] font-semibold text-slate-700">{x.judul}</p>
                    </div>
                    <p className="text-[10.5px] text-slate-500 mt-0.5">{x.pesan}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function AksiTemuan({ id, status, reload }) {
  const [busy, setBusy] = useState(false);
  if (status === 'Ditutup' || status === 'Selesai') return null;
  return (
    <button
      disabled={busy}
      onClick={async (e) => {
        e.stopPropagation();
        setBusy(true);
        try {
          await api.patch(`/api/temuan/${id}`, { status: 'Ditutup' });
          reload();
        } finally {
          setBusy(false);
        }
      }}
      className="mt-1.5 text-[11px] font-semibold text-gov-700 hover:underline disabled:opacity-50"
    >
      {busy ? 'Menyimpan...' : 'Tandai sudah ada tindakan korektif'}
    </button>
  );
}

function Baris({ label, nilai }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="text-slate-800 font-medium text-right truncate">{nilai || '-'}</span>
    </div>
  );
}

function RadarMini({ data }) {
  return <GrafikRadar data={data} tinggi={170} />;
}
