/**
 * Vercel (modo estático) exige carpeta `public` tras el build.
 * Crea/actualiza public/index.html después de nest build.
 */
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const indexPath = path.join(publicDir, 'index.html');
const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>ConVos API</title></head>
<body><p>ConVos API. Endpoints JSON en <code>/api/v1</code>.</p></body>
</html>`;

fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(indexPath, html, 'utf8');
