import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@it-advisory/diagnostic-core', '@it-advisory/domain', '@it-advisory/payments'],
  async redirects() {
    return [
      { source: '/recommendation', destination: '/quiz', permanent: true },
      { source: '/service', destination: '/quiz', permanent: false },
    ];
  },
};

export default nextConfig;
