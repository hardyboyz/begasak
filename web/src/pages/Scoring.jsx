import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Kartu,
  KartuJudul,
  Statistik,
  BadgeLevel,
  Chip,
  Kosong,
  Memuat,
  Modal,
} from '../components/ui';
import { GrafikBatang, GrafikDoughnut } from '../components/charts';
import FormScoring from '../components/FormScoring';
import { Konfirmasi, AksiBaris } from '../components/Formulir';
import { TombolUnduh } from '../components/TombolUnduh';
import { api, useApi } from '../lib/api';
import { useAuth } from '../lib/auth';
import { rupiahFmt, tanggalPendek } from '../lib/utils';
import { IkonCari, IkonRefresh, IkonTambah } from '../components/icons';

const KATEGORI = ['Semua', 'Rendah', 'Sedang', 'Tinggi', 'Sangat tinggi'];
const WARNA_KATEGORI = {
  Rendah: '#15803d',
  Sedang: '#ca8a04',
  Tinggi: '#ea580c',
  'Sangat tinggi': '#b91c1c',
};

function angka2(n) {
  return (Math.round((Number(n) + Number.EPSILON) * 100) / 100).toFixed(2).replace('.', ',');
}

export default function Scoring() {
  const { boleh } = useAuth();
  const [kategori, setKategori] = useState('Semua');
  const [kecamatan, setKecamatan] = useState('Semua');
  const [cari, setCari] = useState('');
  const [page, setPage] = useState(1);
  const per = 20;

  const [mode, setMode] = useState(null);
  const [awal, setAwal] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [hapus, setHapus] = useState(null);
  const [sibuk, setSibuk] = useState(false);
  const [notif, setNotif] = useState('');

  const query = new URLSearchParams({ limit: per, offset: (page - 1) * per });
  if (cari) query.set('q', cari);
  if (kategori !== 'Semua') query.set('kategori', kategori);
  if (kecamatan !== 'Semua') query.set('kecamatan', kecamatan);

  const { data, loading, reload } = useApi(`/api/scoring?${query.toString()}`);
  const { data: ringkasan, reload: reloadRingkasan } = useApi('/api/scoring/ringkasan');
  const { data: meta } = useApi('/api/scoring/meta');
  const { data: appMeta } = useApi('/api/meta');
  const { data: proyekData } = useApi('/api/proyek?limit=500&urut=nama');

  useEffect(() => setPage(1), [cari, kategori, kecamatan]);

  const totalHalaman = Math.ceil((data?.total || 0) / per);
  const r = ringkasan || {};

  const distribusi = useMemo(
    () =>
      KATEGORI.filter((k) => k !== 'Semua')
        .map((k) => ({
          name: k,
          value: r.per_kategori?.[k] || 0,
          color: WARNA_KATEGORI[k],
        }))
        .filter((d) => d.value > 0),
    [r]
  );

  const perAspek = (r.per_aspek || []).map((a) => ({
    label: a.nama,
    nilai: a.rata_skor,
    color: a.rata_skor >= 3 ? '#b91c1c' : a.rata_skor >= 2 ? '#ca8a04' : '#15803d',
  }));

  const selesaiSimpan = (pesan) => {
    setMode(null);
    setAwal(null);
    setNotif(pesan);
    reload();
    reloadRingkasan();
  };

  const simpan = async (nilai) => {
    if (mode === 'ubah' && awal) {
      const j = await api.patch(`/api/scoring/${awal.id}`, nilai);
      selesaiSimpan(`Berhasil memperbarui penilaian ${j.scoring.kode}.`);
    } else {
      const j = await api.post('/api/scoring', nilai);
      selesaiSimpan(`Berhasil menyimpan penilaian ${j.scoring.kode}.`);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Penilaian Scoring Risiko</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Penilaian 8 aspek sesuai Berita Acara · nilai akhir 0–100 · skor keselamatan 4 wajib
            ditindaklanjuti segera.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {boleh('laporan:ekspor') && (
            <TombolUnduh ke="/api/laporan/ekspor?format=csv&data=scoring" nama="begasak-scoring.csv">
              Ekspor CSV
            </TombolUnduh>
          )}
          {boleh('scoring:create') && (
            <button
              onClick={() => {
                setAwal(null);
                setMode('buat');
              }}
              className="tombol-utama"
            >
              <IkonTambah />
              Penilaian Baru
            </button>
          )}
          <button onClick={reload} className="tombol-sekunder">
            <IkonRefresh />
            Perbarui
          </button>
        </div>
      </div>

      {notif && (
        <div className="rounded-lg px-3 py-2.5 text-[12px] border bg-emerald-50 border-emerald-200 text-emerald-700">
          {notif}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Statistik
          label="Total penilaian"
          nilai={r.total || 0}
          satuan="dokumen"
          sub={`${r.kritis || 0} penilaian menandai K3 kritis`}
          tone="gov"
        />
        <Statistik
          label="Proyek dinilai"
          nilai={r.proyek_dinilai || 0}
          satuan="proyek"
          sub={`dari ${r.proyek_total || 0} proyek`}
          tone="emerald"
        />
        <Statistik
          label="Nilai rata-rata"
          nilai={angka2(r.rata_rata || 0)}
          satuan="/ 100"
          sub="Rata-rata seluruh penilaian"
          tone="slate"
        />
        <Statistik
          label="Belum dinilai"
          nilai={r.proyek_belum_dinilai || 0}
          satuan="proyek"
          sub="Perlu penilaian awal"
          tone="orange"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Kartu>
          <KartuJudul judul="Sebaran Kategori" sub="Berdasarkan nilai akhir penilaian" />
          <div className="p-4">
            {distribusi.length ? (
              <>
                <GrafikDoughnut
                  data={distribusi}
                  tinggi={180}
                  centerLabel={r.total || 0}
                  centerSub="penilaian"
                />
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {distribusi.map((d) => (
                    <div key={d.name} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50">
                      <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-slate-600">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                        {d.name}
                      </span>
                      <span className="text-[12px] font-bold text-slate-800 tabular-nums">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <Kosong pesan="Belum ada penilaian" />
            )}
          </div>
        </Kartu>

        <Kartu className="lg:col-span-2">
          <KartuJudul
            judul="Rata-rata Skor per Aspek"
            sub="Skala 1 (rendah) sampai 4 (sangat tinggi)"
          />
          <div className="p-4">
            {perAspek.length ? (
              <GrafikBatang
                data={perAspek}
                tinggi={250}
                horizontal
                formatterY={(v) => Number(v).toFixed(1)}
                formatterTooltip={(v, n) => [`${Number(v).toFixed(2)} / 4`, n]}
              />
            ) : (
              <Kosong pesan="Belum ada data aspek" />
            )}
          </div>
        </Kartu>
      </div>

      <Kartu className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="lg:col-span-2">
            <label className="label">Cari kode / proyek / petugas</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <IkonCari />
              </span>
              <input
                className="input pl-9"
                placeholder="mis. SCR-2026, drainase, Arif..."
                value={cari}
                onChange={(e) => setCari(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label">Kategori</label>
            <select className="input" value={kategori} onChange={(e) => setKategori(e.target.value)}>
              {KATEGORI.map((k) => (
                <option key={k}>{k === 'Semua' ? 'Semua kategori' : k}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Kecamatan</label>
            <select className="input" value={kecamatan} onChange={(e) => setKecamatan(e.target.value)}>
              <option>Semua</option>
              {(appMeta?.kecamatan || []).map((k) => (
                <option key={k.nama}>{k.nama}</option>
              ))}
            </select>
          </div>
        </div>
      </Kartu>

      <Kartu>
        <KartuJudul
          judul="Daftar Penilaian"
          sub={data ? `Menampilkan ${data.items.length} dari ${data.total} penilaian` : ''}
          aksi={
            data && totalHalaman > 1 ? (
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
            ) : null
          }
        />
        <div className="overflow-x-auto">
          {loading && !data ? (
            <Memuat />
          ) : (
            <table className="tabel">
              <thead>
                <tr>
                  <th>Penilaian</th>
                  <th>Proyek</th>
                  <th>Kecamatan</th>
                  <th>Petugas</th>
                  <th className="text-right">Nilai</th>
                  <th>Kategori</th>
                  <th className="text-center">K3</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((s) => (
                  <tr key={s.id} className="cursor-pointer" onClick={() => setDetailId(s.id)}>
                    <td>
                      <p className="font-mono text-[10px] text-slate-400">{s.kode}</p>
                      <p className="text-[11.5px] text-slate-600">{tanggalPendek(s.tanggal)}</p>
                    </td>
                    <td className="max-w-[300px]">
                      <p className="font-mono text-[10px] text-slate-400">{s.proyek_kode}</p>
                      <Link
                        to={`/proyek?detail=${s.proyek_kode}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[12.5px] font-semibold text-slate-800 hover:text-gov-700 line-clamp-1"
                      >
                        {s.proyek_nama}
                      </Link>
                    </td>
                    <td className="text-[12px]">{s.kecamatan}</td>
                    <td className="text-[11.5px] text-slate-600">{s.petugas || '-'}</td>
                    <td className="text-right">
                      <p className="text-[14px] font-extrabold tabular-nums text-slate-900">
                        {angka2(s.nilai_akhir)}
                      </p>
                      <p className="text-[10px] text-slate-400">{rupiahFmt(s.pagu, true)}</p>
                    </td>
                    <td>
                      <BadgeLevel level={s.kategori} size="xs" />
                    </td>
                    <td className="text-center">
                      {s.kritis ? (
                        <Chip tone="red">Kritis</Chip>
                      ) : (
                        <span className="text-[11px] text-slate-300">—</span>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setDetailId(s.id)}
                          className="text-[11px] font-semibold text-gov-700 hover:underline"
                        >
                          Detail
                        </button>
                        <AksiBaris
                          boleh={boleh}
                          ubah={{
                            izin: 'scoring',
                            jalankan: async (x) => {
                              try {
                                const j = await api.get(`/api/scoring/${x.id}`);
                                setAwal(j.scoring);
                                setMode('ubah');
                              } catch (e) {
                                setNotif(`Gagal memuat penilaian: ${e.message}`);
                              }
                            },
                          }}
                          hapus={{ izin: 'scoring', jalankan: (x) => setHapus(x) }}
                          target={s}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {data?.items.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <Kosong pesan="Tidak ada penilaian yang cocok" sub="Ubah kata kunci atau filter" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </Kartu>

      <FormScoring
        buka={!!mode}
        tutup={() => {
          setMode(null);
          setAwal(null);
        }}
        awal={awal}
        meta={meta}
        proyekList={proyekData?.items || []}
        onSaved={simpan}
      />

      <DetailPenilaian
        key={detailId || 'tutup'}
        id={detailId}
        boleh={boleh}
        tutup={() => setDetailId(null)}
        onEdit={(s) => {
          setDetailId(null);
          setAwal(s);
          setMode('ubah');
        }}
        onHapus={(s) => {
          setDetailId(null);
          setHapus(s);
        }}
      />

      <Konfirmasi
        buka={!!hapus}
        tutup={() => setHapus(null)}
        judul="Hapus penilaian?"
        pesan={
          <>
            Penilaian <b>{hapus?.kode}</b> akan dihapus. Risiko proyek akan dihitung ulang dari
            penilaian terbaru atau menjadi <b>Belum dinilai</b> bila tidak ada penilaian lain.
          </>
        }
        sibuk={sibuk}
        onYa={async () => {
          setSibuk(true);
          try {
            const j = await api.del(`/api/scoring/${hapus.id}`);
            setNotif(`Berhasil menghapus penilaian ${j.kode}.`);
            setHapus(null);
            reload();
            reloadRingkasan();
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

function DetailPenilaian({ id, boleh, tutup, onEdit, onHapus }) {
  const { data, loading } = useApi(id ? `/api/scoring/${id}` : null);
  const s = data?.scoring;

  return (
    <Modal
      buka={!!id}
      tutup={tutup}
      lebar="max-w-5xl"
      judul={
        s ? (
          <span className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[11px] text-slate-400">{s.kode}</span>
            <span>Penilaian Scoring</span>
            <BadgeLevel level={s.kategori} />
          </span>
        ) : (
          'Memuat penilaian...'
        )
      }
      footer={
        s && (
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10.5px] text-slate-400">
              Diperbarui {s.updated_at || s.created_at || '-'}
            </p>
            <div className="flex items-center gap-2">
              {boleh('scoring:update') && (
                <button onClick={() => onEdit(s)} className="tombol-sekunder">
                  Ubah
                </button>
              )}
              {boleh('scoring:delete') && (
                <button
                  onClick={() => onHapus(s)}
                  className="rounded-lg bg-red-600 text-white text-[12px] font-semibold px-3 py-2 hover:bg-red-700"
                >
                  Hapus
                </button>
              )}
            </div>
          </div>
        )
      }
    >
      {loading && !s ? (
        <Memuat baris={8} />
      ) : !s ? (
        <Kosong pesan="Penilaian tidak ditemukan" />
      ) : (
        <div className="space-y-4">
          {s.kritis ? (
            <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2.5">
              <p className="text-[12px] font-bold text-red-700">
                Skor keselamatan konstruksi 4 — tindak lanjut segera
              </p>
              <p className="text-[11.5px] text-red-600 mt-0.5">
                Jangan menunggu nilai akhir. Hentikan pekerjaan berisiko sampai temuan keselamatan
                ditutup.
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-slate-50">
              <p className="text-[10.5px] text-slate-500 font-semibold uppercase">Nilai akhir</p>
              <p className="text-2xl font-extrabold text-slate-900 tabular-nums">
                {angka2(s.nilai_akhir)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50">
              <p className="text-[10.5px] text-slate-500 font-semibold uppercase">Tanggal</p>
              <p className="text-[13px] font-bold text-slate-800">{tanggalPendek(s.tanggal)}</p>
              <p className="text-[10.5px] text-slate-400">{s.petugas || '-'}</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50">
              <p className="text-[10.5px] text-slate-500 font-semibold uppercase">Proyek</p>
              <p className="font-mono text-[10px] text-slate-400">{s.proyek?.kode || ''}</p>
              <p className="text-[12px] font-bold text-slate-800 line-clamp-2">
                {s.proyek?.nama || '-'}
              </p>
              {s.pengawasan_id && (
                <p className="text-[10.5px] text-slate-400">Pengawasan #{s.pengawasan_id}</p>
              )}
            </div>
            <div className="p-3 rounded-lg bg-slate-50">
              <p className="text-[10.5px] text-slate-500 font-semibold uppercase">Kategori</p>
              <BadgeLevel level={s.kategori} />
              <p className="text-[10.5px] text-slate-400 mt-1">
                {s.kritis ? 'K3 kritis' : 'Tidak ada flag K3 kritis'}
              </p>
            </div>
          </div>

          <div>
            <h4 className="text-[13px] font-bold text-slate-800 mb-2">Rincian 8 Aspek</h4>
            <div className="space-y-2">
              {(s.detail || []).map((d) => (
                  <div key={d.kode} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-bold text-slate-800">
                          {d.nama}
                          <span className="ml-2 text-[10.5px] font-semibold text-slate-400">
                            bobot {d.bobot}%
                          </span>
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{d.indikator}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <Chip tone={d.skor >= 4 ? 'red' : d.skor >= 3 ? 'amber' : 'emerald'}>
                          Skor {d.skor}
                        </Chip>
                        <p className="text-[11.5px] font-bold text-slate-700 mt-1 tabular-nums">
                          {angka2(d.nilai)} poin
                        </p>
                      </div>
                    </div>
                    {(d.catatan || d.bukti) && (
                      <div className="mt-1.5 space-y-0.5">
                        {d.catatan && <p className="text-[11px] text-slate-600">{d.catatan}</p>}
                        {d.bukti && <p className="text-[10.5px] text-gov-700">Bukti: {d.bukti}</p>}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>

          <div className="rounded-lg bg-gov-50 border border-gov-100 p-3">
            <p className="text-[11px] font-bold text-gov-800 uppercase tracking-wide">Rekomendasi</p>
            <p className="text-[12px] text-slate-700 mt-1">{s.rekomendasi || '-'}</p>
          </div>

          {s.catatan && (
            <div>
              <p className="text-[11px] font-bold text-slate-700">Catatan penilaian</p>
              <p className="text-[12px] text-slate-600 mt-0.5">{s.catatan}</p>
            </div>
          )}
          {s.kesimpulan && (
            <div>
              <p className="text-[11px] font-bold text-slate-700">Kesimpulan</p>
              <p className="text-[12px] text-slate-600 mt-0.5">{s.kesimpulan}</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
