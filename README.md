# BEGASAK

**Besame Mengawasi Bina Konstruksi** — Decision Support System (DSS) untuk monitoring dan pengawasan jasa konstruksi.

Satuan Kerja: **DPURPK Kabupaten Belitung Timur**, Provinsi Kepulauan Bangka Belitung · Tahun Anggaran **2025**.

---

## Ringkasan

| Komponen | Keterangan |
| --- | --- |
| Data | 164 proyek, 349 tenaga kerja bersertifikat, 90 penyedia jasa |
| IKK/KKTC | 83,49% (target 83,49%), gap 69 tenaga kerja |
| Nilai pagu | Rp 47.443.226.079,58 |
| Metode DSS | Skor 7 indikator berbobot + 13 aturan EW proyek + 4 EW agregat |
| Pemetaan | 7 kecamatan, titik koordinat pusat |
| Realtime | Server-Sent Events (`/api/stream`) dengan simulator tick 12 detik |
| Autentikasi | Sesi Bearer di tabel `sesi`, Berlaku 12 jam, 5 peran dengan RBAC per-izin |

## Menjalankan

```bash
npm run setup     # pasang dependency server + web
npm run seed      # isi database dari seed/bikon2025.json
npm run dev       # API :5178 + Web :5179
```

Buka **http://localhost:5179** lalu masuk dengan salah satu akun di bawah.

## Akun Demo

Password untuk semua akun demo: `admin123`, `ppk123`, `awas123`, `mitra123`, `iab123`, `warga123`.

| Username | Peran | Cakupan |
| --- | --- | --- |
| `admin` | Administrator | Seluruh modul, termasuk Manajemen Pengguna (29 izin) |
| `pengguna.ppk` | Perangkat Daerah | Supervisi dan pengawasan lapangan (25 izin) |
| `pengguna.pengawas` | Perangkat Daerah | Field supervisor, cakupan lebih sempit |
| `cv.mitra` | Penyedia Jasa | Proyek, tenaga kerja, dan penyedia (12 izin) |
| `institut` | Asosiasi Profesi | Rekap industri dan pengaduan asosiasi (9 izin) |
| `masyarakat` | Masyarakat | Dashboard, proyek, pengaduan (5 izin) |

Panel "Akun Demo" pada halaman `/masuk` hanya muncul saat `NODE_ENV` bukan `production`.

Perintah terpisah bila diperlukan:

```bash
npm run dev:api    # hanya Express API
npm run dev:web    # hanya Vite dev server
npm run build      # build produksi ke web/dist
npm start          # Express API sekaligus menyajikan web/dist
```

### Variabel lingkungan

| Variabel | Default | Fungsi |
| --- | --- | --- |
| `PORT` | `5178` | Port API |
| `BEGASAK_TICK_MS` | `12000` | Interval simulator monitoring (ms) |
| `BEGASAK_SIM` | aktif | Isi `off` untuk mematikan simulator |
| `NODE_ENV` | — | Isi `production` untuk menyembunyikan akun demo |

## Sumber Data

ETL membaca folder `../DATA BIKON 2025`:

| Berkas | Isi |
| --- | --- |
| `J. Tenaga Kerja.xlsx` | 349 tenaga kerja bersertifikat |
| `KEBUTUHAN TENAGA KERJA.xlsx` | 164 proyek beserta kebutuhan tenaga kerja |
| `Direktori Perusahaan Konstruksi Tahun 2025.xlsx` | 90 penyedia jasa |
| Dokumen IKK | Target indeks kompetensi kerja 83,49% |

```bash
npm run etl        # memerlukan python3 + openpyxl
```

Hasil ETL disimpan di `server/seed/bikon2025.json`, lalu diimpor oleh `npm run seed`.

## Halaman

| Rute | Isi | Peran |
| --- | --- | --- |
| `/` | Dashboard monitoring: IKK, anggaran, risiko, peringatan | Semua |
| `/masuk` | Halaman masuk | Publik |
| `/pengguna` | Manajemen akun, peran, dan status aktif | Administrator |
| `/peta` | Peta skematis risiko per kecamatan | Perangkat Daerah |
| `/proyek` | Data proyek, filter, detail indikator | Semua |
| `/tenaga-kerja` | 349 TKK, analisis kesenjangan kualifikasi | Perangkat Daerah, Penyedia, Asosiasi |
| `/penyedia` | 90 penyedia jasa, skor kemampuan | Perangkat Daerah, Asosiasi |
| `/pengawasan` | Catatan supervisi dan temuan lapangan | Perangkat Daerah, Penyedia |
| `/risiko` | Matriks probabilitas × dampak | Perangkat Daerah, Asosiasi |
| `/peringatan` | Early warning system | Perangkat Daerah |
| `/pengaduan` | Pengaduan masyarakat | Perangkat Daerah, Masyarakat |
| `/laporan` | Ringkasan eksekutif + unduh CSV | Semua |

