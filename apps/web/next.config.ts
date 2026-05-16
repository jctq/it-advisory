import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@techmd/diagnostic-core', '@techmd/domain', '@techmd/payments'],
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
      { source: '/recommendation', destination: '/quiz', permanent: true },
      { source: '/service', destination: '/quiz', permanent: false },
    ];
  },
};

export default nextConfig;
