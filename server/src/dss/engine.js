import { db, audit } from '../db.js';

// ============================================================ UTILITAS
export const angka = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const hariAntara = (a, b) => {
  if (!a || !b) return null;
  const d1 = new Date(a + 'T00:00:00Z');
  const d2 = new Date(b + 'T00:00:00Z');
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return null;
  return Math.round((d2 - d1) / 86400000);
};

export const hariIni = () => new Date().toISOString().slice(0, 10);

export const BOBOT = {
  KETENAGA: 0.22,
  METODE: 0.08,
  KAPASITAS: 0.12,
  PROGRES: 0.2,
  TEMUAN: 0.2,
  K3: 0.12,
  PENGAWASAN: 0.06,
};

export function levelDariSkor(skor) {
  if (skor >= 75) return { level: 'Ekstrem', warna: '#b91c1c', aksi: 'Tindakan Koreksi Mendesak' };
  if (skor >= 50) return { level: 'Tinggi', warna: '#ea580c', aksi: 'Tindakan Koreksi Dipercepat' };
  if (skor >= 25) return { level: 'Sedang', warna: '#ca8a04', aksi: 'Perhatian & Pemantauan' };
  return { level: 'Rendah', warna: '#15803d', aksi: 'Pemantauan Routin' };
}

// ============================================================ INDIKATOR PROYEK
function hitungIndikator(proyek) {
  const id = proyek.id;
  const H = hariIni();

  const tkk = db
    .prepare("SELECT COUNT(*) n FROM penugasan WHERE proyek_id=? AND status='Aktif'")
    .get(id);
  const tkkTA = db
    .prepare(
      `SELECT COUNT(*) n FROM penugasan p JOIN tenaga_kerja t ON t.id=p.tenaga_id
       WHERE p.proyek_id=? AND p.status='Aktif' AND t.kualifikasi='Teknisi/Analis'`
    )
    .get(id);
  const k3 = db
    .prepare(
      `SELECT COUNT(*) n FROM penugasan p JOIN tenaga_kerja t ON t.id=p.tenaga_id
       WHERE p.proyek_id=? AND p.status='Aktif' AND lower(t.jabatan_kerja) LIKE '%keselamatan%'`
    )
    .get(id);

  const tem = db
    .prepare(
      `SELECT COUNT(*) total,
              SUM(CASE WHEN status NOT IN ('Ditutup','Selesai') THEN 1 ELSE 0 END) terbuka,
              SUM(CASE WHEN tingkat='Ekstrem' THEN 1 ELSE 0 END) ekstrem,
              SUM(CASE WHEN tingkat='Tinggi' THEN 1 ELSE 0 END) tinggi,
              SUM(CASE WHEN kategori='K3' AND status NOT IN ('Ditutup','Selesai') THEN 1 ELSE 0 END) k3_terbuka,
              SUM(CASE WHEN status NOT IN ('Ditutup','Selesai') AND tenggat IS NOT NULL
                        AND date(tenggat) < date('now') THEN 1 ELSE 0 END) lewat_tenggat
       FROM temuan WHERE proyek_id=?`
    )
    .get(id);

  const peng = db
    .prepare('SELECT MAX(tanggal) terakhir, COUNT(*) jumlah FROM pengawasan WHERE proyek_id=?')
    .get(id);

  const penyedia = proyek.penyedia_id
    ? db.prepare('SELECT * FROM penyedia_jasa WHERE id=?').get(proyek.penyedia_id)
    : null;

  const progres = angka(proyek.progres);
  const mulai = proyek.tanggal_mulai;
  const selesai = proyek.tanggal_rencana_selesai;
  const durasi = mulai && selesai ? hariAntara(mulai, selesai) : null;
  const berjalan = mulai ? hariAntara(mulai, H) : null;
  const progresHarapan =
    durasi && durasi > 0 && berjalan !== null
      ? Math.min(100, Math.max(0, Math.round((Math.min(berjalan, durasi) * 100) / durasi)))
      : progres;

  return {
    tkk_ditugaskan: angka(tkk.n),
    tkk_teknisi_analis: angka(tkkTA.n),
    ada_k3: angka(k3.n) > 0,
    temuan_total: angka(tem.total),
    temuan_terbuka: angka(tem.terbuka),
    temuan_ekstrem: angka(tem.ekstrem),
    temuan_tinggi: angka(tem.tinggi),
    k3_terbuka: angka(tem.k3_terbuka),
    temuan_lewat_tenggat: angka(tem.lewat_tenggat),
    terakhir_pengawasan: peng.terakhir || null,
    hari_terakhir_pengawasan: peng.terakhir ? hariAntara(peng.terakhir, H) : null,
    jumlah_pengawasan: angka(peng.jumlah),
    penyedia,
    progres_harapan: progresHarapan,
    deviasi_progres: progres - progresHarapan,
    hari_berjalan: berjalan,
    durasi,
    hari_lewat_rencana:
      proyek.status !== 'Selesai' && selesai ? Math.max(0, hariAntara(selesai, H) || 0) : 0,
  };
}

