import { db } from '../db.js';
import { ASPEK, hitungScoring, validasiSkor } from './engine.js';
import { ambilScoring, sinkronRisiko } from './integrasi.js';

export class KesalahanScoring extends Error {
  constructor(pesan, status = 400) {
    super(pesan);
    this.status = status;
  }
}

const hariIni = () => new Date().toISOString().slice(0, 10);

function validasiProyek(proyekId) {
  const id = Number(proyekId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new KesalahanScoring('Proyek wajib dipilih.');
  }
  const proyek = db.prepare('SELECT id, kode, nama FROM proyek WHERE id=?').get(id);
  if (!proyek) throw new KesalahanScoring('Proyek tidak ditemukan.', 404);
  return proyek;
}

function validasiTanggal(tanggal) {
  const nilai = String(tanggal || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nilai) || Number.isNaN(new Date(`${nilai}T00:00:00Z`).getTime())) {
    throw new KesalahanScoring('Tanggal penilaian tidak valid.');
  }
  return nilai;
}

function validasiPengawasan(pengawasanId, proyekId) {
  if (pengawasanId === undefined || pengawasanId === null || pengawasanId === '') return null;
  const id = Number(pengawasanId);
  const pengawasan = db.prepare('SELECT id, proyek_id FROM pengawasan WHERE id=?').get(id);
  if (!pengawasan) throw new KesalahanScoring('Catatan pengawasan tidak ditemukan.', 404);
  if (pengawasan.proyek_id !== proyekId) {
    throw new KesalahanScoring('Catatan pengawasan bukan milik proyek yang dipilih.');
  }
  return id;
}

function kodeBerikut(tanggal) {
  const prefix = `SCR-${tanggal.replace(/-/g, '')}-`;
  const terakhir = db
    .prepare('SELECT kode FROM scoring WHERE kode LIKE ? ORDER BY kode DESC LIMIT 1')
    .get(`${prefix}%`);
  let urut = 1;
  if (terakhir) {
    const n = Number.parseInt(terakhir.kode.slice(prefix.length), 10);
    if (Number.isFinite(n)) urut = n + 1;
  }
  return `${prefix}${String(urut).padStart(3, '0')}`;
}

function petaDetail(scoringId) {
  const out = {};
  for (const d of db.prepare('SELECT * FROM scoring_detail WHERE scoring_id=?').all(scoringId)) {
    out[d.aspek_kode] = { catatan: d.catatan || '', bukti: d.bukti || '' };
  }
  return out;
}

function simpanDetail(scoringId, detail) {
  const ins = db.prepare(
    `INSERT INTO scoring_detail(scoring_id, aspek_kode, skor, bobot, nilai, catatan, bukti)
     VALUES(?,?,?,?,?,?,?)`
  );
  for (const d of detail) {
    ins.run(scoringId, d.kode, d.skor, d.bobot, d.nilai, d.catatan || null, d.bukti || null);
  }
}

