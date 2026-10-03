import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Jalankan perintah npm di sub-paket, meneruskan stdout/stderr dan exit code. */
function jalankan(label, cwd, args, env = {}) {
  const anak = spawn('npm', args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  anak.on('exit', (kode) => {
    if (kode !== 0 && kode !== null) {
      console.error(`\n[${label}] berhenti dengan kode ${kode}`);
      shutDown();
      process.exit(kode);
    }
  });
  return anak;
}

const anak = [];

function shutDown() {
  for (const p of anak) {
    if (!p.killed) p.kill('SIGTERM');
  }
}

process.on('SIGINT', shutDown);
process.on('SIGTERM', shutDown);

if (!existsSync(join(root, 'server', 'node_modules'))) {
  console.error('Dependency server belum terpasang. Jalankan: npm run setup');
  process.exit(1);
}
if (!existsSync(join(root, 'web', 'node_modules'))) {
  console.error('Dependency web belum terpasang. Jalankan: npm run setup');
  process.exit(1);
}

console.log('\nBEGASAK — menyalakan API dan antarmuka web\n');

anak.push(jalankan('api', join(root, 'server'), ['run', 'dev']));
anak.push(jalankan('web', join(root, 'web'), ['run', 'dev']));

console.log('\n  API      : http://localhost:5178');
console.log('  Web      : http://localhost:5179');
console.log('  Health   : http://localhost:5178/api/health');
console.log('  Stream   : http://localhost:5178/api/stream\n');
console.log('  Tekan Ctrl+C untuk menghentikan keduanya.\n');