// ============================================================ SKOR RISIKO
export function skorProyek(proyek) {
  const ind = hitungIndikator(proyek);
  const d = [];

  const butuh = angka(proyek.jumlah_tenaga);
  const ckr = butuh ? ind.tkk_ditugaskan / butuh : 1;
  const sKetenaga = butuh === 0 ? 15 : Math.round((1 - Math.min(1, ckr)) * 100);
  d.push({
    kode: 'KETENAGA',
    label: 'Kesesuaian Tenaga Bersertifikat',
    nilai: sKetenaga,
    catatan: `${ind.tkk_ditugaskan}/${butuh} orang (CKR ${Math.round(Math.min(1, ckr) * 100)}%)`,
  });

  const m = String(proyek.metode_pengadaan || '').trim().toLowerCase();
  let sMetode = 90;
  if (m.includes('langsung')) sMetode = angka(proyek.pagu) > 5e8 ? 70 : 45;
  else if (m.includes('tender') || m.includes('seleksi')) sMetode = 20;
  else if (m.includes('dikecualikan')) sMetode = 75;
  else if (m.includes('e-katalog') || m.includes('katalog')) sMetode = 30;
  d.push({
    kode: 'METODE',
    label: 'Risiko Metode Pengadaan',
    nilai: sMetode,
    catatan: proyek.metode_pengadaan || 'Tidak Diisi',
  });

  let sKap = 55;
  let catKap = 'Penyedia jasa belum ditugaskan';
  if (ind.penyedia) {
    const kap = Math.max(1, angka(ind.penyedia.skor_kemampuan));
    const miliar = angka(proyek.pagu) / 1e9;
    const syaratMin = miliar >= 3 ? 4 : miliar >= 1 ? 3 : 2;
    sKap = Math.round(Math.max(0, Math.min(100, (syaratMin / kap) * 55)));
    catKap = `${ind.penyedia.badan_usaha} · kualifikasi ${ind.penyedia.kualifikasi} untuk pagu Rp ${miliar.toFixed(2)} M`;
  }
  d.push({ kode: 'KAPASITAS', label: 'Kesesuaian Kapasitas Penyedia', nilai: sKap, catatan: catKap });

  const deviasiAbs = Math.abs(ind.deviasi_progres);
  const sProgres = proyek.status === 'Selesai' ? 5 : Math.round(Math.min(100, deviasiAbs * 2.2));
  d.push({
    kode: 'PROGRES',
    label: 'Deviasi Progres Fisik',
    nilai: sProgres,
    catatan: `Rencana ${ind.progres_harapan}% · realisasi ${proyek.progres}% (${ind.deviasi_progres >= 0 ? '+' : ''}${ind.deviasi_progres}%)`,
  });

  const sTemuan = Math.round(
    Math.min(100, ind.temuan_ekstrem * 40 + ind.temuan_tinggi * 20 + ind.temuan_terbuka * 7)
  );
  d.push({
    kode: 'TEMUAN',
    label: 'Beban Temuan Pengawasan',
    nilai: sTemuan,
    catatan: `${ind.temuan_terbuka} terbuka dari ${ind.temuan_total} (${ind.temuan_ekstrem} ekstrem, ${ind.temuan_tinggi} tinggi)`,
  });

  const sK3 = Math.round(Math.min(100, (ind.ada_k3 ? 0 : 65) + ind.k3_terbuka * 18));
  d.push({
    kode: 'K3',
    label: 'Keselamatan & Kesehatan Kerja',
    nilai: sK3,
    catatan: ind.ada_k3 ? 'Tenaga K3 bersertifikat tersedia' : 'Belum ada tenaga K3 bersertifikat',
  });

  let sPeng = 30;
  let catPeng = 'Belum ada riwayat supervisi lapangan';
  if (ind.hari_terakhir_pengawasan !== null) {
    const h = ind.hari_terakhir_pengawasan;
    sPeng = h > 30 ? 90 : h > 14 ? 65 : h > 7 ? 40 : 15;
    catPeng = `Supervisi terakhir ${h} hari lalu`;
  }
  d.push({ kode: 'PENGAWASAN', label: 'Frekuensi Supervisi Lapangan', nilai: sPeng, catatan: catPeng });

  const totalBobot = Object.values(BOBOT).reduce((a, b) => a + b, 0);
  const skor = Math.round(
    Math.min(100, Math.max(0, d.reduce((a, x) => a + x.nilai * (BOBOT[x.kode] || 0), 0) / totalBobot))
  );
  const lv = levelDariSkor(skor);
  return { skor, level: lv.level, warna: lv.warna, aksi: lv.aksi, detail: d, indikator: ind };
}

