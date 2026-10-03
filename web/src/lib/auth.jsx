import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ambilToken, simpanToken, KELUAR_EVENT } from './api';

const AuthCtx = createContext(null);

/**
 * Sumber kebenaran akses di frontend: peran & daftar izin berasal dari server,
 * bukan dari pilihan lokal. `boleh('proyek:create')` dipakai untuk menyembunyikan
 * tombol aksi; backend tetap menjadi pengaman utama.
 */
export function useAuth() {
  return useContext(AuthCtx);
}

export function AuthProvider({ children }) {
  const [pengguna, setPengguna] = useState(null);
  const [akses, setAkses] = useState([]);
  const [siap, setSiap] = useState(false);
  const [galat, setGalat] = useState(null);

  const pulihkan = useCallback(async () => {
    if (!ambilToken()) {
      setPengguna(null);
      setAkses([]);
      setSiap(true);
      return;
    }
    try {
      const j = await api.get('/api/auth/saya');
      setPengguna(j.pengguna);
      setAkses(j.akses || []);
      setGalat(null);
    } catch {
      // Token tidak valid/kedaluwarsa:Api lapisan sudah mengeluarkan sesi.
      setPengguna(null);
      setAkses([]);
    } finally {
      setSiap(true);
    }
  }, []);

  useEffect(() => {
    pulihkan();
  }, [pulihkan]);

  // Server memaksa keluar bila token dicabut atau akun dinonaktifkan.
  useEffect(() => {
    const keluar = () => {
      setPengguna(null);
      setAkses([]);
    };
    window.addEventListener(KELUAR_EVENT, keluar);
    return () => window.removeEventListener(KELUAR_EVENT, keluar);
  }, []);

  const masuk = useCallback(async (username, password) => {
    const j = await api.post('/api/auth/masuk', { username, password });
    simpanToken(j.token);
    setPengguna(j.pengguna);
    setAkses(j.akses || []);
    setGalat(null);
    return j.pengguna;
  }, []);

  const keluar = useCallback(async () => {
    try {
      await api.post('/api/auth/keluar', {});
    } catch {
      /* abaikan:token lokal tetap dihapus */
    }
    simpanToken(null);
    setPengguna(null);
    setAkses([]);
  }, []);

  const boleh = useCallback(
    (aksi) => (aksi ? akses.includes(aksi) : true),
    [akses]
  );

  const nilai = useMemo(
    () => ({ pengguna, peran: pengguna?.peran || null, akses, siap, galat, masuk, keluar, boleh }),
    [pengguna, akses, siap, galat, masuk, keluar, boleh]
  );

  return <AuthCtx.Provider value={nilai}>{children}</AuthCtx.Provider>;
}
