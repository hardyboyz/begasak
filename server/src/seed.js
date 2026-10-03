import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, setMeta, audit } from './db.js';
import { hitungUlang } from './dss/engine.js';
import { hashKataSandi, AKUN_DEMO } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_FILE = path.join(__dirname, '..', 'seed', 'bikon2025.json');

// PRNG deterministik agar data simulasi selalu sama
let _s = 42;
const rnd = () => {
  _s = (_s * 1664525 + 1013904223) % 4294967296;
  return _s / 4294967296;
};
const pilih = (arr) => arr[Math.floor(rnd() * arr.length)];
const antara = (a, b) => a + Math.floor(rnd() * (b - a + 1));

const KATEGORI_TEMUAN = [
  { k: 'K3', d: 'Pekerja tidak menggunakan APD lengkap (helm Proyek, safety shoes, rompi)' },
  { k: 'K3', d: 'Area kerja tidak dipasang rambu peringatan dan papan K3' },
  { k: 'K3', d: 'Kotak listrik sementara tidak terlindung / tidak ada grounding' },
  { k: 'K3', d: 'Material-material ditumpuk melebihi batas aman / blocking akses evakuasi' },
  { k: 'Mutu', d: 'Material agregat tidak sesuai spesifikasi teknis / tidak ada uji mutu' },
  { k: 'Mutu', d: 'Campuran beton tidak terdokumentasi dan belum ada uji tekan' },
  { k: 'Mutu', d: 'Pemadatan timbunan tidak sesuai hasil compaction test' },
  { k: 'Progres', d: 'Progres fisik lebih rendah dari jadwal kerja yang disepakati' },
  { k: 'Progres', d: 'Pekerjaan belum dimulai padahal jadwal sudah berjalan' },
  { k: 'Administrasi', d: 'Dokumen pertanggungjawaban keuangan belum lengkap' },
  { k: 'Administrasi', d: 'Rencana kerja / Time Schedule belum diperbarui' },
  { k: 'Tenaga Kerja', d: 'Tenaga bekerja tanpa sertifikat kompetensi (SKK/SKKK)' },
  { k: 'Tenaga Kerja', d: 'Jumlah tenaga bersertifikat di bawah kebutuhan kontrak' },
  { k: 'Lingkungan', d: 'Pengelolaan sisa material dan sampah konstruksi tidak Tertbrains' },
  { k: 'Keselamatan Lalu Lintas', d: 'Pengaturan jalur dan rambu peringatan jalan tidak memadai' },
];

const MITIGASI = {
  K3: 'Terapkan tindakan korektif dan STOP WORK bila temuan berulang.',
  Mutu: 'Wajibkan uji mutu laboratorium sebelum pekerjaan dilanjutkan.',
  Progres: 'Minta pembaruan Time Schedule dan serahkan rencana pengejaran (catch-up plan).',
  Administrasi: 'Tahan pencairan termin sampai berkas lengkap.',
  'Tenaga Kerja': 'Wajibkan penyediaan tenaga bersertifikat atau pelatihan pra-konstruksi.',
  Lingkungan: 'Terapkan rencana pengangkutan dan pengelolaan limbah konstruksi.',
  'Keselamatan Lalu Lintas': 'Tambahkan rambu, police, dan pengatur lalu lintas sementara.',
};

const PETA_IKK_TARGET = 83.49;

function meta() {
  if (!fs.existsSync(SEED_FILE)) {
    console.error('Seed file tidak ditemukan:', SEED_FILE);
    console.error('Jalankan: python3 etl/parse_bikon.py');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(SEED_FILE, 'utf-8'));
}

function kosongkan() {
  const tabel = [
    'audit_log',
    'sesi',
    'pengaduan',
    'peringatan',
    'risiko',
    'temuan',
    'pengawasan',
    'penugasan',
    'proyek',
    'tenaga_kerja',
    'penyedia_jasa',
    'kecamatan',
    'pengguna',
    'meta',
  ];
  db.pragma('foreign_keys = OFF');
  tabel.forEach((t) => db.prepare(`DELETE FROM ${t}`).run());
  db.prepare("DELETE FROM sqlite_sequence WHERE name IN (" + tabel.map(() => '?').join(',') + ')').run(...tabel);
  db.pragma('foreign_keys = ON');
}

