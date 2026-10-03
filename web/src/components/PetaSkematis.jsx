import { useState } from 'react';

const WARNA = { Rendah: '#15803d', Sedang: '#ca8a04', Tinggi: '#ea580c', Ekstrem: '#b91c1c' };

/**
 * Peta skematis Kabupaten Belitung Timur.
 * Poligon adalah representasi ilustratif batas kecamatan berbasis titik koordinat,
 * bukan batas resmi (sumber: titik pusat koordinat pada DATA BIKON 2025).
 */
const KEC = [
  {
    nama: 'Selatpanjang',
    warna: '#cbd5e1',
    titik: [-3.2107, 107.8732],
    poly: [
      [-3.06, 107.72],
      [-3.06, 108.02],
      [-3.28, 108.02],
      [-3.34, 107.88],
      [-3.26, 107.71],
    ],
  },
  {
    nama: 'Gantung',
    warna: '#cbd5e1',
    titik: [-3.1331, 107.7504],
    poly: [
      [-3.06, 107.62],
      [-3.06, 107.72],
      [-3.26, 107.71],
      [-3.24, 107.58],
      [-3.1, 107.56],
    ],
  },
  {
    nama: 'Kelapa Kampit',
    warna: '#cbd5e1',
    titik: [-2.9841, 107.8167],
    poly: [
      [-2.96, 107.75],
      [-2.96, 107.9],
      [-3.06, 107.9],
      [-3.06, 107.72],
      [-3.0, 107.72],
    ],
  },
  {
    nama: 'Dendang',
    warna: '#cbd5e1',
    titik: [-3.0166, 107.8263],
    poly: [
      [-2.9, 107.9],
      [-2.96, 107.9],
      [-3.06, 107.9],
      [-3.06, 108.0],
      [-2.88, 108.0],
    ],
  },
  {
    nama: 'Manggar',
    warna: '#cbd5e1',
    titik: [-2.8535, 107.7506],
    poly: [
      [-2.76, 107.66],
      [-2.76, 107.84],
      [-2.96, 107.84],
      [-2.9, 107.9],
      [-2.88, 108.0],
      [-2.74, 107.98],
      [-2.68, 107.8],
    ],
  },
  {
    nama: 'Damar',
    warna: '#cbd5e1',
    titik: [-2.7516, 107.9526],
    poly: [
      [-2.68, 107.8],
      [-2.74, 107.98],
      [-2.62, 108.06],
      [-2.58, 107.9],
    ],
  },
  {
    nama: 'Simpang Pesak',
    warna: '#cbd5e1',
    titik: [-2.6561, 107.8979],
    poly: [
      [-2.74, 107.66],
      [-2.76, 107.84],
      [-2.68, 107.8],
      [-2.58, 107.9],
      [-2.62, 108.06],
      [-2.7, 107.92],
    ],
  },
];

// proyeksi sederhana equirectangular
const LAT_MIN = -3.34;
const LAT_MAX = -2.58;
const LNG_MIN = 107.56;
const LNG_MAX = 108.06;

export function proyeksi(lat, lng) {
  const W = 760;
  const H = 400;
  const x = ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * W;
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * H;
  return [x, y];
}

