import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import LogoMerek from '../components/LogoMerek';

export default function Masuk() {
  const { pengguna, masuk, siap } = useAuth();
  const nav = useNavigate();
  const lokasi = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [galat, setGalat] = useState('');
  const [kirim, setKirim] = useState(false);
  const [akun, setAkun] = useState([]);

  useEffect(() => {
    // Hanya ditampilkan di luar produksi agar tidak membocorkan kredensial demo.
    api
      .get('/api/auth/akun-demo')
      .then((j) => setAkun(j.akun || []))
      .catch(() => setAkun([]));
  }, []);

  if (siap && pengguna) return <Navigate to="/" replace />;

  const kirimForm = async (e) => {
    e.preventDefault();
    setGalat('');
    setKirim(true);
    try {
      await masuk(username.trim(), password);
      nav(lokasi.state?.dari || '/', { replace: true });
    } catch (err) {
      setGalat(err.message);
      setPassword('');
    } finally {
      setKirim(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-100">
      {/* Panel kiri: identitas sistem */}
      <div className="hidden lg:flex flex-col justify-between bg-slate-900 text-slate-300 p-10">
        <div className="flex items-center gap-3">
          <LogoMerek className="h-11 w-auto shrink-0" />
          <div>
            <p className="text-white font-extrabold tracking-tight leading-none">BEGASAK</p>
            <p className="text-[11px] text-slate-400 mt-1">Besame Mengawasi Bina Konstruksi</p>
          </div>
        </div>

        <div className="max-w-md">
          <h1 className="text-white text-2xl font-extrabold leading-snug">
            Decision Support System Monitoring &amp; Pengawasan Jasa Konstruksi
          </h1>
          <p className="text-[13px] text-slate-400 mt-3 leading-relaxed">
            Seluruh data master, tenaga kerja, dan analisis risiko hanya dapat diakses oleh pengguna yang
            terdaftar. Hak akses mengikuti peran, dan setiap perubahan tercatat pada audit log.
          </p>
          <ul className="mt-6 space-y-2 text-[12px] text-slate-400">
            {[
              'Peringatan dini otomatis berbasis ambang batas',
              'Realtime monitoring via Server-Sent Events',
              'Jejak audit untuk setiap perubahan data',
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-gov-500 mt-1.5 shrink-0" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[11px] text-slate-500">
          DPURPK Kabupaten Belitung Timur · TA {new Date().getFullYear()}
        </p>
      </div>

      {/* Panel kanan: formulir */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-7">
            <LogoMerek className="h-10 w-auto shrink-0" />
            <p className="font-extrabold text-slate-800">BEGASAK</p>
          </div>

          <h2 className="text-xl font-extrabold text-slate-800">Masuk ke BEGASAK</h2>
          <p className="text-[13px] text-slate-500 mt-1">
            Gunakan akun yang terdaftar untuk melanjutkan.
          </p>

          <form onSubmit={kirimForm} className="mt-6 space-y-3.5">
            <div>
              <label htmlFor="username" className="block text-[12px] font-semibold text-slate-600 mb-1.5">
                Username
              </label>
              <input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gov-500/30 focus:border-gov-500"
                placeholder="mis. admin"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-[12px] font-semibold text-slate-600 mb-1.5">
                Kata sandi
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gov-500/30 focus:border-gov-500"
                placeholder="••••••••"
              />
            </div>

            {galat && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-[12px] text-red-700">
                {galat}
              </div>
            )}

            <button type="submit" disabled={kirim} className="tombol-utama w-full justify-center py-2.5">
              {kirim ? 'Memproses…' : 'Masuk'}
            </button>
          </form>

          {akun.length > 0 && (
            <div className="mt-7 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
              <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wide">
                Akun demo (lingkungan pengembangan)
              </p>
              <p className="text-[11px] text-amber-700 mt-1 mb-2">
                Klik salah satu untuk mengisi formulir.
              </p>
              <div className="space-y-1">
                {akun.map((a) => (
                  <button
                    key={a.username}
                    type="button"
                    onClick={() => {
                      setUsername(a.username);
                      setPassword(a.sandi);
                      setGalat('');
                    }}
                    className="w-full flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-lg bg-white border border-amber-200 hover:border-amber-400 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block text-[12px] font-semibold text-slate-700 truncate">
                        {a.nama}
                      </span>
                      <span className="block text-[10px] text-slate-500 font-mono truncate">
                        {a.username} / {a.sandi}
                      </span>
                    </span>
                    <span className="text-[10px] font-bold text-amber-700 shrink-0">{a.peran}</span>
                  </button>
                ))}
              </div>
              {/* <p className="text-[10px] text-amber-700 mt-2 leading-relaxed">
                Kata sandi demo hanya tersedia di luar produksi. Ganti seluruh kredensial ini sebelum
                sistem dipakai sungguhan.
              </p> */}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
