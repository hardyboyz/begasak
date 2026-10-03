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
  Tab,
  Modal,
} from '../components/ui';
import { GrafikBatang, GrafikDoughnut } from '../components/charts';
import { api, useApi, useRealtime } from '../lib/api';
import { waktuRelatif, rupiahFmt } from '../lib/utils';
import { IkonLive, IkonUnduh, IkonRefresh } from '../components/icons';
import { TombolUnduh } from '../components/TombolUnduh';

const LEVEL = ['Semua', 'Ekstrem', 'Tinggi', 'Sedang', 'Rendah'];
const PER = [20, 50, 100];

export default function Peringatan() {
  const [level, setLevel] = useState('Semua');
  const [aturan, setAturan] = useState('');
  const [kec, setKec] = useState('Semua');
  const [halaman, setHalaman] = useState(1);
  const [per, setPer] = useState(20);
  const [detail, setDetail] = useState(null);
  const [cuaca, setCuaca] = useState(0);

  const { data: meta } = useApi('/api/meta');
  const { feed } = useRealtime({});

  useEffect(() => {
    const i = setInterval(() => setCuaca((c) => c + 1), 20000);
    return () => clearInterval(i);
  }, []);

  const params = new URLSearchParams({ limit: per, offset: (halaman - 1) * per });
  if (level !== 'Semua') params.set('level', level);
  if (aturan) params.set('indikator', aturan);
  if (kec !== 'Semua') params.set('kecamatan', kec);

  const { data, loading, reload } = useApi(`/api/peringatan?${params}`, [cuaca]);
  const st = data?.statistik || {};
  const perLevel = st.perLevel || {};
  const totalHal = Math.ceil((data?.total || 0) / per);

  const baru = feed.filter(
    (f) => f.tipe === 'peringatan-baru' || (f.tipe === 'monitoring' && f.data?.peringatan?.length)
  ).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <IkonLive className="w-6 h-6 text-red-500" />
            Early Warning System
          </h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Peringatan dini otomatis berbasis indikator kepatuhan, kapasitas, dan mutu pekerjaan
          </p>
        </div>
        <div className="flex items-center gap-2">
          {baru > 0 && (
            <span className="tombol-sekunder !bg-red-50 !text-red-700 !border-red-200 animate-pulse">
              {baru} baru
            </span>
          )}
          <button onClick={reload} className="tombol-sekunder">
            <IkonRefresh />
          </button>
          <TombolUnduh ke="/api/laporan/ekspor?format=csv&data=peringatan" nama="begasak-peringatan.csv">
            <IkonUnduh />
            Ekspor
          </TombolUnduh>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {['Ekstrem', 'Tinggi', 'Sedang', 'Rendah'].map((l) => {
          const tone = l === 'Ekstrem' ? 'red' : l === 'Tinggi' ? 'orange' : l === 'Sedang' ? 'amber' : 'emerald';
          return (
            <Statistik
              key={l}
              label={l}
              nilai={perLevel[l] || 0}
              satuan="peringatan"
              sub={l === 'Ekstrem' || l === 'Tinggi' ? 'Perlu tindakan segera' : 'Pantau berkala'}
              tone={tone}
            />
          );
        })}
        <Statistik
          label="Belum ditindaklanjuti"
          nilai={st.belumDibaca || 0}
          satuan="peringatan"
          sub={`Total ${st.total || 0} peringatan`}
          tone="slate"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Kartu className="p-4">
          <p className="text-[12px] font-bold text-slate-700 mb-2">Distribusi Level</p>
          <GrafikDoughnut
            tinggi={170}
            centerLabel={`${st.total || 0}`}
            centerSub="peringatan"
            data={[
              { label: 'Ekstrem', nilai: perLevel.Ekstrem || 0, warna: '#b91c1c' },
              { label: 'Tinggi', nilai: perLevel.Tinggi || 0, warna: '#ea580c' },
              { label: 'Sedang', nilai: perLevel.Sedang || 0, warna: '#ca8a04' },
              { label: 'Rendah', nilai: perLevel.Rendah || 0, warna: '#15803d' },
            ]}
          />
        </Kartu>
        <Kartu className="lg:col-span-2 p-4">
          <p className="text-[12px] font-bold text-slate-700 mb-2">Peringatan per Aturan</p>
          <GrafikBatang
            data={(st.perAturan || []).map((a) => ({ label: a.indikator, nilai: a.n }))}
            tinggi={180}
            horizontal
          />
        </Kartu>
      </div>

      <Kartu className="p-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="label">Level</label>
            <select className="input" value={level} onChange={(e) => { setLevel(e.target.value); setHalaman(1); }}>
              {LEVEL.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Kecamatan</label>
            <select className="input" value={kec} onChange={(e) => { setKec(e.target.value); setHalaman(1); }}>
              <option>Semua</option>
              {(meta?.kecamatan || []).map((k) => (
                <option key={k.nama}>{k.nama}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Aturan</label>
            <select className="input" value={aturan} onChange={(e) => { setAturan(e.target.value); setHalaman(1); }}>
              <option value="">Semua aturan</option>
              {(data?.aturan || []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.id} — {a.nama}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Baris per halaman</label>
            <select className="input" value={per} onChange={(e) => { setPer(+e.target.value); setHalaman(1); }}>
              {PER.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Kartu>

      {feed.length > 0 && (
        <Kartu>
          <KartuJudul judul="Aktivitas Realtime" sub="Peringatan dan supervisi baru dari simulator" />
          <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {feed.slice(0, 20).map((f, i) => {
              const supervisor = f.data?.supervisi;
              const peringatanBaru = f.data?.peringatan;
              const judul = peringatanBaru?.[0]?.judul || f.data?.temuan?.deskripsi || supervisor?.proyek || '';
              const ket =
                f.tipe === 'monitoring'
                  ? 'Supervisi lapangan'
                  : f.tipe === 'pengaduan-baru'
                    ? 'Pengaduan baru'
                    : 'Peringatan dini';
              return (
                <div key={i} className="px-4 py-2.5 flex items-start gap-3">
                  <span className="w-2 h-2 rounded-full bg-gov-500 mt-1.5 shrink-0 denyut" />
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-semibold text-slate-700">{ket}</p>
                    <p className="text-[11.5px] text-slate-500 truncate">{judul}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 ml-auto shrink-0">{waktuRelatif(f.t)}</span>
                </div>
              );
            })}
          </div>
        </Kartu>
      )}

      <Kartu>
        <KartuJudul
          judul="Daftar Peringatan"
          sub={data ? `${data.total} peringatan ditemukan` : ''}
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
                  <th>Kode</th>
                  <th>Level</th>
                  <th>Indikator</th>
                  <th>Pesan</th>
                  <th>Proyek</th>
                  <th className="text-right">Pagu</th>
                  <th>Waktu</th>
                  <th className="text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((p) => (
                  <tr key={p.id} className="cursor-pointer" onClick={() => setDetail(p)}>
                    <td className="font-mono text-[10.5px] text-slate-500">{p.kode}</td>
                    <td>
                      <BadgeLevel level={p.level} size="xs" />
                    </td>
                    <td>
                      <Chip tone="slate">{p.indikator}</Chip>
                    </td>
                    <td className="max-w-[360px]">
                      <p className="text-[12px] font-semibold text-slate-700 line-clamp-1">{p.judul}</p>
                      <p className="text-[11px] text-slate-500 line-clamp-2">{p.pesan}</p>
                    </td>
                    <td className="max-w-[200px]">
                      {p.proyek_kode ? (
                        <Link to={`/proyek?detail=${p.proyek_kode}`} className="text-[11.5px] text-gov-700 hover:underline line-clamp-1">
                          {p.proyek_nama}
                        </Link>
                      ) : (
                        <span className="text-[11.5px] text-slate-500 line-clamp-1">{p.kecamatan || 'Aggregat'}</span>
                      )}
                    </td>
                    <td className="text-right text-[11.5px]">{p.pagu ? rupiahFmt(p.pagu, true) : '-'}</td>
                    <td className="text-[11px] text-slate-500 whitespace-nowrap">{waktuRelatif(p.waktu)}</td>
                    <td className="text-center">
                      {p.ditindaklanjuti ? (
                        <Chip tone="emerald">Ditindaklanjuti</Chip>
                      ) : p.dibaca ? (
                        <Chip tone="amber">Dibaca</Chip>
                      ) : (
                        <Chip tone="red">Belum</Chip>
                      )}
                    </td>
                  </tr>
                ))}
                {data?.items.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <Kosong pesan="Tidak ada peringatan" sub="Semua indikator dalam batas aman" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Kartu>

      {detail && <ModalPeringatan p={detail} tutup={() => setDetail(null)} reload={reload} />}
    </div>
  );
}

function ModalPeringatan({ p, tutup, reload }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      buka
      tutup={tutup}
      lebar="max-w-2xl"
      judul={
        <span className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[11px] text-slate-400">{p.kode}</span>
          <span>{p.judul}</span>
          <BadgeLevel level={p.level} />
        </span>
      }
      footer={
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-slate-400">Sumber: {p.sumber} · Indikator {p.indikator}</p>
          <div className="flex gap-2">
            {!p.dibaca && (
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api.patch(`/api/peringatan/${p.id}`, { dibaca: 1 });
                    reload();
                    tutup();
                  } finally {
                    setBusy(false);
                  }
                }}
                className="tombol-sekunder"
              >
                Tandai dibaca
              </button>
            )}
            {!p.ditindaklanjuti && (
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api.patch(`/api/peringatan/${p.id}`, { dibaca: 1, ditindaklanjuti: 1 });
                    reload();
                    tutup();
                  } finally {
                    setBusy(false);
                  }
                }}
                className="tombol-utama"
              >
                {busy ? '...' : 'Tindaklanjuti'}
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="p-3 rounded-lg bg-slate-50 text-[12.5px] text-slate-700 leading-relaxed">{p.pesan}</div>
        <div className="grid grid-cols-2 gap-3 text-[12px]">
          <div>
            <p className="text-[10.5px] text-slate-500 font-semibold uppercase">Kategori</p>
            <p className="text-slate-800">{p.kategori}</p>
          </div>
          <div>
            <p className="text-[10.5px] text-slate-500 font-semibold uppercase">Kecamatan</p>
            <p className="text-slate-800">{p.kecamatan || 'Seluruh wilayah'}</p>
          </div>
          <div>
            <p className="text-[10.5px] text-slate-500 font-semibold uppercase">Waktu</p>
            <p className="text-slate-800">{p.waktu}</p>
          </div>
          <div>
            <p className="text-[10.5px] text-slate-500 font-semibold uppercase">Pagu</p>
            <p className="text-slate-800">{p.pagu ? rupiahFmt(p.pagu) : '-'}</p>
          </div>
        </div>
        {p.proyek_kode && (
          <Link to={`/proyek?detail=${p.proyek_kode}`} className="text-[12px] text-gov-700 font-semibold hover:underline">
            Lihat detail proyek {p.proyek_nama} →
          </Link>
        )}
      </div>
    </Modal>
  );
}