// ============================================================ ATURAN EARLY WARNING
const det = (s, kode) => s.detail.find((x) => x.kode === kode);

export const ATURAN_EW = [
  {
    id: 'EW-01',
    nama: 'Progres Fisik Tertinggal dari Jadwal',
    level: (p, s) => (s.indikator.deviasi_progres <= -20 ? 'Tinggi' : 'Sedang'),
    cek: (p, s) => p.status === 'Berjalan' && s.indikator.deviasi_progres <= -10,
    pesan: (p, s) =>
      `Progres fisik ${p.progres}% tertinggal ${Math.abs(s.indikator.deviasi_progres)} poin dari jadwal (rencana ${s.indikator.progres_harapan}%).`,
    mitigasi: 'Minta pembaruan jadwal kerja dari PPK dan tambah alokasi tenaga bersertifikat.',
  },
  {
    id: 'EW-02',
    nama: 'Proyek Melewati Jadwal Penyelesaian',
    level: () => 'Ekstrem',
    cek: (p, s) => s.indikator.hari_lewat_rencana > 0,
    pesan: (p, s) =>
      `Rencana selesai ${p.tanggal_rencana_selesai} telah terlewat ${s.indikator.hari_lewat_rencana} hari tanpa penyelesaian.`,
    mitigasi: 'Evaluasi kinerja penyedia dan proses perpanjangan kontrak melalui PPK.',
  },
  {
    id: 'EW-03',
    nama: 'Temuan K3 Belum Ditutup',
    level: (p, s) => (s.indikator.k3_terbuka >= 3 ? 'Tinggi' : 'Sedang'),
    cek: (p, s) => s.indikator.k3_terbuka > 0,
    pesan: (p, s) => `${s.indikator.k3_terbuka} temuan keselamatan & kesehatan kerja masih terbuka.`,
    mitigasi: 'Terapkan stop work pada pekerjaan berisiko sampai temuan ditutup.',
  },
  {
    id: 'EW-04',
    nama: 'Tenaga Kerja Belum Bersertifikat',
    level: (p, s) => (det(s, 'KETENAGA').nilai >= 50 ? 'Tinggi' : 'Sedang'),
    cek: (p, s) => angka(p.jumlah_tenaga) > 0 && det(s, 'KETENAGA').nilai > 0,
    pesan: (p, s) => det(s, 'KETENAGA').catatan,
    mitigasi: 'Wajibkan penyedia menyertakan tenaga bersertifikat atau undertaking pelatihan pra-konstruksi.',
  },
  {
    id: 'EW-05',
    nama: 'Penyedia Jasa Tanpa SBU Terverifikasi',
    level: () => 'Tinggi',
    cek: (p, s) => Boolean(s.indikator.penyedia) && !s.indikator.penyedia.sbu_aktif,
    pesan: (p, s) => `${s.indikator.penyedia.nama} belum memiliki SBU aktif / kualifikasi terverifikasi.`,
    mitigasi: 'Tahan pencairan termin pembayaran sampai legalitas SBU terpenuhi.',
  },
  {
    id: 'EW-06',
    nama: 'Kapasitas Penyedia Tidak Sebanding dengan Pagu',
    level: () => 'Tinggi',
    cek: (p, s) => det(s, 'KAPASITAS').nilai >= 60,
    pesan: (p, s) => det(s, 'KAPASITAS').catatan,
    mitigasi: 'Evaluasi track record dan pertimbangkan pengawas independen tambahan.',
  },
  {
    id: 'EW-07',
    nama: 'Supervisi Lapangan Terlambat',
    level: (p, s) => (s.indikator.hari_terakhir_pengawasan > 30 ? 'Tinggi' : 'Sedang'),
    cek: (p, s) => s.indikator.hari_terakhir_pengawasan !== null && s.indikator.hari_terakhir_pengawasan > 14,
    pesan: (p, s) => `Supervisi lapangan terakhir ${s.indikator.hari_terakhir_pengawasan} hari lalu.`,
    mitigasi: 'Jadwalkan supervisi lapangan dan perbarui data pelaporan harian.',
  },
  {
    id: 'EW-08',
    nama: 'Pengadaan Langsung pada Nilai Besar',
    level: () => 'Tinggi',
    cek: (p) =>
      String(p.metode_pengadaan || '').toLowerCase().includes('langsung') && angka(p.pagu) > 5e8,
    pesan: (p) =>
      `Pengadaan Langsung dengan pagu Rp ${Math.round(angka(p.pagu) / 1e6).toLocaleString('id-ID')} juta.`,
    mitigasi: 'Tinjau justifikasi metode dan daya saing; pastikan ada berita acara pengadaan.',
  },
  {
    id: 'EW-09',
    nama: 'Temuan Berat Belum Ditutup',
    level: (p, s) => (s.indikator.temuan_ekstrem > 0 ? 'Ekstrem' : 'Tinggi'),
    cek: (p, s) => s.indikator.temuan_ekstrem + s.indikator.temuan_tinggi > 0,
    pesan: (p, s) =>
      `${s.indikator.temuan_ekstrem + s.indikator.temuan_tinggi} temuan tingkat tinggi/ekstrem masih terbuka.`,
    mitigasi: 'Prioritaskan koreksi dan verifikasi penutupan temuan oleh pengawas independen.',
  },
  {
    id: 'EW-10',
    nama: 'Nilai Kontrak Melebihi Pagu',
    level: () => 'Tinggi',
    cek: (p) => angka(p.pagu) > 0 && angka(p.nilai_kontrak) > angka(p.pagu),
    pesan: (p) =>
      `Nilai kontrak Rp ${Math.round(angka(p.nilai_kontrak)).toLocaleString('id-ID')} melebihi pagu Rp ${Math.round(angka(p.pagu)).toLocaleString('id-ID')}.`,
    mitigasi: 'Verifikasi dasar hukum perubahan nilai dan lakukan review sebelum pencairan.',
  },
  {
    id: 'EW-11',
    nama: 'Proyek Tanpa Riwayat Supervisi',
    level: () => 'Tinggi',
    cek: (p, s) => p.status === 'Berjalan' && s.indikator.jumlah_pengawasan === 0,
    pesan: () => 'Proyek berjalan tanpa satu pun catatan supervisi lapangan.',
    mitigasi: 'Lakukan supervisi lapangan pertama dan bangun basis data pemantauan.',
  },
  {
    id: 'EW-12',
    nama: 'Temuan Lewat Tenggat Closure',
    level: () => 'Tinggi',
    cek: (p, s) => s.indikator.temuan_lewat_tenggat > 0,
    pesan: (p, s) => `${s.indikator.temuan_lewat_tenggat} temuan melewati tenggat penyelesaian.`,
    mitigasi: 'Eskalasi kepada Leader Proyek dan threaten penghentian kerja bila tidak ada progres.',
  },
  {
    id: 'EW-13',
    nama: 'Keluhan Masyarakat Belum Ditangani',
    level: (p) => 'Tinggi',
    cek: (p) => {
      const r = db
        .prepare("SELECT COUNT(*) n FROM pengaduan WHERE proyek_id=? AND status NOT IN ('Selesai','Ditolak')")
        .get(p.id);
      return angka(r.n) > 0;
    },
    pesan: () => 'Terdapat keluhan masyarakat terkait proyek ini yang belum selesai ditangani.',
    mitigasi: 'Berikan respons cepat dan susun rencana tindak lanjut yang terukur.',
  },
];

