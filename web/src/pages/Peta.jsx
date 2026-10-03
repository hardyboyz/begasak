import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Kartu, KartuJudul, BadgeLevel, Chip, Kosong, Memuat, Statistik, ProgressBar } from '../components/ui';
import { GrafikBatang } from '../components/charts';
import PetaSkematis from '../components/PetaSkematis';
import { useApi } from '../lib/api';
import { rupiahFmt } from '../lib/utils';

const LEVELS = ['Semua', 'Ekstrem', 'Tinggi', 'Sedang', 'Rendah'];

export default function Peta() {
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const kec = params.get('kec') || 'Semua';
  const level = params.get('level') || 'Semua';
  const { data, loading } = useApi('/api/peta');

  const set = (k, v) => {
    const n = new URLSearchParams(params);
    if (!v || v === 'Semua') n.delete(k);
    else n.set(k, v);
    setParams(n, { replace: true });
  };

  const titikTersaring = (data?.titik || []).filter(
    (t) => (kec === 'Semua' || t.kecamatan === kec) && (level === 'Semua' || t.level === level)
  );
  const ringkasan = data?.ringkasan || [];
  const totalPagukan = ringkasan.reduce((a, b) => a + (b.pagu || 0), 0);
  const totalBerisiko = ringkasan.reduce((a, b) => a + (b.ekstrem || 0) + (b.tinggi || 0), 0);

  if (loading && !data) return <Memuat />;
  if (!data) return <Kosong pesan="Gagal memuat data peta" />;

  const daftar = titikTersaring
    .slice()
    .sort((a, b) => (b.skor_risiko || 0) - (a.skor_risiko || 0))
    .slice(0, 120);

  const onKlik = (v) => {
    if (typeof v === 'string' && v.startsWith('PRJ')) {
      nav(`/proyek?detail=${v}`);
      return;
    }
    set('kec', v === 'Semua' ? null : v);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Pemetaan Risiko & Monitoring</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Sebaran proyek dan tingkat risiko per kecamatan Kabupaten Belitung Timur.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <select value={level} onChange={(e) => set('level', e.target.value)} className="input w-auto">
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l === 'Semua' ? 'Semua level' : `Risiko ${l}`}
              </option>
            ))}
          </select>
          {kec !== 'Semua' && (
            <button onClick={() => set('kec', null)} className="tombol-sekunder">
              Reset filter
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Statistik label="Kecamatan tercakup" nilai={data.ringkasan.length} satuan="kecamatan" tone="gov" />
        <Statistik
          label="Nilai pagu terpantau"
          nilai={`Rp ${rupiahFmt(totalPagukan, true)}`}
          sub="Total paket konstruksi"
          tone="slate"
        />
        <Statistik
          label="Proyek berisiko tinggi/ekstrem"
          nilai={totalBerisiko}
          satuan="proyek"
          sub="Perlu intervensi segera"
          tone="orange"
        />
        <Statistik
          label="Titik proyek dipetakan"
          nilai={titikTersaring.length}
          satuan="proyek"
          sub={kec !== 'Semua' ? `Kecamatan ${kec}` : 'Seluruh kabupaten'}
          tone="emerald"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Kartu className="xl:col-span-2">
          <KartuJudul
            judul="Peta Sebaran Risiko Proyek"
            sub="Klik polygon untuk memfilter; titik mewakili proyek"
            aksi={
              <div className="flex gap-1">
                {['Semua', 'Tinggi', 'Ekstrem'].map((l) => (
                  <button
                    key={l}
                    onClick={() => set('level', l === 'Semua' ? null : l)}
                    className={`px-2 py-1 rounded text-[11px] font-semibold transition ${
                      level === l ? 'bg-gov-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            }
          />
          <div className="p-4">
            <PetaSkematis
              ringkasan={data.ringkasan}
              titik={titikTersaring}
              aktifKec={kec}
              filterLevel={level}
              onKlik={onKlik}
            />
          </div>
        </Kartu>

        <div className="space-y-4">
          <Kartu>
            <KartuJudul judul="Profil Kecamatan" sub="Jumlah & nilai工程项目 per wilayah" />
            <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
              {data.ringkasan.map((r) => {
                const total = r.ekstrem + r.tinggi + r.sedang + r.rendah || 1;
                return (
                  <div
                    key={r.kecamatan}
                    onClick={() => set('kec', kec === r.kecamatan ? null : r.kecamatan)}
                    className={`p-2.5 rounded-lg border cursor-pointer transition ${
                      kec === r.kecamatan ? 'border-gov-500 bg-gov-50' : 'border-slate-200 hover:border-gov-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[12.5px] font-bold text-slate-800">{r.kecamatan}</span>
                      <span className="text-[11px] font-semibold text-gov-700">{rupiahFmt(r.pagu, true)}</span>
                    </div>
                    <p className="text-[10.5px] text-slate-500 mt-0.5">
                      {r.jumlah_proyek} proyek · {r.berjalan} berjalan · progres {r.progres}%
                    </p>
                    <div className="flex h-2 mt-2 rounded-full overflow-hidden bg-slate-100">
                      {['ekstrem', 'tinggi', 'sedang', 'rendah'].map((k) => {
                        const v = r[k] || 0;
                        if (!v) return null;
                        return (
                          <div
                            key={k}
                            style={{
                              width: `${(v / total) * 100}%`,
                              background: { ekstrem: '#b91c1c', tinggi: '#ea580c', sedang: '#ca8a04', rendah: '#15803d' }[k],
                            }}
                            title={`${k}: ${v}`}
                          />
                        );
                      })}
                    </div>
                    <div className="flex gap-2 mt-1.5 text-[10px]">
                      {r.ekstrem > 0 && <span className="text-red-600 font-semibold">{r.ekstrem} ekstrem</span>}
                      {r.tinggi > 0 && <span className="text-orange-600 font-semibold">{r.tinggi} tinggi</span>}
                      {r.sedang > 0 && <span className="text-amber-600 font-semibold">{r.sedang} sedang</span>}
                      {r.rendah > 0 && <span className="text-emerald-600 font-semibold">{r.rendah} rendah</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Kartu>

          <Kartu>
            <KartuJudul judul="Nilai Pagu per Kecamatan" />
            <div className="p-4">
              <GrafikBatang
                data={data.ringkasan.map((r) => ({
                  label: r.kecamatan,
                  nilai: Math.round((r.pagu || 0) / 1e6),
                }))}
                tinggi={200}
                horizontal
                formatterY={(v) => `${Math.round(v / 1000)} M`}
                formatterTooltip={(v) => [`Rp ${v} juta`, 'Pagu']}
              />
            </div>
          </Kartu>
        </div>
      </div>

      <Kartu>
        <KartuJudul
          judul={`Daftar Proyek (${titikTersaring.length})`}
          sub="Diurutkan berdasarkan skor risiko tertinggi"
          aksi={<Link to="/proyek" className="text-[11px] font-semibold text-gov-700 hover:underline">Kelola →</Link>}
        />
        <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
          <table className="tabel">
            <thead className="sticky top-0 z-10">
              <tr>
                <th>Proyek</th>
                <th>Kecamatan</th>
                <th>Jenis Pekerjaan</th>
                <th className="text-right">Pagu</th>
                <th className="text-right">Progres</th>
                <th className="text-center">Temuan</th>
                <th className="text-center">Skor</th>
                <th>Level</th>
              </tr>
            </thead>
            <tbody>
              {daftar.map((t) => (
                <tr key={t.kode}>
                  <td className="max-w-[300px]">
                    <p className="font-mono text-[10px] text-slate-400">{t.kode}</p>
                    <Link to={`/proyek?detail=${t.kode}`} className="text-[12.5px] font-semibold text-slate-800 hover:text-gov-700 line-clamp-1">
                      {t.nama}
                    </Link>
                  </td>
                  <td className="text-[12px]">{t.kecamatan}</td>
                  <td className="text-[11.5px] text-slate-500">{t.jenis_pekerjaan}</td>
                  <td className="text-right text-[12px] font-semibold">{rupiahFmt(t.pagu, true)}</td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-14">
                        <ProgressBar nilai={t.progres} tinggi={5} />
                      </div>
                      <span className="text-[11px] tabular-nums">{t.progres}%</span>
                    </div>
                  </td>
                  <td className="text-center">
                    {t.temuan_terbuka > 0 ? (
                      <Chip tone="red">{t.temuan_terbuka}</Chip>
                    ) : (
                      <span className="text-slate-300">0</span>
                    )}
                  </td>
                  <td className="text-center text-[12px] font-bold tabular-nums">{t.skor_risiko || '-'}</td>
                  <td>
                    <BadgeLevel level={t.level} size="xs" />
                  </td>
                </tr>
              ))}
              {daftar.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <Kosong pesan="Tidak ada proyek yang cocok dengan filter" />
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