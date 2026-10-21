/**
 * Mesin scoring DSS BEGASAK — Lampiran II Berita Acara.
 *
 * Skor risiko tiap aspek 1–4. Skor 1 memberi kontribusi 0% dan skor 4
 * memberi kontribusi 100% dari bobot aspek:
 *
 *   nilai_aspek = ((skor - 1) / 3) × bobot
 *   nilai_akhir = Σ nilai_aspek
 *
 * Total dihitung dari nilai mentah, bukan dari nilai yang sudah dibulatkan,
 * agar contoh Berita Acara (50,00) tetap konsisten.
 */

export const ASPEK = [
  {
    kode: 'ADMINISTRASI',
    nama: 'Administrasi dan kontrak',
    indikator: 'Kelengkapan dokumen kontrak, jadwal, dan dokumen pelaksanaan',
    bobot: 10,
    urutan: 1,
  },
  {
    kode: 'KEMAJUAN_FISIK',
    nama: 'Kemajuan fisik',
    indikator: 'Kesesuaian progres fisik aktual dengan rencana',
    bobot: 20,
    urutan: 2,
  },
  {
    kode: 'MUTU',
    nama: 'Mutu pekerjaan',
    indikator: 'Kesesuaian material dan hasil pekerjaan dengan spesifikasi teknis',
    bobot: 20,
    urutan: 3,
  },
  {
    kode: 'WAKTU',
    nama: 'Waktu pelaksanaan',
    indikator: 'Potensi keterlambatan dan kesesuaian terhadap jadwal kontrak',
    bobot: 15,
    urutan: 4,
  },
  {
    kode: 'KEUANGAN',
    nama: 'Keuangan dan progres',
    indikator: 'Kesesuaian progres fisik dengan progres keuangan sesuai data yang tersedia',
    bobot: 10,
    urutan: 5,
  },
  {
    kode: 'KESELAMATAN',
    nama: 'Keselamatan konstruksi',
    indikator: 'Penerapan persyaratan keselamatan konstruksi sesuai jenis dan risiko pekerjaan',
    bobot: 10,
    urutan: 6,
  },
  {
    kode: 'LINGKUNGAN',
    nama: 'Lingkungan dan kondisi lapangan',
    indikator: 'Pengendalian dampak pekerjaan serta gangguan terhadap lingkungan sekitar',
    bobot: 5,
    urutan: 7,
  },
  {
    kode: 'DOKUMENTASI',
    nama: 'Dokumentasi dan pelaporan',
    indikator: 'Ketersediaan foto, laporan monitoring, dan tindak lanjut temuan',
    bobot: 10,
    urutan: 8,
  },
];

export const SKALA_SKOR = [1, 2, 3, 4];

export const KLASIFIKASI = [
  {
    min: 0,
    max: 25,
    kategori: 'Rendah',
    rekomendasi: 'Monitoring rutin sesuai jadwal',
    warna: '#15803d',
  },
  {
    min: 25,
    max: 50,
    kategori: 'Sedang',
    rekomendasi: 'Monitoring terarah dan tindak lanjut terhadap temuan',
    warna: '#ca8a04',
  },
  {
    min: 50,
    max: 75,
    kategori: 'Tinggi',
    rekomendasi: 'Peningkatan frekuensi monitoring dan rencana tindakan korektif',
    warna: '#ea580c',
  },
  {
    min: 75,
    max: 100,
    kategori: 'Sangat tinggi',
    rekomendasi: 'Prioritas pengawasan segera dan eskalasi kepada pejabat berwenang sesuai kondisi',
    warna: '#b91c1c',
  },
];

export const TOTAL_BOBOT = ASPEK.reduce((total, a) => total + a.bobot, 0);

export function bulat2(nilai) {
  return Math.round((Number(nilai) + Number.EPSILON) * 100) / 100;
}

/** Validasi seluruh 8 aspek; mengembalikan skor bersih dan daftar galat. */
export function validasiSkor(input) {
  const skor = {};
  const galat = [];
  for (const aspek of ASPEK) {
    const nilai = input?.[aspek.kode];
    if (nilai === undefined || nilai === null || nilai === '') {
      galat.push(`${aspek.nama} wajib diberi skor 1–4`);
      continue;
    }
    const angka = Number(nilai);
    if (!Number.isInteger(angka) || angka < 1 || angka > 4) {
      galat.push(`${aspek.nama} harus berupa bilangan bulat 1–4`);
      continue;
    }
    skor[aspek.kode] = angka;
  }
  return { skor, galat };
}

export function nilaiBerbobot(skor, bobot) {
  return ((Number(skor) - 1) / 3) * Number(bobot);
}

export function klasifikasi(nilai) {
  const n = Math.max(0, Math.min(100, Number(nilai) || 0));
  return KLASIFIKASI.find((k) => n <= k.max) || KLASIFIKASI[KLASIFIKASI.length - 1];
}

export function kategoriDariNilai(nilai) {
  return klasifikasi(nilai).kategori;
}

/**
 * Hitung nilai akhir dari peta skor `{ ADMINISTRASI: 2, ... }`.
 * `detailMap` opsional berisi catatan/bukti per aspek.
 */
export function hitungScoring(skorMap, detailMap = {}) {
  const detail = ASPEK.map((aspek) => {
    const skor = Number(skorMap?.[aspek.kode]);
    const nilaiMentah = nilaiBerbobot(skor, aspek.bobot);
    const tambahan = detailMap?.[aspek.kode] || {};
    return {
      kode: aspek.kode,
      nama: aspek.nama,
      indikator: aspek.indikator,
      bobot: aspek.bobot,
      urutan: aspek.urutan,
      skor,
      nilai: bulat2(nilaiMentah),
      catatan: tambahan.catatan ? String(tambahan.catatan) : '',
      bukti: tambahan.bukti ? String(tambahan.bukti) : '',
      _nilaiMentah: nilaiMentah,
    };
  });

  const nilaiMentah = detail.reduce((total, d) => total + d._nilaiMentah, 0);
  const nilaiAkhir = bulat2(nilaiMentah);
  const k = klasifikasi(nilaiAkhir);
  const kritis = Number(skorMap?.KESELAMATAN) === 4 ? 1 : 0;
  const rekomendasi = kritis
    ? `${k.rekomendasi}. Skor keselamatan konstruksi 4: tindak lanjut segera tanpa menunggu nilai akhir.`
    : k.rekomendasi;

  return {
    detail: detail.map(({ _nilaiMentah, ...d }) => d),
    nilai_akhir: nilaiAkhir,
    kategori: k.kategori,
    warna: k.warna,
    rekomendasi,
    kritis,
  };
}

/** Ringkasan aspek terburuk untuk deskripsi risiko proyek. */
export function aspekTerburuk(detail, minimal = 3) {
  return detail
    .filter((d) => d.skor >= minimal)
    .sort((a, b) => b.skor - a.skor || b.bobot - a.bobot)
    .map((d) => `${d.nama} (skor ${d.skor})`);
}