export default function PetaSkematis({ringkasan = [], titik = [], onKlik, aktifKec, filterLevel}) {
  const [hover, setHover] = useState(null);
  const stat = Object.fromEntries(ringkasan.map((r) => [r.kecamatan, r]));

  const warnaKec = (nama) => {
    if (filterLevel && filterLevel !== 'Semua') {
      const s = stat[nama];
      if (!s) return '#e2e8f0';
      const n = s[filterLevel.toLowerCase()] || 0;
      return n > 0 ? WARNA[filterLevel] : '#f1f5f9';
    }
    const s = stat[nama];
    if (!s) return '#e2e8f0';
    const b = (s.ekstrem || 0) * 3 + (s.tinggi || 0) * 2 + (s.sedang || 0);
    if (b === 0) return '#e2e8f0';
    const r = b / (s.jumlah_proyek || 1);
    if (r > 0.6) return '#fca5a5';
    if (r > 0.35) return '#fdba74';
    if (r > 0.15) return '#fde68a';
    return '#bbf7d0';
  };

  const titikFilter = titik.filter((t) => {
    if (aktifKec && aktifKec !== 'Semua' && t.kecamatan !== aktifKec) return false;
    if (filterLevel && filterLevel !== 'Semua' && t.level !== filterLevel) return false;
    return true;
  });

  return (
    <div className="relative">
      <svg viewBox="-20 -20 800 440" className="w-full h-auto" style={{ background: '#f8fafc', borderRadius: 12 }}>
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect x={-20} y={-20} width={800} height={440} fill="url(#grid)" />

        {/* laut */}
        <text x={600} y={330} fontSize={13} fill="#94a3b8" fontStyle="italic">
          Laut Jawa
        </text>
        <text x={120} y={30} fontSize={13} fill="#94a3b8" fontStyle="italic">
          Selat Bangka
        </text>

        {KEC.map((k) => {
          const pts = k.poly.map(([la, ln]) => proyeksi(la, ln).join(',')).join(' ');
          const [cx, cy] = proyeksi(k.titik[0], k.titik[1]);
          const s = stat[k.nama];
          const isAktif = aktifKec === k.nama;
          return (
            <g
              key={k.nama}
              onMouseEnter={() => setHover(k.nama)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onKlik?.(isAktif ? null : k.nama)}
              className="cursor-pointer"
            >
              <polygon
                points={pts}
                fill={warnaKec(k.nama)}
                stroke={isAktif ? '#1c5cf5' : '#64748b'}
                strokeWidth={isAktif ? 3 : 1}
                opacity={hover && hover !== k.nama ? 0.6 : 1}
                style={{ transition: 'all .2s' }}
              />
              <text x={cx} y={cy - 8} textAnchor="middle" fontSize={11.5} fontWeight={700} fill="#1e293b">
                {k.nama}
              </text>
              <text x={cx} y={cy + 7} textAnchor="middle" fontSize={10} fill="#475569">
                {s ? `${s.jumlah_proyek} proyek` : '0'}
              </text>
              {s && s.ekstrem + s.tinggi > 0 && (
                <text x={cx} y={cy + 21} textAnchor="middle" fontSize={9.5} fill="#c2410c" fontWeight={700}>
                  {s.ekstrem + s.tinggi} berisiko
                </text>
              )}
            </g>
          );
        })}

        {/* titik proyek */}
        {titikFilter.map((t, i) => {
          const [x, y] = proyeksi(t.latitude, t.longitude);
          const c = WARNA[t.level] || '#94a3b8';
          const r = t.level === 'Ekstrem' ? 5 : t.level === 'Tinggi' ? 4.2 : 3.2;
          return (
            <g key={i} className="cursor-pointer" onClick={() => onKlik?.(t.kode, 'proyek')}>
              {t.level === 'Ekstrem' && (
                <circle cx={x} cy={y} r={r + 4} fill={c} opacity={0.25} className="denyut" />
              )}
              <circle cx={x} cy={y} r={r} fill={c} fillOpacity={0.85} stroke="#fff" strokeWidth={1} />
              <title>
                {`${t.nama}\nLevel: ${t.level}\nPagu: Rp ${(t.pagu || 0).toLocaleString('id-ID')}\nProgres: ${t.progres}%`}
              </title>
            </g>
          );
        })}
      </svg>

      <div className="absolute bottom-2 left-2 bg-white/90 rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] space-y-1">
        <p className="font-bold text-slate-600">Legenda Risiko</p>
        {Object.entries(WARNA).map(([l, c]) => (
          <div key={l} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
            <span className="text-slate-600">{l}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 pt-0.5 border-t border-slate-200">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#e2e8f0' }} />
          <span className="text-slate-500">Tanpa data</span>
        </div>
      </div>

      <p className="text-[10px] text-slate-400 mt-2 px-1">
        Peta skematis ilustratif berbasis titik koordinat pusat kecamatan. Tidak menggantikan batas resmi
        wilayah.
      </p>
    </div>
  );
}

export { WARNA };