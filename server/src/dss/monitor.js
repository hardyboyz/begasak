import { db, audit } from '../db.js';
import { skorProyek, angka, peringatanProyek } from './engine.js';

let _s = 20251001;
const rnd = () => {
  _s = (_s * 1103515245 + 12345) % 2147483648;
  return _s / 2147483648;
};
const pilih = (a) => a[Math.floor(rnd() * a.length)];
const antara = (a, b) => a + Math.floor(rnd() * (b - a + 1));

const hari = (d) => d.toISOString().slice(0, 10);
const tambahHari = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

const TEMPLATE_TEMUAN = [
  { k: 'K3', d: 'Pekerja tidak menggunakan APD lengkap saat pekerjaan di ketinggian' },
  { k: 'K3', d: 'Area kerja belum dipasang rambu peringatan dan papan informasi K3' },
  { k: 'K3', d: 'Instalasi listrik sementara tidak terlindungi dan belum grounding' },
  { k: 'Mutu', d: 'Material agregat tidak disertai hasil uji laboratorium' },
  { k: 'Mutu', d: 'Campuran beton belum terdokumentasi dan belum diuji tekan' },
  { k: 'Progres', d: 'Progres fisik lebih rendah dari jadwal kerja yang disepakati' },
  { k: 'Administrasi', d: 'Dokumen pertanggungjawaban keuangan belum lengkap' },
  { k: 'Tenaga Kerja', d: 'Tenaga bekerja tanpa sertifikat kompetensi competence' },
  { k: 'Lingkungan', d: 'Sisa material dan sampah konstruksi belum tertangani dengan benar' },
  { k: 'Keselamatan Lalu Lintas', d: 'Pengaturan jalur dan rambu peringatan jalan tidak memadai' },
];

const MITIGASI = {
  K3: 'Terapkan tindakan korektif dan STOP WORK bila temuan berulang.',
  Mutu: 'Wajibkan uji mutu laboratorium sebelum pekerjaan dilanjutkan.',
  Progres: 'Minta pembaruan jadwal kerja dan rencana pengejaran.',
  Administrasi: 'Tahan pencairan termin sampai berkas lengkap.',
  'Tenaga Kerja': 'Wajibkan tenaga bersertifikat atau pelatihan pra-konstruksi.',
  Lingkungan: 'Susun rencana pengelolaan dan pengangkutan limbah konstruksi.',
  'Keselamatan Lalu Lintas': 'Tambahkan rambu dan pengatur lalu lintas sementara.',
};

let seq = 1;

/**
 * Simulasi satu aktivitas lapangan baru (supervisi + kemungkinan temuan),
 * lalu hitung ulang risiko & peringatan proyek terkait.
 * Mengembalikan event untuk dikirim lewat SSE.
 */