export const ATURAN_AGGREGAT = [
  {
    id: 'EW-A1',
    nama: 'Kesenjangan Pasokan vs Permintaan Tenaga Bersertifikat',
    level: 'Tinggi',
    cek: (m) => m.gap_total > 0,
    pesan: (m) =>
      `Kebutuhan tenaga kerja terlatih ${m.kebutuhan_total} orang, baru tersedia ${m.tersedia_total} bersertifikat. Kekurangan ${m.gap_total} orang (IKK ${m.ikk}%).`,
    mitigasi: 'Koordinasi pelatihan dan sertifikasi bersama LSP serta dunia usaha.',
  },
  {
    id: 'EW-A2',
    nama: 'Kecamatan Tanpa Proyek Termonitor',
    level: 'Sedang',
    cek: (m) => m.kecamatan_tanpa_proyek > 0,
    pesan: (m) => `${m.kecamatan_tanpa_proyek} kecamatan tidak memiliki proyek dalam Surveillance aktif.`,
    mitigasi: 'Verifikasi kelengkapan data engineering dan rincian rencana pekerjaan.',
  },
  {
    id: 'EW-A3',
    nama: 'Konsentrasi Metode Pengadaan Langsung',
    level: () => 'Sedang',
    cek: (m) => m.persen_langsung > 60,
    pesan: (m) =>
      `${m.persen_langsung.toFixed(1)}% proyek menggunakan Pengadaan Langsung. Risiko rendahnya tingkat persaingan dan efisiensi.`,
    mitigasi: 'Evaluasi ambang batas nilai pengadaan dan tingkat persaingan.',
  },
  {
    id: 'EW-A4',
    nama: 'Penyedia Jasa Tidak Terverifikasi',
    level: () => 'Tinggi',
    cek: (m) => m.penyedia_tanpa_sbu > 0,
    pesan: (m) => `${m.penyedia_tanpa_sbu} penyedia jasa belum memiliki SBU/kualifikasi terverifikasi.`,
    mitigasi: 'Verifikasi legalitas perusahaan sebelum penetapan penyedia.',
  },
];

