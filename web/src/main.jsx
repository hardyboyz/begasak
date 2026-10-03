import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './lib/auth';
import Dashboard from './pages/Dashboard';
import Peta from './pages/Peta';
import Proyek from './pages/Proyek';
import TenagaKerja from './pages/TenagaKerja';
import Penyedia from './pages/Penyedia';
import Pengawasan from './pages/Pengawasan';
import Risiko from './pages/Risiko';
import Peringatan from './pages/Peringatan';
import Pengaduan from './pages/Pengaduan';
import Laporan from './pages/Laporan';
import Pengguna from './pages/Pengguna';
import Kecamatan from './pages/Kecamatan';
import Masuk from './pages/Masuk';
import TidakDitemukan from './pages/TidakDitemukan';
import './index.css';

function Memuat({ children }) {
  return (
    <div className="min-h-screen grid place-items-center bg-slate-100">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gov-600 grid place-items-center text-white font-extrabold">
          B
        </div>
        <p className="text-[12px] text-slate-500">Memuat BEGASAK…</p>
      </div>
    </div>
  );
}

/** Pengguna belum login → arahkan ke /masuk sambil menyimpan tujuan. */
function PerluMasuk() {
  const { siap, pengguna } = useAuth();
  const lokasi = useLocation();
  if (!siap) return <Memuat />;
  if (!pengguna) return <Navigate to="/masuk" replace state={{ dari: lokasi.pathname + lokasi.search }} />;
  return <TidakDitemukan />;
}

/**
 * Gerbang rute berbasis izin yang dikirim server. Peran menentukan menu;
 * `butuh` menentukan halaman mana yang boleh dibuka.
 */
function Rute({ butuh, children }) {
  const { siap, pengguna, peran, boleh } = useAuth();
  const lokasi = useLocation();

  if (!siap) return <Memuat />;
  if (!pengguna) return <Navigate to="/masuk" replace state={{ dari: lokasi.pathname }} />;

  if (butuh && !boleh(butuh)) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 grid place-items-center mx-auto text-3xl font-bold">
          !
        </div>
        <h2 className="text-lg font-extrabold text-slate-800 mt-4">Akses Dibatasi</h2>
        <p className="text-[13px] text-slate-500 mt-1.5">
          Peran <b>{peran}</b> tidak memiliki izin untuk membuka halaman ini. Gunakan menu di samping
          untuk berpindah modul yang tersedia.
        </p>
        <a href="/" className="tombol-utama inline-flex mt-5">
          Kembali ke Dashboard
        </a>
      </div>
    );
  }
  return children;
}

const rute = [
  { path: '/', butuh: 'dashboard:read', el: <Dashboard /> },
  { path: '/peta', butuh: 'peta:read', el: <Peta /> },
  { path: '/proyek', butuh: 'proyek:read', el: <Proyek /> },
  { path: '/tenaga-kerja', butuh: 'tenaga:read', el: <TenagaKerja /> },
  { path: '/penyedia', butuh: 'penyedia:read', el: <Penyedia /> },
  { path: '/pengawasan', butuh: 'pengawasan:read', el: <Pengawasan /> },
  { path: '/risiko', butuh: 'risiko:read', el: <Risiko /> },
  { path: '/peringatan', butuh: 'peringatan:read', el: <Peringatan /> },
  { path: '/pengaduan', butuh: 'pengaduan:read', el: <Pengaduan /> },
  { path: '/laporan', butuh: 'laporan:read', el: <Laporan /> },
  { path: '/pengguna', butuh: 'pengguna:read', el: <Pengguna /> },
  { path: '/kecamatan', butuh: 'kecamatan:read', el: <Kecamatan /> },
];

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Halaman masuk berada di luar Layout; Masuk sudah mengarahkan ke beranda bila sudah punya sesi. */}
          <Route path="/masuk" element={<Masuk />} />
          <Route element={<Layout />}>
            {rute.map((r) => (
              <Route
                key={r.path}
                path={r.path}
                element={
                  <Rute butuh={r.butuh}>
                    {r.el}
                  </Rute>
                }
              />
            ))}
            <Route path="*" element={<PerluMasuk />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