export function tickSitus() {
  const proyekAktif = db
    .prepare("SELECT * FROM proyek WHERE status='Berjalan' ORDER BY RANDOM() LIMIT 8")
    .all();
  const semuaAktif = db.prepare("SELECT * FROM proyek WHERE status='Berjalan'").all();
  if (!semuaAktif.length) return null;

  const proyek = proyekAktif[Math.floor(rnd() * proyekAktif.length)] || semuaAktif[0];
  const s = skorProyek(proyek);
  const kode = `PWG-${proyek.kode}-R${Date.now().toString(36).toUpperCase()}`;
  const tgl = hari(new Date());
  const pengId = db
    .prepare(
      `INSERT INTO pengawasan
       (kode, proyek_id, tanggal, pengawas, lokasi, cuaca, jumlah_pekerja_harian, alat_berat, material_terpasang, catatan, status_verifikasi)
       VALUES (?,?,?,?,?,?,?,?,?,?,'Diverifikasi')`
    )
    .run(
      kode,
      proyek.id,
      tgl,
      pilih(['Arif Setiawan, ST', 'Dedi Kurniawan, ST', 'Rizal Fahmi, ST', 'Siti Rahma, ST']),
      proyek.lokasi_mentioned || proyek.kecamatan,
      pilih(['Cerah', 'Cerah Berawan', 'Hujan Ringan', 'Berawan']),
      antara(2, Math.max(4, proyek.jumlah_tenaga + 4)),
      antara(0, 4),
      Math.round(proyek.nilai_kontrak * (proyek.progres / 100) * 0.05),
      'Supervisi lapangan terjadwal'
    ).lastInsertRowid;

  // Progres bergerak sedikit
  const delta = antara(0, 3);
  if (delta > 0) {
    db.prepare('UPDATE proyek SET progres = MIN(100, progres + ?) WHERE id=?').run(delta, proyek.id);
  }

  // Temuan dengan probabilitas risiko
  const peluang = Math.min(0.75, 0.12 + s.skor / 160);
  let temuanBaru = null;
  if (rnd() < peluang) {
    const t = pilih(TEMPLATE_TEMUAN);
    const r2 = rnd();
    const tingkat = r2 < 0.1 ? 'Ekstrem' : r2 < 0.38 ? 'Tinggi' : r2 < 0.75 ? 'Sedang' : 'Rendah';
    const kodeT = `TMU-${proyek.kode}-R${seq++}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
    const idT = db
      .prepare(
        `INSERT INTO temuan
         (kode, pengawasan_id, proyek_id, tanggal, kategori, deskripsi, lokasi, tingkat, status,
          konsekuensi, tindakan, tenggat, pelapor)
         VALUES (?,?,?,?,?,?,?,?,'Baru',?,?,?,?)`
      )
      .run(
        kodeT,
        pengId,
        proyek.id,
        tgl,
        t.k,
        t.d,
        proyek.lokasi_mentioned || proyek.kecamatan,
        tingkat,
        'Berpotensi mengganggu mutu, keselamatan, atau jadwal proyek.',
        MITIGASI[t.k],
        hari(tambahHari(new Date(), antara(3, 21))),
        'Sistem BEGASAK'
      ).lastInsertRowid;
    temuanBaru = db.prepare('SELECT * FROM temuan WHERE id=?').get(idT);
  }

  // Perbarui skor risiko proyek
  const sBaru = skorProyek(db.prepare('SELECT * FROM proyek WHERE id=?').get(proyek.id));
  db.prepare(
    `UPDATE risiko SET probabilitas=?, dampak=?, skor=?, level=?, deskripsi=?, mitigasi=? WHERE kode=?`
  ).run(
    Math.max(1, Math.min(5, Math.ceil(sBaru.skor / 20))),
    Math.max(1, Math.min(5, Math.ceil(angka(proyek.pagu) / 5e8))),
    Math.max(1, Math.min(5, Math.ceil(sBaru.skor / 20))) *
      Math.max(1, Math.min(5, Math.ceil(angka(proyek.pagu) / 5e8))),
    sBaru.level,
    sBaru.detail
      .filter((x) => x.nilai >= 40)
      .map((x) => `${x.label}: ${x.catatan}`)
      .join(' | ') || 'Seluruh indikator risiko berada dalam batas wajar.',
    sBaru.detail
      .filter((x) => x.nilai >= 50)
      .map((x) => x.label)
      .join('; ') || 'Pemantauan rutin',
    `RSK-${proyek.kode}`
  );

  audit('monitoring', 'supervisi-harian', 'proyek', proyek.id, { skor: sBaru.skor });
  const peringatanBaru = peringatanProyek(proyek.id);
  return {
    supervisi: {
      kode,
      proyek: proyek.nama,
      proyekKode: proyek.kode,
      kecamatan: proyek.kecamatan,
      progres: Math.min(100, proyek.progres + delta),
    },
    temuan: temuanBaru,
    risiko: { kode: proyek.kode, level: sBaru.level, skor: sBaru.skor, aksi: sBaru.aksi },
    peringatan: peringatanBaru,
    waktu: new Date().toISOString(),
  };
}