import crypto from 'node:crypto';
import { db } from './db.js';

/**
 * Modul autentikasi & otorisasi BEGASAK.
 *
 * - Kata sandi disimpan sebagai scrypt + salt acak (tanpa dependensi tambahan).
 * - Sesi memakai token acak yang disimpan di tabel `sesi`, sehingga pengguna
 *   tetap login setelah server restart dan akun bisa dicabut dari sisi server.
 * - Otorisasi berbasis peran melalui matriks HAK_AKSES di bawah.
 */

const MASALAH_SESI_JAM = 12;

// ================================ KATA SANDI
export function hashKataSandi(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const turunan = crypto.scryptSync(String(plain), salt, 64).toString('hex');
  return `scrypt$${salt}$${turunan}`;
}

export function cekKataSandi(plain, tersimpan) {
  if (!tersimpan) return false;
  const [algo, salt, turunan] = String(tersimpan).split('$');
  if (algo !== 'scrypt' || !salt || !turunan) return false;
  const dihitung = crypto.scryptSync(String(plain), salt, 64).toString('hex');
  const a = Buffer.from(dihitung, 'hex');
  const b = Buffer.from(turunan, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ================================ PERAN & HAK AKSES
export const PERAN = [
  {
    nilai: 'Administrator',
    label: 'Administrator Sistem',
    warna: 'bg-slate-700',
    keterangan: 'Akses penuh termasuk pengelolaan akun pengguna.',
  },
  {
    nilai: 'Perangkat Daerah',
    label: 'Perangkat Daerah',
    warna: 'bg-gov-700',
    keterangan: 'Perangkat daerah: mengelola master data, pengawasan, dan pengaduan.',
  },
  {
    nilai: 'Penyedia Jasa',
    label: 'Penyedia Jasa',
    warna: 'bg-emerald-600',
    keterangan: 'Melihat proyek, tenaga kerja, dan submit pengaduan.',
  },
  {
    nilai: 'Asosiasi Profesi',
    label: 'Asosiasi Profesi',
    warna: 'bg-violet-600',
    keterangan: 'Membaca analitik risiko dan rekapitulasi data.',
  },
  {
    nilai: 'Masyarakat',
    label: 'Masyarakat',
    warna: 'bg-slate-600',
    keterangan: 'Melihat proyek dan mengirim pengaduan.',
  },
];

/**
 * Matriks hak akses: peran -> daftar aksi `"sumber:aksi"` yang diizinkan.
 * Dipakai oleh `boleh()` di route server maupun `boleh()` di frontend.
 */
export const HAK_AKSES = {
  Administrator: ['*'],
  'Perangkat Daerah': [
    'dashboard:read',
    'peta:read',
    'proyek:read',
    'proyek:create',
    'proyek:update',
    'proyek:delete',
    'tenaga:read',
    'tenaga:create',
    'tenaga:update',
    'tenaga:delete',
    'penyedia:read',
    'penyedia:create',
    'penyedia:update',
    'penyedia:delete',
    'pengawasan:read',
    'pengawasan:create',
    'pengawasan:update',
    'risiko:read',
    'peringatan:read',
    'peringatan:update',
    'pengaduan:read',
    'pengaduan:create',
    'pengaduan:update',
    'kecamatan:read',
    'kecamatan:create',
    'kecamatan:update',
    'kecamatan:delete',
    'laporan:read',
    'laporan:ekspor',
  ],
  'Penyedia Jasa': [
    'dashboard:read',
    'proyek:read',
    'proyek:update',
    'tenaga:read',
    'penyedia:read',
    'pengawasan:read',
    'risiko:read',
    'peringatan:read',
    'pengaduan:read',
    'pengaduan:create',
    'laporan:read',
    'laporan:ekspor',
  ],
  'Asosiasi Profesi': [
    'dashboard:read',
    'peta:read',
    'proyek:read',
    'tenaga:read',
    'penyedia:read',
    'risiko:read',
    'peringatan:read',
    'laporan:read',
    'laporan:ekspor',
  ],
  Masyarakat: ['dashboard:read', 'proyek:read', 'pengaduan:read', 'pengaduan:create', 'laporan:read'],
};

export const NAMA_PERAN = PERAN.map((p) => p.nilai);

/**
 * Akun demo hasil seed. Hanya dipakai `seed()` untuk membuat akun awal dan
 * ditampilkan oleh `/api/auth/akun-demo` di luar mode produksi.
 */
export const AKUN_DEMO = [
  {
    username: 'admin',
    nama: 'Administrator BEGASAK',
    peran: 'Administrator',
    satker: 'DPURPK Kabupaten Belitung Timur',
    email: 'admin@belitungtimurkab.go.id',
    telepon: '081234567800',
    organisasi: 'DPURPK',
    sandi: 'admin123',
  },
  {
    username: 'bayu',
    nama: 'Ir. Bayu Rosiandi, M.T.',
    peran: 'Perangkat Daerah',
    satker: 'DPURPK Kabupaten Belitung Timur',
    email: 'bayu@belitungtimurkab.go.id',
    telepon: '081234567801',
    organisasi: 'DPURPK',
    sandi: '123456',
  },
  {
    username: 'pengawas',
    nama: 'Pengawas, S.T.',
    peran: 'Perangkat Daerah',
    satker: 'DPURPK-Pengawasan',
    email: 'pengawas@belitungtimurkab.go.id',
    telepon: '081234567802',
    organisasi: 'DPURPK',
    sandi: 'awas123',
  },
  {
    username: 'cv.mitra',
    nama: 'CV. Karya Mandiri',
    peran: 'Penyedia Jasa',
    satker: null,
    email: 'karya.mandiri@mail.com',
    telepon: '081234567803',
    organisasi: 'APACKI',
    sandi: 'mitra123',
  },
  // {
  //   username: 'institut',
  //   nama: 'IAB Beltram',
  //   peran: 'Asosiasi Profesi',
  //   satker: null,
  //   email: 'iab@belitungtimurkab.go.id',
  //   telepon: '081234567804',
  //   organisasi: 'IAB',
  //   sandi: 'iab123',
  // },
  {
    username: 'masyarakat',
    nama: 'Warga Kabupaten Belitung Timur',
    peran: 'Masyarakat',
    satker: null,
    email: null,
    telepon: null,
    organisasi: null,
    sandi: 'warga123',
  },
];

/** Apakah `peran` boleh melakukan `aksi` (format `sumber:aksi`)? Wildcard `*` berarti penuh. */
export function boleh(peran, aksi) {
  const daftar = HAK_AKSES[peran] || [];
  return daftar.includes('*') || daftar.includes(aksi);
}

/** Daftar lengkap hak akses peran, untuk dikirim ke frontend. */
export function petaHakAkses() {
  const lengkap = [
    ...new Set([
      // Administrator mewarisi seluruh hak Perangkat Daerah.
      ...HAK_AKSES['Perangkat Daerah'],
      'pengguna:read',
      'pengguna:create',
      'pengguna:update',
      'pengguna:delete',
      'kecamatan:read',
      'kecamatan:create',
      'kecamatan:update',
      'kecamatan:delete',
    ]),
  ];
  const out = {};
  for (const [peran, daftar] of Object.entries(HAK_AKSES)) {
    out[peran] = daftar.includes('*') ? lengkap : daftar;
  }
  return out;
}

// ================================ SESI
const bersihkanSesi = db.prepare("DELETE FROM sesi WHERE kedaluwarsa IS NOT NULL AND kedaluwarsa < datetime('now')");

export function buatSesi(penggunaId) {
  bersihkanSesi.run();
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare(
    `INSERT INTO sesi(token, pengguna_id, kedaluwarsa)
     VALUES(?,?,datetime('now', ?))`
  ).run(token, penggunaId, `+${MASALAH_SESI_JAM} hours`);
  db.prepare("UPDATE pengguna SET terakhir_masuk=datetime('now') WHERE id=?").run(penggunaId);
  return token;
}

export function penggunaDariToken(token) {
  if (!token) return null;
  const baris = db
    .prepare(
      `SELECT u.id, u.username, u.nama, u.peran, u.satker, u.email, u.telepon, u.organisasi, u.aktif, s.kedaluwarsa
       FROM sesi s JOIN pengguna u ON u.id = s.pengguna_id
       WHERE s.token = ?`
    )
    .get(token);
  if (!baris) return null;
  if (baris.kedaluwarsa && new Date(baris.kedaluwarsa + 'Z') < new Date()) {
    db.prepare('DELETE FROM sesi WHERE token=?').run(token);
    return null;
  }
  if (!baris.aktif) return null;
  const { kedaluwarsa, aktif, ...pengguna } = baris;
  return pengguna;
}

export function tutupSesi(token) {
  if (token) db.prepare('DELETE FROM sesi WHERE token=?').run(token);
}

export function hapusSemuaSesi(penggunaId) {
  db.prepare('DELETE FROM sesi WHERE pengguna_id=?').run(penggunaId);
}

export function bersihkanSesiKedaluwarsa() {
  bersihkanSesi.run();
}

/** Validasi login: mengembalikan { token, pengguna } atau null. */
export function masuk(username, password) {
  const u = db
    .prepare('SELECT id, username, nama, peran, password_hash, aktif FROM pengguna WHERE username = ?')
    .get(String(username || '').trim());
  // Selalu jalankan verifikasi agar waktu respons tidak membocorkan keberadaan akun.
  const hash = u?.password_hash || 'scrypt$deadbeef$00';
  const benar = cekKataSandi(password, hash);
  if (!u || !benar || !u.aktif) return null;
  const token = buatSesi(u.id);
  const { password_hash, aktif, ...pengguna } = u;
  // Kirim daftar izin yang sudah dimekarkan supaya '*' tidak perlu
  // dipahami oleh frontend saat menyembunyikan tombol aksi.
  return { token, pengguna, akses: petaHakAkses()[u.peran] || [] };
}

/** Ambil token dari header Authorization: Bearer <token>. */
export function tokenDari(req) {
  const head = req.get('authorization') || '';
  if (/^bearer\s+/i.test(head)) return head.replace(/^bearer\s+/i, '').trim();
  const x = req.get('x-token');
  if (x) return x;
  // EventSource tidak bisa mengirim header, jadi SSE memakai ?token=.
  if (req.path === '/stream' && req.query && req.query.token) return String(req.query.token);
  return null;
}
