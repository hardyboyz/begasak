import { levelTone } from '../lib/utils';

export function BadgeLevel({ level, size = 'sm' }) {
  const t = levelTone(level);
  const pad = size === 'xs' ? 'px-1.5 py-0 text-[10px]' : 'px-2 py-0.5 text-[11px]';
  return (
    <span className={`badge ${t.bg} ${t.teks} ${pad}`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.titik }} />
      {level}
    </span>
  );
}

export function Chip({ children, tone = 'slate' }) {
  const map = {
    slate: 'bg-slate-100 text-slate-600',
    gov: 'bg-gov-50 text-gov-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-sky-50 text-sky-700',
  };
  return <span className={`badge ${map[tone]}`}>{children}</span>;
}

export function Kartu({ children, className = '' }) {
  return <div className={`kartu ${className}`}>{children}</div>;
}

export function KartuJudul({ judul, sub, aksi }) {
  return (
    <div className="kartu-header">
      <div>
        <h3 className="kartu-title">{judul}</h3>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
      {aksi}
    </div>
  );
}

export function Statistik({
  label,
  nilai,
  satuan,
  sub,
  ikon,
  tone = 'gov',
  onClick,
}) {
  const warna = {
    gov: 'bg-gov-50 text-gov-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    orange: 'bg-orange-50 text-orange-700',
    red: 'bg-red-50 text-red-700',
    slate: 'bg-slate-100 text-slate-600',
  }[tone];

  return (
    <div
      onClick={onClick}
      className={`kartu p-4 ${onClick ? 'cursor-pointer hover:shadow-pop hover:-translate-y-0.5 transition' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-slate-900 tabular-nums leading-none">{nilai}</span>
            {satuan && <span className="text-xs font-semibold text-slate-500">{satuan}</span>}
          </div>
          {sub && <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">{sub}</p>}
        </div>
        {ikon && (
          <div className={`shrink-0 w-9 h-9 rounded-lg grid place-items-center ${warna}`}>{ikon}</div>
        )}
      </div>
    </div>
  );
}

export function Kosong({ pesan = 'Tidak ada data', sub }) {
  return (
    <div className="py-12 text-center">
      <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 grid place-items-center text-slate-400 text-xl">
        ∅
      </div>
      <p className="mt-3 text-sm font-medium text-slate-600">{pesan}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

export function Memuat({ baris = 5 }) {
  return (
    <div className="p-5 space-y-3 animate-pulse">
      {Array.from({ length: baris }).map((_, i) => (
        <div key={i} className="h-9 rounded bg-slate-100" />
      ))}
    </div>
  );
}

export function ProgressBar({ nilai, warna = '#1447e1', tinggi = 8 }) {
  return (
    <div className="w-full bg-slate-200 rounded-full overflow-hidden" style={{ height: tinggi }}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(100, Math.max(0, nilai))}%`, background: warna }}
      />
    </div>
  );
}

export function Avatar({ nama, ukuran = 36 }) {
  const inisial = (nama || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0])
    .join('')
    .toUpperCase();
  return (
    <div
      className="shrink-0 rounded-full bg-gov-100 text-gov-700 grid place-items-center font-bold"
      style={{ width: ukuran, height: ukuran, fontSize: ukuran * 0.38 }}
    >
      {inisial}
    </div>
  );
}

export function Modal({ buka, tutup, judul, lebar = 'max-w-2xl', children, footer }) {
  if (!buka) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={tutup} />
      <div
        className={`relative w-full ${lebar} bg-white rounded-xl shadow-pop animate-fade-in max-h-[90vh] flex flex-col`}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">{judul}</h3>
          <button onClick={tutup} className="text-slate-400 hover:text-slate-700 text-xl leading-none px-1">
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-slate-200 bg-slate-50">{footer}</div>}
      </div>
    </div>
  );
}

export function Tab({ items, aktif, ubah }) {
  return (
    <div className="flex gap-1 bg-slate-200/60 p-1 rounded-lg overflow-x-auto">
      {items.map((it) => (
        <button
          key={it.nilai}
          onClick={() => ubah(it.nilai)}
          className={`tab-nav ${aktif === it.nilai ? 'tab-aktif' : 'tab-nonaktif'}`}
        >
          {it.label}
          {it.jumlah !== undefined && (
            <span
              className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                aktif === it.nilai ? 'bg-white/25' : 'bg-slate-300/70'
              }`}
            >
              {it.jumlah}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}