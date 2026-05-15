import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@techmd/diagnostic-core', '@techmd/domain', '@techmd/payments'],
  async redirects() {
    return [
      { source: '/recommendation', destination: '/quiz', permanent: true },
      { source: '/service', destination: '/quiz', permanent: false },
    ];
  },
};

export default nextConfig;
