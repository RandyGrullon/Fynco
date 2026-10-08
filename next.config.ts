import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // Rutas de la v1 → v2
    return [
      { source: "/dashboard", destination: "/inicio", permanent: true },
      { source: "/accounts", destination: "/cuentas", permanent: true },
      { source: "/accounts/:id", destination: "/cuentas/:id", permanent: true },
      { source: "/activity", destination: "/movimientos", permanent: true },
      { source: "/movements", destination: "/movimientos", permanent: true },
      { source: "/recurring", destination: "/recurrentes", permanent: true },
      { source: "/goals", destination: "/metas", permanent: true },
      { source: "/statistics", destination: "/estadisticas", permanent: true },
      { source: "/settings", destination: "/ajustes", permanent: true },
      { source: "/legal/privacy", destination: "/legal/privacidad", permanent: true },
      { source: "/legal/terms", destination: "/legal/terminos", permanent: true },
    ];
  },
};

export default nextConfig;
