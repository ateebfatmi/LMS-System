import type { NextConfig } from "next";

const developmentScriptSources = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";

const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "form-action 'self'",
      `script-src 'self' 'unsafe-inline'${developmentScriptSources} https://*.clerk.accounts.dev https://*.clerk.com`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://*.supabase.co wss://*.supabase.co",
      "frame-src 'self' https://*.clerk.accounts.dev https://*.clerk.com",
      "worker-src 'self' blob:",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  experimental: {
    agentUpgrade: "security",
  },
  transpilePackages: [
    "@prepzii/contracts",
    "@prepzii/assessment-core",
    "@prepzii/authorization",
    "@prepzii/membership",
    "@prepzii/ui",
  ],
  poweredByHeader: false,
  compress: true,
  async redirects() {
    return [
      { source: "/dashboard", destination: "/dashboard/workspace", permanent: false },
      { source: "/dashboard/admissions", destination: "/dashboard/crm", permanent: false },
      { source: "/dashboard/batches", destination: "/dashboard/batches/workspace", permanent: false },
      { source: "/dashboard/students", destination: "/dashboard/students/workspace", permanent: false },
      { source: "/dashboard/assessments", destination: "/dashboard/assessments/workspace", permanent: false },
      { source: "/dashboard/attendance", destination: "/dashboard/attendance/workspace", permanent: false },
      { source: "/dashboard/fees", destination: "/dashboard/fees/workspace", permanent: false },
      { source: "/dashboard/reports", destination: "/dashboard/reports/workspace", permanent: false },
      { source: "/dashboard/onboarding", destination: "/dashboard/members", permanent: false },
      { source: "/dashboard/question-bank", destination: "/dashboard/assessments/workspace", permanent: false },
      { source: "/dashboard/cbt/:testId", destination: "/dashboard/assessments/:testId", permanent: false },
      { source: "/office", destination: "/dashboard/fees/workspace", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
