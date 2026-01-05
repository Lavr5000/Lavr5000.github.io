/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // Disable default favicon generation
  async generateBuildId() {
    return 'build';
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://api:8000/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
