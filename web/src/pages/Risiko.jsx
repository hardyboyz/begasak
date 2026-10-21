import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TombolUnduh } from '../components/TombolUnduh';
import { Kartu, KartuJudul, Statistik, ProgressBar, BadgeLevel, Kosong, Memuat, Tab } from '../components/ui';
import { useApi } from '../lib/api';
import { rupiahFmt } from '../lib/utils';

export default function Risiko() {
  const [level, setLevel] = useState('Semua');
  const { data, loading } = useApi(`/api/risiko?limit=100${level !== 'Semua' ? `&level=${level}` : ''}`);

  const ringkasan = data?.ringkasan || {};
  const total = ringkasan.total || 0;

  const matriksTersedia = useMemo(() => {
    const list = ['Sangat tinggi', 'Tinggi', 'Sedang', 'Rendah'];
    return list.map((l) => ({ label: l, jumlah: ringkasan[l] || 0 }));
  }, [ringkasan]);

  if (loading && !data) return <Memuat />;
  if (!data) return <Kosong pesan="Gagal memuat data risiko" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Analisis Risiko Proyek</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Risiko berasal dari penilaian scoring terbaru: 8 aspek dengan nilai akhir 0–100.
            {ringkasan.belum_dinilai > 0 && (
              <> {ringkasan.belum_dinilai} proyek belum dinilai.</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/scoring" className="tombol-utama">
            Kelola Scoring
          </Link>
          <TombolUnduh ke="/api/laporan/ekspor?format=csv&data=scoring" nama="begasak-scoring.csv">
            Ekspor CSV
          </TombolUnduh>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {matriksTersedia.map((t) => {
          const tone =
            t.label === 'Sangat tinggi'
              ? 'red'
              : t.label === 'Tinggi'
              ? 'orange'
              : t.label === 'Sedang'
              ? 'amber'
              : 'emerald';
          return (
            <Statistik
              key={t.label}
              label={`Risiko ${t.label}`}
              nilai={t.jumlah}
              satuan="proyek"
              sub={total ? `${Math.round((t.jumlah / total) * 100)}% dari ${total} proyek dinilai` : '-'}
              ikon={<span className="w-2.5 h-2.5 rounded-full" style={{ background: { red: '#b91c1c', orange: '#ea580c', amber: '#ca8a04', emerald: '#15803d' }[tone] }} />}
              tone={tone}
            />
          );
        })}
      </div>

      <Kartu>
        <KartuJudul judul="Daftar Proyek Berdasarkan Tingkat Risiko" />
        <div className="px-4 py-3">
          <Tab
            aktif={level}
            ubah={setLevel}
            items={[
              { nilai: 'Semua', label: 'Semua', jumlah: total },
              ...matriksTersedia.map((t) => ({ nilai: t.label, label: t.label, jumlah: t.jumlah })),
            ]}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="tabel">
            <thead>
              <tr>
                <th>Kode / Proyek</th>
                <th>Kecamatan</th>
                <th className="text-right">Pagu</th>
                <th className="text-right">Progres</th>
                <th className="text-center">Nilai</th>
                <th>Level</th>
                <th>Faktor risiko utama</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r.kode}>
                  <td>
                    <Link to={`/proyek?detail=${r.proyek_kode}`} className="block max-w-[260px]">
                      <p className="font-mono text-[10px] text-slate-400">{r.proyek_kode}</p>
                      <p className="text-[12.5px] font-semibold text-slate-800 hover:text-gov-700 line-clamp-1">
                        {r.proyek_nama}
                      </p>
                    </Link>
                  </td>
                  <td className="text-[12px]">{r.kecamatan}</td>
                  <td className="text-right text-[12px] font-semibold">{rupiahFmt(r.pagu, true)}</td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16">
                        <ProgressBar nilai={r.progres} tinggi={5} />
                      </div>
                      <span className="text-[11px] tabular-nums">{r.progres}%</span>
                    </div>
                  </td>
                  <td className="text-center text-[12px] font-extrabold tabular-nums">
                    {Number(r.skor || 0).toFixed(2).replace('.', ',')}
                  </td>
                  <td>
                    <BadgeLevel level={r.level} size="xs" />
                  </td>
                  <td className="max-w-[320px]">
                    <p className="text-[11.5px] text-slate-500 line-clamp-2">{r.deskripsi}</p>
                    {r.mitigasi && (
                      <p className="text-[11px] text-gov-700 mt-0.5 line-clamp-1">→ {r.mitigasi}</p>
                    )}
                  </td>
                  <td className="text-right">
                    <Link to={`/proyek?detail=${r.proyek_kode}`} className="text-[11px] font-semibold text-gov-700 hover:underline">
                      Detail
                    </Link>
                  </td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <Kosong pesan="Tidak ada proyek pada level ini" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Kartu>
    </div>
  );
}