export function seed({ force = false } = {}) {
  const m = meta();
  if (db.prepare('SELECT COUNT(*) n FROM proyek').get().n > 0 && !force) {
    console.log('Database sudah terisi. Gunakan --force untuk mengisi ulang.');
    return { skipped: true };
  }
  kosongkan();

  const insKec = db.prepare('INSERT INTO kecamatan(nama, lat, lng) VALUES(?,?,?)');
  const petaKec = {};
  m.meta.kecamatan.forEach((k) => {
    const r = insKec.run(k.nama, k.lat, k.lng);
    petaKec[k.nama] = { id: r.lastInsertRowid, lat: k.lat, lng: k.lng };
  });

  const insPby = db.prepare(`INSERT INTO penyedia_jasa
    (kode, nama, nib, nama_pengusaha, jenis_kelamin, alamat, no_hp, email, website, tahun_mulai,
     badan_usaha, status_modal, pekerjaan_utama, kbli, kualifikasi, sbu_aktif, jaringan_usaha,
     tempat_usaha, sumber_data, status, kecamatan, skor_kemampuan)
    VALUES (@kode,@nama,@nib,@nama_pengusaha,@jenis_kelamin,@alamat,@no_hp,@email,@website,@tahun_mulai,
     @badan_usaha,@status_modal,@pekerjaan_utama,@kbli,@kualifikasi,@sbu_aktif,@jaringan_usaha,
     @tempat_usaha,@sumber_data,@status,@kecamatan,@skor_kemampuan)`);
  const petaPby = [];
  m.penyedia_jasa.forEach((p, i) => {
    const r = insPby.run({
      kode: `PYD-${String(i + 1).padStart(3, '0')}`,
      ...p,
      tahun_mulai: /^\d{4}$/.test(p.tahun_mulai || '') ? Number(p.tahun_mulai) : null,
      sbu_aktif: p.sbu_aktif ? 1 : 0,
    });
    petaPby.push({ ...p, id: r.lastInsertRowid });
  });

  const insTkk = db.prepare(`INSERT INTO tenaga_kerja
    (kode, nama, jenis_pelatihan, klasifikasi, kualifikasi, no_sertifikat, penerbit, jabatan_kerja,
     jenjang, jenjang_angka, bersertifikat, tahun_sertifikat, perusahaan_id)
    VALUES (@kode,@nama,@jenis_pelatihan,@klasifikasi,@kualifikasi,@no_sertifikat,@penerbit,@jabatan_kerja,
     @jenjang,@jenjang_angka,@bersertifikat,@tahun_sertifikat,@perusahaan_id)`);
  const insPen = db.prepare(`INSERT INTO penugasan(proyek_id, tenaga_id, jabatan, status, mulai)
    VALUES(?,?,?,'Aktif',?) ON CONFLICT DO NOTHING`);
  const insProyek = db.prepare(`INSERT INTO proyek
    (kode, no_urut, nama, sumber_pendanaan, operator, teknisi_analis, jumlah_tenaga, pagu,
     metode_pengadaan, satker, jenis_pengadaan, jenis_pekerjaan, lokasi_mentioned, kecamatan,
     latitude, longitude, status, progres, tanggal_mulai, tanggal_rencana_selesai,
     tanggal_aktual_selesai, penyedia_id, nilai_kontrak)
    VALUES (@kode,@no_urut,@nama,@sumber_pendanaan,@operator,@teknisi_analis,@jumlah_tenaga,@pagu,
     @metode_pengadaan,@satker,@jenis_pengadaan,@jenis_pekerjaan,@lokasi_mentioned,@kecamatan,
     @latitude,@longitude,@status,@progres,@tanggal_mulai,@tanggal_rencana_selesai,
     @tanggal_aktual_selesai,@penyedia_id,@nilai_kontrak)`);
  const insPeng = db.prepare(`INSERT INTO pengawasan
    (kode, proyek_id, tanggal, pengawas, lokasi, cuaca, jumlah_pekerja_harian, alat_berat, material_terpasang, catatan, foto, status_verifikasi)
    VALUES (@kode,@proyek_id,@tanggal,@pengawas,@lokasi,@cuaca,@jumlah_pekerja_harian,@alat_berat,@material_terpasang,@catatan,@foto,@status_verifikasi)`);
  const insTemuan = db.prepare(`INSERT INTO temuan
    (kode, pengawasan_id, proyek_id, tanggal, kategori, deskripsi, lokasi, tingkat, status,
     konsekuensi, tindakan, tenggat, tanggal_closure, pelapor)
    VALUES (@kode,@pengawasan_id,@proyek_id,@tanggal,@kategori,@deskripsi,@lokasi,@tingkat,@status,
     @konsekuensi,@tindakan,@tenggat,@tanggal_closure,@pelapor)`);

  const hari = (d) => d.toISOString().slice(0, 10);
  const H = new Date();
  const tambahkanHari = (d, n) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };

  // Rasio penugasan = IKK/KKTC. Kebutuhan total 418, TKK bersertifikat 349 -> assign 349 (83,49%).
  const totalKebutuhan = m.proyek.reduce((a, p) => a + p.jumlah, 0);
  const totalTkk = m.tenaga_kerja.length;
  const rasioAssign = Math.min(1, PETA_IKK_TARGET / 100);
  const quotaTkk = Math.min(totalTkk, Math.round(totalKebutuhan * rasioAssign));

  // Bangkitkan tenaga kerja + penugasan
  const tkkTersedia = { Operator: [], 'Teknisi/Analis': [] };
  m.tenaga_kerja.forEach((t, i) => {
    const jenjangAngka = t.jenjang.match(/(\d+)/)?.[1] ? Number(t.jenjang.match(/(\d+)/)[1]) : null;
    const r = insTkk.run({
      kode: `TKK-${String(i + 1).padStart(4, '0')}`,
      nama: t.nama,
      jenis_pelatihan: t.jenis_pelatihan,
      klasifikasi: t.klasifikasi,
      kualifikasi: t.kualifikasi,
      no_sertifikat: t.no_sertifikat,
      penerbit: t.penerbit,
      jabatan_kerja: t.jabatan_kerja,
      jenjang: t.jenjang,
      jenjang_angka: jenjangAngka,
      bersertifikat: t.bersertifikat ? 1 : 0,
      tahun_sertifikat: t.tahun_sertifikat ? Number(t.tahun_sertifikat) : null,
      perusahaan_id: null,
    });
    const id = r.lastInsertRowid;
    const pool = tkkTersedia[t.kualifikasi];
    const target = pool || tkkTersedia.Operator;
    target.push({ id, jabatan: t.jabatan_kerja });
  });

  // Urutan prioritas penugasan: tenaga K3 dan pengawas struktur
  const urutPenting = (a, b) => {
    const pa = /keselamatan|struktur|pengawas/i.test(a.jabatan) ? 0 : 1;
    const pb = /keselamatan|struktur|pengawas/i.test(b.jabatan) ? 0 : 1;
    return pa - pb;
  };
  Object.values(tkkTersedia).forEach((arr) => arr.sort(urutPenting));

  let belum = 0;
  let sudahAssign = 0;
  m.proyek.forEach((p, idx) => {
    const kec = petaKec[p.kecamatan] || petaKec.Manggar;
    const hariMulai = antara(30, 330); // hari ke-n dari awal tahun
    const mulai = tambahkanHari(new Date(H.getFullYear(), 0, 1), -hariMulai);
    const durasi = antara(45, 240);
    const selesaiRencana = tambahkanHari(mulai, durasi);
    const berjalanHari = Math.round((H - mulai) / 86400000);

    let status, progres, selesaiAktual = null;
    if (berjalanHari < -10) {
      status = 'Belum Mulai';
      progres = 0;
    } else if (berjalanHari > durasi) {
      // sebagian selesai, sebagian macet
      if (rnd() < 0.55) {
        status = 'Selesai';
        progres = 100;
        selesaiAktual = hari(tambahkanHari(mulai, durasi + antara(-5, 20)));
      } else {
        status = 'Berjalan';
        progres = antara(Math.max(5, Math.floor((durasi / 150) * 100)), 99);
      }
    } else {
      status = 'Berjalan';
      progres = antara(5, 98);
    }

    //penyedia
    let penyediaId = null;
    const capabilityNeeded = p.pagu > 1e9 ? 4 : p.pagu > 3e8 ? 3 : 2;
    const kandidat = petaPby.filter((x) => x.skor_kemampuan >= 2);
    if (kandidat.length && rnd() < 0.92) {
      const terpilih =
        pilih(kandidat.filter((x) => x.skor_kemampuan >= capabilityNeeded - 1)) || pilih(kandidat);
      penyediaId = terpilih ? terpilih.id : null;
    }

    // Penugasan tenaga
    const butuhTotal = p.jumlah;
    const butuhTA = Math.min(p.teknisi_analis, Math.ceil(butuhTotal / 2));
    const butuhOp = butuhTotal - butuhTA;
    const r = insProyek.run({
      kode: `PRJ-2025-${String(idx + 1).padStart(3, '0')}`,
      no_urut: p.no,
      nama: p.nama_proyek,
      sumber_pendanaan: /non APBD|swasta/i.test(p.satker) ? 'Non APBD' : 'APBD',
      operator: p.operator,
      teknisi_analis: p.teknisi_analis,
      jumlah_tenaga: p.jumlah,
      pagu: p.pagu,
      metode_pengadaan: p.metode_pengadaan,
      satker: p.satker,
      jenis_pengadaan: p.jenis_pengadaan,
      jenis_pekerjaan: p.jenis_pekerjaan,
      lokasi_mentioned: p.lokasi_mentioned,
      kecamatan: p.kecamatan,
      latitude: kec.lat + (rnd() - 0.5) * 0.02,
      longitude: kec.lng + (rnd() - 0.5) * 0.02,
      status,
      progres,
      tanggal_mulai: hari(mulai),
      tanggal_rencana_selesai: hari(selesaiRencana),
      tanggal_aktual_selesai: selesaiAktual,
      penyedia_id: penyediaId,
      nilai_kontrak: Math.round(p.pagu * (0.93 + rnd() * 0.07)),
    });
    const proyekId = r.lastInsertRowid;

    // Assign tenaga sesuai kuota IKK global (349 dari 418 kebutuhan = 83,49%).
    const sisaKuota = quotaTkk - sudahAssign;
    const target = Math.max(0, Math.min(Math.round(butuhTotal * rasioAssign), sisaKuota));
    let assigned = 0;
    const ambil = (pool, n) => {
      for (let i = 0; i < n && pool.length; i++) {
        const t = pool.shift();
        insPen.run(proyekId, t.id, t.jabatan, hari(mulai));
        assigned++;
        sudahAssign++;
      }
    };
    ambil(tkkTersedia['Teknisi/Analis'], Math.min(butuhTA, target));
    ambil(tkkTersedia.Operator, Math.min(butuhOp, Math.max(0, target - assigned)));
    belum += Math.max(0, butuhTotal - assigned);

    // Pengawasan + temuan (hanya untuk proyek Berjalan/Selesai)
    if (status !== 'Belum Mulai' && (status === 'Berjalan' || (status === 'Selesai' && rnd() < 0.7))) {
      const jumlahPeng = status === 'Selesai' ? antara(1, 4) : antara(0, 6);
      for (let k = 0; k < jumlahPeng; k++) {
        const hariKe = Math.max(0, Math.min(berjalanHari, antara(0, Math.max(0, berjalanHari))));
        const tgl = hari(tambahkanHari(mulai, hariKe));
        const pengId = insPeng.run({
          kode: `PWG-${proyekId}-${String(k + 1).padStart(2, '0')}`,
          proyek_id: proyekId,
          tanggal: tgl,
          pengawas: pilih(['Arif Setiawan, ST', 'Dedi Kurniawan, ST', 'Rizal Fahmi, ST', 'Siti Rahma, ST']),
          lokasi: `${p.lokasi_mentioned || p.kecamatan}`,
          cuaca: pilih(['Cerah', 'Cerah Berawan', 'Hujan Ringan', 'Berawan']),
          jumlah_pekerja_harian: antara(2, Math.max(3, butuhTotal + 5)),
          alat_berat: antara(0, 4),
          material_terpasang: Math.round(p.pagu * (progres / 100) * (0.3 + rnd() * 0.1)),
          catatan: 'Supervisi lapangan rutin',
          foto: '',
          status_verifikasi: 'Diverifikasi',
        }).lastInsertRowid;

        // Temuan
        const jmlTemuan = rnd() < 0.65 ? antara(1, 3) : 0;
        for (let t = 0; t < jmlTemuan; t++) {
          const tm = pilih(KATEGORI_TEMUAN);
          const r2 = rnd();
          const tingkat = r2 < 0.12 ? 'Ekstrem' : r2 < 0.4 ? 'Tinggi' : r2 < 0.75 ? 'Sedang' : 'Rendah';
          const statusT =
            status === 'Selesai' ? (rnd() < 0.6 ? 'Ditutup' : 'Ditangani')
            : rnd() < 0.5 ? 'Baru' : rnd() < 0.6 ? 'Ditangani' : 'Ditutup';
          const tenggat = hari(tambahkanHari(new Date(tgl), antara(3, 30)));
          insTemuan.run({
            kode: `TMU-${proyekId}-${k + 1}-${t + 1}`,
            pengawasan_id: pengId,
            proyek_id: proyekId,
            tanggal: tgl,
            kategori: tm.k,
            deskripsi: tm.d,
            lokasi: `${p.lokasi_mentioned || p.kecamatan}`,
            tingkat,
            status: statusT,
            konsekuensi: 'Berpotensi mengganggu mutu, keselamatan, atau jadwal proyek.',
            tindakan: MITIGASI[tm.k] || 'Tindakan korektif oleh penyedia jasa.',
            tenggat,
            tanggal_closure: statusT === 'Ditutup' ? hari(tambahkanHari(new Date(tgl), antara(1, 20))) : null,
            pelapor: pilih(['Pengawas lapangan', 'PPK', 'Masyarakat', 'TQ']),
          });
        }
      }
    }
  });

  // Pengguna demo (6 akun, 5 peran) dengan kata sandi awal.
  // Ganti seluruh kata sandi ini sebelum penggunaan produksi.
  const insUser = db.prepare(
    `INSERT INTO pengguna(username, nama, peran, satker, email, telepon, organisasi, password_hash, dibuat_oleh)
     VALUES(?,?,?,?,?,?,?,?,'seed')`
  );
  for (const a of AKUN_DEMO) {
    insUser.run(a.username, a.nama, a.peran, a.satker, a.email, a.telepon, a.organisasi, hashKataSandi(a.sandi));
  }

  // Pengaduan masyarakat
  const insPengaduan = db.prepare(`INSERT INTO pengaduan
    (kode, nama_pelapor, kontak, lokasi, kecamatan, kategori, deskripsi, tanggal, status, prioritas, proyek_id, ditangani_oleh)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`);
  const daftarProyek = db.prepare('SELECT id, nama, kecamatan FROM proyek ORDER BY RANDOM() LIMIT 12').all();
  const kategoriPeng = ['Debu/Penolakan', 'Drainase Macet', 'Rambu/Keselamatan Jalan', 'Ketidaktransparan', 'Kebisingan'];
  daftarProyek.forEach((p, i) => {
    insPengaduan.run(
      `ADU-${String(i + 1).padStart(3, '0')}`,
      pilih(['Warga setempat', 'Toko sekitar', 'PKK', 'Pemuda', 'Petani']),
      '08' + antara(100000000, 999999999),
      p.nama.slice(0, 60),
      p.kecamatan,
      pilih(kategoriPeng),
      pick_keluhan(),
      hari(new Date()),
      pilih(['Baru', 'Diproses', 'Diproses', 'Selesai']),
      pilih(['Tinggi', 'Sedang', 'Sedang', 'Rendah']),
      p.id,
      pilih(['PPK', 'TQ', 'UPTD'])
    );
  });

  // Meta
  setMeta('nama', m.meta.nama_aplikasi);
  setMeta('subjudul', m.meta.subjudul);
  setMeta('sumber_data', m.meta.sumber_data);
  setMeta('satuan_kerja', m.meta.satuan_kerja);
  setMeta('tahun', m.meta.tahun);
  setMeta('kabupaten', m.meta.kabupaten);
  setMeta('provinsi', m.meta.provinsi);
  setMeta('ikk_target', PETA_IKK_TARGET);
  setMeta('seed_at', new Date().toISOString());

  audit('sistem', 'seed', 'database', null, { proyek: m.proyek.length, tkk: m.tenaga_kerja.length });

  const r = hitungUlang({ denganPeringatan: true });
  console.log('Seed selesai.');
  console.log(`  Proyek  : ${m.proyek.length}`);
  console.log(`  TKK     : ${m.tenaga_kerja.length}`);
  console.log(`  Penyedia: ${m.penyedia_jasa.length}`);
  console.log(
    `  Penugasan: ${sudahAssign} TKK ditugaskan dari ${totalKebutuhan} kebutuhan ` +
      `(CKR ${((sudahAssign / totalKebutuhan) * 100).toFixed(2)}%, target ${PETA_IKK_TARGET}%), gap ${belum}`
  );
  console.log(`  Risiko  : ${r.proyek} proyek dinilai, ${r.peringatan} peringatan dibangkitkan`);
  return { skipped: false, ...r };
}

function pick_keluhan() {
  const o = [
    'Debu Construction material dari proyek troubling bothers warga setiap hari',
    'Saluran air drainase di depan rumah macet danbanjir saat hujan',
    'Tidak ada papan peringatan di lokasi jalan sehingga berbahaya bagi pengguna jalan',
    'Proyek berjalan sangat lambat sudah 5 bulan tanpa penyelesaian',
    'Warga tidak diberi tahu jadwal dan dampak penggantian jalan',
  ];
  return pilih(o);
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seed({ force: process.argv.includes('--force') });
}