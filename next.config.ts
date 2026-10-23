import type { NextConfig } from 'next';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const supabase = new URL(supabaseUrl);
const isDev = process.env.NODE_ENV !== 'production';

// Next.js injects small inline scripts for hydration, so script-src needs
// 'unsafe-inline' unless you move to nonce-based CSP (see docs/security.md).
const csp = [
  "default-src 'self'",
  // connect.facebook.net: Meta Pixel (only loaded when a Pixel ID is set).
  `script-src 'self' 'unsafe-inline' https://connect.facebook.net${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase.origin} https://www.facebook.com`,
  "font-src 'self'",
  `connect-src 'self' ${supabase.origin} ${supabase.origin.replace(/^http/, 'ws')} https://www.facebook.com https://connect.facebook.net`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  "frame-src https://www.facebook.com",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  ...(isDev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: supabase.protocol.replace(':', '') as 'http' | 'https',
        hostname: supabase.hostname,
        port: supabase.port,
        pathname: '/storage/v1/object/public/**',
      },
    ],
    // Allow next/image to optimise from a local Supabase stack in development.
    dangerouslyAllowLocalIP: isDev,
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
