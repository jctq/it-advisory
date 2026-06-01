import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@mdxeditor/editor',
    '@teqmd/diagnostic-core',
    '@teqmd/domain',
    '@teqmd/payments',
  ],
  images: {
    localPatterns: [
      {
        // Brand logos use `brandAssetUrl()` cache-busting query params (`?v=…`).
        pathname: '/brand/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/brand/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: '/recommendation', destination: '/diagnostic', permanent: true },
      { source: '/service', destination: '/diagnostic', permanent: false },
      { source: '/quiz', destination: '/diagnostic', permanent: true },
      { source: '/quiz/:path*', destination: '/diagnostic/:path*', permanent: true },
      { source: '/api/quiz/:path*', destination: '/api/diagnostic/:path*', permanent: true },
      { source: '/admin/quiz-sessions', destination: '/admin/sessions', permanent: true },
      { source: '/admin/quiz-sessions/:sessionId', destination: '/admin/sessions/:sessionId', permanent: true },
      {
        source: '/api/admin/quiz-sessions/:path*',
        destination: '/api/admin/diagnostic-sessions/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
