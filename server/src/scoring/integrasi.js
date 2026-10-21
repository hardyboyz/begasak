import { db } from '../db.js';
import { ASPEK, aspekTerburuk, klasifikasi } from './engine.js';

/**
 * Jembatan antara modul Scoring dan tabel `risiko`.
 *
 * `risiko` kini hanya cache dari penilaian scoring terbaru supaya halaman
 * dashboard, peta, laporan, dan proyek tetap memakai kontrak data yang sama.
 * Sumber kebenaran tetap tabel `scoring` + `scoring_detail`.
 */

function detailDari(scoringId) {
  const baris = db.prepare('SELECT * FROM scoring_detail WHERE scoring_id=?').all(scoringId);
  const peta = new Map(baris.map((d) => [d.aspek_kode, d]));
  return ASPEK.map((a) => {
    const d = peta.get(a.kode);
    return {
      kode: a.kode,
      nama: a.nama,
      indikator: a.indikator,
      bobot: d?.bobot ?? a.bobot,
      urutan: a.urutan,
      skor: d?.skor ?? null,
      nilai: d?.nilai ?? 0,
      catatan: d?.catatan || '',
      bukti: d?.bukti || '',
    };
  });
}

export function ambilScoring(scoringId) {
  const row = db.prepare('SELECT * FROM scoring WHERE id=?').get(scoringId);
  if (!row) return null;
  return { ...row, detail: detailDari(row.id) };
}

export function ambilScoringTerbaru(proyekId) {
  const row = db
    .prepare('SELECT * FROM scoring WHERE proyek_id=? ORDER BY tanggal DESC, id DESC LIMIT 1')
    .get(proyekId);
  if (!row) return null;
  return { ...row, detail: detailDari(row.id) };
}

export function risikoProyek(proyekId) {
  const risiko = db.prepare('SELECT * FROM risiko WHERE proyek_id=?').get(proyekId) || null;
  const scoring = ambilScoringTerbaru(proyekId);
  return { risiko, scoring };
}

/**
 * Materialisasi penilaian terbaru ke tabel `risiko`.
 * Proyek tanpa scoring tidak memiliki baris risiko (dianggap "Belum dinilai").
 */
export function sinkronRisiko(proyekId = null) {
  const proyek = proyekId
    ? db.prepare('SELECT id, kode FROM proyek WHERE id=?').all(proyekId)
    : db.prepare('SELECT id, kode FROM proyek').all();

  const upsert = db.prepare(
    `INSERT INTO risiko(kode, proyek_id, kategori, deskripsi, probabilitas, dampak, skor, level, mitigasi, sumber)
     VALUES(@kode, @proyek_id, 'Scoring DSS', @deskripsi, NULL, NULL, @skor, @level, @mitigasi, 'Scoring DSS')
     ON CONFLICT(kode) DO UPDATE SET
       kategori=excluded.kategori,
       deskripsi=excluded.deskripsi,
       probabilitas=NULL,
       dampak=NULL,
       skor=excluded.skor,
       level=excluded.level,
       mitigasi=excluded.mitigasi,
       sumber='Scoring DSS'`
  );
  const hapus = db.prepare('DELETE FROM risiko WHERE proyek_id=?');

  let dinilai = 0;
  const tx = db.transaction(() => {
    for (const p of proyek) {
      const s = ambilScoringTerbaru(p.id);
      if (!s) {
        hapus.run(p.id);
        continue;
      }
      const buruk = aspekTerburuk(s.detail, 3);
      upsert.run({
        kode: `RSK-${p.kode}`,
        proyek_id: p.id,
        deskripsi:
          buruk.length > 0
            ? `Aspek risiko: ${buruk.join(', ')}`
            : 'Seluruh aspek scoring berada pada tingkat risiko rendah.',
        skor: s.nilai_akhir,
        level: s.kategori,
        mitigasi: s.rekomendasi || klasifikasi(s.nilai_akhir).rekomendasi,
      });
      dinilai++;
    }
  });
  tx();
  return { proyek: proyek.length, dinilai, belum_dinilai: proyek.length - dinilai };
}

export function ringkasanRisiko() {
  const perLevel = { Rendah: 0, Sedang: 0, Tinggi: 0, 'Sangat tinggi': 0, 'Belum dinilai': 0 };
  const rows = db.prepare('SELECT level, COUNT(*) n FROM risiko GROUP BY level').all();
  for (const r of rows) {
    const level = r.level === 'Ekstrem' ? 'Sangat tinggi' : r.level;
    if (perLevel[level] !== undefined) perLevel[level] += r.n;
  }
  const total = db.prepare('SELECT COUNT(*) n FROM proyek').get().n;
  const dinilai = Object.entries(perLevel)
    .filter(([k]) => k !== 'Belum dinilai')
    .reduce((a, [, n]) => a + n, 0);
  perLevel['Belum dinilai'] = Math.max(0, total - dinilai);
  return {
    ...perLevel,
    total,
    dinilai,
    belum_dinilai: perLevel['Belum dinilai'],
    skor_rata: Number(
      (db.prepare('SELECT AVG(skor) n FROM risiko').get()?.n || 0).toFixed(2)
    ),
  };
}

export function ringkasanScoring() {
  const total = db.prepare('SELECT COUNT(*) n FROM scoring').get().n;
  const rata = db.prepare('SELECT AVG(nilai_akhir) n FROM scoring').get()?.n || 0;
  const perKategori = { Rendah: 0, Sedang: 0, Tinggi: 0, 'Sangat tinggi': 0 };
  db.prepare('SELECT kategori, COUNT(*) n FROM scoring GROUP BY kategori').all().forEach((r) => {
    const kategori = r.kategori === 'Ekstrem' ? 'Sangat tinggi' : r.kategori;
    if (perKategori[kategori] !== undefined) perKategori[kategori] += r.n;
  });
  const perAspek = ASPEK.map((a) => {
    const r = db
      .prepare(
        `SELECT AVG(skor) skor, AVG(nilai) nilai, COUNT(*) n
         FROM scoring_detail WHERE aspek_kode=?`
      )
      .get(a.kode);
    return {
      kode: a.kode,
      nama: a.nama,
      bobot: a.bobot,
      rata_skor: Number((r?.skor || 0).toFixed(2)),
      rata_nilai: Number((r?.nilai || 0).toFixed(2)),
      jumlah: r?.n || 0,
    };
  });
  const proyekDinilai = db.prepare('SELECT COUNT(DISTINCT proyek_id) n FROM scoring').get().n;
  const proyekTotal = db.prepare('SELECT COUNT(*) n FROM proyek').get().n;
  return {
    total,
    rata_rata: Number(Number(rata).toFixed(2)),
    per_kategori: perKategori,
    per_aspek: perAspek,
    proyek_dinilai: proyekDinilai,
    proyek_belum_dinilai: Math.max(0, proyekTotal - proyekDinilai),
    proyek_total: proyekTotal,
    kritis: db.prepare('SELECT COUNT(*) n FROM scoring WHERE kritis=1').get().n,
  };
}
