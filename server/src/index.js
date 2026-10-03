import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { db, getMeta, audit } from './db.js';
import { seed } from './seed.js';
import {
  metrik,
  statistikPeringatan,
  analisisKesenjangan,
  petaRisiko,
  skorProyek,
  hitungUlang,
  angka,
  ATURAN_EW,
  ATURAN_AGGREGAT,
} from './dss/engine.js';
import { tickSitus } from './dss/monitor.js';
import { mulaiSSE, idkirim } from './realtime.js';
import {
  masuk,
  tutupSesi,
  penggunaDariToken,
  tokenDari,
  boleh as bolehPeran,
  hashKataSandi,
  cekKataSandi,
  hapusSemuaSesi,
  bersihkanSesiKedaluwarsa,
  PERAN,
  NAMA_PERAN,
  petaHakAkses,
  AKUN_DEMO,
} from './auth.js';

const boleh = (req, aksi) => bolehPeran(req.pengguna?.peran, aksi);
const namaAksi = (req) => req.pengguna?.nama || req.pengguna?.username || 'sistem';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5178;

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Auto-seed bila database kosong
if (db.prepare('SELECT COUNT(*) n FROM proyek').get().n === 0) {
  console.log('Database kosong, menjalankan seed otomatis...');
  seed({ force: true });
}

// ================================ HELPER
const n = (v) => angka(v);
const q = (sql, ...p) => db.prepare(sql).all(...p);
const g = (sql, ...p) => db.prepare(sql).get(...p);

function paging(req) {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 25));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  return { limit, offset };
}

function like(v) {
  return `%${String(v || '').toLowerCase()}%`;
}

// ================================ AUTENTIKASI & OTORISASI
// Catatan: `req.path` di dalam `app.use('/api')` tidak lagi memuat awalan /api,
// sehingga pola harus cocok dengan `originalUrl`.
const BEBAS = [/^\/api\/health$/, /^\/api\/auth\/masuk$/, /^\/api\/auth\/akun-demo$/];

app.use('/api', (req, res, next) => {
  const jalur = (req.originalUrl || '').split('?')[0];
  req.pengguna = penggunaDariToken(tokenDari(req));
  if (req.pengguna || BEBAS.some((p) => p.test(jalur))) return next();
  res.status(401).json({ pesan: 'Belum masuk. Sesi tidak ditemukan atau telah berakhir.', kode: 'BELUM_MASUK' });
});

/** Pastikan pengguna sudah masuk. */
function wajibMasuk(req, res, next) {
  if (!req.pengguna) {
    return res.status(401).json({ pesan: 'Belum masuk.', kode: 'BELUM_MASUK' });
  }
  next();
}

/** Pastikan pengguna punya izin untuk aksi `sumber:aksi`. */
function wajibIzin(aksi) {
  return (req, res, next) => {
    if (!req.pengguna) {
      return res.status(401).json({ pesan: 'Belum masuk.', kode: 'BELUM_MASUK' });
    }
    if (!boleh(req, aksi)) {
      audit(namaAksi(req), 'tolak-akses', aksi.split(':')[0], null, { aksi });
      return res.status(403).json({
        pesan: `Peran ${req.pengguna.peran} tidak memiliki hak ${aksi}.`,
        kode: 'TIDAK_DIIZINKAN',
        aksi,
        peran: req.pengguna.peran,
      });
    }
    next();
  };
}

app.post('/api/auth/masuk', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ pesan: 'Username dan kata sandi wajib diisi.' });
  }
  const hasil = masuk(username, password);
  if (!hasil) {
    audit(String(username).slice(0, 60), 'gagal-masuk', 'pengguna', null, {});
    return res.status(401).json({ pesan: 'Username atau kata sandi salah.', kode: 'GAGAL_MASUK' });
  }
  audit(hasil.pengguna.nama, 'masuk', 'pengguna', hasil.pengguna.id, {});
  res.json({ ok: true, token: hasil.token, pengguna: hasil.pengguna, akses: hasil.akses });
});

app.post('/api/auth/keluar', wajibMasuk, (req, res) => {
  tutupSesi(tokenDari(req));
  res.json({ ok: true });
});

app.get('/api/auth/saya', wajibMasuk, (req, res) => {
  res.json({ pengguna: req.pengguna, akses: req.pengguna ? petaHakAkses()[req.pengguna.peran] || [] : [] });
});

/** Daftar peran & hak aksesnya, dipakai frontend untuk menyusun menu. */
app.get('/api/auth/peran', wajibMasuk, (_req, res) => {
  res.json({ peran: PERAN, akses: petaHakAkses() });
});

/** Akun demo untuk memudahkan login saat pengembangan; dimatikan di produksi. */
app.get('/api/auth/akun-demo', (_req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ pesan: 'Tidak tersedia.' });
  }
  res.json({
    akun: AKUN_DEMO.map((a) => ({ username: a.username, peran: a.peran, sandi: a.sandi, nama: a.nama })),
  });
});

bersihkanSesiKedaluwarsa();
setInterval(bersihkanSesiKedaluwarsa, 3600_000).unref?.();

// ================================ META & HEALTH
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, waktu: new Date().toISOString() });
});

app.get('/api/meta', wajibIzin('dashboard:read'), (_req, res) => {
  res.json({
    nama: getMeta('nama') || 'BEGASAK',
    subjudul: getMeta('subjudul'),
    sumber_data: getMeta('sumber_data'),
    satuan_kerja: getMeta('satuan_kerja'),
    tahun: getMeta('tahun'),
    kabupaten: getMeta('kabupaten'),
    provinsi: getMeta('provinsi'),
    ikk_target: Number(getMeta('ikk_target') || 0),
    seed_at: getMeta('seed_at'),
    kecamatan: q('SELECT nama, lat, lng FROM kecamatan ORDER BY nama'),
  });
});

// ================================ DASHBOARD
app.get('/api/dashboard', wajibIzin('dashboard:read'), (_req, res) => {
  const m = metrik();
  const pering = statistikPeringatan();
  const tren = q(
    `SELECT substr(waktu,1,10) tanggal, COUNT(*) n,
            SUM(CASE WHEN level='Ekstrem' THEN 1 ELSE 0 END) ekstrem,
            SUM(CASE WHEN level='Tinggi' THEN 1 ELSE 0 END) tinggi
     FROM peringatan GROUP BY tanggal ORDER BY tanggal DESC LIMIT 14`
  );
  const progresKec = q(
    `SELECT p.kecamatan, COUNT(*) proyek, ROUND(AVG(p.progres),1) progres_rata,
            SUM(p.pagu) pagu, SUM(CASE WHEN p.status='Berjalan' THEN 1 ELSE 0 END) berjalan,
            (SELECT COUNT(*) FROM risiko r JOIN proyek x ON x.id=r.proyek_id
              WHERE x.kecamatan=p.kecamatan AND r.level IN ('Tinggi','Ekstrem')) berisiko
     FROM proyek p GROUP BY p.kecamatan ORDER BY pagu DESC`
  );
  const statusProyek = q('SELECT status, COUNT(*) n, SUM(pagu) pagu FROM proyek GROUP BY status');
  const metode = q(
    `SELECT COALESCE(NULLIF(metode_pengadaan,''),'Tidak Diisi') metode, COUNT(*) n, SUM(pagu) pagu
     FROM proyek GROUP BY metode ORDER BY pagu DESC`
  );
  const jenis = q(
    `SELECT jenis_pekerjaan, COUNT(*) n, SUM(pagu) pagu FROM proyek GROUP BY jenis_pekerjaan ORDER BY pagu DESC`
  );
  const proyekPilihan = q(
    `SELECT kode, nama, kecamatan, pagu, progres, status FROM proyek
     WHERE status='Berjalan' ORDER BY pagu DESC LIMIT 8`
  );
  const terbaru = q(
    `SELECT kode, judul, pesan, level, kategori, kecamatan, waktu, indikator
     FROM peringatan ORDER BY id DESC LIMIT 10`
  );
  res.json({
    metrik: m,
    peringatan: pering,
    trenPeringatan: tren.reverse(),
    perKecamatan: progresKec,
    statusProyek,
    metode,
    jenisPekerjaan: jenis,
    proyekPilihan,
    peringatanTerbaru: terbaru,
    analisis: analisisKesenjangan(),
  });
});

