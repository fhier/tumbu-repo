/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 'standalone' menghasilkan bundle minimal untuk Docker deployment
  output: 'standalone',
  transpilePackages: ['@tumbu/contracts', '@tumbu/devkit'],
  async rewrites() {
    // Di development: proxy ke localhost:3001
    // Di Docker: Next.js server-side rewrites ke service 'api' dalam network Docker
    const apiBase = process.env.INTERNAL_API_URL || 'http://127.0.0.1:3001';
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;