// ============================================================ AGREGASI NASIONAL
export function metrik() {
  const satu = (sql, ...p) => angka(db.prepare(sql).get(...p)?.n);
  const tkk = satu("SELECT COUNT(*) n FROM tenaga_kerja WHERE bersertifikat=1");
  const tkkOp = satu("SELECT COUNT(*) n FROM tenaga_kerja WHERE bersertifikat=1 AND kualifikasi='Operator'");
  const tkkTA = satu("SELECT COUNT(*) n FROM tenaga_kerja WHERE bersertifikat=1 AND kualifikasi='Teknisi/Analis'");
  const kebOp = satu('SELECT SUM(operator) n FROM proyek');
  const kebTA = satu('SELECT SUM(teknisi_analis) n FROM proyek');
  const kebTotal = satu('SELECT SUM(jumlah_tenaga) n FROM proyek');
  const pagu = db.prepare('SELECT SUM(pagu) n FROM proyek').get()?.n || 0;
  const proyekTotal = satu('SELECT COUNT(*) n FROM proyek');
  const berjalan = satu("SELECT COUNT(*) n FROM proyek WHERE status='Berjalan'");
  const selesai = satu("SELECT COUNT(*) n FROM proyek WHERE status='Selesai'");
  const belum = satu("SELECT COUNT(*) n FROM proyek WHERE status IN ('Belum Mulai','Disiapkan')");
  const peny = satu('SELECT COUNT(*) n FROM penyedia_jasa');
  const penyAktif = satu("SELECT COUNT(*) n FROM penyedia_jasa WHERE status='Aktif'");
  const penySbu = satu('SELECT COUNT(*) n FROM penyedia_jasa WHERE sbu_aktif=1');
  const temuTotal = satu('SELECT COUNT(*) n FROM temuan');
  const temuBuka = satu("SELECT COUNT(*) n FROM temuan WHERE status NOT IN ('Ditutup','Selesai')");
  const pengTotal = satu('SELECT COUNT(*) n FROM pengawasan');

  const gapTotal = Math.max(0, kebTotal - tkk);
  const level = db.prepare('SELECT level, COUNT(*) n FROM risiko GROUP BY level').all();
  const perLevel = { Rendah: 0, Sedang: 0, Tinggi: 0, Ekstrem: 0 };
  level.forEach((r) => {
    perLevel[r.level] = angka(r.n);
  });

  return {
    tkk: { total: tkk, operator: tkkOp, teknisi_analis: tkkTA },
    kebutuhan: { operator: kebOp, teknisi_analis: kebTA, total: kebTotal },
    gap: {
      total: gapTotal,
      operator: Math.max(0, kebOp - tkkOp),
      teknisi_analis: Math.max(0, kebTA - tkkTA),
    },
    ikk: kebTotal ? Number(((tkk / kebTotal) * 100).toFixed(2)) : 0,
    ckr: kebTotal ? Number(((tkk / kebTotal) * 100).toFixed(2)) : 0,
    proyek: { total: proyekTotal, berjalan, selesai, belum_mulai: belum },
    anggaran: {
      pagu_total: Number(pagu),
      kontrak_total: Number(db.prepare('SELECT SUM(nilai_kontrak) n FROM proyek').get()?.n || 0),
      realisasi: Number(db.prepare('SELECT SUM(nilai_kontrak*progres/100) n FROM proyek').get()?.n || 0),
    },
    penyedia: {
      total: peny,
      aktif: penyAktif,
      bersertifikat_sbu: penySbu,
      tanpa_sbu: satu('SELECT COUNT(*) n FROM penyedia_jasa WHERE sbu_aktif=0'),
    },
    pengawasan: {
      temuan_total: temuTotal,
      temuan_terbuka: temuBuka,
      temuan_ekstrem: satu("SELECT COUNT(*) n FROM temuan WHERE tingkat='Ekstrem'"),
      catatan_supervisi: pengTotal,
    },
    risiko: perLevel,
  };
}