Menu, tombol, dan rute menyesuaikan izin peran aktif. Halaman di luar akses menampilkan
pesan pembatasan, dan permintaan API ditolak `403` oleh guard `wajibIzin`.

## Autentikasi & RBAC

- Password disimpan sebagai hash `scrypt` (garam acak per pengguna), bukan teks biasa.
- Login mengembalikan token acak yang disimpan pada tabel `sesi` (kedaluwarsa 12 jam).
- Setiap permintaan harus menyertakan `Authorization: Bearer <token>`.
- Sesi dicabut otomatis saat logout, akun dinonaktifkan, atau akun dihapus.
- `Administrator` aktif terakhir tidak dapat dinonaktifkan, dihapus, atau diturunkan perannya.

Izin yang tersedia: `dashboard`, `peta`, `proyek`, `tenaga`, `penyedia`, `pengawasan`,
`risiko`, `peringatan`, `pengaduan`, `laporan`, `pengguna`, `audit`, `sistem` — masing-masing
dengan aksi `read`, `create`, `update`, `delete`.

Route publik: `GET /api/health`, `POST /api/auth/masuk`, `GET /api/auth/akun-demo`.
Seluruh `/api/*` lainnya memerlukan sesi valid.

Endpoint SSE memakai token pada query string karena `EventSource` tidak dapat mengirim
header: `GET /api/stream?token=<token>`.

Endpoint unduh CSV juga memerlukan header Authorization, sehingga antarmuka mengambil
berkas sebagai Blob (`unduh()` di `web/src/lib/api.js`) alih-alih tautan `<a href>`.

## Model Risiko

Bobot indikator:

| Indikator | Bobot |
| --- | --- |
| Ketersediaan tenaga bersertifikat | 22% |
| Metode pengadaan | 8% |
| Kapasitas penyedia | 12% |
| Deviasi progres | 20% |
| Temuan pengawasan | 20% |
| Keselamatan kerja (K3) | 12% |
| Frekuensi supervisi | 6% |

Tingkat: Rendah < 25 · Sedang 25–49 · Tinggi 50–74 · Ekstrem ≥ 75.

Aturan early warning proyek: EW-01 s.d. EW-13. Aturan agregat: EW-A1 s.d. EW-A4.

## Realtime (SSE)

`GET /api/stream` enjoyment event berikut:

| Event | Isi payload |
| --- | --- |
| `hello` | `{ waktu }` — konfirmasi koneksi |
| `monitoring` | `{ supervisi, temuan, risiko, peringatan[], waktu }` |
| `peringatan-baru` | `{ peringatan[] }` — hanya peringatan yang baru muncul |
| `pengaduan-baru` | baris pengaduan yang baru masuk |
| `hitung-ulang` | hasil eksekusi ulang DSS Engine |

`monitoring` dipancarkan setiap tick simulator dan mencakup skor risiko terbaru proyek
yang disupervised beserta temuan (bila ada) dan daftar peringatan DSS Engine yang baru.

## Ekspor Data

Semua endpoint berikut memerlukan sesi dan izin `laporan:read`.

```
GET /api/laporan/ekspor?format=csv&data=proyek
GET /api/laporan/ekspor?format=csv&data=tenaga
GET /api/laporan/ekspor?format=csv&data=penyedia
GET /api/laporan/ekspor?format=csv&data=temuan
GET /api/laporan/ekspor?format=csv&data=pengawasan
GET /api/laporan/ekspor?format=csv&data=peringatan
```

CSV memakai pemisah `;`, BOM UTF-8, dan escape tanda kutip ganda agar langsung terbuka
di Excel. Parameter `data` yang tidak dikenal dijawab HTTP 400 beserta daftar dataset
yang tersedia.

## Catatan

- Peta bersifat skematis; batas wilayah adalah ilustrasi berbasis titik koordinat pusat kecamatan, bukan batas resmi.
- Simulasi temuan dan progres menghasilkan angka yang berubah setiap kali `npm run seed` dijalankan.
- Koordinat dan tanggal pada data simulasi bersifat ilustratif untuk keperluan demonstrasi DSS.
- Setelah `npm run build`, jalankan `npm start` untuk menyajikan API dan antarmuka dari satu origin pada port 5178.
- Akun demo hanya untuk demonstrasi; jalankan dengan `NODE_ENV=production` agar kredensial tidak ditampilkan.
- Menyusun ulang data: `node server/src/seed.js --force` mengembalikan database ke kondisi baseline.
