import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Kartu, KartuJudul, Statistik, ProgressBar, BadgeLevel, Chip, Kosong, Memuat } from '../components/ui';
import { GrafikDoughnut, GrafikBatang, TOOLTIP_STYLE } from '../components/charts';
import {
  IkonProyek,
  IkonTenaga,
  IkonPeringatan,
  IkonRisiko,
  IkonPenyedia,
  IkonPengawasan,
  IkonLive,
  IkonRefresh,
} from '../components/icons';
import { rupiahFmt, rupiahPenuh, waktuRelatif, tanggalPendek } from '../lib/utils';
import { useApi, useRealtime } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function Dashboard() {
  const { data, loading, reload } = useApi('/api/dashboard');
  // Layout sudahanquilla satu koneksi SSE; halaman ini memakai hooks sendiri
  // agar tidak bergantung pada konteks presentasi Layout.
  const { data: meta } = useApi('/api/meta');
  const { terhubung, feed } = useRealtime({});

  useEffect(() => {
    const t = setInterval(reload, 30000);
    return () => clearInterval(t);
  }, [reload]);

  if (loading && !data) return <Memuat baris={8} />;
  if (!data) return <Kosong pesan="Gagal memuat dashboard" sub="Pastikan server API berjalan" />;

  const m = data.metrik;
  const per = data.peringatan;
  const target = meta?.ikk_target || 83.49;

  const komposisiRisiko = ['Ekstrem', 'Tinggi', 'Sedang', 'Rendah']
    .filter((l) => m.risiko[l] > 0)
    .map((l) => ({
      name: l,
      value: m.risiko[l],
      color: { Ekstrem: '#b91c1c', Tinggi: '#ea580c', Sedang: '#ca8a04', Rendah: '#15803d' }[l],
    }));

  const statusProyek = data.statusProyek.map((s) => ({
    label: s.status,
    nilai: s.n,
    color: { Berjalan: '#1447e1', Selesai: '#15803d', 'Belum Mulai': '#94a3b8' }[s.status] || '#94a3b8',
  }));

  const tren = data.trenPeringatan.map((t) => ({
    label: tanggalPendek(t.tanggal).replace(' 2025', ''),
    Tinggi: t.tinggi,
    Ekstrem: t.ekstrem,
  }));

  const featCount = feed.length;

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">
            Dashboard Monitoring Pengawasan Jasa Konstruksi
          </h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Kabupaten {meta?.kabupaten} · TA {meta?.tahun} · Pemantauan{' '}
            <span className={terhubung ? 'text-emerald-600 font-semibold' : 'text-slate-400'}>
              {terhubung ? '● realtime aktif' : '○ tidak tersambung'}
            </span>{' '}
            · {featCount} aktivitas masuk
          </p>
        </div>
        <button onClick={reload} className="tombol-sekunder">
          <IkonRefresh />
          Perbarui Data
        </button>
      </div>

      {/* KPI UTAMA */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <Statistik
          label="Total Proyek"
          nilai={m.proyek.total}
          satuan="paket"
          sub={`${m.proyek.berjalan} berjalan · ${m.proyek.selesai} selesai`}
          ikon={<IkonProyek className="w-5 h-5" />}
          tone="gov"
        />
        <Statistik
          label="Pagu Anggaran"
          nilai={`Rp ${rupiahFmt(m.anggaran.pagu_total, true)}`}
          sub={`Realisasi ${rupiahFmt(m.anggaran.realisasi, true)}`}
          ikon={<span className="text-[13px] font-bold">Rp</span>}
          tone="slate"
        />
        <Statistik
          label="TKK Bersertifikat"
          nilai={m.tkk.total}
          satuan="orang"
          sub={`${m.tkk.operator} operator · ${m.tkk.teknisi_analis} T/A`}
          ikon={<IkonTenaga className="w-5 h-5" />}
          tone="emerald"
        />
        <Statistik
          label="IKK KKTC"
          nilai={`${m.ikk}`}
          satuan="%"
          sub={`Target ${target}% · ${m.ikk >= target ? 'terlampaui' : 'dibawah target'}`}
          ikon={<span className="text-[13px] font-bold">%</span>}
          tone={m.ikk >= target ? 'emerald' : 'amber'}
        />
        <Statistik
          label="Proyek Berisiko"
          nilai={m.risiko.Tinggi + m.risiko.Ekstrem}
          satuan="proyek"
          sub={`${m.risiko.Ekstrem} ekstrem · ${m.risiko.Tinggi} tinggi`}
          ikon={<IkonRisiko className="w-5 h-5" />}
          tone="orange"
        />
        <Statistik
          label="Temuan Terbuka"
          nilai={m.pengawasan.temuan_terbuka}
          satuan="temuan"
          sub={`Dari ${m.pengawasan.temuan_total} temuan`}
          ikon={<IkonPengawasan className="w-5 h-5" />}
          tone="red"
        />
      </div>

      {/* BARIS 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* IKK + GAP */}
        <Kartu>
          <KartuJudul
            judul="Indeks KKTC & Analisis Kesenjangan"
            sub="Rasio tenaga bersertifikat terhadap kebutuhan"
          />
          <div className="p-5">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                    IKK Realisasi
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">target {target}%</span>
                </div>
                <p className="text-4xl font-extrabold text-slate-900 leading-none tabular-nums">{m.ikk}%</p>
                <div className="mt-3">
                  <div className="relative">
                    <ProgressBar
                      nilai={Math.min(100, m.ikk)}
                      warna={m.ikk >= target ? '#15803d' : '#ea580c'}
                      tinggi={10}
                    />
                    <div
                      className="absolute -top-0.5 w-0.5 h-[14px] bg-slate-700"
                      style={{ left: `${Math.min(100, target)}%` }}
                      title={`Target ${target}%`}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2">
                    {m.tkk.total} orang bersertifikat dari kebutuhan {m.kebutuhan.total} orang
                  </p>
                </div>
              </div>
              <div
                className={`w-20 h-20 rounded-xl grid place-items-center text-center ${
                  m.ikk >= target ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'
                }`}
              >
                <div>
                  <p className="text-[10px] font-semibold uppercase">Gap</p>
                  <p className="text-2xl font-extrabold leading-none tabular-nums">{m.gap.total}</p>
                  <p className="text-[10px]">orang</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-5">
              {data.analisis.kualifikasi.map((k) => {
                const gap = Math.max(0, k.kebutuhan - k.tersedia);
                const rasio = k.kebutuhan ? Math.round((k.tersedia / k.kebutuhan) * 100) : 0;
                return (
                  <div key={k.kualifikasi} className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <p className="text-[11px] font-bold text-slate-700">{k.kualifikasi}</p>
                    <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
                      {k.tersedia} tersedia / {k.kebutuhan} butuh
                    </p>
                    <div className="mt-2">
                      <ProgressBar nilai={rasio} warna={rasio >= 90 ? '#15803d' : rasio >= 75 ? '#ca8a04' : '#b91c1c'} tinggi={6} />
                    </div>
                    <p className="text-[11px] mt-1.5 font-semibold text-slate-600">
                      {rasio}% ·{' '}
                      <span className={gap > 0 ? 'text-red-600' : 'text-emerald-600'}>
                        {gap > 0 ? `kurang ${gap}` : 'terpenuhi'}
                      </span>
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 leading-relaxed">
              <p>
                <span className="font-semibold text-slate-600">Rumus IKK:</span> (Tenaga Kerja Terlatih
                Bersertifikat ÷ Kebutuhan Tenaga Kerja Terlatih) × 100%
              </p>
              <p className="mt-1 font-mono">
                = {m.tkk.total} / {m.kebutuhan.total} × 100% = {m.ikk}%
              </p>
            </div>
          </div>
        </Kartu>

        {/* COMPOSISI RISIKO */}
        <Kartu>
          <KartuJudul judul="Komposisi Tingkat Risiko Proyek" sub={`${m.proyek.total} proyek dinilai`} />
          <div className="p-4">
            <GrafikDoughnut
              data={komposisiRisiko}
              tinggi={196}
              centerLabel={`${m.risiko.Tinggi + m.risiko.Ekstrem}`}
              centerSub="proyek berisiko"
            />
            <div className="grid grid-cols-2 gap-2 mt-3">
              {komposisiRisiko.map((c) => (
                <div key={c.name} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50">
                  <span className="flex items-center gap-1.5 text-[12px] font-medium text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
                    {c.name}
                  </span>
                  <span className="text-[12px] font-bold text-slate-800 tabular-nums">{c.value}</span>
                </div>
              ))}
            </div>
            <Link
              to="/risiko"
              className="mt-3 block text-center text-[12px] font-semibold text-gov-700 hover:underline py-2 rounded-lg bg-gov-50 hover:bg-gov-100 transition"
            >
              Lihat analisis risiko lengkap
            </Link>
          </div>
        </Kartu>

        {/* EARLY WARNING */}
        <Kartu className="flex flex-col">
          <KartuJudul
            judul="Early Warning"
            sub={`${per.total} peringatan dini aktif`}
            aksi={
              <Link to="/peringatan" className="text-[11px] font-semibold text-gov-700 hover:underline">
                Kelola
              </Link>
            }
          />
          <div className="grid grid-cols-4 gap-1.5 px-4 pt-3">
            {['Ekstrem', 'Tinggi', 'Sedang', 'Rendah'].map((l) => {
              const t = { Ekstrem: 'bg-red-50 text-red-700', Tinggi: 'bg-orange-50 text-orange-700', Sedang: 'bg-amber-50 text-amber-700', Rendah: 'bg-emerald-50 text-emerald-700' }[l];
              return (
                <div key={l} className={`rounded-lg py-2 text-center ${t}`}>
                  <p className="text-lg font-extrabold leading-none tabular-nums">{per.perLevel[l] || 0}</p>
                  <p className="text-[9px] font-bold uppercase mt-0.5">{l}</p>
                </div>
              );
            })}
          </div>
          <div className="flex-1 overflow-y-auto max-h-64 mt-2 px-2 pb-2">
            {data.peringatanTerbaru.length === 0 && <Kosong pesan="Tidak ada peringatan" />}
            {data.peringatanTerbaru.map((p) => (
              <Link
                key={p.kode}
                to="/peringatan"
                className="block px-2.5 py-2 rounded-lg hover:bg-slate-50 transition"
              >
                <div className="flex items-start gap-2">
                  <BadgeLevel level={p.level} size="xs" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-slate-700 leading-snug line-clamp-1">{p.judul}</p>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-snug">{p.pesan}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{p.indikator}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Kartu>
      </div>

      {/* BARIS 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Kartu className="xl:col-span-2">
          <KartuJudul judul="Sebaran Proyek & Risiko per Kecamatan" sub="Klik untuk melihat peta risiko" />
          <div className="p-4">
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.perKecamatan} margin={{ top: 8, right: 8, left: -18, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="kecamatan" tick={{ fontSize: 10 }} angle={-18} textAnchor="end" height={54} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Bar dataKey="berjalan" name="Berjalan" stackId="a" fill="#1447e1" radius={[0, 0, 0, 0]} />
                  <Bar
                    dataKey="berisiko"
                    name="Berisiko (T/Ekstrem)"
                    stackId="b"
                    fill="#ea580c"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar dataKey="jumlah_proyek" name="Total proyek" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
              {data.perKecamatan.map((k) => (
                <Link
                  key={k.kecamatan}
                  to={`/peta?kec=${encodeURIComponent(k.kecamatan)}`}
                  className="p-2.5 rounded-lg border border-slate-200 hover:border-gov-400 hover:bg-gov-50 transition"
                >
                  <p className="text-[11px] font-bold text-slate-700">{k.kecamatan}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{k.jumlah_proyek} proyek</p>
                  <p className="text-[11px] font-semibold text-gov-700 mt-0.5">{rupiahFmt(k.pagu, true)}</p>
                  {k.berisiko > 0 && (
                    <p className="text-[10px] font-semibold text-orange-600 mt-0.5">{k.berisiko} berisiko</p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </Kartu>

        <Kartu>
          <KartuJudul judul="Sebaran Proyek per Metode Pengadaan" />
          <div className="p-4">
            <GrafikBatang
              data={data.metode.map((x) => ({
                label: x.metode === 'Tidak Diisi' ? 'Tidak Diisi' : x.metode,
                nilai: x.n,
                pagu: rupiahFmt(x.pagu, true),
              }))}
              tinggi={220}
              horizontal
            />
            <div className="mt-2 space-y-1.5">
              {data.metode.slice(0, 3).map((x) => (
                <div key={x.metode} className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-600">{x.metode}</span>
                  <span className="font-semibold text-slate-800">{rupiahPenuh(x.pagu)}</span>
                </div>
              ))}
            </div>
          </div>
        </Kartu>
      </div>

      {/* BARIS 3 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Kartu className="xl:col-span-2">
          <KartuJudul
            judul="Aktivitas Supervisi Realtime"
            sub="Monitoring lapangan dari seluruh titik proyek"
            aksi={
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                <span className={`w-2 h-2 rounded-full ${terhubung ? 'bg-emerald-500 denyut' : 'bg-slate-300'}`} />
                {terhubung ? 'streaming' : 'terputus'}
              </span>
            }
          />
          {feed.length === 0 ? (
            <div className="px-4">
              <Kosong
                pesan="Belum ada aktivitas streaming"
                sub="Aktivitas supervisi lapangan akan muncul di sini secara otomatis"
              />
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
              {feed.map((f, i) => {
                const d = f.data?.supervisi || {};
                return (
                  <div key={i} className="px-4 py-3 hover:bg-slate-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[12px] font-bold text-slate-800 flex items-center gap-1.5">
                          <IkonLive className="w-3.5 h-3.5 text-gov-600" />
                          Supervisi {d.proyekKode}
                        </p>
                        <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-1">{d.proyek}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          {d.kecamatan && <Chip tone="slate">{d.kecamatan}</Chip>}
                          {f.data?.temuan && (
                            <Chip tone="red">
                              Temuan {f.data.temuan.tingkat}: {f.data.temuan.deskripsi?.slice(0, 46)}
                            </Chip>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-slate-400">{waktuRelatif(f.t)}</p>
                        <p className="text-[12px] font-bold text-slate-700 mt-0.5">{d.progres}%</p>
                        {f.data?.risiko && <BadgeLevel level={f.data.risiko.level} size="xs" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Kartu>

        <Kartu>
          <KartuJudul
            judul="Proyek Berpagu Terbesar"
            aksi={
              <Link to="/proyek" className="text-[11px] font-semibold text-gov-700 hover:underline">
                Semua
              </Link>
            }
          />
          <div className="divide-y divide-slate-100">
            {data.proyekPilihan.map((p) => (
              <Link
                key={p.kode}
                to={`/proyek?detail=${p.kode}`}
                className="block px-4 py-2.5 hover:bg-slate-50 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-slate-700 line-clamp-1">{p.nama}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {p.kode} · {p.kecamatan}
                    </p>
                  </div>
                  <p className="text-[12px] font-bold text-gov-700 shrink-0">{rupiahFmt(p.pagu, true)}</p>
                </div>
                <div className="mt-1.5">
                  <ProgressBar nilai={p.progres} warna="#1447e1" tinggi={5} />
                </div>
              </Link>
            ))}
          </div>
        </Kartu>
      </div>

      {/* BARIS 4 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kartu>
          <KartuJudul judul="Penyedia Jasa Konstruksi" />
          <div className="p-4 grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-slate-50">
              <p className="text-[11px] text-slate-500 font-semibold">Terdaftar</p>
              <p className="text-xl font-extrabold text-slate-900">{m.penyedia.total}</p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50">
              <p className="text-[11px] text-emerald-700 font-semibold">SBU terverifikasi</p>
              <p className="text-xl font-extrabold text-emerald-800">{m.penyedia.bersertifikat_sbu}</p>
            </div>
            <div className="p-3 rounded-lg bg-orange-50 col-span-2">
              <p className="text-[11px] text-orange-700 font-semibold">
                Perlu verifikasi ({m.penyedia.tanpa_sbu} penyedia)
              </p>
              <Link to="/penyedia" className="text-[12px] text-orange-800 font-semibold hover:underline">
                Lihat daftar →
              </Link>
            </div>
          </div>
        </Kartu>

        <Kartu>
          <KartuJudul judul="Temuan Pengawasan" />
          <div className="p-4 space-y-2">
            {[
              ['Total temuan', m.pengawasan.temuan_total, 'slate'],
              ['Masih terbuka', m.pengawasan.temuan_terbuka, 'red'],
              ['Tingkat ekstrem', m.pengawasan.temuan_ekstrem, 'red'],
              ['Catatan supervisi', m.pengawasan.catatan_supervisi, 'gov'],
            ].map(([l, v, t]) => (
              <div key={l} className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
                <span className="text-[12px] text-slate-600">{l}</span>
                <span
                  className={`text-[13px] font-bold tabular-nums ${
                    t === 'red' ? 'text-red-600' : t === 'gov' ? 'text-gov-700' : 'text-slate-800'
                  }`}
                >
                  {v}
                </span>
              </div>
            ))}
            <Link
              to="/pengawasan"
              className="block text-center text-[12px] font-semibold text-gov-700 hover:underline mt-2"
            >
              Kelola temuan →
            </Link>
          </div>
        </Kartu>

        <Kartu>
          <KartuJudul judul="Jenis Pekerjaan" />
          <div className="p-4 space-y-2 max-h-56 overflow-y-auto">
            {data.jenisPekerjaan.map((j) => (
              <div key={j.jenis_pekerjaan}>
                <div className="flex items-center justify-between text-[12px] mb-1">
                  <span className="text-slate-600 font-medium">{j.jenis_pekerjaan}</span>
                  <span className="text-slate-500 tabular-nums">{j.n} proyek</span>
                </div>
                <ProgressBar
                  nilai={(j.pagu / (data.jenisPekerjaan[0]?.pagu || 1)) * 100}
                  warna="#8b5cf6"
                  tinggi={5}
                />
                <p className="text-[10px] text-slate-400 mt-0.5 text-right">{rupiahFmt(j.pagu, true)}</p>
              </div>
            ))}
          </div>
        </Kartu>
      </div>
    </div>
  );
}

