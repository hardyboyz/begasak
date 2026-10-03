import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.BEGASAK_DB || path.join(__dirname, '..', 'data', 'begasak.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS meta (
  kunci TEXT PRIMARY KEY,
  nilai TEXT
);

CREATE TABLE IF NOT EXISTS kecamatan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT UNIQUE NOT NULL,
  lat REAL,
  lng REAL
);

CREATE TABLE IF NOT EXISTS penyedia_jasa (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kode TEXT UNIQUE NOT NULL,
  nama TEXT NOT NULL,
  nib TEXT,
  nama_pengusaha TEXT,
  jenis_kelamin TEXT,
  alamat TEXT,
  no_hp TEXT,
  email TEXT,
  website TEXT,
  tahun_mulai INTEGER,
  badan_usaha TEXT,
  status_modal TEXT,
  pekerjaan_utama TEXT,
  kbli TEXT,
  kualifikasi TEXT,
  sbu_aktif INTEGER DEFAULT 0,
  jaringan_usaha TEXT,
  tempat_usaha TEXT,
  sumber_data TEXT,
  status TEXT,
  kecamatan TEXT,
  skor_kemampuan INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tenaga_kerja (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kode TEXT UNIQUE NOT NULL,
  nama TEXT NOT NULL,
  jenis_pelatihan TEXT,
  klasifikasi TEXT,
  kualifikasi TEXT,
  no_sertifikat TEXT,
  penerbit TEXT,
  jabatan_kerja TEXT,
  jenjang TEXT,
  jenjang_angka INTEGER,
  bersertifikat INTEGER DEFAULT 1,
  tahun_sertifikat INTEGER,
  perusahaan_id INTEGER REFERENCES penyedia_jasa(id) ON DELETE SET NULL,
  aktif INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS proyek (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kode TEXT UNIQUE NOT NULL,
  no_urut INTEGER,
  nama TEXT NOT NULL,
  sumber_pendanaan TEXT DEFAULT 'APBD',
  operator INTEGER DEFAULT 0,
  teknisi_analis INTEGER DEFAULT 0,
  jumlah_tenaga INTEGER DEFAULT 0,
  pagu REAL DEFAULT 0,
  metode_pengadaan TEXT,
  satker TEXT,
  jenis_pengadaan TEXT,
  jenis_pekerjaan TEXT,
  lokasi_mentioned TEXT,
  kecamatan TEXT,
  latitude REAL,
  longitude REAL,
  status TEXT DEFAULT 'Berjalan',
  progres INTEGER DEFAULT 0,
  tanggal_mulai TEXT,
  tanggal_rencana_selesai TEXT,
  tanggal_aktual_selesai TEXT,
  penyedia_id INTEGER REFERENCES penyedia_jasa(id) ON DELETE SET NULL,
  nilai_kontrak REAL DEFAULT 0,
  pagespan INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS penugasan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proyek_id INTEGER NOT NULL REFERENCES proyek(id) ON DELETE CASCADE,
  tenaga_id INTEGER NOT NULL REFERENCES tenaga_kerja(id) ON DELETE CASCADE,
  jabatan TEXT,
  status TEXT DEFAULT 'Aktif',
  mulai TEXT,
  selesai TEXT,
  UNIQUE(proyek_id, tenaga_id, jabatan)
);

CREATE TABLE IF NOT EXISTS pengawasan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kode TEXT UNIQUE NOT NULL,
  proyek_id INTEGER NOT NULL REFERENCES proyek(id) ON DELETE CASCADE,
  tanggal TEXT NOT NULL,
  pengawas TEXT,
  lokasi TEXT,
  cuaca TEXT,
  jumlah_pekerja_harian INTEGER DEFAULT 0,
  alat_berat INTEGER DEFAULT 0,
  material_terpasang REAL DEFAULT 0,
  catatan TEXT,
  foto TEXT,
  status_verifikasi TEXT DEFAULT 'Diverifikasi',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS temuan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kode TEXT UNIQUE NOT NULL,
  pengawasan_id INTEGER REFERENCES pengawasan(id) ON DELETE CASCADE,
  proyek_id INTEGER NOT NULL REFERENCES proyek(id) ON DELETE CASCADE,
  tanggal TEXT NOT NULL,
  kategori TEXT,
  deskripsi TEXT,
  lokasi TEXT,
  tingkat TEXT DEFAULT 'Sedang',
  status TEXT DEFAULT 'Baru',
  konsekuensi TEXT,
  tindakan TEXT,
  tenggat TEXT,
  tanggal_closure TEXT,
  pelapor TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS risiko (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kode TEXT UNIQUE NOT NULL,
  proyek_id INTEGER REFERENCES proyek(id) ON DELETE CASCADE,
  kategori TEXT,
  deskripsi TEXT,
  probabilitas INTEGER DEFAULT 3,
  dampak INTEGER DEFAULT 3,
  skor INTEGER DEFAULT 9,
  level TEXT,
  mitigasi TEXT,
  status TEXT DEFAULT 'Aktif',
  sumber TEXT DEFAULT 'DSS Engine',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS peringatan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kode TEXT UNIQUE NOT NULL,
  judul TEXT NOT NULL,
  pesan TEXT,
  level TEXT,
  kategori TEXT,
  proyek_id INTEGER REFERENCES proyek(id) ON DELETE CASCADE,
  kecamatan TEXT,
  sumber TEXT,
  indikator TEXT,
  waktu TEXT DEFAULT (datetime('now')),
  dibaca INTEGER DEFAULT 0,
  ditindaklanjuti INTEGER DEFAULT 0,
  metadata TEXT
);

CREATE TABLE IF NOT EXISTS pengguna (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  nama TEXT,
  peran TEXT,
  satker TEXT,
  email TEXT,
  telepon TEXT,
  organisasi TEXT,
  aktif INTEGER DEFAULT 1,
  password_hash TEXT,
  dibuat_oleh TEXT,
  terakhir_masuk TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sesi (
  token TEXT PRIMARY KEY,
  pengguna_id INTEGER NOT NULL REFERENCES pengguna(id) ON DELETE CASCADE,
  dibuat TEXT DEFAULT (datetime('now')),
  kedaluwarsa TEXT
);

CREATE TABLE IF NOT EXISTS pengaduan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kode TEXT UNIQUE NOT NULL,
  nama_pelapor TEXT,
  kontak TEXT,
  lokasi TEXT,
  kecamatan TEXT,
  kategori TEXT,
  deskripsi TEXT,
  foto TEXT,
  tanggal TEXT,
  status TEXT DEFAULT 'Baru',
  prioritas TEXT DEFAULT 'Sedang',
  proyek_id INTEGER REFERENCES proyek(id) ON DELETE SET NULL,
  ditangani_oleh TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  waktu TEXT DEFAULT (datetime('now')),
  pengguna TEXT,
  aksi TEXT,
  entitas TEXT,
  entitas_id INTEGER,
  detail TEXT
);

CREATE INDEX IF NOT EXISTS idx_proyek_kec ON proyek(kecamatan);
CREATE INDEX IF NOT EXISTS idx_proyek_satker ON proyek(satker);
CREATE INDEX IF NOT EXISTS idx_proyek_status ON proyek(status);
CREATE INDEX IF NOT EXISTS idx_temuan_proyek ON temuan(proyek_id);
CREATE INDEX IF NOT EXISTS idx_temuan_status ON temuan(status);
CREATE INDEX IF NOT EXISTS idx_pengawasan_proyek ON pengawasan(proyek_id);
CREATE INDEX IF NOT EXISTS idx_peringatan_waktu ON peringatan(waktu DESC);
CREATE INDEX IF NOT EXISTS idx_risiko_proyek ON risiko(proyek_id);
CREATE INDEX IF NOT EXISTS idx_pengaduan_status ON pengaduan(status);
CREATE INDEX IF NOT EXISTS idx_sesi_pengguna ON sesi(pengguna_id);
CREATE INDEX IF NOT EXISTS idx_audit_entitas ON audit_log(entitas, entitas_id);
`);

// Migrasi ringan untuk database yang sudah ada sebelum kolom password_hash ditambahkan.
try {
  const kolomPengguna = db.prepare('PRAGMA table_info(pengguna)').all().map((c) => c.name);
  if (!kolomPengguna.includes('password_hash')) {
    db.exec('ALTER TABLE pengguna ADD COLUMN password_hash TEXT');
  }
  if (!kolomPengguna.includes('dibuat_oleh')) {
    db.exec('ALTER TABLE pengguna ADD COLUMN dibuat_oleh TEXT');
  }
  if (!kolomPengguna.includes('terakhir_masuk')) {
    db.exec('ALTER TABLE pengguna ADD COLUMN terakhir_masuk TEXT');
  }
} catch (err) {
  console.error('Migrasi skema pengguna gagal:', err.message);
}

export function setMeta(kunci, nilai) {
  db.prepare(
    'INSERT INTO meta(kunci, nilai) VALUES(?,?) ON CONFLICT(kunci) DO UPDATE SET nilai=excluded.nilai'
  ).run(kunci, String(nilai));
}

export function getMeta(kunci) {
  const r = db.prepare('SELECT nilai FROM meta WHERE kunci=?').get(kunci);
  return r ? r.nilai : null;
}

export function audit(pengguna, aksi, entitas, entitasId, detail) {
  db.prepare(
    'INSERT INTO audit_log(pengguna, aksi, entitas, entitas_id, detail) VALUES(?,?,?,?,?)'
  ).run(
    pengguna || 'sistem',
    aksi,
    entitas,
    entitasId ?? null,
    detail ? JSON.stringify(detail) : null
  );
}

export { DB_PATH };