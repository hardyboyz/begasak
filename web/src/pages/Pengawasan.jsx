import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Kartu,
  KartuJudul,
  Chip,
  BadgeLevel,
  Kosong,
  Memuat,
  Statistik,
} from '../components/ui';
import { GrafikBatang, GrafikDoughnut } from '../components/charts';
import { api, useApi } from '../lib/api';
import { tanggalPendek, waktuRelatif } from '../lib/utils';
import { IkonRefresh, IkonUnduh, IkonLive } from '../components/icons';
import { TombolUnduh } from '../components/TombolUnduh';

const HAL = [20, 50, 100];

export default function Pengawasan() {
  const [kec, setKec] = useState('Semua');
  const [statusT, setStatusT] = useState('');
  const [tingkat, setTingkat] = useState('');
  const [halaman, setHalaman] = useState(1);
  const [per, setPer] = useState(20);
  const [live, setLive] = useState(false);
  const [perBaru, setPerBaru] = useState(0);

  const { data: meta } = useApi('/api/meta');
  const { data: ring } = useApi('/api/dashboard');

  useEffect(() => {
    if (!live) return;
    const i = setInterval(() => setPerBaru((n) => n + 1), 15000);
    return () => clearInterval(i);
  }, [live]);

  const params = new URLSearchParams({ limit: per, offset: (halaman - 1) * per });
  if (kec !== 'Semua') params.set('kecamatan', kec);
  if (statusT) params.set('status', statusT);
  if (tingkat) params.set('tingkat', tingkat);

  const { data, loading, reload } = useApi(`/api/temuan?${params}`, [live ? perBaru : 0]);
  const { data: sup, reload: reloadSup } = useApi(
    `/api/pengawasan?limit=${Math.min(per, 15)}${kec !== 'Semua' ? `&kecamatan=${encodeURIComponent(kec)}` : ''}`,
    [live ? perBaru : 0]
  );

  useEffect(() => setHalaman(1), [kec, statusT, tingkat, per]);

  const m = ring?.metrik?.pengawasan || {};
  const totalHal = Math.ceil((data?.total || 0) / per);
  const ringkasanKat = data?.ringkasan || [];

  const muatUlang = () => {
    reload();
    reloadSup();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Pengawasan & Temuan</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Catatan supervisi harian dan temuan dari lapangan
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLive((v) => !v)}
            className={`tombol-sekunder ${live ? '!bg-emerald-50 !text-emerald-700 !border-emerald-300' : ''}`}
            title="Auto refresh setiap 15 detik"
          >
            <IkonLive />
            {live ? 'Live aktif' : 'Aktifkan live'}
          </button>
          <button onClick={muatUlang} className="tombol-sekunder">
            <IkonRefresh />
          </button>
          <TombolUnduh ke="/api/laporan/ekspor?format=csv&data=temuan" nama="begasak-temuan.csv">
            <IkonUnduh />
            Ekspor
          </TombolUnduh>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Statistik label="Total temuan" nilai={m.temuan_total || 0} satuan="temuan" tone="gov" />
        <Statistik
          label="Temuan terbuka"
          nilai={m.temuan_terbuka || 0}
          satuan="temuan"
          sub="Menunggu tindakan korektif"
          tone="orange"
        />
        <Statistik
          label="Temuan ekstrem"
          nilai={m.temuan_ekstrem || 0}
          satuan="temuan"
          sub="Prioritas pemeriksaan lanjutan"
          tone={m.temuan_ekstrem > 0 ? 'red' : 'emerald'}
        />
        <Statistik
          label="Catatan supervisi"
          nilai={m.catatan_supervisi || 0}
          satuan="laporan"
          sub="Dokumentasi lapangan"
          tone="slate"
        />
      </div>

      <Kartu className="p-4">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
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
            <label className="label">Status temuan</label>
            <select className="input" value={statusT} onChange={(e) => setStatusT(e.target.value)}>
              <option value="">Semua</option>
              {['Baru', 'Ditangani', 'Ditutup', 'Selesai'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Tingkat</label>
            <select className="input" value={tingkat} onChange={(e) => setTingkat(e.target.value)}>
              <option value="">Semua</option>
              {['Rendah', 'Sedang', 'Tinggi', 'Ekstrem'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Baris per halaman</label>
            <select className="input" value={per} onChange={(e) => setPer(+e.target.value)}>
              {HAL.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Link to="/proyek" className="tombol-sekunder w-full justify-center">
              Lihat proyek
            </Link>
          </div>
        </div>
      </Kartu>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Kartu>
            <KartuJudul
              judul="Daftar Temuan Supervisi"
              sub={data ? `${data.total} temuan` : ''}
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
              <div className="divide-y divide-slate-100">
                {data?.items.map((t) => (
                  <div key={t.id} className="p-4 hover:bg-slate-50/60">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[10px] text-slate-400">{t.kode}</span>
                          <BadgeLevel level={t.tingkat} size="xs" />
                          <Chip tone="slate">{t.kategori}</Chip>
                          <Chip
                            tone={
                              t.status === 'Ditutup' || t.status === 'Selesai'
                                ? 'emerald'
                                : t.status === 'Ditangani'
                                ? 'amber'
                                : 'red'
                            }
                          >
                            {t.status}
                          </Chip>
                        </div>
                        <p className="text-[13px] text-slate-800 font-medium mt-1.5 leading-relaxed">
                          {t.deskripsi}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          <Link to={`/proyek?detail=${t.proyek_kode}`} className="font-semibold text-gov-700 hover:underline">
                            {t.proyek_nama}
                          </Link>{' '}
                          · {t.kecamatan} · {t.lokasi || '-'} · {tanggalPendek(t.tanggal)} · pelapor:{' '}
                          {t.pelapor}
                        </p>
                        {t.tindakan && (
                          <p className="text-[11.5px] text-emerald-700 mt-1 bg-emerald-50 rounded px-2 py-1 inline-block">
                            Tindakan: {t.tindakan}
                          </p>
                        )}
                        {t.konsekuensi && (
                          <p className="text-[11.5px] text-red-700 mt-1">Konsekuensi: {t.konsekuensi}</p>
                        )}
                      </div>
                      <AksiTemuan
                        id={t.id}
                        status={t.status}
                        reload={() => {
                          reload();
                          reloadSup();
                        }}
                      />
                    </div>
                  </div>
                ))}
                {data?.items.length === 0 && (
                  <div className="p-6">
                    <Kosong pesan="Tidak ada temuan yang cocok" sub="Ubah filter atau kecamatan" />
                  </div>
                )}
              </div>
            )}
          </Kartu>
        </div>

        <div className="space-y-4">
          <Kartu>
            <KartuJudul judul="Catatan Supervisi Terbaru" sub="Perekaman lapangan" aksi={<button onClick={reloadSup} className="text-[11px] text-gov-700 font-semibold hover:underline">↻</button>} />
            <div className="divide-y divide-slate-100 max-h-[28rem] overflow-y-auto">
              {(sup?.items || []).map((s) => (
                <div key={s.id} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] text-slate-400">{s.kode}</span>
                    <span className="text-[10px] text-slate-400">{waktuRelatif(s.created_at)}</span>
                  </div>
                  <p className="text-[11.5px] font-semibold text-slate-700 mt-0.5 line-clamp-1">{s.proyek_nama}</p>
                  <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{s.catatan}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5 text-[10px] text-slate-500">
                    <Chip tone="slate">{s.kecamatan}</Chip>
                    <Chip tone="blue">{s.jumlah_pekerja_harian} pekerja</Chip>
                    <Chip tone="violet">{s.alat_berat} alat</Chip>
                    <Chip tone="emerald">{s.material_terpasang} material</Chip>
                  </div>
                </div>
              ))}
              {(!sup || sup.items.length === 0) && (
                <div className="p-4">
                  <Kosong pesan="Belum ada catatan supervisi" />
                </div>
              )}
            </div>
          </Kartu>

          <Kartu>
            <KartuJudul judul="Temuan per Kategori" />
            <div className="p-4">
              <GrafikBatang data={ringkasanKat.map((k) => ({ label: k.kategori, nilai: k.terbuka }))} tinggi={220} horizontal />
            </div>
          </Kartu>

          <Kartu>
            <KartuJudul judul="Proporsi Status Temuan" />
            <div className="p-4">
              <GrafikDoughnut
                tinggi={170}
                centerLabel={`${m.temuan_total || 0}`}
                centerSub="temuan"
                data={[
                  { label: 'Tertutup', nilai: (m.temuan_total || 0) - (m.temuan_terbuka || 0), warna: '#15803d' },
                  { label: 'Terbuka', nilai: m.temuan_terbuka || 0, warna: '#ea580c' },
                  { label: 'Ekstrem', nilai: m.temuan_ekstrem || 0, warna: '#b91c1c' },
                ]}
              />
            </div>
          </Kartu>
        </div>
      </div>
    </div>
  );
}

function AksiTemuan({ id, status, reload }) {
  const [busy, setBusy] = useState(false);
  if (status === 'Ditutup' || status === 'Selesai') {
    return (
      <span className="text-[10.5px] font-semibold text-emerald-600 shrink-0 flex items-center gap-1">
        ✓ Ditutup
      </span>
    );
  }
  const berikut = status === 'Baru' ? 'Ditangani' : 'Ditutup';
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api.patch(`/api/temuan/${id}`, {
            status: berikut,
            tindakan: status === 'Baru' ? 'Telah diverifikasi, dalam proses perbaikan' : 'Perbaikan selesai dan diverifikasi',
            tanggal_closure: berikut === 'Ditutup' ? new Date().toISOString().slice(0, 10) : undefined,
          });
          reload();
        } finally {
          setBusy(false);
        }
      }}
      className="tombol-utama !px-2.5 !py-1 !text-[11px] shrink-0"
    >
      {busy ? '...' : `→ ${berikut}`}
    </button>
  );
}