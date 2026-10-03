import { db } from './db.js';

const klien = new Set();

export function tambahKlien(res) {
  klien.add(res);
  return () => klien.delete(res);
}

function kirim(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of klien) {
    try {
      res.write(payload);
    } catch {
      klien.delete(res);
    }
  }
}

export function idkirim(event, data) {
  kirim(event, data);
}

export function jumlahKlien() {
  return klien.size;
}

export function mulaiSSE(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(`retry: 3000\n\n`);
  res.write(`event: hello\ndata: ${JSON.stringify({ waktu: new Date().toISOString() })}\n\n`);

  const lepas = tambahKlien(res);
  const ping = setInterval(() => {
    try {
      res.write(`: ping ${Date.now()}\n\n`);
    } catch {
      /* ignore */
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(ping);
    lepas();
  });
}

export { db };