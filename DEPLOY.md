# Desplegar ConVos (API + Web)

No se puede desplegar “en tu cuenta” sin que tú entres a Vercel, Railway, Neon, etc. Sigue estos pasos en orden.

---

## Guía paso a paso: pasos 2, 3 y 4 (API lista + web en Vercel)

**Antes:** ya debes tener **Neon** (`DATABASE_URL`) y **Upstash** (`REDIS_URL`) como en tu `apps/api/.env` local.

### Paso 2 — API en Railway

1. Entra en [railway.app](https://railway.app) e inicia sesión (puedes usar GitHub).
2. **New project** → **Deploy from GitHub repo** → autoriza a Railway si te lo pide → elige el repo **ConVosApp**.
3. Railway creará un **servicio** conectado al repo. Ábrelo.
4. **Settings** del servicio → **Root Directory**:
   - **Déjalo vacío** (raíz del monorepo).  
   - No pongas `apps/api` aquí: el `railway.toml` de la raíz ya ejecuta `npm ci && npm run build -w api`.
5. **Variables** (pestaña **Variables** o **Raw Editor**). Añade **una por una** (copia los valores de tu `apps/api/.env` de producción, **sin** `NODE_ENV=development`):

   | Nombre | Valor |
   |--------|--------|
   | `DATABASE_URL` | Tu URI completa de Neon |
   | `REDIS_URL` | Solo `redis://default:...@....upstash.io:6379` (sin `redis-cli`) |
   | `JWT_ACCESS_SECRET` | Cadena larga (en producción, **no** uses `dev_access_secret_change_me`) |
   | `JWT_REFRESH_SECRET` | Otra cadena larga distinta |
   | `NODE_ENV` | `production` |
   | `JWT_ACCESS_TTL_SECONDS` | `900` (opcional) |
   | `JWT_REFRESH_TTL_SECONDS` | `2592000` (opcional) |

   Opcional si usas push: `VAPID_*` como en tu `.env`.

6. **Deploy**: guarda variables; Railway redeployará solo. Mira **Deployments** → clic en el deploy → **Build Logs** / **Deploy Logs**:
   - Debe verse `prisma migrate deploy` (release) y luego el arranque de Node.
7. Si el build falla por `npm ci`, comprueba que el **`package-lock.json` de la raíz** del repo esté **commiteado** y pusheado a GitHub.

### Paso 3 — Dominio público y probar la API

1. En el mismo servicio de Railway → **Settings** → **Networking** → **Generate domain** (o **Public Networking**).
2. Copia la URL, por ejemplo `https://convos-api-production-xxxx.up.railway.app`.
3. En el navegador abre:

   `https://ESA-URL/api/v1`

   (sin barra al final después de `v1`).

4. Deberías ver JSON tipo `{"ok":true}`. Si ves **502** o error, abre **Logs** en Railway y revisa `DATABASE_URL` / `REDIS_URL` / errores de Prisma.

5. **Anota la URL base de la API para el front** (la usarás tal cual en el paso 4):

   `https://ESA-URL/api/v1`

### Paso 4 — Web en Vercel (proyecto nuevo, solo Next)

1. Entra en [vercel.com](https://vercel.com) → **Add New…** → **Project**.
2. **Import** el mismo repo **ConVosApp** (no reutilices el proyecto viejo que solo mostraba HTML de la API).
3. Antes de **Deploy**, pulsa **Configure Project** (o el lápiz de ajustes):
   - **Root Directory:** escribe **`apps/web`** y confirma (Vercel debe detectar **Next.js**).
   - **Framework Preset:** Next.js.
   - **Build Command / Output Directory:** deja los valores por defecto de Next (no fuerces `public` como en la API).
4. **Environment Variables** → **Add**:
   - Nombre: `NEXT_PUBLIC_API_BASE_URL`
   - Valor: **exactamente** la URL del paso 3, por ejemplo  
     `https://convos-api-production-xxxx.up.railway.app/api/v1`  
     (https, sin espacios, **con** `/api/v1` al final).
   - Marca **Production** (y Preview si quieres la misma API en previews).
5. **Deploy**. Cuando termine, abre la URL que te da Vercel (tipo `xxx.vercel.app`).
6. Prueba **Registro / Login**. Si falla la red, en el navegador F12 → **Red** mira si las peticiones van a tu dominio de Railway y si hay error CORS (con `origin: true` en Nest no debería).

### Checklist rápido

- [ ] Railway: Root Directory **vacío**, variables puestas, deploy verde.
- [ ] `https://TU-RAILWAY/api/v1` → `{"ok":true}`.
- [ ] Vercel: Root **`apps/web`**, `NEXT_PUBLIC_API_BASE_URL` = esa misma base API.
- [ ] Proyecto Vercel viejo (solo `public` de la API) archivado o ignorado para no confundirte.

---

## 0. Qué va dónde

| Parte | Servicio recomendado | Por qué |
|--------|----------------------|---------|
| **Web** (Next.js) | **Vercel** | Preset Next.js, `Root Directory = apps/web` |
| **API** (Nest) | **Railway** (u otro Node) | Nest necesita un proceso Node largo; Vercel “estático” no sirve |
| **PostgreSQL** | **Neon** o **Supabase** | Gratis para empezar |
| **Redis** | **Upstash** | Gratis para empezar; la API lo usa para colas |

---

## 1. Base de datos (Neon)

1. Entra en [neon.tech](https://neon.tech), crea cuenta y un **proyecto**.
2. Copia la **connection string** (URI) de Postgres.
3. Debe incluir `?sslmode=require` si Neon la indica.

Guárdala: la usarás como `DATABASE_URL`.

---

## 2. Redis (Upstash) — referencia corta

1. [upstash.com](https://upstash.com) → Redis → crea base → URL TCP `redis://default:...@....upstash.io:6379` → variable `REDIS_URL` (sin el comando `redis-cli`).

---

## 3. CORS

En `apps/api` ya está `enableCors({ origin: true })`, así que el front en otro dominio (Vercel) puede llamar a la API en Railway. Si en el futuro restringes orígenes, añade el dominio `*.vercel.app` y tu dominio custom.

---

## 4. Proyecto Vercel viejo (solo `public`)

El despliegue que solo mostraba “ConVos API…” puedes **archivarlo o borrarlo** para no confundirte.

---

## 5. Si algo falla

- **API 502 / no arranca:** revisa logs en Railway y que `DATABASE_URL` / `REDIS_URL` sean correctas.
- **Migraciones:** en local, con `DATABASE_URL` de Neon:  
  `cd apps/api && npx prisma migrate deploy --schema prisma/schema.prisma`
- **Front “fail to fetch”:** comprueba `NEXT_PUBLIC_API_BASE_URL` (https, sin typo) y que la API responda en `/api/v1`.

---

## Resumen en una frase

**Tú:** Neon + Upstash → variables en Railway (repo raíz + `railway.toml`) → dominio API → segundo proyecto Vercel con `apps/web` y `NEXT_PUBLIC_API_BASE_URL` apuntando a esa API.