// ================================ PROYEK
app.get('/api/proyek', wajibIzin('proyek:read'), (req, res) => {
  const { limit, offset } = paging(req);
  const where = [];
  const params = [];
  if (req.query.q) {
    where.push('(p.nama LIKE ? OR p.kode LIKE ? OR p.lokasi_mentioned LIKE ?)');
    params.push(like(req.query.q), like(req.query.q), like(req.query.q));
  }
  if (req.query.kecamatan) {
    where.push('p.kecamatan = ?');
    params.push(req.query.kecamatan);
  }
  if (req.query.satker) {
    where.push('p.satker = ?');
    params.push(req.query.satker);
  }
  if (req.query.status) {
    where.push('p.status = ?');
    params.push(req.query.status);
  }
  if (req.query.metode) {
    where.push('p.metode_pengadaan = ?');
    params.push(req.query.metode);
  }
  if (req.query.jenis) {
    where.push('p.jenis_pekerjaan = ?');
    params.push(req.query.jenis);
  }
  if (req.query.level) {
    where.push('r.level = ?');
    params.push(req.query.level);
  }
  if (req.query.sumber) {
    where.push('p.sumber_pendanaan = ?');
    params.push(req.query.sumber);
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = g(`SELECT COUNT(*) n FROM proyek p LEFT JOIN risiko r ON r.proyek_id=p.id ${w}`, ...params).n;
  const urut = { pagu: 'p.pagu', progres: 'p.progres', risiko: 'r.skor', nama: 'p.nama' }[
    req.query.urut || 'pagu'
  ];
  const items = q(
    `SELECT p.*, r.level, r.skor AS skor_risiko,
            (SELECT COUNT(*) FROM temuan t WHERE t.proyek_id=p.id AND t.status NOT IN ('Ditutup','Selesai')) temuan_terbuka,
            (SELECT COUNT(*) FROM pengawasan pw WHERE pw.proyek_id=p.id) jumlah_pengawasan,
            (SELECT COUNT(*) FROM penugasan pg WHERE pg.proyek_id=p.id AND pg.status='Aktif') tenaga_ditugaskan,
            py.nama AS penyedia_nama, py.kualifikasi AS penyedia_kualifikasi, py.sbu_aktif AS penyedia_sbu
     FROM proyek p
     LEFT JOIN risiko r ON r.proyek_id=p.id
     LEFT JOIN penyedia_jasa py ON py.id=p.penyedia_id
     ${w}
     ORDER BY ${urut} DESC LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset
  );
  res.json({ total, limit, offset, items });
});

app.get('/api/proyek/:kode', wajibIzin('proyek:read'), (req, res) => {
  const p = g('SELECT * FROM proyek WHERE kode=? OR id=?', req.params.kode, req.params.kode);
  if (!p) return res.status(404).json({ pesan: 'Proyek tidak ditemukan' });
  const s = skorProyek(p);
  res.json({
    proyek: p,
    ...s,
    penyedia: p.penyedia_id ? g('SELECT * FROM penyedia_jasa WHERE id=?', p.penyedia_id) : null,
    penugasan: q(
      `SELECT pg.id, pg.jabatan, pg.status, t.kode, t.nama, t.kualifikasi, t.jenjang,
              t.penerbit, t.no_sertifikat, t.jabatan_kerja
       FROM penugasan pg JOIN tenaga_kerja t ON t.id=pg.tenaga_id
       WHERE pg.proyek_id=? ORDER BY t.kualifikasi, t.nama`,
      p.id
    ),
    pengawasan: q('SELECT * FROM pengawasan WHERE proyek_id=? ORDER BY tanggal DESC', p.id),
    temuan: q('SELECT * FROM temuan WHERE proyek_id=? ORDER BY tanggal DESC', p.id),
    risiko: g('SELECT * FROM risiko WHERE proyek_id=?', p.id),
    peringatan: q('SELECT * FROM peringatan WHERE proyek_id=? ORDER BY level', p.id),
    pengaduan: q('SELECT * FROM pengaduan WHERE proyek_id=?', p.id),
  });
});

app.post('/api/proyek', wajibIzin('proyek:create'), (req, res) => {
  const b = req.body || {};
  if (!b.nama || !String(b.nama).trim()) return res.status(400).json({ pesan: 'Nama proyek wajib diisi' });
  try {
    const kode = kodeProyekBerikutnya(b);
    const proyek = simpanProyek(b, kode, null);
    audit(namaAksi(req), 'buat', 'proyek', proyek.id, { kode, nama: proyek.nama });
    hitungUlang();
    idkirim('hitung-ulang', { sumber: 'proyek', aksi: 'buat', kode });
    res.status(201).json({ ok: true, proyek });
  } catch (e) {
    res.status(e.status || 500).json({ pesan: e.message });
  }
});

/** Tentukan kode proyek: pakai yang diminta bila ada, atau nomor urut berikutnya. */
/**
 * Nomor urut berikutnya untuk kode otomatis.
 *
 * Angka diambil dari nomor terbesar yang SUDAH ADA, bukan dari jumlah baris:
 * penghapusan baris terakhir membuat COUNT(*) mundur dan poised menghasilkan
 * kode yang sudah dipakai. Teks dipindai langsung agar pola kode lama
 * (mis. PRJ-2025-097) tetap ikut dipertahankan.
 */
function urutBerikutnya(tabel, kolom, prefix, lebar) {
  let maks = 0;
  const re = new RegExp(`^${prefix}(\\d+)$`);
  for (const { v } of db.prepare(`SELECT ${kolom} v FROM ${tabel} WHERE ${kolom} LIKE ?`).all(`${prefix}%`)) {
    const cocok = re.exec(v || '');
    if (cocok) maks = Math.max(maks, Number(cocok[1]));
  }
  return String(maks + 1).padStart(lebar, '0');
}

/**
 * Tentukan kode untuk data baru. Kode dari klien dipakai apa adanya bila
 * tersedia; kode otomatis錯 tidak pernah menabrak data yang ada.
 */
function kodeOtomatis(tabel, kolom, prefix, lebar, kodeDiminta, label) {
  if (kodeDiminta) {
    const ada = db.prepare(`SELECT 1 FROM ${tabel} WHERE ${kolom}=?`).get(kodeDiminta);
    if (ada) {
      const e = new Error(`Kode ${label} ${kodeDiminta} sudah digunakan.`);
      e.status = 409;
      throw e;
    }
    return kodeDiminta;
  }
  let urut = urutBerikutnya(tabel, kolom, prefix, lebar);
  // Bergeser sampai benar-benar kosong, untuk jaga-jaga bila ada celah.
  while (db.prepare(`SELECT 1 FROM ${tabel} WHERE ${kolom}=?`).get(`${prefix}${urut}`)) {
    urut = String(Number(urut) + 1).padStart(lebar, '0');
  }
  return `${prefix}${urut}`;
}

function kodeProyekBerikutnya(b) {
  return kodeOtomatis('proyek', 'kode', 'PRJ-2025-', 3, String(b.kode || '').trim(), 'proyek');
}

/** Field proyek yang boleh dikirim klien saat membuat atau mengubah. */
const KOLOM_PROYEK = [
  'nama', 'sumber_pendanaan', 'operator', 'teknisi_analis', 'jumlah_tenaga', 'pagu',
  'metode_pengadaan', 'satker', 'jenis_pengadaan', 'jenis_pekerjaan', 'lokasi_mentioned',
  'kecamatan', 'latitude', 'longitude', 'status', 'progres', 'tanggal_mulai',
  'tanggal_rencana_selesai', 'tanggal_aktual_selesai', 'penyedia_id', 'nilai_kontrak',
];

function bersihkanProyek(b, lama = {}) {
  const ambil = (k, bawaan) => (b[k] !== undefined ? b[k] : lama[k] !== undefined ? lama[k] : bawaan);
  const operator = n(ambil('operator', 0));
  const teknisi = n(ambil('teknisi_analis', 0));
  let jumlah = n(ambil('jumlah_tenaga', operator + teknisi));
  if (!jumlah) jumlah = operator + teknisi;
  const progres = Math.min(100, Math.max(0, n(ambil('progres', 0))));
  return {
    nama: String(ambil('nama', '')).trim(),
    sumber_pendanaan: ambil('sumber_pendanaan', 'APBD'),
    operator,
    teknisi_analis: teknisi,
    jumlah_tenaga: jumlah,
    pagu: n(ambil('pagu', 0)),
    metode_pengadaan: ambil('metode_pengadaan', 'Pengadaan Langsung'),
    satker: ambil('satker', 'DPURPK Kabupaten Belitung Timur'),
    jenis_pengadaan: ambil('jenis_pengadaan', 'Pekerjaan Konstruksi'),
    jenis_pekerjaan: ambil('jenis_pekerjaan', 'Lainnya'),
    lokasi_mentioned: ambil('lokasi_mentioned', ''),
    kecamatan: ambil('kecamatan', 'Manggar'),
    latitude: n(ambil('latitude', 0)) || null,
    longitude: n(ambil('longitude', 0)) || null,
    status: ambil('status', 'Berjalan'),
    progres,
    tanggal_mulai: ambil('tanggal_mulai', null),
    tanggal_rencana_selesai: ambil('tanggal_rencana_selesai', null),
    tanggal_aktual_selesai: ambil('tanggal_aktual_selesai', null),
    penyedia_id: n(ambil('penyedia_id', 0)) || null,
    nilai_kontrak: n(ambil('nilai_kontrak', 0)),
  };
}

function simpanProyek(b, kode, id) {
  // Saat PATCH, data lama harus jadi dasar agar field yang tidak dikirim
  // tidak tertimpa default kosong/nol.
  const lama = id ? g('SELECT * FROM proyek WHERE id=?', id) : null;
  const d = bersihkanProyek(b, lama || {});
  if (id) {
    db.prepare(
      `UPDATE proyek SET nama=@nama, sumber_pendanaan=@sumber_pendanaan, operator=@operator,
        teknisi_analis=@teknisi_analis, jumlah_tenaga=@jumlah_tenaga, pagu=@pagu,
        metode_pengadaan=@metode_pengadaan, satker=@satker, jenis_pengadaan=@jenis_pengadaan,
        jenis_pekerjaan=@jenis_pekerjaan, lokasi_mentioned=@lokasi_mentioned, kecamatan=@kecamatan,
        latitude=@latitude, longitude=@longitude, status=@status, progres=@progres,
        tanggal_mulai=@tanggal_mulai, tanggal_rencana_selesai=@tanggal_rencana_selesai,
        tanggal_aktual_selesai=@tanggal_aktual_selesai, penyedia_id=@penyedia_id,
        nilai_kontrak=@nilai_kontrak WHERE id=@id`
    ).run({ ...d, id });
    return g('SELECT * FROM proyek WHERE id=?', id);
  }
  const r = db
    .prepare(
      `INSERT INTO proyek (kode, nama, sumber_pendanaan, operator, teknisi_analis, jumlah_tenaga,
        pagu, metode_pengadaan, satker, jenis_pengadaan, jenis_pekerjaan, lokasi_mentioned,
        kecamatan, latitude, longitude, status, progres, tanggal_mulai, tanggal_rencana_selesai,
        tanggal_aktual_selesai, penyedia_id, nilai_kontrak)
       VALUES (@kode,@nama,@sumber_pendanaan,@operator,@teknisi_analis,@jumlah_tenaga,@pagu,
        @metode_pengadaan,@satker,@jenis_pengadaan,@jenis_pekerjaan,@lokasi_mentioned,@kecamatan,
        @latitude,@longitude,@status,@progres,@tanggal_mulai,@tanggal_rencana_selesai,
        @tanggal_aktual_selesai,@penyedia_id,@nilai_kontrak)`
    )
    .run({ ...d, kode });
  return g('SELECT * FROM proyek WHERE id=?', r.lastInsertRowid);
}

app.patch('/api/proyek/:id', wajibIzin('proyek:update'), (req, res) => {
  const p = g('SELECT * FROM proyek WHERE id=?', req.params.id);
  if (!p) return res.status(404).json({ pesan: 'Proyek tidak ditemukan' });
  if (!Object.keys(req.body || {}).some((k) => KOLOM_PROYEK.includes(k))) {
    return res.status(400).json({ pesan: 'Tidak ada field yang diperbarui' });
  }
  if (req.body.nama !== undefined && !String(req.body.nama).trim()) {
    return res.status(400).json({ pesan: 'Nama proyek tidak boleh kosong' });
  }
  try {
    const proyek = simpanProyek(req.body, p.kode, p.id);
    audit(namaAksi(req), 'ubah', 'proyek', p.id, req.body);
    hitungUlang();
    idkirim('hitung-ulang', { sumber: 'proyek', aksi: 'ubah', kode: p.kode });
    res.json({ ok: true, proyek });
  } catch (e) {
    res.status(e.status || 500).json({ pesan: e.message });
  }
});

app.delete('/api/proyek/:id', wajibIzin('proyek:delete'), (req, res) => {
  const p = g('SELECT * FROM proyek WHERE id=?', req.params.id);
  if (!p) return res.status(404).json({ pesan: 'Proyek tidak ditemukan' });
  const rincian = g(
    `SELECT (SELECT COUNT(*) FROM penugasan WHERE proyek_id=?) penugasan,
            (SELECT COUNT(*) FROM pengawasan WHERE proyek_id=?) pengawasan,
            (SELECT COUNT(*) FROM temuan WHERE proyek_id=?) temuan`,
    p.id,
    p.id,
    p.id
  );
  db.prepare('DELETE FROM proyek WHERE id=?').run(p.id);
  audit(namaAksi(req), 'hapus', 'proyek', p.id, { kode: p.kode, nama: p.nama, rincian });
  hitungUlang();
  idkirim('hitung-ulang', { sumber: 'proyek', aksi: 'hapus', kode: p.kode });
  res.json({ ok: true, kode: p.kode, rincian });
});

// ================================ TENAGA KERJA
app.get('/api/tenaga-kerja', wajibIzin('tenaga:read'), (req, res) => {
  const { limit, offset } = paging(req);
  const where = [];
  const params = [];
  if (req.query.q) {
    where.push('(t.nama LIKE ? OR t.no_sertifikat LIKE ?)');
    params.push(like(req.query.q), like(req.query.q));
  }
  if (req.query.kualifikasi) {
    where.push('t.kualifikasi = ?');
    params.push(req.query.kualifikasi);
  }
  if (req.query.klasifikasi) {
    where.push('t.klasifikasi = ?');
    params.push(req.query.klasifikasi);
  }
  if (req.query.jenjang) {
    where.push('t.jenjang = ?');
    params.push(req.query.jenjang);
  }
  if (req.query.penerbit) {
    where.push('t.penerbit = ?');
    params.push(req.query.penerbit);
  }
  if (req.query.jabatan) {
    where.push('t.jabatan_kerja = ?');
    params.push(req.query.jabatan);
  }
  if (req.query.proyek) {
    where.push('EXISTS (SELECT 1 FROM penugasan pg WHERE pg.tenaga_id=t.id AND pg.proyek_id=?)');
    params.push(req.query.proyek);
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = g(`SELECT COUNT(*) n FROM tenaga_kerja t ${w}`, ...params).n;
  const items = q(
    `SELECT t.*, (SELECT COUNT(*) FROM penugasan pg WHERE pg.tenaga_id=t.id AND pg.status='Aktif') proyek_aktif
     FROM tenaga_kerja t ${w} ORDER BY t.kode LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset
  );
  res.json({
    total,
    limit,
    offset,
    items,
    opsi: {
      kualifikasi: q("SELECT DISTINCT kualifikasi v FROM tenaga_kerja WHERE kualifikasi<>'' ORDER BY v").map((x) => x.v),
      jenjang: q("SELECT DISTINCT jenjang v FROM tenaga_kerja WHERE jenjang<>'' ORDER BY jenjang").map((x) => x.v),
      penerbit: q('SELECT DISTINCT penerbit v FROM tenaga_kerja WHERE penerbit<>\'\' ORDER BY v').map((x) => x.v),
      jabatan: q(
        "SELECT DISTINCT jabatan_kerja v FROM tenaga_kerja WHERE jabatan_kerja<>'' ORDER BY v LIMIT 60"
      ).map((x) => x.v),
    },
  });
});

// ================================ PENGADAAN (ekspor combine kebutuhan)
// ================================ TENAGA KERJA (CRUD)
/** Field tenaga kerja yang boleh dikirim klien. */
const KOLOM_TENAGA = [
  'nama', 'jenis_pelatihan', 'klasifikasi', 'kualifikasi', 'no_sertifikat', 'penerbit',
  'jabatan_kerja', 'jenjang', 'jenjang_angka', 'bersertifikat', 'tahun_sertifikat',
  'perusahaan_id', 'aktif',
];

function bersihkanTenaga(b, lama = {}) {
  const ambil = (k, bawaan) => (b[k] !== undefined ? b[k] : lama[k] !== undefined ? lama[k] : bawaan);
  const bersertifikat = ambil('bersertifikat', 1) ? 1 : 0;
  return {
    nama: String(ambil('nama', '')).trim(),
    jenis_pelatihan: ambil('jenis_pelatihan', ''),
    klasifikasi: ambil('klasifikasi', ''),
    kualifikasi: ambil('kualifikasi', ''),
    no_sertifikat: ambil('no_sertifikat', ''),
    penerbit: ambil('penerbit', ''),
    jabatan_kerja: ambil('jabatan_kerja', ''),
    jenjang: ambil('jenjang', ''),
    jenjang_angka: n(ambil('jenjang_angka', 0)),
    bersertifikat,
    tahun_sertifikat: n(ambil('tahun_sertifikat', 0)) || null,
    perusahaan_id: n(ambil('perusahaan_id', 0)) || null,
    aktif: ambil('aktif', 1) ? 1 : 0,
  };
}

function kodeTenagaBerikutnya(b) {
  return kodeOtomatis('tenaga_kerja', 'kode', 'TKK-2025-', 4, String(b.kode || '').trim(), 'tenaga kerja');
}

app.post('/api/tenaga-kerja', wajibIzin('tenaga:create'), (req, res) => {
  const b = req.body || {};
  if (!String(b.nama || '').trim()) return res.status(400).json({ pesan: 'Nama tenaga kerja wajib diisi' });
  if (b.no_sertifikat && g('SELECT id FROM tenaga_kerja WHERE no_sertifikat=?', String(b.no_sertifikat).trim())) {
    return res.status(409).json({ pesan: `Nomor sertifikat ${b.no_sertifikat} sudah terdaftar.` });
  }
  try {
    const kode = kodeTenagaBerikutnya(b);
    const d = bersihkanTenaga(b);
    const r = db
      .prepare(
        `INSERT INTO tenaga_kerja (kode, nama, jenis_pelatihan, klasifikasi, kualifikasi,
          no_sertifikat, penerbit, jabatan_kerja, jenjang, jenjang_angka, bersertifikat,
          tahun_sertifikat, perusahaan_id, aktif)
         VALUES (@kode,@nama,@jenis_pelatihan,@klasifikasi,@kualifikasi,@no_sertifikat,@penerbit,
          @jabatan_kerja,@jenjang,@jenjang_angka,@bersertifikat,@tahun_sertifikat,@perusahaan_id,@aktif)`
      )
      .run({ ...d, kode });
    audit(namaAksi(req), 'buat', 'tenaga_kerja', r.lastInsertRowid, { kode, nama: d.nama });
    res.status(201).json({ ok: true, tenaga: g('SELECT * FROM tenaga_kerja WHERE id=?', r.lastInsertRowid) });
  } catch (e) {
    res.status(e.status || 500).json({ pesan: e.message });
  }
});

app.patch('/api/tenaga-kerja/:id', wajibIzin('tenaga:update'), (req, res) => {
  const t = g('SELECT * FROM tenaga_kerja WHERE id=?', req.params.id);
  if (!t) return res.status(404).json({ pesan: 'Tenaga kerja tidak ditemukan' });
  if (!Object.keys(req.body || {}).some((k) => KOLOM_TENAGA.includes(k))) {
    return res.status(400).json({ pesan: 'Tidak ada field yang diperbarui' });
  }
  if (req.body.nama !== undefined && !String(req.body.nama).trim()) {
    return res.status(400).json({ pesan: 'Nama tidak boleh kosong' });
  }
  if (
    req.body.no_sertifikat &&
    g('SELECT id FROM tenaga_kerja WHERE no_sertifikat=? AND id<>?', String(req.body.no_sertifikat).trim(), t.id)
  ) {
    return res.status(409).json({ pesan: `Nomor sertifikat ${req.body.no_sertifikat} sudah terdaftar.` });
  }
  try {
    const d = bersihkanTenaga(req.body, t);
    db.prepare(
      `UPDATE tenaga_kerja SET nama=@nama, jenis_pelatihan=@jenis_pelatihan, klasifikasi=@klasifikasi,
        kualifikasi=@kualifikasi, no_sertifikat=@no_sertifikat, penerbit=@penerbit,
        jabatan_kerja=@jabatan_kerja, jenjang=@jenjang, jenjang_angka=@jenjang_angka,
        bersertifikat=@bersertifikat, tahun_sertifikat=@tahun_sertifikat, perusahaan_id=@perusahaan_id,
        aktif=@aktif WHERE id=@id`
    ).run({ ...d, id: t.id });
    audit(namaAksi(req), 'ubah', 'tenaga_kerja', t.id, req.body);
    res.json({ ok: true, tenaga: g('SELECT * FROM tenaga_kerja WHERE id=?', t.id) });
  } catch (e) {
    res.status(e.status || 500).json({ pesan: e.message });
  }
});

app.delete('/api/tenaga-kerja/:id', wajibIzin('tenaga:delete'), (req, res) => {
  const t = g('SELECT * FROM tenaga_kerja WHERE id=?', req.params.id);
  if (!t) return res.status(404).json({ pesan: 'Tenaga kerja tidak ditemukan' });
  const penugasan = g('SELECT COUNT(*) n FROM penugasan WHERE tenaga_id=?', t.id).n;
  // Penugasan ber-ON DELETE CASCADE, jadi hapus tenaga ikut membebaskan proyeknya.
  db.prepare('DELETE FROM tenaga_kerja WHERE id=?').run(t.id);
  audit(namaAksi(req), 'hapus', 'tenaga_kerja', t.id, { kode: t.kode, nama: t.nama, penugasan });
  res.json({ ok: true, kode: t.kode, rincian: { penugasan } });
});

// ================================ PENGADAAN (ekspor combine kebutuhan)
// ================================ PENYEDIA JASA
app.get('/api/penyedia', wajibIzin('penyedia:read'), (req, res) => {
  const { limit, offset } = paging(req);
  const where = [];
  const params = [];
  if (req.query.q) {
    where.push('(nama LIKE ? OR nib LIKE ? OR nama_pengusaha LIKE ?)');
    params.push(like(req.query.q), like(req.query.q), like(req.query.q));
  }
  if (req.query.kualifikasi) {
    where.push('kualifikasi = ?');
    params.push(req.query.kualifikasi);
  }
  if (req.query.badan_usaha) {
    where.push('badan_usaha = ?');
    params.push(req.query.badan_usaha);
  }
  if (req.query.status) {
    where.push('status = ?');
    params.push(req.query.status);
  }
  if (req.query.kecamatan) {
    where.push('kecamatan = ?');
    params.push(req.query.kecamatan);
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = g(`SELECT COUNT(*) n FROM penyedia_jasa ${w}`, ...params).n;
  const items = q(
    `SELECT *,
            (SELECT COUNT(*) FROM proyek p WHERE p.penyedia_id=penyedia_jasa.id) proyek_ditugaskan,
            (SELECT COALESCE(SUM(p.pagu),0) FROM proyek p WHERE p.penyedia_id=penyedia_jasa.id) nilai_kontrak
     FROM penyedia_jasa ${w} ORDER BY nama LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset
  );
  res.json({
    total,
    limit,
    offset,
    items,
    ringkasan: g(
      `SELECT COUNT(*) total,
              SUM(CASE WHEN sbu_aktif=1 THEN 1 ELSE 0 END) bersertifikat,
              SUM(CASE WHEN status='Aktif' THEN 1 ELSE 0 END) aktif
       FROM penyedia_jasa`
    ),
    // Dipakai form CRUD dan filter, bukan sekadar nilai tetap di frontend.
    opsi: {
      badan_usaha: q(
        "SELECT DISTINCT badan_usaha v FROM penyedia_jasa WHERE badan_usaha<>'' ORDER BY v"
      ).map((x) => x.v),
      kualifikasi: q(
        "SELECT DISTINCT kualifikasi v FROM penyedia_jasa WHERE kualifikasi<>'' ORDER BY v"
      ).map((x) => x.v),
      kecamatan: q(
        "SELECT DISTINCT kecamatan v FROM penyedia_jasa WHERE kecamatan<>'' ORDER BY v"
      ).map((x) => x.v),
    },
  });
});

// ================================ PENYEDIA JASA (CRUD)
/** Field penyedia jasa yang boleh dikirim klien. */
const KOLOM_PENYEDIA = [
  'nama', 'nib', 'nama_pengusaha', 'jenis_kelamin', 'alamat', 'no_hp', 'email', 'website',
  'tahun_mulai', 'badan_usaha', 'status_modal', 'pekerjaan_utama', 'kbli', 'kualifikasi',
  'sbu_aktif', 'jaringan_usaha', 'tempat_usaha', 'sumber_data', 'status', 'kecamatan',
  'skor_kemampuan',
];

function bersihkanPenyedia(b, lama = {}) {
  const ambil = (k, bawaan) => (b[k] !== undefined ? b[k] : lama[k] !== undefined ? lama[k] : bawaan);
  return {
    nama: String(ambil('nama', '')).trim(),
    nib: ambil('nib', ''),
    nama_pengusaha: ambil('nama_pengusaha', ''),
    jenis_kelamin: ambil('jenis_kelamin', ''),
    alamat: ambil('alamat', ''),
    no_hp: ambil('no_hp', ''),
    email: ambil('email', ''),
    website: ambil('website', ''),
    tahun_mulai: n(ambil('tahun_mulai', 0)) || null,
    badan_usaha: ambil('badan_usaha', ''),
    status_modal: ambil('status_modal', ''),
    pekerjaan_utama: ambil('pekerjaan_utama', ''),
    kbli: ambil('kbli', ''),
    kualifikasi: ambil('kualifikasi', ''),
    sbu_aktif: ambil('sbu_aktif', 0) ? 1 : 0,
    jaringan_usaha: ambil('jaringan_usaha', ''),
    tempat_usaha: ambil('tempat_usaha', ''),
    sumber_data: ambil('sumber_data', 'Manual'),
    status: ambil('status', 'Aktif'),
    kecamatan: ambil('kecamatan', ''),
    skor_kemampuan: Math.min(100, Math.max(1, n(ambil('skor_kemampuan', 50)))),
  };
}

function kodePenyediaBerikutnya(b) {
  return kodeOtomatis('penyedia_jasa', 'kode', 'PEN-2025-', 3, String(b.kode || '').trim(), 'penyedia');
}

app.post('/api/penyedia', wajibIzin('penyedia:create'), (req, res) => {
  const b = req.body || {};
  if (!String(b.nama || '').trim()) return res.status(400).json({ pesan: 'Nama penyedia wajib diisi' });
  if (b.nib && g('SELECT id FROM penyedia_jasa WHERE nib=?', String(b.nib).trim())) {
    return res.status(409).json({ pesan: `NIB ${b.nib} sudah terdaftar.` });
  }
  try {
    const kode = kodePenyediaBerikutnya(b);
    const d = bersihkanPenyedia(b);
    const r = db
      .prepare(
        `INSERT INTO penyedia_jasa (kode, nama, nib, nama_pengusaha, jenis_kelamin, alamat, no_hp,
          email, website, tahun_mulai, badan_usaha, status_modal, pekerjaan_utama, kbli, kualifikasi,
          sbu_aktif, jaringan_usaha, tempat_usaha, sumber_data, status, kecamatan, skor_kemampuan)
         VALUES (@kode,@nama,@nib,@nama_pengusaha,@jenis_kelamin,@alamat,@no_hp,@email,@website,
          @tahun_mulai,@badan_usaha,@status_modal,@pekerjaan_utama,@kbli,@kualifikasi,@sbu_aktif,
          @jaringan_usaha,@tempat_usaha,@sumber_data,@status,@kecamatan,@skor_kemampuan)`
      )
      .run({ ...d, kode });
    audit(namaAksi(req), 'buat', 'penyedia_jasa', r.lastInsertRowid, { kode, nama: d.nama });
    res.status(201).json({ ok: true, penyedia: g('SELECT * FROM penyedia_jasa WHERE id=?', r.lastInsertRowid) });
  } catch (e) {
    res.status(e.status || 500).json({ pesan: e.message });
  }
});

app.patch('/api/penyedia/:id', wajibIzin('penyedia:update'), (req, res) => {
  const s = g('SELECT * FROM penyedia_jasa WHERE id=?', req.params.id);
  if (!s) return res.status(404).json({ pesan: 'Penyedia jasa tidak ditemukan' });
  if (!Object.keys(req.body || {}).some((k) => KOLOM_PENYEDIA.includes(k))) {
    return res.status(400).json({ pesan: 'Tidak ada field yang diperbarui' });
  }
  if (req.body.nama !== undefined && !String(req.body.nama).trim()) {
    return res.status(400).json({ pesan: 'Nama penyedia tidak boleh kosong' });
  }
  if (req.body.nib && g('SELECT id FROM penyedia_jasa WHERE nib=? AND id<>?', String(req.body.nib).trim(), s.id)) {
    return res.status(409).json({ pesan: `NIB ${req.body.nib} sudah terdaftar.` });
  }
  try {
    const d = bersihkanPenyedia(req.body, s);
    db.prepare(
      `UPDATE penyedia_jasa SET nama=@nama, nib=@nib, nama_pengusaha=@nama_pengusaha,
        jenis_kelamin=@jenis_kelamin, alamat=@alamat, no_hp=@no_hp, email=@email, website=@website,
        tahun_mulai=@tahun_mulai, badan_usaha=@badan_usaha, status_modal=@status_modal,
        pekerjaan_utama=@pekerjaan_utama, kbli=@kbli, kualifikasi=@kualifikasi, sbu_aktif=@sbu_aktif,
        jaringan_usaha=@jaringan_usaha, tempat_usaha=@tempat_usaha, sumber_data=@sumber_data,
        status=@status, kecamatan=@kecamatan, skor_kemampuan=@skor_kemampuan WHERE id=@id`
    ).run({ ...d, id: s.id });
    audit(namaAksi(req), 'ubah', 'penyedia_jasa', s.id, req.body);
    res.json({ ok: true, penyedia: g('SELECT * FROM penyedia_jasa WHERE id=?', s.id) });
  } catch (e) {
    res.status(e.status || 500).json({ pesan: e.message });
  }
});

app.delete('/api/penyedia/:id', wajibIzin('penyedia:delete'), (req, res) => {
  const s = g('SELECT * FROM penyedia_jasa WHERE id=?', req.params.id);
  if (!s) return res.status(404).json({ pesan: 'Penyedia jasa tidak ditemukan' });
  const rincian = {
    proyek: g('SELECT COUNT(*) n FROM proyek WHERE penyedia_id=?', s.id).n,
    tenaga: g('SELECT COUNT(*) n FROM tenaga_kerja WHERE perusahaan_id=?', s.id).n,
  };
  // Proyek & tenaga memakai ON DELETE SET NULL, jadi data induk tetap utuh.
  db.prepare('DELETE FROM penyedia_jasa WHERE id=?').run(s.id);
  audit(namaAksi(req), 'hapus', 'penyedia_jasa', s.id, { kode: s.kode, nama: s.nama, rincian });
  res.json({ ok: true, kode: s.kode, rincian });
});

// ================================ PENGAWASAN & TEMUAN
app.get('/api/pengawasan', wajibIzin('pengawasan:read'), (req, res) => {
  const { limit, offset } = paging(req);
  const where = [];
  const params = [];
  if (req.query.proyek) {
    where.push('pw.proyek_id = ?');
    params.push(req.query.proyek);
  }
  if (req.query.q) {
    where.push('(p.nama LIKE ? OR pw.kode LIKE ?)');
    params.push(like(req.query.q), like(req.query.q));
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  res.json({
    total: g(`SELECT COUNT(*) n FROM pengawasan pw JOIN proyek p ON p.id=pw.proyek_id ${w}`, ...params).n,
    items: q(
      `SELECT pw.*, p.kode AS proyek_kode, p.nama AS proyek_nama, p.kecamatan, p.progres
       FROM pengawasan pw JOIN proyek p ON p.id=pw.proyek_id ${w}
       ORDER BY pw.tanggal DESC, pw.id DESC LIMIT ? OFFSET ?`,
      ...params,
      limit,
      offset
    ),
  });
});

app.post('/api/pengawasan', wajibIzin('pengawasan:create'), (req, res) => {
  const b = req.body || {};
  const p = g('SELECT * FROM proyek WHERE id=? OR kode=?', b.proyek_id, b.kode_proyek);
  if (!p) return res.status(404).json({ pesan: 'Proyek tidak ditemukan' });
  const kode = `PWG-${p.kode}-${Date.now().toString(36).toUpperCase()}`;
  const id = db
    .prepare(
      `INSERT INTO pengawasan (kode, proyek_id, tanggal, pengawas, lokasi, cuaca,
        jumlah_pekerja_harian, alat_berat, material_terpasang, catatan, foto)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      kode,
      p.id,
      b.tanggal || new Date().toISOString().slice(0, 10),
      b.pengawas || namaAksi(req),
      b.lokasi || p.lokasi_mentioned,
      b.cuaca || 'Cerah',
      n(b.jumlah_pekerja_harian),
      n(b.alat_berat),
      n(b.material_terpasang),
      b.catatan || '',
      b.foto || ''
    ).lastInsertRowid;
  audit(namaAksi(req), 'buat', 'pengawasan', id, { proyek: p.kode });
  res.status(201).json({ ok: true, id, kode });
});

app.get('/api/temuan', wajibIzin('pengawasan:read'), (req, res) => {
  const { limit, offset } = paging(req);
  const where = [];
  const params = [];
  if (req.query.proyek) {
    where.push('t.proyek_id = ?');
    params.push(req.query.proyek);
  }
  if (req.query.status) {
    where.push('t.status = ?');
    params.push(req.query.status);
  }
  if (req.query.tingkat) {
    where.push('t.tingkat = ?');
    params.push(req.query.tingkat);
  }
  if (req.query.kategori) {
    where.push('t.kategori = ?');
    params.push(req.query.kategori);
  }
  if (req.query.q) {
    where.push('(t.deskripsi LIKE ? OR p.nama LIKE ?)');
    params.push(like(req.query.q), like(req.query.q));
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  res.json({
    total: g(`SELECT COUNT(*) n FROM temuan t JOIN proyek p ON p.id=t.proyek_id ${w}`, ...params).n,
    items: q(
      `SELECT t.*, p.nama AS proyek_nama, p.kode AS proyek_kode, p.kecamatan
       FROM temuan t JOIN proyek p ON p.id=t.proyek_id ${w}
       ORDER BY t.tanggal DESC, t.id DESC LIMIT ? OFFSET ?`,
      ...params,
      limit,
      offset
    ),
    ringkasan: q(
      `SELECT t.kategori, COUNT(*) n,
              SUM(CASE WHEN t.status NOT IN ('Ditutup','Selesai') THEN 1 ELSE 0 END) terbuka
       FROM temuan t GROUP BY t.kategori ORDER BY n DESC`
    ),
  });
});

app.patch('/api/temuan/:id', wajibIzin('pengawasan:update'), (req, res) => {
  const b = req.body || {};
  const t = g('SELECT * FROM temuan WHERE id=?', req.params.id);
  if (!t) return res.status(404).json({ pesan: 'Temuan tidak ditemukan' });
  const sets = [];
  const vals = [];
  ['status', 'tingkat', 'tindakan', 'tenggat', 'deskripsi'].forEach((f) => {
    if (b[f] !== undefined) {
      sets.push(`${f}=?`);
      vals.push(b[f]);
    }
  });
  if (b.status === 'Ditutup' || b.status === 'Selesai') {
    sets.push('tanggal_closure=?');
    vals.push(new Date().toISOString().slice(0, 10));
  }
  if (sets.length) {
    vals.push(t.id);
    db.prepare(`UPDATE temuan SET ${sets.join(',')} WHERE id=?`).run(...vals);
  }
  audit(namaAksi(req), 'ubah', 'temuan', t.id, b);
  res.json({ ok: true, temuan: g('SELECT * FROM temuan WHERE id=?', t.id) });
});

// ================================ RISIKO & PERINGATAN
app.get('/api/risiko', wajibIzin('risiko:read'), (req, res) => {
  const { limit, offset } = paging(req);
  const where = [];
  const params = [];
  if (req.query.level) {
    where.push('r.level = ?');
    params.push(req.query.level);
  }
  if (req.query.kecamatan) {
    where.push('p.kecamatan = ?');
    params.push(req.query.kecamatan);
  }
  if (req.query.q) {
    where.push('(p.nama LIKE ? OR r.deskripsi LIKE ?)');
    params.push(like(req.query.q), like(req.query.q));
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  res.json({
    total: g(`SELECT COUNT(*) n FROM risiko r JOIN proyek p ON p.id=r.proyek_id ${w}`, ...params).n,
    items: q(
      `SELECT r.*, p.kode AS proyek_kode, p.nama AS proyek_nama, p.kecamatan, p.pagu, p.progres, p.status
       FROM risiko r JOIN proyek p ON p.id=r.proyek_id ${w}
       ORDER BY CASE r.level WHEN 'Ekstrem' THEN 4 WHEN 'Tinggi' THEN 3 WHEN 'Sedang' THEN 2 ELSE 1 END DESC,
                r.skor DESC LIMIT ? OFFSET ?`,
      ...params,
      limit,
      offset
    ),
    matriks: q(
      'SELECT probabilitas, dampak, COUNT(*) n FROM risiko GROUP BY probabilitas, dampak'
    ),
  });
});

app.get('/api/peringatan', wajibIzin('peringatan:read'), (req, res) => {
  const { limit, offset } = paging(req);
  const where = [];
  const params = [];
  if (req.query.level) {
    where.push('pw.level = ?');
    params.push(req.query.level);
  }
  if (req.query.kecamatan) {
    where.push('pw.kecamatan = ?');
    params.push(req.query.kecamatan);
  }
  if (req.query.indikator) {
    where.push('pw.indikator = ?');
    params.push(req.query.indikator);
  }
  if (req.query.belum) where.push('pw.dibaca = 0');
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  res.json({
    total: g(`SELECT COUNT(*) n FROM peringatan pw ${w}`, ...params).n,
    items: q(
      `SELECT pw.*, p.kode AS proyek_kode, p.nama AS proyek_nama, p.pagu, p.progres
       FROM peringatan pw LEFT JOIN proyek p ON p.id=pw.proyek_id ${w}
       ORDER BY CASE pw.level WHEN 'Ekstrem' THEN 4 WHEN 'Tinggi' THEN 3 WHEN 'Sedang' THEN 2 ELSE 1 END DESC,
                pw.id DESC LIMIT ? OFFSET ?`,
      ...params,
      limit,
      offset
    ),
    statistik: statistikPeringatan(),
    aturan: [...ATURAN_EW, ...ATURAN_AGGREGAT].map((a) => ({ id: a.id, nama: a.nama })),
  });
});

app.patch('/api/peringatan/:id', wajibIzin('peringatan:update'), (req, res) => {
  const pw = g('SELECT * FROM peringatan WHERE id=?', req.params.id);
  if (!pw) return res.status(404).json({ pesan: 'Peringatan tidak ditemukan' });
  const b = req.body || {};
  // Field yang tidak dikirim harus mempertahankan nilai lama; menandai
  // "dibaca" secara otomatis akan menyembunyikan peringatan yang belum ditindak.
  db.prepare('UPDATE peringatan SET dibaca=?, ditindaklanjuti=? WHERE id=?').run(
    b.dibaca !== undefined ? (b.dibaca ? 1 : 0) : pw.dibaca,
    b.ditindaklanjuti !== undefined ? (b.ditindaklanjuti ? 1 : 0) : pw.ditindaklanjuti,
    pw.id
  );
  audit(namaAksi(req), 'tindak-lanjuti', 'peringatan', pw.id, b);
  res.json({ ok: true });
});

app.post('/api/dss/hitung-ulang', wajibIzin('risiko:update'), (req, res) => {
  const r = hitungUlang({ denganPeringatan: true });
  idkirim('hitung-ulang', r);
  res.json(r);
});

// ================================ PETA
app.get('/api/peta', wajibIzin('peta:read'), (_req, res) => {
  const titik = petaRisiko();
  const ringkasan = q(
    `SELECT p.kecamatan, k.lat, k.lng,
            COUNT(*) jumlah_proyek, SUM(p.pagu) pagu,
            SUM(CASE WHEN p.status='Berjalan' THEN 1 ELSE 0 END) berjalan,
            SUM(CASE WHEN r.level='Ekstrem' THEN 1 ELSE 0 END) ekstrem,
            SUM(CASE WHEN r.level='Tinggi' THEN 1 ELSE 0 END) tinggi,
            SUM(CASE WHEN r.level='Sedang' THEN 1 ELSE 0 END) sedang,
            SUM(CASE WHEN r.level='Rendah' THEN 1 ELSE 0 END) rendah,
            ROUND(AVG(p.progres),1) progres
     FROM proyek p LEFT JOIN risiko r ON r.proyek_id=p.id
     LEFT JOIN kecamatan k ON k.nama=p.kecamatan
     GROUP BY p.kecamatan`
  );
  res.json({ titik, ringkasan, zona: ['Rendah', 'Sedang', 'Tinggi', 'Ekstrem'] });
});

// ================================ LAPORAN
app.get('/api/laporan/ringkasan', wajibIzin('laporan:read'), (_req, res) => {
  const m = metrik();
  const per = statistikPeringatan();
  res.json({
    judul: 'Laporan Pemantauan dan Pengawasan Jasa Konstruksi',
generated_pada: new Date().toISOString(),
    meta: {
      aplikasi: getMeta('nama'),
      subjudul: getMeta('subjudul'),
      satuan_kerja: getMeta('satuan_kerja'),
      sumber_data: getMeta('sumber_data'),
      tahun: getMeta('tahun'),
      kabupaten: getMeta('kabupaten'),
    },
    ikk: {
      target: Number(getMeta('ikk_target') || 0),
      tercapai: m.ikk,
      selisih: Number((m.ikk - Number(getMeta('ikk_target') || 0)).toFixed(2)),
      komponen: {
        tersedia: m.tkk.total,
        kebutuhan: m.kebutuhan.total,
        gap: m.gap.total,
      },
    },
    anggaran: m.anggaran,
    proyek: m.proyek,
    penyedia: m.penyedia,
    pengawasan: m.pengawasan,
    risiko: m.risiko,
    peringatan: per,
    kesimpulan: buildKesimpulan(m, per),
  });
});

function buildKesimpulan(m, per) {
  const c = [];
  const totalBerisiko = m.risiko.Tinggi + m.risiko.Ekstrem;
  c.push(
    `Terdapat ${m.proyek.total} proyek konstruksi dengan total pagu Rp ${Math.round(
      m.anggaran.pagu_total
    ).toLocaleString('id-ID')}, tersebar pada ${q('SELECT COUNT(DISTINCT kecamatan) n FROM proyek')[0].n} kecamatan.`
  );
  c.push(
    `Indeks KKTC (IKK) tenaga kerja bersertifikat sebesar ${m.ikk}% terhadap kebutuhan ${m.kebutuhan.total} orang, ` +
      `${m.ikk >= Number(getMeta('ikk_target') || 0) ? 'di atas' : 'di bawah'} target ${getMeta('ikk_target')}%. ` +
      `Tersisa kesenjangan ${m.gap.total} orang (operator ${m.gap.operator}, teknisi/analis ${m.gap.teknisi_analis}).`
  );
  c.push(
    `${totalBerisiko} proyek berada pada level risiko Tinggi/Ekstrem dan ${per.total} peringatan dini aktif, ` +
      `terutama ${per.perAturan.slice(0, 3).map((a) => a.judul).join(', ')}.`
  );
  if (m.penyedia.tanpa_sbu > 0) {
    c.push(`${m.penyedia.tanpa_sbu} penyedia jasa belum memiliki SBU/kualifikasi terverifikasi sehingga perlu pengesahan sebelum penetapan.`);
  }
  return c;
}

const EKSPOR = {
  proyek: {
    file: 'begasak-proyek',
    sql: `SELECT p.kode,p.nama,p.kecamatan,p.satker,p.metode_pengadaan,p.jenis_pekerjaan,
                 p.sumber_pendanaan,p.jumlah_tenaga,p.operator,p.teknisi_analis,p.pagu,
                 p.nilai_kontrak,p.progres,p.status,p.tanggal_mulai,p.tanggal_rencana_selesai,
                 r.level AS level_risiko,r.skor AS skor_risiko
          FROM proyek p LEFT JOIN risiko r ON r.proyek_id=p.id
          ORDER BY r.skor DESC, p.pagu DESC`,
  },
  tenaga: {
    file: 'begasak-tenaga-kerja',
    sql: `SELECT kode,nama,klasifikasi,kualifikasi,jenjang,jenjang_angka,no_sertifikat,penerbit,
                 jabatan_kerja,tahun_sertifikat,bersertifikat,aktif,
                 (SELECT COUNT(*) FROM penugasan pg WHERE pg.tenaga_id=tenaga_kerja.id AND pg.status='Aktif') AS proyek_aktif
          FROM tenaga_kerja ORDER BY kode`,
  },
  penyedia: {
    file: 'begasak-penyedia-jasa',
    sql: `SELECT kode,nama,nib,nama_pengusaha,badan_usaha,status,kualifikasi,kbli,sbu_aktif,
                 pekerjaan_utama,alamat,kecamatan,tempat_usaha,skor_kemampuan,
                 (SELECT COUNT(*) FROM proyek p WHERE p.penyedia_id=penyedia_jasa.id) AS proyek_ditugaskan
          FROM penyedia_jasa ORDER BY skor_kemampuan DESC, nama`,
  },
  temuan: {
    file: 'begasak-temuan',
    sql: `SELECT t.kode,t.tanggal,t.kategori,t.deskripsi,t.lokasi,t.tingkat,t.status,t.konsekuensi,
                 t.tindakan,t.tenggat,t.tanggal_closure,t.pelapor,
                 p.kode AS proyek_kode,p.nama AS proyek_nama,p.kecamatan
          FROM temuan t LEFT JOIN proyek p ON p.id=t.proyek_id
          ORDER BY t.tanggal DESC`,
  },
  pengawasan: {
    file: 'begasak-pengawasan',
    sql: `SELECT s.kode,s.tanggal,s.pengawas,s.lokasi,s.cuaca,s.jumlah_pekerja_harian,s.alat_berat,
                 s.material_terpasang,s.catatan,s.status_verifikasi,
                 p.kode AS proyek_kode,p.nama AS proyek_nama,p.kecamatan
          FROM pengawasan s LEFT JOIN proyek p ON p.id=s.proyek_id
          ORDER BY s.tanggal DESC`,
  },
  peringatan: {
    file: 'begasak-peringatan-dini',
    sql: `SELECT kode,waktu,level,kategori,indikator,judul,pesan,kecamatan,sumber,dibaca,ditindaklanjuti
          FROM peringatan ORDER BY waktu DESC`,
  },
};

function keCsv(rows) {
  if (!rows.length) return '';
  const sel = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/\r?\n/g, ' ').trim();
    return /[";]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = Object.keys(rows[0]).map((k) => k.toUpperCase().replace(/_/g, ' '));
  return (
    '\uFEFF' +
    [head.map(sel).join(';'), ...rows.map((r) => Object.values(r).map(sel).join(';'))].join('\r\n')
  );
}

app.get('/api/laporan/ekspor', wajibIzin('laporan:ekspor'), (req, res) => {
  const format = req.query.format || 'json';
  if (format === 'csv') {
    const kunci = String(req.query.data || 'proyek').toLowerCase();
    const def = EKSPOR[kunci];
    if (!def) {
      return res.status(400).json({
        error: `data tidak dikenal: ${kunci}`,
        tersedia: Object.keys(EKSPOR),
      });
    }
    const rows = q(def.sql);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${def.file}.csv"`);
    return res.send(keCsv(rows));
  }
  res.json({
    proyek: q('SELECT * FROM proyek ORDER BY pagu DESC'),
    tenaga: q('SELECT * FROM tenaga_kerja ORDER BY kode'),
    penyedia: q('SELECT * FROM penyedia_jasa ORDER BY nama'),
    temuan: q('SELECT * FROM temuan ORDER BY tanggal DESC'),
    peringatan: q('SELECT * FROM peringatan ORDER BY waktu DESC'),
  });
});

// ================================ PENGADUAN MASYARAKAT
app.get('/api/pengaduan', wajibIzin('pengaduan:read'), (req, res) => {
  const { limit, offset } = paging(req);
  const w = req.query.status ? 'WHERE status = ?' : '';
  const params = req.query.status ? [req.query.status] : [];
  res.json({
    total: g(`SELECT COUNT(*) n FROM pengaduan ${w}`, ...params).n,
    items: q(
      `SELECT pg.*, p.nama AS proyek_nama, p.kode AS proyek_kode FROM pengaduan pg
       LEFT JOIN proyek p ON p.id=pg.proyek_id ${w} ORDER BY pg.id DESC LIMIT ? OFFSET ?`,
      ...params,
      limit,
      offset
    ),
  });
});

app.post('/api/pengaduan', wajibIzin('pengaduan:create'), (req, res) => {
  const b = req.body || {};
  if (!b.deskripsi) return res.status(400).json({ pesan: 'Deskripsi keluhan wajib diisi' });
  const kode = `ADU-${Date.now().toString(36).toUpperCase()}`;
  const id = db
    .prepare(
      `INSERT INTO pengaduan (kode, nama_pelapor, kontak, lokasi, kecamatan, kategori, deskripsi, foto, tanggal, prioritas, proyek_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      kode,
      b.nama_pelapor || 'Anonim',
      b.kontak || '',
      b.lokasi || '',
      b.kecamatan || 'Manggar',
      b.kategori || 'Lainnya',
      b.deskripsi,
      b.foto || '',
      new Date().toISOString().slice(0, 10),
      b.prioritas || 'Sedang',
      b.proyek_id || null
    ).lastInsertRowid;
  audit('masyarakat', 'buat', 'pengaduan', id, { kode });
  idkirim('pengaduan-baru', g('SELECT * FROM pengaduan WHERE id=?', id));
  res.status(201).json({ ok: true, id, kode, pesan: 'Keluhan Anda telah diterima dan akan diverifikasi' });
});

app.patch('/api/pengaduan/:id', wajibIzin('pengaduan:update'), (req, res) => {
  const b = req.body || {};
  const pg = g('SELECT * FROM pengaduan WHERE id=?', req.params.id);
  if (!pg) return res.status(404).json({ pesan: 'Pengaduan tidak ditemukan' });
  const sets = [];
  const vals = [];
  ['status', 'prioritas', 'ditangani_oleh'].forEach((f) => {
    if (b[f] !== undefined) {
      sets.push(`${f}=?`);
      vals.push(b[f]);
    }
  });
  if (sets.length) {
    vals.push(pg.id);
    db.prepare(`UPDATE pengaduan SET ${sets.join(',')} WHERE id=?`).run(...vals);
  }
  audit(namaAksi(req), 'ubah', 'pengaduan', pg.id, b);
  res.json({ ok: true });
});

// ================================ PENGGUNA (CRUD, khusus Administrator)
const KOLOM_PENGGUNA = ['username', 'nama', 'peran', 'satker', 'email', 'telepon', 'organisasi', 'aktif'];

app.get('/api/pengguna', wajibIzin('pengguna:read'), (req, res) => {
  const { limit, offset } = paging(req);
  const where = [];
  const params = [];
  if (req.query.q) {
    where.push('(username LIKE ? OR nama LIKE ? OR email LIKE ? OR organisasi LIKE ?)');
    params.push(like(req.query.q), like(req.query.q), like(req.query.q), like(req.query.q));
  }
  if (req.query.peran) {
    where.push('peran = ?');
    params.push(req.query.peran);
  }
  if (req.query.aktif !== undefined && req.query.aktif !== '') {
    where.push('aktif = ?');
    params.push(Number(req.query.aktif) ? 1 : 0);
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = g(`SELECT COUNT(*) n FROM pengguna ${w}`, ...params).n;
  const items = q(
    `SELECT id, username, nama, peran, satker, email, telepon, organisasi, aktif,
            dibuat_oleh, terakhir_masuk, created_at,
            (CASE WHEN password_hash IS NULL OR password_hash='' THEN 0 ELSE 1 END) punya_sandi,
            (SELECT COUNT(*) FROM sesi s WHERE s.pengguna_id = pengguna.id) sesi_aktif
     FROM pengguna ${w} ORDER BY id LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset
  );
  res.json({ total, limit, offset, items, peran: PERAN });
});

app.post('/api/pengguna', wajibIzin('pengguna:create'), (req, res) => {
  const b = req.body || {};
  const username = String(b.username || '').trim().toLowerCase();
  if (!username) return res.status(400).json({ pesan: 'Username wajib diisi' });
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
    return res.status(400).json({ pesan: 'Username hanya boleh huruf/angka/titik/garis, 3-40 karakter.' });
  }
  if (!NAMA_PERAN.includes(b.peran)) {
    return res.status(400).json({ pesan: `Peran tidak dikenal. Pilihan: ${NAMA_PERAN.join(', ')}` });
  }
  if (!b.password || String(b.password).length < 6) {
    return res.status(400).json({ pesan: 'Kata sandi minimal 6 karakter' });
  }
  if (g('SELECT id FROM pengguna WHERE username=?', username)) {
    return res.status(409).json({ pesan: `Username ${username} sudah terdaftar.` });
  }
  const r = db
    .prepare(
      `INSERT INTO pengguna (username, nama, peran, satker, email, telepon, organisasi, aktif,
        password_hash, dibuat_oleh)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      username,
      String(b.nama || username).trim(),
      b.peran,
      b.satker || null,
      b.email || null,
      b.telepon || null,
      b.organisasi || null,
      b.aktif === false || b.aktif === 0 ? 0 : 1,
      hashKataSandi(b.password),
      namaAksi(req)
    );
  audit(namaAksi(req), 'buat', 'pengguna', r.lastInsertRowid, { username, peran: b.peran });
  res.status(201).json({ ok: true, pengguna: g('SELECT id, username, nama, peran, aktif FROM pengguna WHERE id=?', r.lastInsertRowid) });
});

app.patch('/api/pengguna/:id', wajibIzin('pengguna:update'), (req, res) => {
  const u = g('SELECT * FROM pengguna WHERE id=?', req.params.id);
  if (!u) return res.status(404).json({ pesan: 'Pengguna tidak ditemukan' });
  const b = req.body || {};
  if (b.peran !== undefined && !NAMA_PERAN.includes(b.peran)) {
    return res.status(400).json({ pesan: `Peran tidak dikenal. Pilihan: ${NAMA_PERAN.join(', ')}` });
  }
  const gantiSandi = b.password !== undefined && b.password !== '';
  if (gantiSandi) {
    if (String(b.password).length < 6) return res.status(400).json({ pesan: 'Kata sandi minimal 6 karakter' });
    if (!cekKataSandi(b.passwordLama || '', u.password_hash)) {
      return res.status(403).json({ pesan: 'Kata sandi lama tidak cocok.' });
    }
  }
  // Seluruh validasi dan penulisan dijalankan dalam satu transaksi: bila
  // salah satu field ditolak, perubahan kata sandi tidak boleh ikut berlaku.
  const sets = [];
  const vals = [];
  for (const k of KOLOM_PENGGUNA) {
    if (b[k] === undefined) continue;
    if (k === 'username') {
      const username = String(b.username).trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
        return res.status(400).json({ pesan: 'Format username tidak valid.' });
      }
      if (g('SELECT id FROM pengguna WHERE username=? AND id<>?', username, u.id)) {
        return res.status(409).json({ pesan: `Username ${username} sudah terdaftar.` });
      }
      sets.push('username=?');
      vals.push(username);
      continue;
    }
    if (k === 'peran') {
      // Admin aktif terakhir juga tidak boleh diturunkan perannya lewat update.
      if (
        b.peran !== 'Administrator' &&
        u.peran === 'Administrator' &&
        u.aktif &&
        hitungAdminAktif(u.id) === 0
      ) {
        return res.status(400).json({ pesan: 'Minimal harus ada satu Administrator aktif.' });
      }
      sets.push('peran=?');
      vals.push(b.peran);
      continue;
    }
    if (k === 'aktif') {
      const aktif = b.aktif ? 1 : 0;
      // Jangan biarkan admin aktif terakhir kehilangan aksesnya sendiri.
      if (!aktif && u.peran === 'Administrator' && hitungAdminAktif(u.id) === 0) {
        return res.status(400).json({ pesan: 'Minimal harus ada satu Administrator aktif.' });
      }
      sets.push('aktif=?');
      vals.push(aktif);
      continue;
    }
    sets.push(`${k}=?`);
    vals.push(b[k] === '' ? null : b[k]);
  }
  const valsFinal = [...vals, u.id];
  const nonaktif = b.aktif !== undefined && !Number(b.aktif);
  db.transaction(() => {
    if (gantiSandi) {
      db.prepare('UPDATE pengguna SET password_hash=? WHERE id=?').run(hashKataSandi(b.password), u.id);
    }
    if (sets.length) {
      db.prepare(`UPDATE pengguna SET ${sets.join(',')} WHERE id=?`).run(...valsFinal);
    }
  })();

  if (gantiSandi) {
    hapusSemuaSesi(u.id);
    audit(namaAksi(req), 'ubah-sandi', 'pengguna', u.id, { username: u.username });
  }
  if (sets.length) {
    if (nonaktif) hapusSemuaSesi(u.id);
    audit(namaAksi(req), 'ubah', 'pengguna', u.id, {
      ...b,
      password: undefined,
      passwordLama: undefined,
    });
  }
  res.json({
    ok: true,
    pengguna: g('SELECT id, username, nama, peran, satker, email, telepon, organisasi, aktif FROM pengguna WHERE id=?', u.id),
  });
});

app.delete('/api/pengguna/:id', wajibIzin('pengguna:delete'), (req, res) => {
  const u = g('SELECT * FROM pengguna WHERE id=?', req.params.id);
  if (!u) return res.status(404).json({ pesan: 'Pengguna tidak ditemukan' });
  if (u.id === req.pengguna.id) {
    return res.status(400).json({ pesan: 'Anda tidak dapat menghapus akun yang sedang digunakan.' });
  }
  if (u.peran === 'Administrator' && hitungAdminAktif(u.id) === 0) {
    return res.status(400).json({ pesan: 'Minimal harus ada satu Administrator aktif.' });
  }
  hapusSemuaSesi(u.id);
  db.prepare('DELETE FROM pengguna WHERE id=?').run(u.id);
  audit(namaAksi(req), 'hapus', 'pengguna', u.id, { username: u.username, peran: u.peran });
  res.json({ ok: true, username: u.username });
});

/** Jumlah Administrator aktif selain `kecualiId`. */
function hitungAdminAktif(kecualiId) {
  return g(
    "SELECT COUNT(*) n FROM pengguna WHERE peran='Administrator' AND aktif=1 AND id<>?",
    kecualiId
  ).n;
}

// ================================ MASTER KECAMATAN
// Catatan: `proyek.kecamatan`, `penyedia_jasa.kecamatan`, `pengaduan.kecamatan`, dan
// `peringatan.kecamatan` menyimpan NAMA kecamatan sebagai teks, bukan foreign key.
// Karena itu ubah nama harus ikut memperbarui semua tabel terkait, dan hapus harus
// ditolak selama masih ada data yang memakainya.
const TABEL_PAKAI_KECAMATAN = [
  { tabel: 'proyek', label: 'proyek' },
  { tabel: 'penyedia_jasa', label: 'penyedia' },
  { tabel: 'pengaduan', label: 'pengaduan' },
  { tabel: 'peringatan', label: 'peringatan' },
];

/** Berapa banyak baris tiap tabel yang memakai nama `nama` ini. */
function pemakaianKecamatan(nama) {
  const out = {};
  for (const { tabel, label } of TABEL_PAKAI_KECAMATAN) {
    out[label] = g(`SELECT COUNT(*) n FROM ${tabel} WHERE kecamatan = ?`, nama).n;
  }
  out.total = Object.values(out).reduce((a, b) => a + b, 0);
  return out;
}

function bersihkanKecamatan(b, lama = {}) {
  const ambil = (k, bawaan) => (b[k] !== undefined ? b[k] : lama[k] !== undefined ? lama[k] : bawaan);
  // Kolom kosong dari formulir berarti "belum diisi", bukan 0. Number('') bernilai
  // 0 sehingga harus ditangani eksplisit agar tidak menggeser titik peta ke Gulf Guinea.
  const koordinat = (v) => {
    if (v === null || v === undefined || String(v).trim() === '') return null;
    const angka = Number(v);
    return Number.isFinite(angka) ? angka : null;
  };
  return {
    nama: String(ambil('nama', '')).trim().replace(/\s+/g, ' '),
    lat: koordinat(ambil('lat', null)),
    lng: koordinat(ambil('lng', null)),
  };
}

/** Validasi rentang koordinat bumi. Balikan pesan galat, atau null bila sah. */
function validasiKoordinat(d) {
  if (d.lat !== null && (d.lat < -90 || d.lat > 90)) {
    return 'Lintang harus berada di antara -90 sampai 90.';
  }
  if (d.lng !== null && (d.lng < -180 || d.lng > 180)) {
    return 'Bujur harus berada di antara -180 sampai 180.';
  }
  return null;
}

app.get('/api/kecamatan', wajibIzin('kecamatan:read'), (req, res) => {
  const items = q(
    `SELECT id, nama, lat, lng,
            (SELECT COUNT(*) FROM proyek p WHERE p.kecamatan = kecamatan.nama) proyek,
            (SELECT COUNT(*) FROM penyedia_jasa s WHERE s.kecamatan = kecamatan.nama) penyedia,
            (SELECT COUNT(*) FROM pengaduan g WHERE g.kecamatan = kecamatan.nama) pengaduan,
            (SELECT COUNT(*) FROM peringatan w WHERE w.kecamatan = kecamatan.nama) peringatan
     FROM kecamatan ORDER BY nama`
  );
  // Pencarian dilakukan di memori karena daftar kecamatan kecil dan tetap ringkas.
  const cari = String(req.query.q || '').trim().toLowerCase();
  const hasil = cari ? items.filter((k) => k.nama.toLowerCase().includes(cari)) : items;
  res.json({ total: items.length, cocok: hasil.length, items: hasil });
});

app.post('/api/kecamatan', wajibIzin('kecamatan:create'), (req, res) => {
  const d = bersihkanKecamatan(req.body || {});
  if (!d.nama) return res.status(400).json({ pesan: 'Nama kecamatan wajib diisi' });
  if (d.nama.length > 60) return res.status(400).json({ pesan: 'Nama kecamatan maksimal 60 karakter' });
  if (g('SELECT id FROM kecamatan WHERE nama = ? COLLATE NOCASE', d.nama)) {
    return res.status(409).json({ pesan: `Kecamatan ${d.nama} sudah terdaftar.` });
  }
  const coords = validasiKoordinat(d);
  if (coords) return res.status(400).json({ pesan: coords });
  try {
    const r = db.prepare('INSERT INTO kecamatan(nama, lat, lng) VALUES(?,?,?)').run(d.nama, d.lat, d.lng);
    audit(namaAksi(req), 'buat', 'kecamatan', r.lastInsertRowid, { nama: d.nama, lat: d.lat, lng: d.lng });
    res.status(201).json({ ok: true, kecamatan: g('SELECT * FROM kecamatan WHERE id=?', r.lastInsertRowid) });
  } catch (e) {
    res.status(e.status || 500).json({ pesan: e.message });
  }
});

app.patch('/api/kecamatan/:id', wajibIzin('kecamatan:update'), (req, res) => {
  const k = g('SELECT * FROM kecamatan WHERE id=?', req.params.id);
  if (!k) return res.status(404).json({ pesan: 'Kecamatan tidak ditemukan' });
  const b = req.body || {};
  if (b.nama !== undefined && !String(b.nama).trim()) {
    return res.status(400).json({ pesan: 'Nama kecamatan tidak boleh kosong' });
  }
  const d = bersihkanKecamatan(b, k);
  if (d.nama.length > 60) return res.status(400).json({ pesan: 'Nama kecamatan maksimal 60 karakter' });
  if (d.nama.toLowerCase() !== k.nama.toLowerCase() && g('SELECT id FROM kecamatan WHERE nama = ? COLLATE NOCASE AND id<>?', d.nama, k.id)) {
    return res.status(409).json({ pesan: `Kecamatan ${d.nama} sudah terdaftar.` });
  }
  const coords = validasiKoordinat(d);
  if (coords) return res.status(400).json({ pesan: coords });
  try {
    const gantiNama = d.nama !== k.nama;
    db.transaction(() => {
      db.prepare('UPDATE kecamatan SET nama=?, lat=?, lng=? WHERE id=?').run(d.nama, d.lat, d.lng, k.id);
      // Nama kecamatan direferensikan sebagai teks, jadi ikut diperbarui agar
      // data lama tidak orphaned dari peta maupun agregasi per kecamatan.
      if (gantiNama) {
        for (const { tabel } of TABEL_PAKAI_KECAMATAN) {
          db.prepare(`UPDATE ${tabel} SET kecamatan=? WHERE kecamatan=?`).run(d.nama, k.nama);
        }
      }
    })();
    audit(namaAksi(req), 'ubah', 'kecamatan', k.id, {
      nama: d.nama,
      lat: d.lat,
      lng: d.lng,
      nama_lama: gantiNama ? k.nama : undefined,
    });
    res.json({ ok: true, kecamatan: g('SELECT * FROM kecamatan WHERE id=?', k.id) });
  } catch (e) {
    res.status(e.status || 500).json({ pesan: e.message });
  }
});

app.delete('/api/kecamatan/:id', wajibIzin('kecamatan:delete'), (req, res) => {
  const k = g('SELECT * FROM kecamatan WHERE id=?', req.params.id);
  if (!k) return res.status(404).json({ pesan: 'Kecamatan tidak ditemukan' });
  const pemakaian = pemakaianKecamatan(k.nama);
  // Mencegah yatim data: nama kecamatan disimpan sebagai teks di empat tabel,
  // jadi menghapus yang masih terpakai akan membuang peta dan agregasinya.
  if (pemakaian.total > 0) {
    const rincian = Object.entries(pemakaian)
      .filter(([k2]) => k2 !== 'total')
      .map(([k2, v]) => `${v} ${k2}`)
      .join(', ');
    return res.status(409).json({
      pesan: `Kecamatan ${k.nama} masih dipakai oleh ${pemakaian.total} data (${rincian}). Pindahkan datanya lebih dulu.`,
      pemakaian,
    });
  }
  db.prepare('DELETE FROM kecamatan WHERE id=?').run(k.id);
  audit(namaAksi(req), 'hapus', 'kecamatan', k.id, { nama: k.nama });
  res.json({ ok: true, nama: k.nama });
});

// ================================ AUDIT
app.get('/api/audit', wajibIzin('pengguna:read'), (req, res) => {
  const { limit, offset } = paging(req);
  res.json({
    total: g('SELECT COUNT(*) n FROM audit_log').n,
    items: q('SELECT * FROM audit_log ORDER BY id DESC LIMIT ? OFFSET ?', limit, offset),
  });
});

// ================================ REALTIME SSE
app.get('/api/stream', wajibMasuk, (req, res) => {
  mulaiSSE(req, res);
});

// Simulator tick
if (process.env.BEGASAK_SIM !== 'off') {
  const interval = Number(process.env.BEGASAK_TICK_MS || 12000);
  setInterval(() => {
    try {
      const e = tickSitus();
      if (e) idkirim('monitoring', e);
      if (e?.peringatan?.length) idkirim('peringatan-baru', { peringatan: e.peringatan });
    } catch (err) {
      console.error('tick error', err.message);
    }
  }, interval).unref?.();
  console.log(`Simulator monitoring aktif setiap ${interval / 1000}s (SSE: /api/stream)`);
}

// ================================ STATIC (produksi)
const dist = path.join(__dirname, '..', '..', 'web', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ pesan: err.message });
});

app.listen(PORT, () => {
  console.log(`\n  BEGASAK API  ->  http://localhost:${PORT}`);
  console.log(`  Dashboard    ->  http://localhost:${PORT}/api/dashboard`);
  console.log(`  Streaming    ->  http://localhost:${PORT}/api/stream\n`);
});