import type { NextConfig } from "next";

/** Origen del backend Nest (sin barra final). Solo desarrollo / self-host con proxy. */
const API_PROXY_TARGET = (process.env.API_PROXY_TARGET ?? "http://127.0.0.1:4000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${API_PROXY_TARGET}/api/v1/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${API_PROXY_TARGET}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