export function buatScoring(body, pengguna) {
  const proyek = validasiProyek(body?.proyek_id);
  const tanggal = validasiTanggal(body?.tanggal || hariIni());
  const pengawasanId = validasiPengawasan(body?.pengawasan_id, proyek.id);
  const { skor, galat } = validasiSkor(body?.skor || {});
  if (galat.length) throw new KesalahanScoring(galat.join('; '));
  const detailInput = body?.detail && typeof body.detail === 'object' ? body.detail : {};
  const hasil = hitungScoring(skor, detailInput);
  const petugas = String(body?.petugas || pengguna || 'Petugas Pengawasan').trim();

  let id;
  const tx = db.transaction(() => {
    const r = db
      .prepare(
        `INSERT INTO scoring
         (kode, proyek_id, pengawasan_id, tanggal, petugas, nilai_akhir, kategori, kritis,
          rekomendasi, catatan, kesimpulan, dibuat_oleh)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        kodeBerikut(tanggal),
        proyek.id,
        pengawasanId,
        tanggal,
        petugas,
        hasil.nilai_akhir,
        hasil.kategori,
        hasil.kritis,
        hasil.rekomendasi,
        body?.catatan || null,
        body?.kesimpulan || null,
        pengguna || null
      );
    id = Number(r.lastInsertRowid);
    simpanDetail(id, hasil.detail);
  });
  tx();
  sinkronRisiko(proyek.id);
  return ambilScoring(id);
}

export function ubahScoring(id, body, pengguna) {
  const lama = db.prepare('SELECT * FROM scoring WHERE id=?').get(Number(id));
  if (!lama) throw new KesalahanScoring('Penilaian scoring tidak ditemukan.', 404);

  const proyek = validasiProyek(body?.proyek_id ?? lama.proyek_id);
  const tanggal = validasiTanggal(body?.tanggal ?? lama.tanggal);
  const pengawasanId = validasiPengawasan(
    body?.pengawasan_id !== undefined ? body.pengawasan_id : lama.pengawasan_id,
    proyek.id
  );

  const skorLama = {};
  for (const d of db.prepare('SELECT aspek_kode, skor FROM scoring_detail WHERE scoring_id=?').all(lama.id)) {
    skorLama[d.aspek_kode] = d.skor;
  }
  const { skor, galat } = validasiSkor(body?.skor || skorLama);
  if (galat.length) throw new KesalahanScoring(galat.join('; '));

  const detailInput =
    body?.detail && typeof body.detail === 'object' ? body.detail : petaDetail(lama.id);
  const hasil = hitungScoring(skor, detailInput);
  const petugas = String(body?.petugas ?? lama.petugas ?? pengguna ?? 'Petugas Pengawasan').trim();

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE scoring SET
         proyek_id=?, pengawasan_id=?, tanggal=?, petugas=?, nilai_akhir=?, kategori=?,
         kritis=?, rekomendasi=?, catatan=?, kesimpulan=?, updated_at=datetime('now')
       WHERE id=?`
    ).run(
      proyek.id,
      pengawasanId,
      tanggal,
      petugas,
      hasil.nilai_akhir,
      hasil.kategori,
      hasil.kritis,
      hasil.rekomendasi,
      body?.catatan !== undefined ? body.catatan : lama.catatan,
      body?.kesimpulan !== undefined ? body.kesimpulan : lama.kesimpulan,
      lama.id
    );
    db.prepare('DELETE FROM scoring_detail WHERE scoring_id=?').run(lama.id);
    simpanDetail(lama.id, hasil.detail);
  });
  tx();
  sinkronRisiko(proyek.id);
  if (lama.proyek_id !== proyek.id) sinkronRisiko(lama.proyek_id);
  return ambilScoring(lama.id);
}

export function hapusScoring(id) {
  const lama = db.prepare('SELECT * FROM scoring WHERE id=?').get(Number(id));
  if (!lama) throw new KesalahanScoring('Penilaian scoring tidak ditemukan.', 404);
  db.prepare('DELETE FROM scoring WHERE id=?').run(lama.id);
  sinkronRisiko(lama.proyek_id);
  return lama;
}

export function daftarScoring({
  limit = 25,
  offset = 0,
  proyek_id,
  kategori,
  kecamatan,
  q,
  dari,
  sampai,
} = {}) {
  const where = [];
  const params = [];
  if (proyek_id) {
    where.push('s.proyek_id = ?');
    params.push(Number(proyek_id));
  }
  if (kategori) {
    if (kategori === 'Sangat tinggi') {
      where.push("s.kategori IN ('Sangat tinggi','Ekstrem')");
    } else {
      where.push('s.kategori = ?');
      params.push(kategori);
    }
  }
  if (kecamatan) {
    where.push('p.kecamatan = ?');
    params.push(kecamatan);
  }
  if (q) {
    where.push('(s.kode LIKE ? OR p.kode LIKE ? OR p.nama LIKE ? OR s.petugas LIKE ?)');
    const pola = `%${String(q).toLowerCase()}%`;
    params.push(pola, pola, pola, pola);
  }
  if (dari) {
    where.push('s.tanggal >= ?');
    params.push(dari);
  }
  if (sampai) {
    where.push('s.tanggal <= ?');
    params.push(sampai);
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db
    .prepare(`SELECT COUNT(*) n FROM scoring s JOIN proyek p ON p.id=s.proyek_id ${w}`)
    .get(...params).n;
  const items = db
    .prepare(
      `SELECT s.*, p.kode AS proyek_kode, p.nama AS proyek_nama, p.kecamatan, p.pagu, p.progres,
              p.penyedia_id,
              (SELECT COUNT(*) FROM scoring_detail d WHERE d.scoring_id=s.id AND d.skor=4) jumlah_skor4,
              (SELECT GROUP_CONCAT(d.aspek_kode, ',') FROM scoring_detail d
                 WHERE d.scoring_id=s.id AND d.skor=4) aspek_skor4
       FROM scoring s JOIN proyek p ON p.id=s.proyek_id ${w}
       ORDER BY s.tanggal DESC, s.id DESC LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);
  return { total, items };
}

export { ASPEK };
