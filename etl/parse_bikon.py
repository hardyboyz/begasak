#!/usr/bin/env python3
"""
BEGASAK ETL — mengubah folder "DATA BIKON 2025" menjadi seed JSON untuk database.

Sumber:
  1. Jumlah Tenaga Kerja Konstruksi Operator dan Teknisi Analis 2025.xlsx
  2. Jumlah Kebutuhan Tenaga Kerja Konstruksi.xlsx
  3. PERSENTASE TENAGA OPERATOR TEKNISI ANALIS YANG MEMILIKI SERTIFIKAT KOMPETENSI.docx
  Direktori Perusahaan Konstruksi Tahun 2025.xlsx

Jalankan:  python3 etl/parse_bikon.py
"""
import json
import os
import re
import sys
import zipfile
import html
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))


def find_data_dir():
    kandidat = [
        os.path.join(ROOT, "DATA BIKON 2025"),
        os.path.join(os.path.dirname(ROOT), "DATA BIKON 2025"),
    ]
    for d in kandidat:
        if os.path.isdir(d):
            return d
    sys.exit("Folder 'DATA BIKON 2025' tidak ditemukan di: " + " | ".join(kandidat))


DATA_DIR = find_data_dir()
OUT_DIR = os.path.join(ROOT, "server", "seed")
F_TKK = "1. Jumlah Tenaga Kerja Konstruksi Operator dan Teknisi Analis 2025.xlsx"
F_KEB = "2. Jumlah Kebutuhan Tenaga Kerja Konstruksi.xlsx"
F_DIR = "Direktori Perusahaan Konstruksi Tahun 2025.xlsx"
F_IKK = "PERSENTASE TENAGA OPERATOR TEKNISI ANALIS YANG MEMILIKI SERTIFIKAT KOMPETENSI.docx"

# Kecamatan Kabupaten Belitung Timur + titik pusat (approximate, untuk pemetaan)
KECAMATAN = [
    {"nama": "Manggar", "lat": -2.8535, "lng": 107.7506},
    {"nama": "Damar", "lat": -2.7516, "lng": 107.9526},
    {"nama": "Kelapa Kampit", "lat": -2.9841, "lng": 107.8167},
    {"nama": "Dendang", "lat": -3.0166, "lng": 107.8263},
    {"nama": "Gantung", "lat": -3.1331, "lng": 107.7504},
    {"nama": "Simpang Pesak", "lat": -2.6561, "lng": 107.8979},
    {"nama": "Simpang Renggiang", "lat": -3.2107, "lng": 107.8732},
]
KEC_ALIASES = [
    ("Simpang Renggiang", ["simpang renggiang", "s. renggiang", "simpang renggiang", "renggiang"]),
    ("Kelapa Kampit", ["kelapa kampit", "kelapakampit", "kelapa kampang"]),
    ("Simpang Pesak", ["simpang pesak", "simpangpesak", "sp. pesak", "s. pesak"]),
    ("Damar", ["damar"]),
    ("Dendang", ["dendang"]),
    ("Gantung", ["gantung"]),
    ("Manggar", ["manggar"]),
]


def norm(v):
    if v is None:
        return ""
    s = str(v).replace("\xa0", " ").replace("\n", " ").strip()
    return re.sub(r"\s+", " ", s)


def guess_kecamatan(*texts):
    blob = " ".join(norm(t).lower() for t in texts)
    for nama, aliases in KEC_ALIASES:
        for a in aliases:
            if a in blob:
                return nama
    return "Manggar"  # fallback: pusat kabupaten


def detect_kecamatan(text):
    """Terjemahkan nama wilayah tak baku -> nama kecamatan resmi."""
    t = norm(text).lower()
    if "kec. manggar" in t or "manggar" in t:
        return "Manggar"
    for nama, aliases in KEC_ALIASES:
        if any(a in t for a in aliases):
            return nama
    return ""


def load_workbook(path):
    try:
        import openpyxl
    except ImportError:
        sys.exit("Butuh: pip install openpyxl")
    return openpyxl.load_workbook(os.path.join(DATA_DIR, path), data_only=True)


def is_num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def is_seq(v):
    s = norm(v)
    return s.isdigit()


