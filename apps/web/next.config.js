/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 'standalone' menghasilkan bundle minimal untuk Docker deployment
  output: 'standalone',
  transpilePackages: ['@tumbu/contracts', '@tumbu/devkit', '@tumbu/core', '@tumbu/domain'],
  async rewrites() {
    // Di development: proxy ke localhost:3001
    // Di Docker: Next.js server-side rewrites ke service 'api' dalam network Docker
    const apiBase = process.env.INTERNAL_API_URL || 'http://api:3001';
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;

