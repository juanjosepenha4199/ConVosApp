# Desplegar ConVos (API + Web)

No se puede desplegar “en tu cuenta” sin que tú entres a Vercel, Railway, Neon, etc. Sigue estos pasos en orden.

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

## 2. Redis (Upstash)

1. Entra en [upstash.com](https://upstash.com) → Redis → crea base.
2. Copia la URL tipo `rediss://...` o la que te den como **Redis URL**.

Guárdala: será `REDIS_URL`.

---

## 3. API en Railway

1. Entra en [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub** → elige **ConVosApp**.
2. **Importante:** en el servicio, **Root Directory** déjalo **vacío** (raíz del repo), para que existan `package-lock.json` y workspaces. En la raíz está `railway.toml` con build/start/migrate.
3. En **Variables** del servicio, añade (valores de tu `.env.example` / producción):

   | Variable | Ejemplo / notas |
   |----------|------------------|
   | `DATABASE_URL` | URI de Neon |
   | `REDIS_URL` | URI de Upstash |
   | `JWT_ACCESS_SECRET` | Cadena larga aleatoria |
   | `JWT_REFRESH_SECRET` | Otra cadena larga |
   | `NODE_ENV` | `production` |
   | `PORT` | Railway suele inyectarla; si falla, no la fuerces |

   Opcionales: `JWT_ACCESS_TTL_SECONDS`, `JWT_REFRESH_TTL_SECONDS`, etc.

4. **Deploy**. El `releaseCommand` en `railway.toml` ejecuta `prisma migrate deploy` antes de levantar la API (necesita `DATABASE_URL`).

5. En **Settings → Networking** genera un **dominio público** (p. ej. `xxx.up.railway.app`).

6. Prueba en el navegador: `https://TU-DOMINIO-RAILWAY/api/v1` → debería responder JSON tipo `{"ok":true}` o similar.

**Tu URL de API para el front será:**  
`https://TU-DOMINIO-RAILWAY/api/v1`  
(sin barra final extra).

---

## 4. Web en Vercel (segundo proyecto)

1. [vercel.com](https://vercel.com) → **Add New Project** → mismo repo **ConVosApp**.
2. **Root Directory:** `apps/web` (solo la web).
3. **Framework:** Next.js (automático).
4. **Output Directory:** sin override raro (no uses `public` como en la API).
5. **Environment Variables:**

   | Variable | Valor |
   |----------|--------|
   | `NEXT_PUBLIC_API_BASE_URL` | `https://TU-DOMINIO-RAILWAY/api/v1` |

   Opcional: `API_PROXY_TARGET` solo si usas rewrites en servidor; en producción lo normal es que el **navegador** llame directo a Railway con `NEXT_PUBLIC_API_BASE_URL`.

6. Deploy. Abre la URL de Vercel: deberías ver la landing / login de ConVos.

---

## 5. CORS

En `apps/api` ya está `enableCors({ origin: true })`, así que el front en otro dominio (Vercel) puede llamar a la API en Railway. Si en el futuro restringes orígenes, añade el dominio `*.vercel.app` y tu dominio custom.

---

## 6. Proyecto Vercel viejo (solo `public`)

El despliegue que solo mostraba “ConVos API…” puedes **archivarlo o borrarlo** para no confundirte.

---

## 7. Si algo falla

- **API 502 / no arranca:** revisa logs en Railway y que `DATABASE_URL` / `REDIS_URL` sean correctas.
- **Migraciones:** en local, con `DATABASE_URL` de Neon:  
  `cd apps/api && npx prisma migrate deploy --schema prisma/schema.prisma`
- **Front “fail to fetch”:** comprueba `NEXT_PUBLIC_API_BASE_URL` (https, sin typo) y que la API responda en `/api/v1`.

---

## Resumen en una frase

**Tú:** Neon + Upstash → variables en Railway (repo raíz + `railway.toml`) → dominio API → segundo proyecto Vercel con `apps/web` y `NEXT_PUBLIC_API_BASE_URL` apuntando a esa API.
