import { useState } from 'react';
import { Kartu, KartuJudul, Kosong, Memuat, ProgressBar } from '../components/ui';
import { GrafikBatang, GrafikDoughnut, GrafikGaris } from '../components/charts';
import { useApi } from '../lib/api';
import { rupiahFmt, rupiahPenuh } from '../lib/utils';
import { IkonUnduh } from '../components/icons';
import { unduh } from '../lib/api';

const DASHBOARD = [
  { key: 'proyek', label: 'Data Proyek' },
  { key: 'tenaga', label: 'Tenaga Kerja' },
  { key: 'penyedia', label: 'Penyedia Jasa' },
  { key: 'temuan', label: 'Temuan Supervisi' },
  { key: 'pengawasan', label: 'Catatan Supervisi' },
  { key: 'peringatan', label: 'Peringatan Dini' },
];

export default function Laporan() {
  const { data, loading } = useApi('/api/laporan/ringkasan');
  const { data: ring } = useApi('/api/dashboard');
  const [dasar, setDasar] = useState('semua');

  if (loading && !data) return <Memuat />;
  if (!data) return <Kosong pesan="Gagal memuat ringkasan laporan" />;

  const m = ring?.metrik || {};
  const ang = data.anggaran || {};
  const pj = data.proyek || {};
  const py = data.penyedia || {};
  const pw = data.pengawasan || {};
  const ikk = data.ikk || {};

  const perAturan = data.peringatan?.perAturan || [];
  const tren = (ring?.trenPeringatan || []).slice().reverse();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">{data.judul}</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            {data.meta.satuan_kerja} · Periode TA {data.meta.tahun} · Dibuat{' '}
            {new Date(data.generated_pada).toLocaleString('id-ID')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={dasar} onChange={(e) => setDasar(e.target.value)} className="input w-auto text-[12px]">
            <option value="semua">Semua data</option>
            {DASHBOARD.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => window.print()}
            className="tombol-sekunder"
            title="Cetak / simpan sebagai PDF"
          >
            Cetak
          </button>
        </div>
      </div>

      {/* RINGKASAN EKSEKUTIF */}
      <Kartu className="p-5">
        <p className="text-[10.5px] font-bold uppercase tracking-wider text-gov-700 mb-3">
          Ringkasan Eksekutif
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-[11px] text-slate-500">Total Proyek</p>
            <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{pj.total || 0}</p>
            <p className="text-[10.5px] text-slate-400 mt-0.5">
              {pj.berjalan || 0} berjalan · {pj.selesai || 0} selesai
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500">Nilai Pagu</p>
            <p className="text-2xl font-extrabold text-slate-900">{rupiahFmt(ang.pagu_total || 0, true)}</p>
            <p className="text-[10.5px] text-slate-400 mt-0.5">kontrak {rupiahFmt(ang.kontrak_total || 0, true)}</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500">IKK (target {ikk.target}%)</p>
            <p
              className="text-2xl font-extrabold tabular-nums"
              style={{ color: ikk.tercapai >= ikk.target ? '#15803d' : '#ea580c' }}
            >
              {ikk.tercapai}%
              <span className="text-sm">target {ikk.target}%</span>
            </p>
            <p className="text-[10.5px] text-slate-400 mt-0.5">gap {ikk.selisih} tenaga kerja</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500">Proyek Berisiko Tinggi/Ekstrem</p>
            <p className="text-2xl font-extrabold text-orange-600 tabular-nums">
              {(data.risiko?.Tinggi || 0) + (data.risiko?.Ekstrem || 0)}
            </p>
            <p className="text-[10.5px] text-slate-400 mt-0.5">dari {pj.total || 0} proyek</p>
          </div>
        </div>
      </Kartu>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Kartu className="p-4 lg:col-span-2">
          <p className="text-[12px] font-bold text-slate-700 mb-2">Realisasi Anggaran</p>
          <ProgressBar nilai={ang.realisasi || 0} tinggi={14} />
          <div className="flex justify-between text-[11px] text-slate-500 mt-1.5">
            <span>
              Realisasi <b className="text-slate-800">{rupiahPenuh(Math.round(ang.realisasi || 0))}</b>
            </span>
            <span>
              Pagu <b className="text-slate-800">{rupiahPenuh(Math.round(ang.pagu_total || 0))}</b>
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5">
            Realisasi fisik rata-rata proyek berjalan{' '}
            <b className="text-slate-800">
              {(ring?.perKecamatan || []).reduce((a, b) => a + b.progres_rata, 0) / ((ring?.perKecamatan || []).length || 1) || 0}%
            </b>
          </p>
        </Kartu>

        <Kartu className="p-4">
          <p className="text-[12px] font-bold text-slate-700 mb-2">Distribusi Risiko</p>
          <GrafikDoughnut
            tinggi={170}
            centerLabel={`${pj.total || 0}`}
            centerSub="proyek"
            data={[
              { label: 'Ekstrem', nilai: data.risiko?.Ekstrem || 0, warna: '#b91c1c' },
              { label: 'Tinggi', nilai: data.risiko?.Tinggi || 0, warna: '#ea580c' },
              { label: 'Sedang', nilai: data.risiko?.Sedang || 0, warna: '#ca8a04' },
              { label: 'Rendah', nilai: data.risiko?.Rendah || 0, warna: '#15803d' },
            ]}
          />
        </Kartu>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Kartu>
          <KartuJudul judul="Pagu per Kecamatan" sub="10 teratas" />
          <div className="p-4">
            <GrafikBatang
              data={(ring?.perKecamatan || []).map((k) => ({ label: k.kecamatan, nilai: Math.round(k.pagu / 1e6) }))}
              tinggi={220}
              horizontal
              formatterTooltip={(v) => [`Rp ${v} juta`, 'Pagu']}
            />
          </div>
        </Kartu>

        <Kartu>
          <KartuJudul judul="Tren Peringatan Dini" sub="30 hari terakhir" />
          <div className="p-4">
            {tren.length > 1 ? (
              <GrafikGaris
                data={tren.map((t) => ({ label: t.hari, Tinggi: t.tinggi, Sedang: t.sedang, Rendah: t.rendah }))}
                tinggi={220}
                linhas={[
                  { kunci: 'Tinggi', warna: '#ea580c' },
                  { kunci: 'Sedang', warna: '#ca8a04' },
                  { kunci: 'Rendah', warna: '#15803d' },
                ]}
              />
            ) : (
              <Kosong pesan="Data tren belum tersedia" />
            )}
          </div>
        </Kartu>
      </div>

      <Kartu>
        <KartuJudul judul="Ringkasan Kepatuhan" />
        <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <TabelRingkas
            judul="Tenaga Kerja"
            baris={[
              ['Tersedia', `${ikk.komponen?.tersedia || 0} orang`],
              ['Kebutuhan', `${ikk.komponen?.kebutuhan || 0} orang`],
              ['Gap', `${ikk.komponen?.gap || 0} orang`],
              ['IKK', `${ikk.tercapai}%`],
            ]}
          />
          <TabelRingkas
            judul="Penyedia Jasa"
            baris={[
              ['Terdaftar', `${py.total || 0} perusahaan`],
              ['SBU aktif', `${py.bersertifikat_sbu || 0} perusahaan`],
              ['Belum SBU', `${py.tanpa_sbu || 0} perusahaan`],
              ['Aktif', `${py.aktif || 0} perusahaan`],
            ]}
          />
          <TabelRingkas
            judul="Pengawasan"
            baris={[
              ['Catatan supervisi', `${pw.catatan_supervisi || 0} laporan`],
              ['Temuan total', `${pw.temuan_total || 0} temuan`],
              ['Belum ditutup', `${pw.temuan_terbuka || 0} temuan`],
              ['Tingkat ekstrem', `${pw.temuan_ekstrem || 0} temuan`],
            ]}
          />
          <TabelRingkas
            judul="Peringatan Dini"
            baris={[
              ['Total', `${data.peringatan?.total || 0} peringatan`],
              ['Tinggi + Ekstrem', `${(data.peringatan?.perLevel?.Tinggi || 0) + (data.peringatan?.perLevel?.Ekstrem || 0)} peringatan`],
              ['Belum dibaca', `${data.peringatan?.belumDibaca || 0} peringatan`],
              ['Aturan aktif', `${perAturan.length} indikator`],
            ]}
          />
        </div>
      </Kartu>

      <Kartu>
        <KartuJudul judul="Peringatan Dini per Indikator" sub="10 teratas" />
        <div className="p-4">
          <GrafikBatang data={perAturan.slice(0, 10).map((a) => ({ label: a.indikator, nilai: a.n }))} tinggi={230} horizontal />
        </div>
      </Kartu>

      <Kartu>
        <KartuJudul judul="Kesimpulan dan Rekomendasi" sub="Dihasilkan oleh DSS engine" />
        <div className="p-4 space-y-2">
          {(data.kesimpulan || []).map((k, i) => (
            <div key={i} className="flex gap-3 p-3 rounded-lg bg-slate-50">
              <span className="w-5 h-5 rounded-full bg-gov-700 text-white text-[10px] font-bold grid place-items-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              <p className="text-[12.5px] text-slate-700 leading-relaxed">{k}</p>
            </div>
          ))}
          {(!data.kesimpulan || data.kesimpulan.length === 0) && (
            <Kosong pesan="Belum ada kesimpulan" sub="Jalankan perhitungan ulang DSS engine" />
          )}
        </div>
      </Kartu>

      <Kartu>
        <KartuJudul judul="Unduh Data" sub="Format CSV untuk analisis lanjutan di Excel" />
        <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-2">
          {DASHBOARD.map((d) => (
            <button
              key={d.key}
              onClick={() => unduh(`/api/laporan/ekspor?format=csv&data=${d.key}`, `begasak-${d.key}.csv`)}
              className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-slate-200 hover:border-gov-400 hover:bg-gov-50 transition text-left"
            >
              <span className="text-[12px] font-semibold text-slate-700">{d.label}</span>
              <IkonUnduh className="w-4 h-4 text-gov-600" />
            </button>
          ))}
        </div>
      </Kartu>
    </div>
  );
}

function TabelRingkas({ judul, baris }) {
  return (
    <div>
      <p className="text-[12px] font-bold text-slate-800 mb-1.5">{judul}</p>
      <div className="space-y-1">
        {baris.map(([l, v]) => (
          <div key={l} className="flex justify-between text-[11.5px] border-b border-slate-100 pb-0.5">
            <span className="text-slate-500">{l}</span>
            <span className="font-semibold text-slate-800 tabular-nums">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}