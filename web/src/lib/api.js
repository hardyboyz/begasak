import { useCallback, useEffect, useRef, useState } from 'react';

const BASE = '';
const KUNCI_TOKEN = 'begasak_token';

/** Pesan 401 dipancarkan lewat event agar AuthProvider bisa mengeluarkan sesi. */
export const KELUAR_EVENT = 'begasak:keluar';

export function ambilToken() {
  try {
    return localStorage.getItem(KUNCI_TOKEN) || null;
  } catch {
    return null;
  }
}

export function simpanToken(token) {
  try {
    if (token) localStorage.setItem(KUNCI_TOKEN, token);
    else localStorage.removeItem(KUNCI_TOKEN);
  } catch {
    /* penyimpanan tidak tersedia (mode privat) */
  }
}

async function req(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = ambilToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    simpanToken(null);
    window.dispatchEvent(new CustomEvent(KELUAR_EVENT, { detail: 'Sesi berakhir.' }));
    const err = new Error('Sesi berakhir. Silakan masuk kembali.');
    err.status = 401;
    throw err;
  }

  if (!res.ok) {
    let pesan = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      pesan = j.pesan || pesan;
    } catch {
      /* ignore */
    }
    const err = new Error(pesan);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

export function useApi(path, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const muat = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      const j = await req(path);
      setData(j);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  useEffect(() => {
    muat();
  }, [muat, ...deps]);

  return { data, loading, error, reload: muat, setData };
}

export const api = {
  get: (p) => req(p),
  post: (p, body) => req(p, { method: 'POST', body: JSON.stringify(body) }),
  patch: (p, body) => req(p, { method: 'PATCH', body: JSON.stringify(body) }),
  del: (p) => req(p, { method: 'DELETE' }),
};

/**
 * Unduh berkas dari API.
 *
 * Tautan <a href> biasa tidak membawa header Authorization sehingga endpoint
 * terproteksi akan membalas 401. File diambil sebagai Blob lebih dulu supaya
 * token tetap ikut, lalu disimpan lewat object URL.
 */
export async function unduh(path, namaCadangan = 'unduhan.csv') {
  const headers = {};
  const token = ambilToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { headers });
  if (!res.ok) {
    let pesan = `HTTP ${res.status}`;
    try {
      pesan = (await res.json()).pesan || pesan;
    } catch {
      /* ignore */
    }
    throw new Error(pesan);
  }

  const disposisi = res.headers.get('content-disposition') || '';
  const cocok = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposisi);
  const nama = cocok ? decodeURIComponent(cocok[1]) : namaCadangan;

  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = nama;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return nama;
}

/**
 * Berlangganan event realtime BEGASAK melalui Server-Sent Events.
 * Mengembalikan daftar event terbaru (maks 60) dan status koneksi.
 *
 * Token dikirim lewat query string karena EventSource tidak mendukung header.
 */
export function useRealtime(handlers = {}) {
  const [terhubung, setTerhubung] = useState(false);
  const [feed, setFeed] = useState([]);
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const token = ambilToken();
    if (!token) {
      setTerhubung(false);
      return undefined;
    }
    const es = new EventSource(`${BASE}/api/stream?token=${encodeURIComponent(token)}`);
    const push = (tipe) => (e) => {
      let data = {};
      try {
        data = JSON.parse(e.data);
      } catch {
        /* ignore */
      }
      const h = ref.current[tipe];
      if (typeof h === 'function') h(data);
      setFeed((f) => [{ tipe, evt: tipe, data, t: new Date() }, ...f].slice(0, 60));
    };

    es.addEventListener('open', () => setTerhubung(true));
    es.addEventListener('hello', () => setTerhubung(true));
    es.addEventListener('error', () => setTerhubung(false));
    ['monitoring', 'peringatan-baru', 'pengaduan-baru', 'hitung-ulang'].forEach((nama) =>
      es.addEventListener(nama, push(nama))
    );

    return () => es.close();
  }, []);

  return { terhubung, feed };
}

export function useTicker(ms = 15000) {
  const [detik, setDetik] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setDetik((d) => d + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
  return detik;
}
