export const LEVEL = {
  Rendah: { bg: 'bg-emerald-50', teks: 'text-emerald-700', titik: '#15803d', chip: '#d1fae5' },
  Sedang: { bg: 'bg-amber-50', teks: 'text-amber-700', titik: '#ca8a04', chip: '#fef3c7' },
  Tinggi: { bg: 'bg-orange-50', teks: 'text-orange-700', titik: '#ea580c', chip: '#ffedd5' },
  Ekstrem: { bg: 'bg-red-50', teks: 'text-red-700', titik: '#b91c1c', chip: '#fee2e2' },
};

export const WARNA_RISIKO = {
  Rendah: '#15803d',
  Sedang: '#ca8a04',
  Tinggi: '#ea580c',
  Ekstrem: '#b91c1c',
};

export function levelTone(level) {
  return LEVEL[level] || LEVEL.Rendah;
}

const rupiah = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const rupiah2 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

export function rupiahFmt(v, short = false) {
  const n = Number(v) || 0;
  if (short) {
    const abs = Math.abs(n);
    if (abs >= 1e12) return `${(n / 1e12).toFixed(1).replace('.', ',')} T`;
    if (abs >= 1e9) return `${(n / 1e9).toFixed(1).replace('.', ',')} M`;
    if (abs >= 1e6) return `${(n / 1e6).toFixed(0)} jt`;
    if (abs >= 1e3) return `${(n / 1e3).toFixed(0)} rb`;
  }
  return rupiah.format(n);
}

export function rupiahPenuh(v) {
  return 'Rp ' + rupiah2.format(Number(v) || 0);
}

export function angka(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function tanggalPendek(iso) {
  if (!iso) return '-';
  const d = new Date(String(iso).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function waktuRelatif(iso) {
  if (!iso) return '-';
  const d = new Date(String(iso).replace(' ', 'T').replace('Z', ''));
  const selisih = (Date.now() - d.getTime()) / 1000;
  if (Number.isNaN(selisih)) return '-';
  if (selisih < 60) return 'baru saja';
  if (selisih < 3600) return `${Math.floor(selisih / 60)} menit lalu`;
  if (selisih < 86400) return `${Math.floor(selisih / 3600)} jam lalu`;
  if (selisih < 2592000) return `${Math.floor(selisih / 86400)} hari lalu`;
  return tanggalPendek(iso);
}

export function persen(v, total) {
  if (!total) return 0;
  return Math.round((Number(v) / Number(total)) * 100);
}