// ============================================================ HITUNG ULANG
export function hitungUlang({ denganPeringatan = true } = {}) {
  const proyek = db.prepare('SELECT * FROM proyek').all();
  const up = db.prepare(
    `INSERT INTO risiko(kode, proyek_id, kategori, deskripsi, probabilitas, dampak, skor, level, mitigasi, sumber)
     VALUES(@kode, @proyek_id, @kategori, @deskripsi, @probabilitas, @dampak, @skor, @level, @mitigasi, 'DSS Engine')
     ON CONFLICT(kode) DO UPDATE SET kategori=excluded.kategori, deskripsi=excluded.deskripsi,
       probabilitas=excluded.probabilitas, dampak=excluded.dampak, skor=excluded.skor,
       level=excluded.level, mitigasi=excluded.mitigasi`
  );
  let n = 0;
  const tx = db.transaction(() => {
    for (const p of proyek) {
      const s = skorProyek(p);
      const prob = Math.max(1, Math.min(5, Math.ceil(s.skor / 20)));
      const damp = Math.max(1, Math.min(5, Math.ceil(angka(p.pagu) / 5e8)));
      up.run({
        kode: `RSK-${p.kode}`,
        proyek_id: p.id,
        kategori: s.level,
        deskripsi:
          s.detail
            .filter((x) => x.nilai >= 40)
            .map((x) => `${x.label}: ${x.catatan}`)
            .join(' | ') || 'Seluruh indikator risiko berada dalam batas wajar.',
        probabilitas: prob,
        dampak: damp,
        skor: prob * damp,
        level: s.level,
        mitigasi: s.detail
          .filter((x) => x.nilai >= 50)
          .map((x) => x.label)
          .join('; ') || 'Pemantauan rutin',
      });
      n++;
    }
  });
  tx();
  const per = denganPeringatan ? regeneratePeringatan() : 0;
  audit('dss-engine', 'hitung-ulang', 'risiko', null, { proyek: n, peringatan: per });
  return { proyek: n, peringatan: per };
}

function regeneratePeringatan() {
  const proyek = db.prepare('SELECT * FROM proyek').all();
  const ins = db.prepare(
    `INSERT INTO peringatan(kode, judul, pesan, level, kategori, proyek_id, kecamatan, sumber, indikator, waktu)
     VALUES(@kode, @judul, @pesan, @level, 'DSS Engine', @proyek_id, @kecamatan, 'DSS Engine', @indikator, datetime('now'))
     ON CONFLICT(kode) DO UPDATE SET judul=excluded.judul, pesan=excluded.pesan,
       level=excluded.level, kecamatan=excluded.kecamatan`
  );
  let total = 0;
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM peringatan WHERE sumber='DSS Engine'").run();
    for (const p of proyek) {
      const s = skorProyek(p);
      for (const a of ATURAN_EW) {
        let ok = false;
        try {
          ok = Boolean(a.cek(p, s));
        } catch {
          ok = false;
        }
        if (!ok) continue;
        ins.run({
          kode: `EW-${a.id}-${p.kode}`,
          judul: a.nama,
          pesan: a.pesan(p, s),
          level: a.level(p, s),
          proyek_id: p.id,
          kecamatan: p.kecamatan,
          indikator: a.id,
        });
        total++;
      }
    }
    // peringatan agregat
    const m = mAgregat();
    for (const a of ATURAN_AGGREGAT) {
      if (!a.cek(m)) continue;
      ins.run({
        kode: `EW-${a.id}`,
        judul: a.nama,
        pesan: a.pesan(m),
        level: typeof a.level === 'function' ? a.level(m) : a.level,
        proyek_id: null,
        kecamatan: null,
        indikator: a.id,
      });
      total++;
    }
  });
  tx();
  return total;
}

