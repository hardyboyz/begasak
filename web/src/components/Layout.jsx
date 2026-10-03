import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useApi, useRealtime } from '../lib/api';
import { useAuth } from '../lib/auth';
import { waktuRelatif, levelTone } from '../lib/utils';
import { BadgeLevel } from './ui';
import {
  IkonDashboard,
  IkonPeta,
  IkonProyek,
  IkonTenaga,
  IkonPenyedia,
  IkonPengawasan,
  IkonPeringatan,
  IkonLaporan,
  IkonMasyarakat,
  IkonKomplain,
  IkonLive,
  IkonMenu,
  IkonKecamatan,
  IkonPengguna,
} from './icons';

/**
 * Warna badge peran. Daftar izin TIDAK didefinisikan di sini — Permissions
 * ditentukan oleh server dan dibaca lewat `useAuth().boleh()`.
 */
export const WARNA_PERAN = {
  Administrator: { warna: 'bg-gov-700' },
  'Perangkat Daerah': { warna: 'bg-gov-700' },
  'Penyedia Jasa': { warna: 'bg-emerald-600' },
  'Asosiasi Profesi': { warna: 'bg-violet-600' },
  Masyarakat: { warna: 'bg-slate-600' },
};

const MENU = [
  { to: '/', label: 'Dashboard Monitoring', ikon: IkonDashboard, butuh: 'dashboard:read' },
  { to: '/peta', label: 'Pemetaan Risiko', ikon: IkonPeta, butuh: 'peta:read' },
  { to: '/proyek', label: 'Data Proyek', ikon: IkonProyek, butuh: 'proyek:read' },
  { to: '/tenaga-kerja', label: 'Tenaga Kerja', ikon: IkonTenaga, butuh: 'tenaga:read' },
  { to: '/penyedia', label: 'Penyedia Jasa', ikon: IkonPenyedia, butuh: 'penyedia:read' },
  { to: '/pengawasan', label: 'Pengawasan & Temuan', ikon: IkonPengawasan, butuh: 'pengawasan:read' },
  { to: '/risiko', label: 'Analisis Risiko', ikon: IkonPeringatan, butuh: 'risiko:read' },
  { to: '/peringatan', label: 'Early Warning', ikon: IkonLive, butuh: 'peringatan:read', sorot: true },
  { to: '/pengaduan', label: 'Pengaduan Masyarakat', ikon: IkonKomplain, butuh: 'pengaduan:read' },
  { to: '/laporan', label: 'Pelaporan', ikon: IkonLaporan, butuh: 'laporan:read' },
  { to: '/pengguna', label: 'Manajemen Pengguna', ikon: IkonPengguna, butuh: 'pengguna:read' },
  { to: '/kecamatan', label: 'Setup Kecamatan', ikon: IkonKecamatan, butuh: 'kecamatan:read' },
];

/** Pencarian judul halaman berdasarkan segmen URL terpanjang. */
function judulHalaman(pathname) {
  const cocok = MENU.filter(
    (m) => (m.to === '/' ? pathname === '/' : pathname.startsWith(m.to))
  ).sort((a, b) => b.to.length - a.to.length);
  return cocok[0]?.label || 'BEGASAK';
}

