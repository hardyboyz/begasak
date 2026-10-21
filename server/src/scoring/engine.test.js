import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ASPEK,
  TOTAL_BOBOT,
  hitungScoring,
  klasifikasi,
  nilaiBerbobot,
  validasiSkor,
} from './engine.js';

const skor = (nilai) => Object.fromEntries(ASPEK.map((a) => [a.kode, nilai]));

test('bobot seluruh aspek berjumlah 100', () => {
  assert.equal(TOTAL_BOBOT, 100);
});

test('skor 1 memberi kontribusi 0 dan skor 4 memberi bobot penuh', () => {
  assert.equal(nilaiBerbobot(1, 20), 0);
  assert.equal(nilaiBerbobot(4, 20), 20);
  assert.equal(hitungScoring(skor(1)).nilai_akhir, 0);
  assert.equal(hitungScoring(skor(1)).kategori, 'Rendah');
  assert.equal(hitungScoring(skor(4)).nilai_akhir, 100);
  assert.equal(hitungScoring(skor(4)).kategori, 'Sangat tinggi');
});

test('contoh Berita Acara menghasilkan 50,00 dan kategori Sedang', () => {
  const hasil = hitungScoring({
    ADMINISTRASI: 2,
    KEMAJUAN_FISIK: 3,
    MUTU: 2,
    WAKTU: 3,
    KEUANGAN: 2,
    KESELAMATAN: 4,
    LINGKUNGAN: 1,
    DOKUMENTASI: 2,
  });
  assert.equal(hasil.nilai_akhir, 50);
  assert.equal(hasil.kategori, 'Sedang');
  assert.equal(hasil.kritis, 1);
});

test('skor keselamatan 4 menandai temuan kritis', () => {
  const hasil = hitungScoring({ ...skor(1), KESELAMATAN: 4 });
  assert.equal(hasil.kritis, 1);
  assert.match(hasil.rekomendasi, /tindak lanjut segera/i);
});

test('batas klasifikasi mengikuti Berita Acara', () => {
  assert.equal(klasifikasi(0).kategori, 'Rendah');
  assert.equal(klasifikasi(25).kategori, 'Rendah');
  assert.equal(klasifikasi(25.01).kategori, 'Sedang');
  assert.equal(klasifikasi(50).kategori, 'Sedang');
  assert.equal(klasifikasi(50.01).kategori, 'Tinggi');
  assert.equal(klasifikasi(75).kategori, 'Tinggi');
  assert.equal(klasifikasi(75.01).kategori, 'Sangat tinggi');
  assert.equal(klasifikasi(100).kategori, 'Sangat tinggi');
});

test('validasi menolak skor kosong, pecahan, dan di luar 1–4', () => {
  const kosong = validasiSkor({});
  assert.equal(kosong.galat.length, ASPEK.length);

  const salah = validasiSkor({ ...skor(1), MUTU: 2.5, WAKTU: 5, KEUANGAN: 0 });
  assert.equal(salah.galat.length, 3);
});

test('validasi meloloskan delapan skor bulat 1–4', () => {
  const hasil = validasiSkor(skor(3));
  assert.deepEqual(hasil.galat, []);
  assert.equal(Object.keys(hasil.skor).length, ASPEK.length);
});
