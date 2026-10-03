import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function TidakDitemukan() {
  const { peran } = useAuth();
  return (
    <div className="max-w-lg mx-auto mt-16 text-center">
      <p className="text-5xl font-extrabold text-gov-700">404</p>
      <h2 className="text-lg font-extrabold text-slate-800 mt-2">Halaman tidak ditemukan</h2>
      <p className="text-[13px] text-slate-500 mt-1.5">
        Alamat yang Anda tuju tidak tersedia pada aplikasi BEGASAK.{peran ? <> Peran aktif: <b>{peran}</b>.</> : null}
      </p>
      <div className="flex gap-2 justify-center mt-5">
        <Link to="/" className="tombol-utama">
          Dashboard
        </Link>
        <Link to="/peta" className="tombol-sekunder">
          Peta Risiko
        </Link>
      </div>
    </div>
  );
}