export default function Layout() {
  const { pengguna, peran, boleh, keluar } = useAuth();
  // Permintaan hanya dibuat bila role memang berhak; tanpa ini peran tanpa
  // izin akan memicu 403 sia-sia pada setiap muat halaman.
  const { data: meta } = useApi(boleh('dashboard:read') ? '/api/meta' : null);
  const { data: ringkasan } = useApi(boleh('peringatan:read') ? '/api/peringatan?limit=1' : null);
  const lokasi = useLocation();
  const nav = useNavigate();

  const [mobile, setMobile] = useState(false);
  const [notifBuka, setNotifBuka] = useState(false);
  const [akunBuka, setAkunBuka] = useState(false);

  const { terhubung, feed } = useRealtime({
    'monitoring': () => {},
  });

  useEffect(() => {
    setMobile(false);
    setNotifBuka(false);
    setAkunBuka(false);
  }, [lokasi.pathname]);

  // Tutup panel akun saat klik di luar.
  useEffect(() => {
    if (!akunBuka) return undefined;
    const tutup = () => setAkunBuka(false);
    window.addEventListener('click', tutup);
    return () => window.removeEventListener('click', tutup);
  }, [akunBuka]);

  const menuBoleh = useMemo(() => MENU.filter((m) => boleh(m.butuh)), [boleh]);

  const perLevel = (ringkasan?.statistik?.perLevel) || {};
  const inisial = (pengguna?.nama || pengguna?.username || '?').slice(0, 2).toUpperCase();

  return (
      <div className="min-h-screen flex">
        {/* SIDEBAR */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 flex flex-col
            transform transition-transform lg:translate-x-0 ${mobile ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="px-5 py-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gov-600 grid place-items-center text-white font-extrabold text-lg shadow-lg">
                B
              </div>
              <div className="min-w-0">
                <p className="text-white font-extrabold tracking-tight leading-none">BEGASAK</p>
                <p className="text-[10px] text-slate-400 mt-1 leading-tight truncate">
                  Besame Mengawasi Bina Konstruksi
                </p>
              </div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
            {menuBoleh.map((m) => (
              <NavLink
                key={m.to}
                to={m.to}
                end={m.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition ${
                    isActive
                      ? 'bg-gov-600 text-white shadow-sm'
                      : 'hover:bg-slate-800 hover:text-white text-slate-400'
                  }`
                }
              >
                <m.ikon className="w-[18px] h-[18px] shrink-0" />
                <span className="flex-1 truncate">{m.label}</span>
                {m.sorot && perLevel.Tinggi + perLevel.Ekstrem > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {perLevel.Tinggi + perLevel.Ekstrem}
                  </span>
                )}
              </NavLink>
            ))}

            <div className="pt-4 mt-4 border-t border-slate-800">
              <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                 Integrasi Sistem
              </p>
              <div className="px-3 space-y-1.5 text-[11px] text-slate-400">
                <p className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${terhubung ? 'bg-emerald-400 denyut' : 'bg-slate-600'}`}
                    />
                    Stream realtime
                  </span>
                  <span className="text-slate-500">{terhubung ? 'aktif' : 'putus'}</span>
                </p>
                <p className="flex items-center justify-between">
                  <span>Sumber data</span>
                  <span className="text-slate-500 font-mono text-[10px]">{meta?.sumber_data || '-'}</span>
                </p>
              </div>
            </div>
          </nav>

          <div className="px-4 py-3 border-t border-slate-800 text-[10px] text-slate-500 leading-relaxed">
            <p className="font-semibold text-slate-400">{meta?.satuan_kerja || 'DPURPK'}</p>
            <p>Kab. {meta?.kabupaten} · Prov. {meta?.provinsi}</p>
            <p className="mt-1">TA {meta?.tahun} · v1.0</p>
          </div>
        </aside>

        {mobile && <div className="fixed inset-0 bg-slate-900/50 z-30 lg:hidden" onClick={() => setMobile(false)} />}

        {/* KONTEN */}
        <div className="flex-1 lg:ml-64 min-w-0 flex flex-col">
          <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
            <div className="flex items-center gap-3 px-4 lg:px-6 h-14">
              <button className="lg:hidden text-slate-600" onClick={() => setMobile((v) => !v)}>
                <IkonMenu />
              </button>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800 truncate">{judulHalaman(lokasi.pathname)}</p>
                <p className="text-[11px] text-slate-500 truncate hidden sm:block">
                  Decision Support System Pengawasan Jasa Konstruksi
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 text-[11px] font-semibold text-slate-600">
                  <span
                    className={`w-2 h-2 rounded-full ${terhubung ? 'bg-emerald-500 denyut' : 'bg-slate-400'}`}
                  />
                  {terhubung ? 'Live' : 'Offline'}
                </div>

                {boleh('peringatan:read') && (
                  <div className="relative">
                    <button
                      onClick={() => setNotifBuka((v) => !v)}
                      className="relative w-9 h-9 grid place-items-center rounded-lg border border-slate-300 hover:bg-slate-50"
                    >
                      <IkonLive className="w-[18px] h-[18px] text-slate-600" />
                      {(perLevel.Tinggi || 0) + (perLevel.Ekstrem || 0) > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-red-600 text-white text-[9px] font-bold grid place-items-center">
                          {perLevel.Tinggi + perLevel.Ekstrem > 99 ? '99+' : perLevel.Tinggi + perLevel.Ekstrem}
                        </span>
                      )}
                    </button>

                    {notifBuka && (
                    <div className="absolute right-0 mt-2 w-80 max-h-[26rem] overflow-y-auto bg-white rounded-xl shadow-pop border border-slate-200 z-30">
                      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                        <p className="font-semibold text-sm text-slate-800">Notifikasi Dini</p>
                        <NavLink to="/peringatan" className="text-[11px] text-gov-700 font-semibold hover:underline">
                          Semua
                        </NavLink>
                      </div>
                      <div className="p-2">
                        {(feed.length ? feed : []).slice(0, 12).map((f, i) => (
                          <div key={i} className="px-2 py-2 rounded-lg hover:bg-slate-50">
                            <p className="text-[12px] font-semibold text-slate-700">
                              Supervisi {f.data?.supervisi?.proyekKode || ''}
                            </p>
                            <p className="text-[11px] text-slate-500 line-clamp-2">
                              {f.data?.supervisi?.proyek || ''}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{waktuRelatif(f.t)}</p>
                          </div>
                        ))}
                        {!feed.length && (
                          <p className="text-[11px] text-slate-400 text-center py-6">
                            Belum ada aktivitas realtime. Menunggu aktivitas supervisi…
                            </p>
                        )}
                      </div>
                    </div>
                  )}
                  </div>
                )}

                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setAkunBuka((v) => !v)}
                    className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg border border-slate-300 hover:bg-slate-50"
                    title={pengguna?.nama || pengguna?.username}
                  >
                    <span
                      className={`w-7 h-7 rounded-md grid place-items-center text-white text-[10px] font-bold ${WARNA_PERAN[peran]?.warna || 'bg-slate-600'}`}
                    >
                      {inisial}
                    </span>
                    <span className="hidden sm:block text-left leading-tight max-w-[9rem]">
                      <span className="block text-[11px] font-bold text-slate-700 truncate">
                        {pengguna?.nama || pengguna?.username}
                      </span>
                      <span className="block text-[10px] text-slate-500 truncate">{peran}</span>
                    </span>
                  </button>

                  {akunBuka && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-pop border border-slate-200 z-30 overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-100">
                        <p className="text-[13px] font-bold text-slate-800 truncate">
                          {pengguna?.nama || pengguna?.username}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate font-mono">
                          {pengguna?.username}
                        </p>
                        <p
                          className={`mt-2 inline-block px-2 py-0.5 rounded-md text-[10px] font-bold text-white ${WARNA_PERAN[peran]?.warna || 'bg-slate-600'}`}
                        >
                          {peran}
                        </p>
                        {pengguna?.satker && (
                          <p className="text-[10px] text-slate-500 mt-1.5">{pengguna.satker}</p>
                        )}
                      </div>
                      {boleh('pengguna:read') && (
                        <button
                          onClick={() => {
                            nav('/pengguna');
                            setAkunBuka(false);
                          }}
                          className="w-full text-left px-4 py-2.5 text-[12px] text-slate-700 hover:bg-slate-50"
                        >
                          Manajemen Pengguna
                        </button>
                      )}
                      <button
                        onClick={() => keluar()}
                        className="w-full text-left px-4 py-2.5 text-[12px] text-red-600 hover:bg-red-50 border-t border-slate-100"
                      >
                        Keluar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 lg:px-6 py-5">
            <Outlet />
          </main>

          <footer className="px-6 py-4 text-[11px] text-slate-400 border-t border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                © {meta?.tahun} BEGASAK · {meta?.satuan_kerja} · Decision Support System Monitoring &
                Pengawasan Jasa Konstruksi
              </span>
              <span className="font-mono">Data: {meta?.sumber_data} · IKK target {meta?.ikk_target}%</span>
            </div>
          </footer>
        </div>
      </div>
  );
}