# Diagram Alur dan UML BEGASAK

Dokumen ini berisi flowchart dan diagram UML aplikasi **BEGASAK** dalam format
[Mermaid](https://mermaid.js.org/). Diagram dapat dirender langsung oleh GitHub,
GitLab, VS Code, Obsidian, atau Mermaid Live Editor.

## Daftar Diagram

1. [Flowchart utama aplikasi](#1-flowchart-utama-aplikasi)
2. [Flowchart autentikasi dan RBAC](#2-flowchart-autentikasi-dan-rbac)
3. [Flowchart penilaian scoring](#3-flowchart-penilaian-scoring)
4. [Flowchart DSS dan early warning](#4-flowchart-dss-dan-early-warning)
5. [UML use case](#5-uml-use-case)
6. [UML class diagram](#6-uml-class-diagram)
7. [UML sequence diagram](#7-uml-sequence-diagram)
8. [UML component diagram](#8-uml-component-diagram)
9. [ERD database](#9-erd-database)

---

## 1. Flowchart Utama Aplikasi

Alur umum dari pengguna membuka aplikasi sampai data scoring memengaruhi
dashboard, peta, risiko, peringatan, dan laporan.

```mermaid
flowchart TD
    A([Pengguna]) --> B["Buka aplikasi web"]
    B --> C{"Punya token sesi valid?"}
    C -- Tidak --> D["Halaman /masuk"]
    D --> E["POST /api/auth/masuk"]
    E --> F{"Username, password, dan status aktif valid?"}
    F -- Tidak --> G["Tampilkan galat + catat audit gagal-masuk"]
    G --> D
    F -- Ya --> H["Buat token sesi 12 jam"]
    H --> I["Simpan token di browser"]
    I --> J["Layout + menu sesuai izin peran"]
    C -- Ya --> J

    J --> K{"Pilih modul"}
    K --> L["Dashboard"]
    K --> M["Peta Risiko"]
    K --> N["Data Proyek"]
    K --> O["Tenaga Kerja"]
    K --> P["Penyedia Jasa"]
    K --> Q["Pengawasan"]
    K --> R["Penilaian Scoring"]
    K --> S["Daftar Risiko"]
    K --> T["Peringatan Dini"]
    K --> U["Pengaduan"]
    K --> V["Laporan"]
    K --> W["Pengguna, Kecamatan, Audit"]

    R --> X["API /api/scoring"]
    X --> Y["Simpan scoring + 8 detail aspek"]
    Y --> Z["Sinkronisasi tabel risiko"]
    Z --> AA["Regenerasi peringatan DSS"]
    AA --> L
    AA --> M
    AA --> S
    AA --> T
    AA --> V

    L --> AB([Selesai])
    M --> AB
    N --> AB
    O --> AB
    P --> AB
    Q --> AB
    S --> AB
    T --> AB
    U --> AB
    V --> AB
    W --> AB
```

---

## 2. Flowchart Autentikasi dan RBAC

```mermaid
flowchart TD
    A([Request API]) --> B{"Endpoint publik?"}
    B -- Ya --> C["Proses request"]
    B -- Tidak --> D{"Header Authorization: Bearer ada?"}
    D -- Tidak --> E["401 Tidak terautentikasi"]
    D -- Ya --> F{"Token ada di tabel sesi dan belum kedaluwarsa?"}
    F -- Tidak --> E
    F -- Ya --> G["Muat pengguna + peran"]
    G --> H{"Akun masih aktif?"}
    H -- Tidak --> I["Cabut sesi + 401"]
    H -- Ya --> J{"Peran punya izin sumber:aksi?"}
    J -- Tidak --> K["403 Tidak diizinkan"]
    J -- Ya --> L["Jalankan handler"]
    L --> M["Catat audit bila mengubah data"]
    M --> N([Response JSON / CSV])

    C --> N
    E --> N
    I --> N
    K --> N
```

Matriks izin utama:

| Modul | Administrator | Perangkat Daerah | Penyedia Jasa | Asosiasi Profesi | Masyarakat |
| --- | --- | --- | --- | --- | --- |
| Dashboard | Ya | Ya | Ya | Ya | Ya |
| Peta | Ya | Ya | - | Ya | - |
| Proyek | Ya | Ya | Baca/ubah | Baca | Baca |
| Tenaga kerja | Ya | Ya | Baca | Baca | - |
| Penyedia | Ya | Ya | Baca | Baca | - |
| Pengawasan | Ya | Ya | Baca | - | - |
| Scoring | Ya | Ya | Baca | Baca | Baca |
| Risiko | Ya | Ya | Baca | Baca | - |
| Peringatan | Ya | Ya | Baca | Baca | - |
| Pengaduan | Ya | Ya | Buat/baca | - | Buat/baca |
| Laporan | Ya | Ya | Ya | Ya | Ya |
| Pengguna | Ya | - | - | - | - |

---

## 3. Flowchart Penilaian Scoring

Alur ini adalah inti model risiko BEGASAK. Nilai akhir dihitung dari delapan
aspek, lalu dimaterialisasikan ke tabel `risiko`.

```mermaid
flowchart TD
    A([Buka /scoring]) --> B{"Izin scoring:read?"}
    B -- Tidak --> B1["Halaman akses terbatas / 403"]
    B -- Ya --> C["Muat meta, ringkasan, dan daftar penilaian"]
    C --> D{"Pilih aksi"}
    D -- "Lihat detail" --> E["GET /api/scoring/:id"]
    E --> E1["Tampilkan 8 aspek, rekomendasi, dan catatan"]
    E1 --> Z([Selesai])

    D -- "Buat / ubah" --> F{"Izin scoring:create / scoring:update?"}
    F -- Tidak --> F1["Tolak 403"]
    F -- Ya --> G["Isi proyek, tanggal, petugas, pengawasan, catatan"]
    G --> H["Pilih skor 1-4 untuk 8 aspek"]
    H --> I{"Semua skor bilangan bulat 1-4?"}
    I -- Tidak --> G
    I -- Ya --> J["nilai_aspek = ((skor - 1) / 3) x bobot"]
    J --> K["nilai_akhir = jumlah nilai_aspek"]
    K --> L["Bulatkan nilai akhir ke 2 desimal"]
    L --> M{"nilai_akhir <= 25?"}
    M -- Ya --> N["Kategori Rendah"]
    M -- Tidak --> O{"nilai_akhir <= 50?"}
    O -- Ya --> P["Kategori Sedang"]
    O -- Tidak --> Q{"nilai_akhir <= 75?"}
    Q -- Ya --> R["Kategori Tinggi"]
    Q -- Tidak --> S["Kategori Sangat tinggi"]

    N --> T{"Skor KESELAMATAN = 4?"}
    P --> T
    R --> T
    S --> T
    T -- Ya --> U["Tandai K3 kritis + rekomendasi tindak lanjut segera"]
    T -- Tidak --> V["Gunakan rekomendasi kategori"]

    U --> W["Simpan scoring + 8 detail dalam transaksi"]
    V --> W
    W --> X["Upsert cache risiko proyek"]
    X --> Y["Regenerasi peringatan proyek + agregat"]
    Y --> AA["Kirim response + refresh tabel/ringkasan"]
    AA --> Z
```

Bobot aspek:

| Kode aspek | Bobot |
| --- | ---: |
| `ADMINISTRASI` | 10 |
| `KEMAJUAN_FISIK` | 20 |
| `MUTU` | 20 |
| `WAKTU` | 15 |
| `KEUANGAN` | 10 |
| `KESELAMATAN` | 10 |
| `LINGKUNGAN` | 5 |
| `DOKUMENTASI` | 10 |

Rumus:

```text
nilai_aspek = ((skor - 1) / 3) x bobot
nilai_akhir = jumlah seluruh nilai_aspek
```

Klasifikasi:

| Rentang nilai | Kategori |
| --- | --- |
| 0 - 25 | Rendah |
| > 25 - 50 | Sedang |
| > 50 - 75 | Tinggi |
| > 75 - 100 | Sangat tinggi |

---

## 4. Flowchart DSS dan Early Warning

Risiko proyek berasal dari scoring terbaru, sedangkan indikator operasional
tetap dipakai untuk aturan early warning.

```mermaid
flowchart TD
    A["Data proyek, tenaga kerja, penyedia, pengawasan, temuan"] --> B["hitungIndikator(proyek)"]
    B --> C["Indikator: K3 terbuka, deviasi progres, sertifikasi, supervisi, dll."]
    C --> D["Evaluasi EW-01 s.d. EW-14"]
    D --> E{"Aturan terpenuhi?"}
    E -- Tidak --> F["Tidak ada peringatan proyek"]
    E -- Ya --> G["Buat/perbarui peringatan proyek"]

    H["Penilaian scoring terbaru"] --> I["Cache risiko proyek"]
    I --> J["Evaluasi EW agregat EW-A1 s.d. EW-A4"]
    G --> J
    J --> K["Simpan peringatan + siarkan SSE"]
    K --> L["Dashboard, Peringatan, Peta, Laporan"]
    I --> L
```

Prinsip penting:

- `scoring` adalah sumber kebenaran risiko.
- `risiko` hanya cache untuk Dashboard, Peta, Proyek, dan Laporan.
- Proyek tanpa scoring berstatus **Belum dinilai**, bukan risiko nol.
- Peringatan dini tetap memakai `hitungIndikator`, terpisah dari skor risiko.
- Skor `KESELAMATAN = 4` selalu menghasilkan penandaan K3 kritis.

---

## 5. UML Use Case

Mermaid belum memiliki notasi use-case native, sehingga diagram berikut
menggunakan aktor dan use case dalam bentuk flowchart UML.

```mermaid
flowchart LR
    Admin(["Administrator"])
    PD(["Perangkat Daerah"])
    Penyedia(["Penyedia Jasa"])
    Asosiasi(["Asosiasi Profesi"])
    Masyarakat(["Masyarakat"])

    subgraph SISTEM["Sistem BEGASAK"]
        UC1(("Masuk / keluar"))
        UC2(("Melihat dashboard"))
        UC3(("Melihat peta risiko"))
        UC4(("Mengelola data proyek"))
        UC5(("Mengelola tenaga kerja"))
        UC6(("Mengelola penyedia jasa"))
        UC7(("Mencatat pengawasan dan temuan"))
        UC8(("Membuat / mengubah scoring"))
        UC9(("Melihat scoring dan rekomendasi"))
        UC10(("Melihat daftar risiko"))
        UC11(("Menindaklanjuti peringatan dini"))
        UC12(("Mengirim / menangani pengaduan"))
        UC13(("Melihat dan mengekspor laporan"))
        UC14(("Mengelola pengguna dan audit"))
        UC15(("Mengelola kecamatan"))
    end

    Admin --> UC1
    Admin --> UC2
    Admin --> UC3
    Admin --> UC4
    Admin --> UC5
    Admin --> UC6
    Admin --> UC7
    Admin --> UC8
    Admin --> UC9
    Admin --> UC10
    Admin --> UC11
    Admin --> UC12
    Admin --> UC13
    Admin --> UC14
    Admin --> UC15

    PD --> UC1
    PD --> UC2
    PD --> UC3
    PD --> UC4
    PD --> UC5
    PD --> UC6
    PD --> UC7
    PD --> UC8
    PD --> UC9
    PD --> UC10
    PD --> UC11
    PD --> UC12
    PD --> UC13
    PD --> UC15

    Penyedia --> UC1
    Penyedia --> UC2
    Penyedia --> UC4
    Penyedia --> UC5
    Penyedia --> UC6
    Penyedia --> UC7
    Penyedia --> UC9
    Penyedia --> UC10
    Penyedia --> UC11
    Penyedia --> UC12
    Penyedia --> UC13

    Asosiasi --> UC1
    Asosiasi --> UC2
    Asosiasi --> UC3
    Asosiasi --> UC4
    Asosiasi --> UC5
    Asosiasi --> UC6
    Asosiasi --> UC9
    Asosiasi --> UC10
    Asosiasi --> UC11
    Asosiasi --> UC13

    Masyarakat --> UC1
    Masyarakat --> UC2
    Masyarakat --> UC4
    Masyarakat --> UC9
    Masyarakat --> UC12
    Masyarakat --> UC13
```

---

## 6. UML Class Diagram

```mermaid
classDiagram
    class Pengguna {
        +int id
        +String username
        +String nama
        +String peran
        +String password_hash
        +int aktif
        +masuk(username, password) Sesi
        +keluar(token) void
        +boleh(izin) bool
    }

    class Sesi {
        +String token
        +int pengguna_id
        +datetime dibuat
        +datetime kedaluwarsa
        +valid() bool
    }

    class Proyek {
        +int id
        +String kode
        +String nama
        +String kecamatan
        +float pagu
        +String status
        +int progres
        +date tanggal_mulai
        +date tanggal_rencana_selesai
        +int penyedia_id
        +risikoTerbaru() Risiko
        +skorScoringTerbaru() Scoring
    }

    class PenyediaJasa {
        +int id
        +String kode
        +String nama
        +String kualifikasi
        +int skor_kemampuan
        +int sbu_aktif
    }

    class TenagaKerja {
        +int id
        +String kode
        +String nama
        +String kualifikasi
        +String jenjang
        +int bersertifikat
        +int perusahaan_id
    }

    class Penugasan {
        +int id
        +int proyek_id
        +int tenaga_id
        +String jabatan
        +String status
    }

    class Pengawasan {
        +int id
        +String kode
        +int proyek_id
        +date tanggal
        +String pengawas
        +String catatan
        +String status_verifikasi
    }

    class Temuan {
        +int id
        +String kode
        +int proyek_id
        +int pengawasan_id
        +String kategori
        +String tingkat
        +String status
        +date tenggat
    }

    class Scoring {
        +int id
        +String kode
        +int proyek_id
        +int pengawasan_id
        +date tanggal
        +String petugas
        +float nilai_akhir
        +String kategori
        +int kritis
        +String rekomendasi
        +hitungNilaiAkhir() float
        +tentukanKategori() String
        +isKritis() bool
        +sinkronRisiko() void
    }

    class ScoringDetail {
        +int id
        +int scoring_id
        +String aspek_kode
        +int skor
        +float bobot
        +float nilai
        +String catatan
        +String bukti
        +hitungKontribusi() float
    }

    class Risiko {
        +int id
        +String kode
        +int proyek_id
        +float skor
        +String level
        +String mitigasi
        +String sumber
    }

    class Peringatan {
        +int id
        +String kode
        +int proyek_id
        +String judul
        +String level
        +String indikator
        +int dibaca
        +int ditindaklanjuti
    }

    class Pengaduan {
        +int id
        +String kode
        +int proyek_id
        +String kategori
        +String status
        +String prioritas
    }

    class AuditLog {
        +int id
        +datetime waktu
        +String pengguna
        +String aksi
        +String entitas
        +int entitas_id
        +String detail
    }

    Pengguna "1" --> "*" Sesi : memiliki
    PenyediaJasa "1" --> "*" Proyek : mengerjakan
    PenyediaJasa "1" --> "*" TenagaKerja : mempekerjakan
    Proyek "1" --> "*" Penugasan : memiliki
    TenagaKerja "1" --> "*" Penugasan : ditugaskan
    Proyek "1" --> "*" Pengawasan : diawasi
    Pengawasan "1" --> "*" Temuan : menghasilkan
    Proyek "1" --> "*" Scoring : dinilai
    Scoring "1" *-- "8" ScoringDetail : terdiri dari
    Proyek "1" --> "0..1" Risiko : cache risiko
    Proyek "1" --> "*" Peringatan : memicu
    Proyek "1" --> "*" Pengaduan : menerima
    Pengguna "1" --> "*" AuditLog : menghasilkan
```

Catatan: tabel `risiko` bukan sumber kebenaran. Nilai `skor` dan `level` di
dalamnya merupakan hasil sinkronisasi dari `Scoring` terbaru.

---

## 7. UML Sequence Diagram

Skenario: Perangkat Daerah membuat penilaian scoring baru.

```mermaid
sequenceDiagram
    autonumber
    actor PD as Perangkat Daerah
    participant UI as React SPA
    participant API as Express API
    participant Auth as Auth / RBAC
    participant Repo as Scoring Repository
    participant Engine as Scoring Engine
    participant DB as SQLite
    participant Sync as Integrasi Risiko
    participant DSS as DSS Engine

    PD->>UI: Buka /scoring dan tekan Penilaian Baru
    UI->>API: GET /api/scoring/meta
    UI->>API: GET /api/scoring/ringkasan
    UI->>API: GET /api/scoring?limit=20
    API-->>UI: Meta aspek, ringkasan, daftar penilaian

    PD->>UI: Isi form dan skor 8 aspek
    UI->>UI: Hitung nilai akhir secara live
    PD->>UI: Simpan Penilaian
    UI->>API: POST /api/scoring
    API->>Auth: wajibIzin scoring:create
    Auth-->>API: Diizinkan
    API->>Repo: buatScoring(body, pengguna)

    Repo->>DB: Validasi proyek dan pengawasan
    Repo->>Engine: validasiSkor(skor)
    Engine-->>Repo: Skor valid / daftar galat

    alt Skor tidak valid
        Engine-->>Repo: Galat validasi
        Repo-->>API: KesalahanScoring
        API-->>UI: 400 + pesan galat
        UI-->>PD: Tampilkan galat
    else Skor valid
        Repo->>Engine: hitungScoring(skor, detail)
        Engine-->>Repo: nilai_akhir, kategori, kritis, rekomendasi
        Repo->>DB: BEGIN
        Repo->>DB: INSERT scoring
        Repo->>DB: INSERT 8 scoring_detail
        Repo->>DB: COMMIT
        Repo->>Sync: sinkronRisiko(proyek_id)
        Sync->>DB: Upsert / hapus cache risiko
        API->>DB: Audit log
        API->>DSS: hitungUlang(denganPeringatan=true)
        DSS->>DB: Sinkron seluruh risiko
        DSS->>DB: Regenerasi peringatan EW
        API-->>UI: 201 Created + scoring
        UI->>API: GET /api/scoring/ringkasan
        UI-->>PD: Tampilkan nilai, kategori, dan rekomendasi
    end
```

Skenario membaca proyek yang belum dinilai:

```mermaid
sequenceDiagram
    autonumber
    actor Pengguna
    participant UI as React SPA
    participant API as Express API
    participant Proyek as Data Proyek
    participant Sync as Integrasi Risiko

    Pengguna->>UI: Buka detail proyek
    UI->>API: GET /api/proyek/:kode
    API->>Proyek: Ambil proyek + indikator
    API->>Sync: ambilScoringTerbaru(proyek_id)
    alt Belum ada scoring
        Sync-->>API: null
        API-->>UI: skor=null, level="Belum dinilai"
        UI-->>Pengguna: Badge "Belum dinilai" dan ajakan menilai
    else Sudah ada scoring
        Sync-->>API: scoring terbaru
        API-->>UI: skor, kategori, detail 8 aspek
        UI-->>Pengguna: Nilai akhir, kategori, rekomendasi
    end
```

---

## 8. UML Component Diagram

```mermaid
flowchart LR
    subgraph Aktor["Aktor"]
        A1(["Administrator"])
        A2(["Perangkat Daerah"])
        A3(["Penyedia Jasa"])
        A4(["Asosiasi Profesi"])
        A5(["Masyarakat"])
    end

    subgraph Browser["Browser"]
        Web["React SPA"]
        Router["React Router + RBAC Route"]
        APIClient["API Client / fetch + Bearer token"]
        Pages["Halaman: Dashboard, Peta, Proyek, Scoring, Risiko, Peringatan, Laporan"]
        SSE["EventSource /api/stream"]
    end

    subgraph Server["Server Express"]
        API["REST API /api/*"]
        Auth["Auth + RBAC"]
        Scoring["Modul Scoring"]
        Engine["Scoring Engine"]
        DSS["DSS Engine + EW"]
        Monitor["Simulator Monitoring"]
        Export["Export CSV"]
        SSEBroker["SSE Broker"]
        Seed["Seed / ETL Loader"]
    end

    subgraph Data["Data"]
        DB[("SQLite BEGASAK")]
        Files["seed/bikon2025.json"]
        Source["Data BIKON 2025 / Excel"]
    end

    A1 --> Web
    A2 --> Web
    A3 --> Web
    A4 --> Web
    A5 --> Web

    Web --> Router
    Router --> Pages
    Pages --> APIClient
    Pages --> SSE
    APIClient -->|"HTTPS JSON + Bearer"| API
    SSE -->|"SSE token"| SSEBroker

    API --> Auth
    API --> Scoring
    API --> DSS
    API --> Export
    API --> SSEBroker
    Scoring --> Engine
    DSS --> Engine
    Scoring --> DB
    DSS --> DB
    API --> DB
    Monitor --> DB
    Monitor --> SSEBroker
    Seed --> Source
    Seed --> Files
    Seed --> DB
    Export --> DB
```

---

## 9. ERD Database

Entity Relationship Diagram utama. Kolom yang ditampilkan adalah kolom kunci
dan kolom penting; tabel lengkap dapat dilihat di `server/src/db.js`.

```mermaid
erDiagram
    PENGGUNA {
        int id PK
        string username UK
        string nama
        string peran
        string password_hash
        int aktif
        datetime created_at
    }

    SESI {
        string token PK
        int pengguna_id FK
        datetime dibuat
        datetime kedaluwarsa
    }

    PENYEDIA_JASA {
        int id PK
        string kode UK
        string nama
        string kualifikasi
        int skor_kemampuan
        int sbu_aktif
    }

    TENAGA_KERJA {
        int id PK
        string kode UK
        string nama
        string kualifikasi
        string jenjang
        int bersertifikat
        int perusahaan_id FK
    }

    PROYEK {
        int id PK
        string kode UK
        string nama
        string kecamatan
        float pagu
        string status
        int progres
        int penyedia_id FK
    }

    PENUGASAN {
        int id PK
        int proyek_id FK
        int tenaga_id FK
        string jabatan
        string status
    }

    PENGAWASAN {
        int id PK
        string kode UK
        int proyek_id FK
        date tanggal
        string pengawas
        string status_verifikasi
    }

    TEMUAN {
        int id PK
        string kode UK
        int proyek_id FK
        int pengawasan_id FK
        string kategori
        string tingkat
        string status
        date tenggat
    }

    SCORING {
        int id PK
        string kode UK
        int proyek_id FK
        int pengawasan_id FK
        date tanggal
        float nilai_akhir
        string kategori
        int kritis
        string rekomendasi
    }

    SCORING_DETAIL {
        int id PK
        int scoring_id FK
        string aspek_kode
        int skor
        float bobot
        float nilai
        string catatan
        string bukti
    }

    RISIKO {
        int id PK
        string kode UK
        int proyek_id FK
        float skor
        string level
        string mitigasi
        string sumber
    }

    PERINGATAN {
        int id PK
        string kode UK
        int proyek_id FK
        string judul
        string level
        string indikator
        int dibaca
        int ditindaklanjuti
    }

    PENGADUAN {
        int id PK
        string kode UK
        int proyek_id FK
        string kategori
        string status
        string prioritas
    }

    AUDIT_LOG {
        int id PK
        datetime waktu
        string pengguna
        string aksi
        string entitas
        int entitas_id
        string detail
    }

    PENGGUNA ||--o{ SESI : memiliki
    PENYEDIA_JASA ||--o{ PROYEK : mengerjakan
    PENYEDIA_JASA ||--o{ TENAGA_KERJA : mempekerjakan
    PROYEK ||--o{ PENUGASAN : memiliki
    TENAGA_KERJA ||--o{ PENUGASAN : ditugaskan
    PROYEK ||--o{ PENGAWASAN : diawasi
    PENGAWASAN ||--o{ TEMUAN : menghasilkan
    PROYEK ||--o{ SCORING : dinilai
    SCORING ||--|{ SCORING_DETAIL : terdiri_dari
    PROYEK ||--o| RISIKO : cache_risiko
    PROYEK ||--o{ PERINGATAN : memicu
    PROYEK ||--o{ PENGADUAN : menerima
```

---

## Ringkasan Arsitektur

| Lapisan | Teknologi | Tanggung jawab |
| --- | --- | --- |
| Antarmuka | React 18 + Vite + Tailwind | Halaman, form, filter, grafik, peta, RBAC route |
| API | Express + better-sqlite3 | REST JSON, autentikasi, otorisasi, validasi, audit |
| Domain risiko | Scoring Engine + DSS Engine | Formula 8 aspek, klasifikasi, cache risiko, early warning |
| Realtime | Server-Sent Events | Monitoring, peringatan baru, hitung ulang DSS |
| Penyimpanan | SQLite mode WAL | Data proyek, tenaga, penyedia, pengawasan, scoring, peringatan |
| Data awal | Seed + ETL Python | Impor Data BIKON 2025 dan pembuatan data demonstrasi |