/**
 * Hitung ulang peringatan DSS Engine untuk satu proyek saja.
 * Dipakai simulator realtime agar event peringatan baru bisa disiarkan
 * tanpa menimpa seluruh tabel peringatan.
 */
export function peringatanProyek(proyekId) {
  const p = db.prepare('SELECT * FROM proyek WHERE id=?').get(proyekId);
  if (!p) return [];
  const s = skorProyek(p);
  const ins = db.prepare(
    `INSERT INTO peringatan(kode, judul, pesan, level, kategori, proyek_id, kecamatan, sumber, indikator, waktu)
     VALUES(@kode, @judul, @pesan, @level, 'DSS Engine', @proyek_id, @kecamatan, 'DSS Engine', @indikator, datetime('now'))
     ON CONFLICT(kode) DO UPDATE SET judul=excluded.judul, pesan=excluded.pesan,
       level=excluded.level, kecamatan=excluded.kecamatan`
  );
  const sebelum = new Set(
    db
      .prepare("SELECT kode FROM peringatan WHERE proyek_id=? AND sumber='DSS Engine'")
      .all(proyekId)
      .map((r) => r.kode)
  );
  const tx = db.transaction(() => {
    db.prepare(
      "DELETE FROM peringatan WHERE proyek_id=? AND sumber='DSS Engine' AND ditindaklanjuti=0"
    ).run(proyekId);
    for (const a of ATURAN_EW) {
      let ok = false;
      try {
        ok = Boolean(a.cek(p, s));
      } catch {
        ok = false;
      }
      if (!ok) continue;
      ins.run({
        kode: `EW-${a.id}-${p.kode}`,
        judul: a.nama,
        pesan: a.pesan(p, s),
        level: a.level(p, s),
        proyek_id: proyekId,
        kecamatan: p.kecamatan,
        indikator: a.id,
      });
    }
  });
  tx();
  return db
    .prepare("SELECT * FROM peringatan WHERE proyek_id=? AND sumber='DSS Engine'")
    .all(proyekId)
    .filter((r) => !sebelum.has(r.kode));
}

function mAgregat() {
  const kebTotal = angka(db.prepare('SELECT SUM(jumlah_tenaga) n FROM proyek').get()?.n);
  const tersedia = angka(db.prepare('SELECT COUNT(*) n FROM tenaga_kerja WHERE bersertifikat=1').get()?.n);
  const kAwait = new Set(
    db.prepare('SELECT DISTINCT kecamatan FROM proyek WHERE status=\'Berjalan\'').all().map((r) => r.kecamatan)
  );
  const semuaKec = db.prepare('SELECT nama FROM kecamatan').all().map((r) => r.nama);
  const langsung = angka(
    db.prepare("SELECT COUNT(*) n FROM proyek WHERE lower(metode_pengadaan) LIKE '%langsung%'").get()?.n
  );
  const totalProyek = angka(db.prepare('SELECT COUNT(*) n FROM proyek').get()?.n);
  return {
    kebutuhan_total: kebTotal,
    tersedia_total: tersedia,
    gap_total: Math.max(0, kebTotal - tersedia),
    ikk: kebTotal ? Number(((tersedia / kebTotal) * 100).toFixed(2)) : 0,
    kecamatan_tanpa_proyek: semuaKec.filter((k) => !kAwait.has(k)).length,
    persen_langsung: totalProyek ? (langsung / totalProyek) * 100 : 0,
    penyedia_tanpa_sbu: angka(db.prepare('SELECT COUNT(*) n FROM penyedia_jasa WHERE sbu_aktif=0').get()?.n),
  };
}

