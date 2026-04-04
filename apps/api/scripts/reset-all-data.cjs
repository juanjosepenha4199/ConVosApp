/**
 * Deja la app como recién publicada: vacía Postgres (migrate reset), Redis y carpeta uploads.
 * No modifica .env ni claves. Requiere DATABASE_URL y, para Redis, Docker con infra/docker-compose.
 *
 * Uso: npm run db:reset -w api   (desde la raíz: npm run db:reset)
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const apiRoot = path.join(__dirname, '..');
process.chdir(apiRoot);

console.log('[reset] Prisma migrate reset (borra todos los datos y reaplica migraciones)…');
execSync('npx prisma migrate reset --force --schema prisma/schema.prisma --skip-seed', {
  stdio: 'inherit',
  env: process.env,
});

const uploadsDir = path.join(apiRoot, 'uploads');
if (fs.existsSync(uploadsDir)) {
  for (const name of fs.readdirSync(uploadsDir)) {
    if (name === '.gitkeep') continue;
    fs.rmSync(path.join(uploadsDir, name), { recursive: true, force: true });
  }
  console.log('[reset] Carpeta apps/api/uploads vaciada (se mantiene .gitkeep si existe).');
}

const repoRoot = path.join(apiRoot, '..', '..');
const composeFile = path.join(repoRoot, 'infra', 'docker-compose.yml');
if (fs.existsSync(composeFile)) {
  try {
    execSync(`docker compose -f "${composeFile}" exec -T redis redis-cli FLUSHALL`, {
      stdio: 'inherit',
    });
    console.log('[reset] Redis FLUSHALL OK.');
  } catch {
    console.warn('[reset] Redis: FLUSHALL omitido (¿contenedor apagado?).');
  }
} else {
  console.warn('[reset] No se encontró infra/docker-compose.yml; Redis no tocado.');
}

console.log('[reset] Listo.');
