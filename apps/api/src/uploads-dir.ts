import { join } from 'path';

/**
 * Carpeta de ficheros bajo `/uploads`. Usa la ruta del módulo compilado (`dist/`)
 * para no depender de `process.cwd()` (monorepo / Railway pueden variar).
 */
export const UPLOADS_ABSOLUTE_DIR = join(__dirname, '..', 'uploads');