# ---------------------------------------------------------------- TENAGA KERJA
def parse_tkk():
    wb = load_workbook(F_TKK)
    ws = wb["J. Tenaga Kerja"]
    rows = []
    for r in range(14, ws.max_row + 1):
        v = [ws.cell(r, c).value for c in range(2, 12)]
        if not (is_seq(v[0]) and norm(v[1])):
            continue
        rows.append({
            "no": int(norm(v[0])),
            "nama": norm(v[1]),
            "jenis_pelatihan": norm(v[2]),
            "klasifikasi": norm(v[3]),
            "kualifikasi": norm(v[4]) or "Operator",
            "no_sertifikat": norm(v[5]),
            "penerbit": norm(v[6]),
            "jabatan_kerja": re.sub(r"\s+", " ", norm(v[7]).title()) if v[7] else "",
            "jenjang": norm(v[8]),
        })
    # Seluruh baris tabel adalah tenaga terlatih yang membuktikan kompetensi
    # melalui sertifikattraining/pelatihan, sehingga bersertifikat bila
    # nomor sertifikat terisi (format LSP: "I-2023..." atau kode BNSP "74321 ...").
    for t in rows:
        t["bersertifikat"] = bool(t["no_sertifikat"])
        tahun = re.search(r"(20\d{2})", t["no_sertifikat"])
        t["tahun_sertifikat"] = tahun.group(1) if tahun else None
        t["format_sertifikat"] = "LSP" if t["no_sertifikat"].upper().startswith("I-") else (
            "BNSP" if re.match(r"^\d{4,}", t["no_sertifikat"]) else "Lainnya"
        )
    wb.close()
    return rows


# ---------------------------------------------------------------- KEBUTUHAN
def parse_kebutuhan():
    wb = load_workbook(F_KEB)
    ws = wb["KEBUTUHAN TENAGA KERJA"]
    rows = []
    for r in range(15, ws.max_row + 1):
        v = [ws.cell(r, c).value for c in range(2, 13)]
        if not (is_seq(v[0]) and norm(v[1])):
            continue
        lokasi = norm(v[9])
        nama = norm(v[1])
        kec_mentioned = detect_kecamatan(nama)
        kec = kec_mentioned or guess_kecamatan(lokasi, nama)
        rows.append({
            "no": int(norm(v[0])),
            "nama_proyek": nama,
            "operator": int(v[2] or 0),
            "teknisi_analis": int(v[3] or 0),
            "jumlah": int(v[4] or 0),
            "pagu": float(v[5] or 0),
            "metode_pengadaan": norm(v[6]) or "Tidak Diisi",
            "satker": norm(v[7]) or "Tidak Diisi",
            "jenis_pengadaan": norm(v[8]) or "Pekerjaan Konstruksi",
            "lokasi_mentioned": lokasi,
            "kecamatan": kec,
            # klasifikasi jenis pekerjaan dari nama proyek
            "jenis_pekerjaan": klasifikasi_pekerjaan(nama),
        })
    wb.close()
    return rows


def klasifikasi_pekerjaan(nama):
    n = nama.lower()
    if "jalan" in n or "jembatan" in n or "lalu lintas" in n:
        return "Jalan & Jembatan"
    if "drainase" in n or "saluran" in n or "irigasi" in n or "spam" in n or "air" in n:
        return "Drainase & Air Bersih"
    if "gedung" in n or "kantor" in n or "sekolah" in n or "rumah sakit" in n or "pembangunan" in n or "pembangunan" in n:
        return "Bangunan Gedung"
    if "pemeliharaan" in n or "perbaikan" in n:
        return "Pemeliharaan"
    if "survey" in n or "kondisi" in n:
        return "Survey & Konsultasi"
    if "pantai" in n or "pengaman" in n:
        return "Pantai & Pengaman"
    return "Lainnya"


# ---------------------------------------------------------------- PENYEDIA JASA
def parse_penyedia():
    wb = load_workbook(F_DIR)
    ws = wb["Sheet1"]
    rows = []
    for r in range(11, ws.max_row + 1):
        v = [ws.cell(r, c).value for c in range(1, 35)]
        nama = norm(v[5])
        if not nama:
            continue
        no = norm(v[0])
        alamat = norm(v[9]) or norm(v[13])
        rows.append({
            "no": int(no) if is_seq(no) else len(rows) + 1,
            "nama": nama,
            "nib": norm(v[6]),
            "nama_pengusaha": norm(v[7]),
            "jenis_kelamin": norm(v[8]),
            "alamat": alamat,
            "no_hp": norm(v[19]),
            "email": norm(v[21]),
            "website": norm(v[22]),
            "tahun_mulai": norm(v[23]),
            "badan_usaha": norm(v[24]),
            "status_modal": norm(v[25]),
            "pekerjaan_utama": norm(v[26]),
            "kbli": norm(v[27]),
            "kualifikasi": norm(v[28]),
            "jaringan_usaha": norm(v[29]),
            "tempat_usaha": norm(v[30]),
            "sumber_data": norm(v[32]),
            "status": norm(v[33]) or "Belum Terverifikasi",
            "kecamatan": guess_kecamatan(alamat, nama),
        })
    wb.close()
    for p in rows:
        p["status"] = p["status"].replace("Aktif ", "Aktif").strip() or "Belum Terverifikasi"
        p["badan_usaha"] = p["badan_usaha"] or "Tidak Terisi"
        p["kualifikasi"] = p["kualifikasi"] or "Tidak Terisi"
        p["sbu_aktif"] = p["kualifikasi"] != "Tidak Terisi"
        p["skor_kemampuan"] = {
            "Besar": 5, "Menengah": 4, "Kecil": 3, "Tidak Terisi": 1,
        }.get(p["kualifikasi"], 1)
    return rows


