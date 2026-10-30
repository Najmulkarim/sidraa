import type { NextConfig } from 'next';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const supabase = new URL(supabaseUrl);
const isDev = process.env.NODE_ENV !== 'production';

// Next.js injects small inline scripts for hydration, so script-src needs
// 'unsafe-inline' unless you move to nonce-based CSP (see docs/security.md).
// frame-ancestors: no site may frame the shop, except the admin showing its own theme previews.
const csp = (frameAncestors: string) => [
  "default-src 'self'",
  // connect.facebook.net: Meta Pixel (only loaded when a Pixel ID is set). tawk.to: live chat, likewise.
  `script-src 'self' 'unsafe-inline' https://connect.facebook.net https://*.tawk.to https://cdn.jsdelivr.net${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://*.tawk.to https://cdn.jsdelivr.net https://fonts.googleapis.com",
  `img-src 'self' data: blob: ${supabase.origin} https://www.facebook.com https://*.tawk.to https://tawk.link`,
  "font-src 'self' https://*.tawk.to https://fonts.gstatic.com",
  "media-src 'self' https://*.tawk.to",
  `connect-src 'self' ${supabase.origin} ${supabase.origin.replace(/^http/, 'ws')} https://www.facebook.com https://connect.facebook.net https://*.tawk.to wss://*.tawk.to`,
  `frame-ancestors ${frameAncestors}`,
  "form-action 'self'",
  // 'self': the Homepage editor shows /preview in a frame.
  "frame-src 'self' https://www.facebook.com https://*.tawk.to",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = (frame: 'none' | 'self') => [
  { key: 'Content-Security-Policy', value: csp(`'${frame}'`) },
  { key: 'X-Frame-Options', value: frame === 'none' ? 'DENY' : 'SAMEORIGIN' },
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
    // 90 for hero banners (HD), 75 everywhere else.
    qualities: [75, 90],
    // AVIF where the browser supports it (about a third smaller than WebP).
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders('none') },
      // Staff-only theme previews, shown beside the Homepage editor (same site only).
      { source: '/preview/:path*', headers: securityHeaders('self') },
    ];
  },
};

export default nextConfig;
