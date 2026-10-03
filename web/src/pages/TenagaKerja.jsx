import { useState, useEffect } from 'react';
import {
  Kartu,
  KartuJudul,
  Chip,
  Kosong,
  Memuat,
  Statistik,
  ProgressBar,
  Tab,
} from '../components/ui';
import { GrafikDoughnut, GrafikBatang } from '../components/charts';
import { api, useApi } from '../lib/api';
import { useAuth } from '../lib/auth';
import { IkonCari, IkonUnduh, IkonTambah } from '../components/icons';
import { TombolUnduh } from '../components/TombolUnduh';
import { Formulir, Konfirmasi, AksiBaris } from '../components/Formulir';

const HAL = [25, 50, 100];

export default function TenagaKerja() {
  const { boleh } = useAuth();
  const [mode, setMode] = useState(null);
  const [sunting, setSunting] = useState(null);
  const [hapus, setHapus] = useState(null);
  const [sibuk, setSibuk] = useState(false);
  const [notif, setNotif] = useState('');

  const [q, setQ] = useState('');
  const [kual, setKual] = useState('');
  const [jenjang, setJenjang] = useState('');
  const [penerbit, setPenerbit] = useState('');
  const [jabatan, setJabatan] = useState('');
  const [halaman, setHalaman] = useState(1);
  const [per, setPer] = useState(25);
  const [tab, setTab] = useState('Semua');

  const { data: ring } = useApi('/api/dashboard');

  const params = new URLSearchParams({ limit: per, offset: (halaman - 1) * per });
  if (q) params.set('q', q);
  if (kual) params.set('kualifikasi', kual);
  if (jenjang) params.set('jenjang', jenjang);
  if (penerbit) params.set('penerbit', penerbit);
  if (jabatan) params.set('jabatan', jabatan);

  const { data, loading, reload } = useApi(`/api/tenaga-kerja?${params}`);
  const opsi = data?.opsi || {};

  useEffect(() => setHalaman(1), [q, kual, jenjang, penerbit, jabatan, per]);

  const FIELDS = [
    { nama: 'nama', label: 'Nama tenaga kerja', wajib: true, lebar: 'penuh' },
    { nama: 'kualifikasi', label: 'Kualifikasi', tipe: 'select', opsi: opsi.kualifikasi || [], hint: 'Kosongkan bila belum bersertifikat.' },
    { nama: 'jenjang', label: 'Jenjang', tipe: 'select', opsi: opsi.jenjang || [] },
    { nama: 'no_sertifikat', label: 'Nomor sertifikat', hint: 'Harus unik bila diisi.' },
    { nama: 'penerbit', label: 'Penerbit sertifikat', tipe: 'select', opsi: opsi.penerbit || [] },
    { nama: 'tahun_sertifikat', label: 'Tahun sertifikat', tipe: 'number', bintang: true, min: 1900 },
    { nama: 'jabatan_kerja', label: 'Jabatan kerja', tipe: 'select', opsi: opsi.jabatan || [] },
    { nama: 'jenis_pelatihan', label: 'Jenis pelatihan' },
    { nama: 'klasifikasi', label: 'Klasifikasi' },
    { nama: 'perusahaan_id', label: 'ID perusahaan penyedia', tipe: 'number', bintang: true, min: 0 },
    { nama: 'aktif', label: 'Aktif', tipe: 'checkbox', hint: 'Tenaga nonaktif tidak dapat dipilih untuk penugasan baru.' },
  ];

  const m = ring?.metrik || {};
  const tkk = m.tkk || {};
  const keb = m.kebutuhan || {};
  const gap = m.gap || {};
  const target = ring?.metrik?.ikk || 83.49;
  const totalHal = Math.ceil((data?.total || 0) / per);

  const komposisi = [
    { label: 'Operator', nilai: tkk.operator || 0, warna: '#1447e1' },
    { label: 'Teknisi/Analis', nilai: tkk.teknisi_analis || 0, warna: '#7c3aed' },
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
          <h1 className="text-xl font-extrabold text-slate-900">Tenaga Kerja Bersertifikat</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Rekapitulasi tenaga kerja sertifikat dan ketersediaannya terhadap kebutuhan proyek
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
          {boleh('tenaga:create') && (
            <button
              onClick={() => {
                setSunting(null);
                setMode('buat');
              }}
              className="tombol-utama"
            >
              <IkonTambah />
              Tambah Tenaga Kerja
            </button>
          )}
          <TombolUnduh ke="/api/laporan/ekspor?format=csv&data=tenaga" nama="begasak-tenaga-kerja.csv">
            <IkonUnduh />
            Ekspor
          </TombolUnduh>
        </div>
      </div>

      {/* IKK */}
      <Kartu className="p-4">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex-1 min-w-[240px]">
            <div className="flex items-end justify-between mb-1.5">
              <div>
                <p className="text-[12px] font-bold text-slate-800">Indeks Kompetensi Kerja (IKK)</p>
                <p className="text-[11px] text-slate-500">
                  Rasio tenaga bersertifikat terhadap total kebutuhan tenaga kerja
                </p>
              </div>
              <p className="text-2xl font-extrabold text-gov-700 tabular-nums">{m.ikk}%</p>
            </div>
            <div className="relative">
              <ProgressBar nilai={m.ikk || 0} tinggi={12} warna={m.ikk >= target ? '#15803d' : '#ea580c'} />
              <span
                className="absolute -top-1 text-[10px] font-bold text-slate-500"
                style={{ left: `${target}%` }}
              >
                target {target}%
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Kebutuhan <span className="font-bold text-slate-700">{keb.total || 0}</span> orang · tersedia{' '}
              <span className="font-bold text-slate-700">{tkk.total || 0}</span> orang bersertifikat · gap{' '}
              <span className="font-bold text-red-600">{gap.total || 0}</span> orang
            </p>
          </div>

          <div className="w-full sm:w-56">
            <GrafikDoughnut
              data={komposisi}
              tinggi={150}
              centerLabel={`${tkk.total || 0}`}
              centerSub="TKK"
            />
          </div>
        </div>
      </Kartu>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Statistik label="Total TKK" nilai={tkk.total || 0} satuan="orang" tone="gov" />
        <Statistik
          label="Operator"
          nilai={tkk.operator || 0}
          satuan="orang"
          sub={`Kebutuhan ${keb.operator || 0} · gap ${gap.operator || 0}`}
          tone="slate"
        />
        <Statistik
          label="Teknisi / Analis"
          nilai={tkk.teknisi_analis || 0}
          satuan="orang"
          sub={`Kebutuhan ${keb.teknisi_analis || 0} · gap ${gap.teknisi_analis || 0}`}
          tone="slate"
        />
        <Statistik
          label="Kesenjangan Kualifikasi"
          nilai={gap.total || 0}
          satuan="orang"
          sub="Perlu penambahan pelatihan/sertifikasi"
          tone={gap.total > 0 ? 'orange' : 'emerald'}
        />
      </div>

      <Kartu className="p-4">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2">
            <label className="label">Cari nama / no. sertifikat</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <IkonCari />
              </span>
              <input className="input pl-9" placeholder="nama atau nomor sertifikat" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Kualifikasi</label>
            <select className="input" value={kual} onChange={(e) => setKual(e.target.value)}>
              <option value="">Semua</option>
              {(opsi.kualifikasi || []).map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Jenjang</label>
            <select className="input" value={jenjang} onChange={(e) => setJenjang(e.target.value)}>
              <option value="">Semua</option>
              {(opsi.jenjang || []).map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Penerbit</label>
            <select className="input" value={penerbit} onChange={(e) => setPenerbit(e.target.value)}>
              <option value="">Semua</option>
              {(opsi.penerbit || []).map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
        </div>
        {(ring?.analisis?.perLsp || []).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 items-center">
            <span className="text-[11px] font-semibold text-slate-500">Lembaga:</span>
            {ring.analisis.perLsp.map((l, i) => (
              <button
                // Nama lembaga bisa berulang pada data nyata; index menjaga key tetap unik.
                key={`${l.penerbit || l.nama}-${i}`}
                onClick={() => setPenerbit(penerbit === (l.penerbit || l.nama) ? '' : l.penerbit || l.nama)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                  penerbit === (l.penerbit || l.nama)
                    ? 'bg-gov-700 text-white border-gov-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-gov-300'
                }`}
              >
                {l.penerbit || l.nama} ({l.n})
              </button>
            ))}
          </div>
        )}
      </Kartu>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Kartu className="lg:col-span-2">
          <KartuJudul
            judul="Daftar Tenaga Kerja"
            sub={data ? `${data.total} tenaga ditemukan` : ''}
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
                    <th>Nama</th>
                    <th>Kualifikasi</th>
                    <th>Sertifikat</th>
                    <th>Penerbit</th>
                    <th>Jabatan</th>
                    <th className="text-center">Ditugaskan</th>
                    <th className="text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((t) => (
                    <tr key={t.id}>
                      <td className="font-mono text-[10.5px] text-slate-500">{t.kode}</td>
                      <td className="max-w-[200px]">
                        <p className="text-[12.5px] font-semibold text-slate-800 line-clamp-1">{t.nama}</p>
                        {t.klasifikasi && (
                          <p className="text-[10.5px] text-slate-400 line-clamp-1">{t.klasifikasi}</p>
                        )}
                      </td>
                      <td>
                        <Chip tone={t.kualifikasi === 'Operator' ? 'gov' : 'violet'}>{t.kualifikasi}</Chip>
                      </td>
                      <td>
                        <p className="font-mono text-[10.5px] text-slate-600">{t.no_sertifikat}</p>
                        <p className="text-[10px] text-slate-400">
                          {t.jenjang} {t.tahun_sertifikat || ''}
                        </p>
                      </td>
                      <td className="text-[11.5px]">{t.penerbit}</td>
                      <td className="text-[11.5px] text-slate-600 max-w-[150px]">
                        <span className="line-clamp-1">{t.jabatan_kerja || '-'}</span>
                      </td>
                      <td className="text-center">
                        {t.proyek_aktif > 0 ? (
                          <Chip tone="emerald">{t.proyek_aktif}</Chip>
                        ) : (
                          <span className="text-slate-300 text-[12px]">0</span>
                        )}
                      </td>
                      <td>
                        <AksiBaris
                          boleh={boleh}
                          ubah={{
                            izin: 'tenaga',
                            jalankan: (x) => {
                              setSunting(x);
                              setMode('ubah');
                            },
                          }}
                          hapus={{ izin: 'tenaga', jalankan: (x) => setHapus(x) }}
                          target={t}
                        />
                      </td>
                    </tr>
                  ))}
                  {data?.items.length === 0 && (
                    <tr>
                      <td colSpan={8}>
                        <Kosong pesan="Tidak ada tenaga yang cocok" />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Kartu>

        <div className="space-y-4">
          <Kartu>
            <KartuJudul judul="Kebutuhan vs Ketersediaan" sub="Per kualifikasi tenaga kerja" />
            <div className="p-4 space-y-3">
              {(ring?.analisis?.kualifikasi || []).map((k) => {
                const rasio = k.kebutuhan ? (k.tersedia / k.kebutuhan) * 100 : 0;
                return (
                  <div key={k.kualifikasi}>
                    <div className="flex justify-between text-[12px] mb-1">
                      <span className="font-semibold text-slate-700">{k.kualifikasi}</span>
                      <span className="text-slate-500 tabular-nums">
                        {k.tersedia} / {k.kebutuhan} ({rasio.toFixed(0)}%)
                      </span>
                    </div>
                    <ProgressBar nilai={rasio} tinggi={8} warna={rasio >= 100 ? '#15803d' : '#ea580c'} />
                  </div>
                );
              })}
            </div>
          </Kartu>

          <Kartu>
            <KartuJudul judul="Sebaran per Jenjang" />
            <div className="p-4">
              <GrafikBatang
                data={(ring?.analisis?.perJenjang || []).map((j) => ({ label: j.jenjang, nilai: j.n }))}
                tinggi={200}
                horizontal
              />
            </div>
          </Kartu>

          <Kartu>
            <KartuJudul judul="Jabatan Kerja Terdaftar" sub="10 jabatan teratas" />
            <div className="p-4 space-y-1.5">
              {(ring?.analisis?.perJabatan || []).slice(0, 10).map((j) => (
                <div key={j.jabatan_kerja || j.label} className="flex justify-between gap-2 text-[11.5px]">
                  <span className="text-slate-600 truncate">{j.jabatan_kerja || j.label}</span>
                  <span className="font-bold text-slate-800 shrink-0">{j.n}</span>
                </div>
              ))}
              {(ring?.analisis?.perJabatan || []).length === 0 && (
                <p className="text-[11.5px] text-slate-400">Data jabatan tidak tersedia</p>
              )}
            </div>
          </Kartu>
        </div>
      </div>

      <Formulir
        buka={!!mode}
        tutup={() => setMode(null)}
        judul={mode === 'ubah' ? `Ubah ${sunting?.kode || 'Tenaga Kerja'}` : 'Tambah Tenaga Kerja'}
        fields={FIELDS}
        nilaiAwal={
          sunting
            ? Object.fromEntries(FIELDS.map((f) => [f.nama, sunting[f.nama] ?? '']))
            : { aktif: 1, tahun_sertifikat: '' }
        }
        onSimpan={async (nilai) => {
          if (mode === 'ubah') {
            await api.patch(`/api/tenaga-kerja/${sunting.id}`, nilai);
            setNotif(`Berhasil memperbarui ${sunting.kode}.`);
          } else {
            const j = await api.post('/api/tenaga-kerja', nilai);
            setNotif(`Berhasil menambah tenaga kerja ${j.tenaga.kode}.`);
          }
          reload();
        }}
      />

      <Konfirmasi
        buka={!!hapus}
        tutup={() => setHapus(null)}
        judul="Hapus tenaga kerja?"
        pesan={
          <>
            <b>{hapus?.kode}</b> · {hapus?.nama} akan dihapus. Penugasan pada proyek ikut terhapus
            ({hapus?.proyek_aktif || 0} penugasan).
          </>
        }
        sibuk={sibuk}
        onYa={async () => {
          setSibuk(true);
          try {
            await api.del(`/api/tenaga-kerja/${hapus.id}`);
            setNotif(`Berhasil menghapus ${hapus.kode}.`);
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