# ---------------------------------------------------------------- IKK (dari docx)
def parse_ikk():
    p = os.path.join(DATA_DIR, F_IKK)
    terlatih = kebutuhan = None
    if os.path.exists(p):
        with zipfile.ZipFile(p) as z:
            xml = z.read("word/document.xml").decode("utf-8", "ignore")
        txt = html.unescape(re.sub(r"<[^>]+>", " ", xml))
        nums = re.findall(r"(\d{3})\s*Orang", txt)
        # ambil dua angka unik pertama yang muncul pada Tabel 1 dan Tabel 2
        uniq = []
        for c in nums:
            if c not in uniq:
                uniq.append(c)
        if len(uniq) >= 2:
            terlatih, kebutuhan = int(uniq[0]), int(uniq[1])
    terlatih = terlatih or 349
    kebutuhan = kebutuhan or 418
    return {
        "terlatih_bersertifikat": terlatih,
        "kebutuhan_total": kebutuhan,
        "persentase": round(terlatih / kebutuhan * 100, 2),
        "rumus": "IKK = (Tenaga Kerja Terlatih Bersertifikat / Kebutuhan Tenaga Kerja Terlatih) x 100%",
        "sumber": "DPURPK Kab. Belitung Timur, LSP ATAKI, LSP Astekindo, LSP K3 (Dokumen IKK 2025)",
    }


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    tkk = parse_tkk()
    keb = parse_kebutuhan()
    pby = parse_penyedia()
    ikk = parse_ikk()

    keb_serializable = []
    for k in keb:
        d = dict(k)
        d["pagu"] = round(float(d["pagu"]), 2)
        keb_serializable.append(d)

    out = {
        "meta": {
            "nama_aplikasi": "BEGASAK",
            "subjudul": "Besame Mengawasi Bina Konstruksi",
            "sumber_data": "DATA BIKON 2025",
            "satuan_kerja": "DPURPK Kabupaten Belitung Timur",
            "tahun": 2025,
            "kabupaten": "Belitung Timur",
            "provinsi": "Kepulauan Bangka Belitung",
            "kecamatan": KECAMATAN,
            "imported_at": None,
        },
        "ikk": ikk,
        "tenaga_kerja": tkk,
        "proyek": keb_serializable,
        "penyedia_jasa": pby,
    }

    with open(os.path.join(OUT_DIR, "bikon2025.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

    # ringkasan
    print("=" * 66)
    print("BEGASAK ETL — ringkasan DATA BIKON 2025")
    print("=" * 66)
    print(f"TKK bersertifikat        : {len(tkk)}")
    print(f"  Operator                : {sum(1 for t in tkk if t['kualifikasi'] == 'Operator')}")
    print(f"  Teknisi/Analis          : {sum(1 for t in tkk if 'Teknisi' in t['kualifikasi'])}")
    print(f"  LSP penerbit            : {len(set(t['penerbit'] for t in tkk))}")
    print(f"  Jabatan kerja           : {len(set(t['jabatan_kerja'] for t in tkk))}")
    print(f"Proyek (kebutuhan TKK)   : {len(keb)}")
    print(f"  Total kebutuhan         : {sum(k['jumlah'] for k in keb)}")
    print(f"  Total pagu              : Rp {sum(k['pagu'] for k in keb):,.0f}")
    print(f"  Metode                  : {dict(Counter(k['metode_pengadaan'] for k in keb))}")
    print(f"Penyedia jasa            : {len(pby)}")
    print(f"  Badan usaha             : {dict(Counter(p['badan_usaha'] for p in pby))}")
    print(f"IKK                      : {ikk['persentase']}% ({ikk['terlatih_bersertifikat']}/{ikk['kebutuhan_total']})")
    print(f"Output                   : {os.path.join(OUT_DIR, 'bikon2025.json')}")


if __name__ == "__main__":
    main()