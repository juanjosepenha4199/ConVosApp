# ConVos

Plataforma web para crear planes reales en grupo, validarlos con foto y convertirlos en recuerdos, con puntos, rachas, niveles y retos.

## Requisitos

- Node.js (recomendado LTS)
- Docker Desktop (para Postgres + Redis)

## Arranque rápido (desarrollo)

1) Levantar base de datos y redis:

```bash
npm run db:up
```

2) Configurar variables de entorno:

- Copia `.env.example` a `.env` en la raíz.
- Copia `apps/api/.env.example` a `apps/api/.env`.
- Copia `apps/web/.env.example` a `apps/web/.env.local`.
- **Redis** debe estar arriba (`npm run db:up`) para colas BullMQ (retos semanales, recordatorios, escaneo de inactividad).
- **Web Push (opcional):** genera claves VAPID y ponlas en `apps/api/.env`:

```bash
npx web-push generate-vapid-keys
```

Pega `VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` en `apps/api/.env` y ajusta `VAPID_SUBJECT`.

3) Instalar dependencias:

```bash
npm install
```

4) Migraciones:

```bash
npm run db:migrate
```

5) Ejecutar web + api:

```bash
npm run dev
```

## Estructura

- `apps/web`: Next.js (frontend)
- `apps/api`: NestJS (backend)
- `infra`: Docker compose (Postgres, Redis)

