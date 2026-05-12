import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@it-advisory/diagnostic-core', '@it-advisory/domain'],
};

export default nextConfig;
