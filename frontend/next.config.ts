import type { NextConfig } from "next";

const isVercel = Boolean(process.env.VERCEL);

const nextConfig: NextConfig = {
  // Use standalone output for Docker containers; Vercel handles its own serverless packaging
  ...(isVercel ? {} : { output: "standalone" }),
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
  async rewrites() {
    const defaultBackendUrl = isVercel ? "https://docintel-api.onrender.com" : "http://127.0.0.1:8000";
    const backendUrl = (process.env.BACKEND_URL || defaultBackendUrl).replace(/\/$/, "");
    return [
      {
        source: "/api/streaming/:path*",
        destination: `${backendUrl}/api/streaming/:path*`,
      },
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: "/admin/:path*",
        destination: `${backendUrl}/admin/:path*`,
      },
      {
        source: "/health/:path*",
        destination: `${backendUrl}/health/:path*`,
      },
      {
        source: "/health",
        destination: `${backendUrl}/health`,
      },
      {
        source: "/metrics",
        destination: `${backendUrl}/metrics`,
      },
    ];
  },
};

export default nextConfig;
