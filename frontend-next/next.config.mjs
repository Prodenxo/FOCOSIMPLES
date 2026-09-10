import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: '/configuracoes', destination: '/minha-conta', permanent: false },
      { source: '/configuracoes/:path*', destination: '/minha-conta/:path*', permanent: false },
    ];
  },
  images: {
    remotePatterns: [],
  },
  webpack: (config) => {
    config.resolve.alias['@edusites/bancos-brasil/core'] = path.join(
      __dirname,
      'node_modules/@edusites/bancos-brasil/src/core.js',
    );
    return config;
  },
};

export default nextConfig;
