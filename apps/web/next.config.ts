import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@it-advisory/diagnostic-core', '@it-advisory/domain'],
  async redirects() {
    return [{ source: '/recommendation', destination: '/service', permanent: true }];
  },
};

export default nextConfig;