export function statistikPeringatan() {
  const per = db.prepare('SELECT level, COUNT(*) n FROM peringatan GROUP BY level').all();
  const perLevel = { Rendah: 0, Sedang: 0, Tinggi: 0, Ekstrem: 0 };
  per.forEach((r) => {
    perLevel[r.level] = angka(r.n);
  });
  const perAturan = db
    .prepare('SELECT indikator, judul, COUNT(*) n FROM peringatan GROUP BY indikator, judul ORDER BY n DESC')
    .all();
  return {
    perLevel,
    perAturan,
    total: perLevel.Rendah + perLevel.Sedang + perLevel.Tinggi + perLevel.Ekstrem,
    belumDibaca: angka(db.prepare('SELECT COUNT(*) n FROM peringatan WHERE dibaca=0').get()?.n),
  };
}

export function analisisKesenjangan() {
  const kual = db
    .prepare(
      `SELECT 'Operator' AS kualifikasi,
              (SELECT COUNT(*) FROM tenaga_kerja WHERE bersertifikat=1 AND kualifikasi='Operator') tersedia,
              (SELECT COALESCE(SUM(operator),0) FROM proyek) kebutuhan
       UNION ALL
       SELECT 'Teknisi/Analis' AS kualifikasi,
              (SELECT COUNT(*) FROM tenaga_kerja WHERE bersertifikat=1 AND kualifikasi='Teknisi/Analis') tersedia,
              (SELECT COALESCE(SUM(teknisi_analis),0) FROM proyek) kebutuhan`
    )
    .all();

  const perKec = db
    .prepare(
      `SELECT p.kecamatan,
              SUM(p.jumlah_tenaga) kebutuhan,
              COUNT(*) jumlah_proyek,
              SUM(p.pagu) pagu
       FROM proyek p GROUP BY p.kecamatan ORDER BY pagu DESC`
    )
    .all();

  const perSatker = db
    .prepare(
      `SELECT p.satker,
              SUM(p.jumlah_tenaga) kebutuhan,
              COUNT(*) jumlah_proyek,
              SUM(p.pagu) pagu
       FROM proyek p GROUP BY p.satker ORDER BY pagu DESC`
    )
    .all();

  const perJenjang = db
    .prepare(
      `SELECT jenjang, COUNT(*) n FROM tenaga_kerja
       WHERE bersertifikat=1 GROUP BY jenjang ORDER BY n DESC`
    )
    .all();

  const perJabatan = db
    .prepare(
      `SELECT jabatan_kerja, COUNT(*) n FROM tenaga_kerja
       WHERE bersertifikat=1 AND jabatan_kerja IS NOT NULL AND jabatan_kerja<>''
       GROUP BY jabatan_kerja ORDER BY n DESC LIMIT 20`
    )
    .all();

  const perLsp = db
    .prepare(
      `SELECT penerbit, COUNT(*) n FROM tenaga_kerja
       WHERE bersertifikat=1 GROUP BY penerbit ORDER BY n DESC`
    )
    .all();

  const perMetode = db
    .prepare(
      `SELECT COALESCE(NULLIF(metode_pengadaan,''),'Tidak Diisi') metode,
              COUNT(*) jumlah, SUM(pagu) pagu, SUM(jumlah_tenaga) kebutuhan
       FROM proyek GROUP BY metode ORDER BY pagu DESC`
    )
    .all();

  const perJenisPekerjaan = db
    .prepare(
      `SELECT jenis_pekerjaan, COUNT(*) jumlah, SUM(pagu) pagu,
              SUM(CASE WHEN status='Berjalan' THEN 1 ELSE 0 END) berjalan
       FROM proyek GROUP BY jenis_pekerjaan ORDER BY pagu DESC`
    )
    .all();

  return { kualifikasi: kual, perKecamatan: perKec, perSatker, perJenjang, perJabatan, perLsp, perMetode, perJenisPekerjaan };
}

export function petaRisiko() {
  return db
    .prepare(
      `SELECT pr.kode, pr.nama, pr.kecamatan, pr.latitude, pr.longitude, pr.pagu, pr.progres,
              pr.status, pr.metode_pengadaan, pr.jenis_pekerjaan, pr.sumber_pendanaan,
              r.level, r.skor AS skor_risiko,
              (SELECT COUNT(*) FROM temuan t WHERE t.proyek_id=pr.id AND t.status NOT IN ('Ditutup','Selesai')) temuan_terbuka
       FROM proyek pr LEFT JOIN risiko r ON r.proyek_id=pr.id`
    )
    .all();
}

export function proyekTeratas(limit = 10) {
  return db
    .prepare('SELECT * FROM proyek ORDER BY pagu DESC LIMIT ?')
    .all(limit)
    .map((p) => ({ ...p, ...skorProyek(p) }));
}

export { hitungIndikator };