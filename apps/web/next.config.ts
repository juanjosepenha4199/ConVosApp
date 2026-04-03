import type { NextConfig } from "next";

/**
 * Origen del backend Nest (sin `/api/v1` ni barra final).
 * En Vercel: si defines `NEXT_PUBLIC_API_BASE_URL=https://…/api/v1`, los rewrites usan el mismo host
 * (evita proxy a 127.0.0.1 cuando el cliente cae en `/api/v1` relativo).
 */
function apiProxyOrigin(): string {
  const explicit = process.env.API_PROXY_TARGET?.replace(/\/$/, "").trim();
  if (explicit) return explicit;

  let pub = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "").trim();
  if (pub && !pub.startsWith("/") && !/^https?:\/\//i.test(pub)) {
    pub = `https://${pub}`;
  }
  if (pub?.startsWith("http://") || pub?.startsWith("https://")) {
    return pub.replace(/\/api\/v1$/i, "") || pub;
  }

  return "http://127.0.0.1:4000";
}

const nextConfig: NextConfig = {
  async rewrites() {
    const target = apiProxyOrigin();
    return [
      {
        source: "/api/v1/:path*",
        destination: `${target}/api/v1/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${target}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
