# BEGASAK

**Besame Mengawasi Bina Konstruksi** — Decision Support System (DSS) untuk monitoring dan pengawasan jasa konstruksi.

Satuan Kerja: **DPURPK Kabupaten Belitung Timur**, Provinsi Kepulauan Bangka Belitung · Tahun Anggaran **2025**.

---

## Ringkasan

| Komponen | Keterangan |
| --- | --- |
| Data | 164 proyek, 146 penilaian scoring, 349 tenaga kerja bersertifikat, 90 penyedia jasa |
| IKK/KKTC | 83,49% (target 83,49%), gap 69 tenaga kerja |
| Nilai pagu | Rp 47.443.226.079,58 |
| Metode DSS | Scoring risiko 8 aspek berbobot (0–100) + 14 aturan EW proyek + 4 EW agregat |
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
| `admin` | Administrator | Seluruh modul, termasuk Manajemen Pengguna |
| `pengguna.ppk` | Perangkat Daerah | Supervisi, pengawasan lapangan, dan scoring |
| `pengguna.pengawas` | Perangkat Daerah | Field supervisor, cakupan lebih sempit |
| `cv.mitra` | Penyedia Jasa | Proyek, tenaga kerja, penyedia, dan scoring (baca) |
| `institut` | Asosiasi Profesi | Rekap industri, scoring (baca), dan pengaduan asosiasi |
| `masyarakat` | Masyarakat | Dashboard, proyek, scoring (baca), pengaduan |

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
| `/peta` | Peta skematis risiko per kecamatan | Perangkat Daerah, Asosiasi |
| `/proyek` | Data proyek, filter, detail aspek scoring | Semua |
| `/tenaga-kerja` | 349 TKK, analisis kesenjangan kualifikasi | Perangkat Daerah, Penyedia, Asosiasi |
| `/penyedia` | 90 penyedia jasa, skor kemampuan | Perangkat Daerah, Asosiasi |
| `/pengawasan` | Catatan supervisi dan temuan lapangan | Perangkat Daerah, Penyedia |
| `/scoring` | Penilaian risiko 8 aspek, riwayat, dan rekomendasi | Semua (tulis: Administrator/PD) |
| `/risiko` | Daftar proyek menurut tingkat risiko scoring | Perangkat Daerah, Asosiasi, Penyedia |
| `/peringatan` | Early warning system | Perangkat Daerah |
| `/pengaduan` | Pengaduan masyarakat | Perangkat Daerah, Masyarakat |
| `/laporan` | Ringkasan eksekutif + unduh CSV | Semua |

Menu, tombol, dan rute menyesuaikan izin peran aktif. Halaman di luar akses menampilkan
pesan pembatasan, dan permintaan API ditolak `403` oleh guard `wajibIzin`.

Flowchart dan UML aplikasi tersedia di [`docs/DIAGRAM.md`](docs/DIAGRAM.md).

## Autentikasi & RBAC

- Password disimpan sebagai hash `scrypt` (garam acak per pengguna), bukan teks biasa.
- Login mengembalikan token acak yang disimpan pada tabel `sesi` (kedaluwarsa 12 jam).
- Setiap permintaan harus menyertakan `Authorization: Bearer <token>`.
- Sesi dicabut otomatis saat logout, akun dinonaktifkan, atau akun dihapus.
- `Administrator` aktif terakhir tidak dapat dinonaktifkan, dihapus, atau diturunkan perannya.

Izin yang tersedia: `dashboard`, `peta`, `proyek`, `tenaga`, `penyedia`, `pengawasan`,
`scoring`, `risiko`, `peringatan`, `pengaduan`, `kecamatan`, `laporan`, `pengguna`, `audit`,
`sistem` — masing-masing dengan aksi `read`, `create`, `update`, `delete` sesuai peran.
Hanya Administrator dan Perangkat Daerah yang dapat menulis penilaian scoring; peran lain
memiliki akses baca.

Route publik: `GET /api/health`, `POST /api/auth/masuk`, `GET /api/auth/akun-demo`.
Seluruh `/api/*` lainnya memerlukan sesi valid.

Endpoint SSE memakai token pada query string karena `EventSource` tidak dapat mengirim
header: `GET /api/stream?token=<token>`.

Endpoint unduh CSV juga memerlukan header Authorization, sehingga antarmuka mengambil
berkas sebagai Blob (`unduh()` di `web/src/lib/api.js`) alih-alih tautan `<a href>`.

## Model Risiko (Scoring 8 Aspek)

Risiko proyek dihitung dari penilaian terbaru pada halaman `/scoring`. Setiap aspek diberi
skor **1–4**, lalu kontribusinya dihitung dengan:

```text
nilai_aspek = ((skor - 1) / 3) x bobot
nilai_akhir = jumlah seluruh nilai_aspek
```

Nilai akhir dibulatkan ke 2 desimal. Bobot aspek:

| Aspek | Bobot |
| --- | --- |
| Administrasi | 10% |
| Kemajuan fisik | 20% |
| Mutu | 20% |
| Waktu | 15% |
| Keuangan | 10% |
| Keselamatan konstruksi | 10% |
| Lingkungan | 5% |
| Dokumentasi | 10% |

Klasifikasi: **Rendah** 0–25 · **Sedang** >25–50 · **Tinggi** >50–75 ·
**Sangat tinggi** >75–100.

Aturan khusus: skor aspek keselamatan konstruksi **4** selalu menandai penilaian sebagai
**K3 kritis** dan wajib ditindaklanjuti segera, berapa pun nilai akhirnya. Proyek tanpa
penilaian ditampilkan sebagai **Belum dinilai** dan tidak dianggap berisiko nol.

Tabel `risiko` tetap menjadi cache untuk Dashboard, Peta, Laporan, dan Proyek. Cache
disinkronkan setiap kali penilaian dibuat, diubah, atau dihapus.

Aturan early warning proyek: EW-01 s.d. EW-14. Aturan agregat: EW-A1 s.d. EW-A4.
Peringatan dini tetap memakai `hitungIndikator` dan tidak bergantung pada skor risiko lama.

## Realtime (SSE)

`GET /api/stream` mengirim event berikut:

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
GET /api/laporan/ekspor?format=csv&data=scoring
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
