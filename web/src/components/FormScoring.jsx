import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Chip } from './ui';
import { useApi } from '../lib/api';
import { useAuth } from '../lib/auth';

const TONE_SKOR = {
  1: 'bg-emerald-600 border-emerald-600 text-white',
  2: 'bg-amber-500 border-amber-500 text-white',
  3: 'bg-orange-500 border-orange-500 text-white',
  4: 'bg-red-600 border-red-600 text-white',
};

const LABEL_SKOR = { 1: 'Rendah', 2: 'Sedang', 3: 'Tinggi', 4: 'Sangat tinggi' };

const hariIni = () => new Date().toISOString().slice(0, 10);

function angka2(n) {
  return (Math.round((Number(n) + Number.EPSILON) * 100) / 100).toFixed(2).replace('.', ',');
}

export default function FormScoring({ buka, tutup, awal, meta, proyekList, onSaved }) {
  const { pengguna } = useAuth();
  const aspek = meta?.aspek || [];
  const klasifikasi = meta?.klasifikasi || [];

  const [form, setForm] = useState({
    proyek_id: '',
    pengawasan_id: '',
    tanggal: hariIni(),
    petugas: '',
    catatan: '',
    kesimpulan: '',
  });
  const [skor, setSkor] = useState({});
  const [detail, setDetail] = useState({});
  const [galat, setGalat] = useState('');
  const [pesan, setPesan] = useState('');
  const [kirim, setKirim] = useState(false);
  const bukaSebelumnya = useRef(false);

  const { data: pengawasan } = useApi(
    buka && form.proyek_id ? `/api/pengawasan?proyek=${form.proyek_id}&limit=100` : null
  );

  useEffect(() => {
    if (buka && !bukaSebelumnya.current) {
      if (awal) {
        setForm({
          proyek_id: String(awal.proyek_id || ''),
          pengawasan_id: awal.pengawasan_id ? String(awal.pengawasan_id) : '',
          tanggal: awal.tanggal || hariIni(),
          petugas: awal.petugas || pengguna?.nama || '',
          catatan: awal.catatan || '',
          kesimpulan: awal.kesimpulan || '',
        });
        setSkor(
          Object.fromEntries((awal.detail || []).map((d) => [d.kode, Number(d.skor) || 0]))
        );
        setDetail(
          Object.fromEntries(
            (awal.detail || []).map((d) => [
              d.kode,
              { catatan: d.catatan || '', bukti: d.bukti || '' },
            ])
          )
        );
      } else {
        setForm({
          proyek_id: '',
          pengawasan_id: '',
          tanggal: hariIni(),
          petugas: pengguna?.nama || '',
          catatan: '',
          kesimpulan: '',
        });
        setSkor({});
        setDetail({});
      }
      setGalat('');
      setPesan('');
      setKirim(false);
    }
    bukaSebelumnya.current = buka;
  }, [buka, awal, pengguna]);

  const hasil = useMemo(() => {
    const rows = aspek.map((a) => {
      const nilaiSkor = Number(skor[a.kode]) || 0;
      const nilai = nilaiSkor ? ((nilaiSkor - 1) / 3) * a.bobot : 0;
      return { ...a, skor: nilaiSkor, nilai };
    });
    const total = rows.reduce((t, r) => t + r.nilai, 0);
    const nilaiAkhir = Math.round((total + Number.EPSILON) * 100) / 100;
    const k = klasifikasi.find((x) => nilaiAkhir <= x.max) || klasifikasi[klasifikasi.length - 1] || {};
    return {
      rows,
      nilai: nilaiAkhir,
      kategori: k.kategori || '-',
      rekomendasi: k.rekomendasi || '',
      warna: k.warna || '#64748b',
      kritis: Number(skor.KESELAMATAN) === 4,
    };
  }, [aspek, klasifikasi, skor]);

  const ubah = (nama, nilai) => {
    setForm((f) => ({ ...f, [nama]: nilai }));
    setGalat('');
  };

  const ubahProyek = (id) => {
    setForm((f) => ({ ...f, proyek_id: id, pengawasan_id: '' }));
    setGalat('');
  };

  const ubahDetail = (kode, field, nilai) => {
    setDetail((d) => ({ ...d, [kode]: { ...(d[kode] || {}), [field]: nilai } }));
  };

  const simpan = async (e) => {
    e.preventDefault();
    setPesan('');
    if (!form.proyek_id) return setGalat('Pilih proyek yang akan dinilai.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.tanggal)) return setGalat('Tanggal penilaian tidak valid.');
    const belum = aspek.filter((a) => !Number(skor[a.kode]));
    if (belum.length) {
      return setGalat(`Lengkapi skor untuk: ${belum.map((a) => a.nama).join(', ')}.`);
    }
    setKirim(true);
    try {
      await onSaved({
        proyek_id: Number(form.proyek_id),
        pengawasan_id: form.pengawasan_id ? Number(form.pengawasan_id) : null,
        tanggal: form.tanggal,
        petugas: form.petugas,
        catatan: form.catatan,
        kesimpulan: form.kesimpulan,
        skor,
        detail,
      });
    } catch (err) {
      setPesan(err.message);
    } finally {
      setKirim(false);
    }
  };

  const daftarPengawasan = pengawasan?.items || [];

  return (
    <Modal
      buka={buka}
      tutup={tutup}
      judul={awal ? `Ubah Penilaian ${awal.kode}` : 'Penilaian Scoring Baru'}
      lebar="max-w-5xl"
    >
      <form onSubmit={simpan}>
        {(galat || pesan) && (
          <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-[12px] text-red-700">
            {galat || pesan}
          </div>
        )}

        <div
          className="rounded-xl border p-4 mb-4"
          style={{ borderColor: `${hasil.warna}55`, background: `${hasil.warna}0d` }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                Nilai akhir (live)
              </p>
              <p className="text-3xl font-extrabold tabular-nums" style={{ color: hasil.warna }}>
                {angka2(hasil.nilai)}
                <span className="text-sm font-semibold text-slate-400"> / 100</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Chip tone={hasil.kategori === 'Sangat tinggi' ? 'red' : hasil.kategori === 'Tinggi' ? 'amber' : 'slate'}>
                {hasil.kategori}
              </Chip>
              {hasil.kritis && <Chip tone="red">K3 kritis · tindak lanjut segera</Chip>}
            </div>
          </div>
          <p className="text-[11.5px] text-slate-600 mt-2">
            <span className="font-semibold">Rekomendasi:</span> {hasil.rekomendasi || 'Lengkapi skor aspek.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Proyek <span className="text-red-500">*</span>
            </label>
            <select
              value={form.proyek_id}
              onChange={(e) => ubahProyek(e.target.value)}
              className="input"
            >
              <option value="">Pilih proyek...</option>
              {proyekList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.kode} — {p.nama}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tanggal</label>
            <input
              type="date"
              value={form.tanggal}
              onChange={(e) => ubah('tanggal', e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Petugas</label>
            <input
              value={form.petugas}
              onChange={(e) => ubah('petugas', e.target.value)}
              className="input"
              placeholder="Nama petugas penilai"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Catatan pengawasan terkait (opsional)
            </label>
            <select
              value={form.pengawasan_id}
              onChange={(e) => ubah('pengawasan_id', e.target.value)}
              className="input"
              disabled={!form.proyek_id}
            >
              <option value="">Tidak dikaitkan</option>
              {daftarPengawasan.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.kode} · {p.tanggal}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Catatan penilaian
            </label>
            <textarea
              value={form.catatan}
              onChange={(e) => ubah('catatan', e.target.value)}
              rows={2}
              className="input resize-y"
              placeholder="Ringkasan kondisi dan dasar penilaian"
            />
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-end justify-between gap-2 mb-2">
            <div>
              <p className="text-[13px] font-bold text-slate-800">Skor 8 Aspek Risiko</p>
              <p className="text-[11px] text-slate-500">
                Skor 1 = kontribusi 0% · skor 4 = kontribusi penuh dari bobot aspek.
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {hasil.rows.map((a) => {
              const kritis = a.kode === 'KESELAMATAN' && a.skor === 4;
              return (
                <div
                  key={a.kode}
                  className={`rounded-xl border p-3 ${
                    kritis ? 'border-red-300 bg-red-50/40' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-bold text-slate-800">
                        {a.nama}
                        <span className="ml-2 text-[10.5px] font-semibold text-slate-500">
                          bobot {a.bobot}%
                        </span>
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{a.indikator}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-semibold uppercase text-slate-400">Kontribusi</p>
                      <p className="text-[13px] font-extrabold tabular-nums text-slate-800">
                        {angka2(a.nilai)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 mt-2.5">
                    {[1, 2, 3, 4].map((n) => {
                      const aktif = a.skor === n;
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setSkor((s) => ({ ...s, [a.kode]: n }))}
                          className={`rounded-lg border px-2 py-1.5 text-left transition ${
                            aktif
                              ? TONE_SKOR[n]
                              : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
                          }`}
                        >
                          <span className="block text-[13px] font-extrabold leading-none">{n}</span>
                          <span className={`block text-[9.5px] mt-0.5 ${aktif ? 'text-white/90' : 'text-slate-400'}`}>
                            {LABEL_SKOR[n]}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    <input
                      value={detail[a.kode]?.catatan || ''}
                      onChange={(e) => ubahDetail(a.kode, 'catatan', e.target.value)}
                      className="input !py-1.5 !text-[11.5px]"
                      placeholder="Catatan aspek (opsional)"
                    />
                    <input
                      value={detail[a.kode]?.bukti || ''}
                      onChange={(e) => ubahDetail(a.kode, 'bukti', e.target.value)}
                      className="input !py-1.5 !text-[11.5px]"
                      placeholder="Bukti / dokumen pendukung (opsional)"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1 mt-4">
            Kesimpulan (opsional)
          </label>
          <textarea
            value={form.kesimpulan}
            onChange={(e) => ubah('kesimpulan', e.target.value)}
            rows={2}
            className="input resize-y"
            placeholder="Kesimpulan penilaian; jika kosong memakai rekomendasi sistem"
          />
        </div>

        <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
          <button type="button" onClick={tutup} className="tombol-kedua">
            Batal
          </button>
          <button type="submit" disabled={kirim} className="tombol-utama">
            {kirim ? 'Menyimpan…' : 'Simpan Penilaian'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
