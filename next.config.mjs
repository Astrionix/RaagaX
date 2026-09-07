/** @type {import('next').NextConfig} */
const isStaticExport = process.env.STATIC_EXPORT === 'true';

const nextConfig = {
  ...(isStaticExport ? { output: 'export', distDir: '.next_apk_build', trailingSlash: true } : {}),
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qbqnlmfdmfayeztagvkj.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFicW5sbWZkbWZheWV6dGFndmtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyMDAzNDksImV4cCI6MjEwMTc3NjM0OX0.Xjj4PQmu1LLYu7Yk0XiijVEDqzd4PqSsZzACaKkWLXk',
  },
  images: {
    unoptimized: isStaticExport,
    remotePatterns: [
      { protocol: 'https', hostname: 'c.saavncdn.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'aac.saavncdn.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'yt3.ggpht.com' }
    ]
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = {
        type: 'memory',
      };
    }
    return config;
  },
  async redirects() {
    return [
      {
        source: '/releases/RaagaX-Windows-Universal.exe',
        destination: 'https://github.com/Astrionix/RaagaX/releases/download/v1.0.0/RaagaX-Windows-Universal.exe',
        permanent: false,
      },
      {
        source: '/releases/RaagaX-Windows-Portable.exe',
        destination: 'https://github.com/Astrionix/RaagaX/releases/download/v1.0.0/RaagaX-Windows-Portable.exe',
        permanent: false,
      },
      {
        source: '/releases/RaagaX-macOS-Universal.dmg',
        destination: 'https://github.com/Astrionix/RaagaX/releases/download/v1.0.0/RaagaX-macOS-Universal.dmg',
        permanent: false,
      },
      {
        source: '/releases/RaagaX-macOS-arm64.dmg',
        destination: 'https://github.com/Astrionix/RaagaX/releases/download/v1.0.0/RaagaX-macOS-Universal.dmg',
        permanent: false,
      },
      {
        source: '/releases/RaagaX-macOS-intel.dmg',
        destination: 'https://github.com/Astrionix/RaagaX/releases/download/v1.0.0/RaagaX-macOS-Universal.dmg',
        permanent: false,
      },
      {
        source: '/releases/RaagaX-latest.apk',
        destination: 'https://github.com/Astrionix/RaagaX/releases/download/v1.0.0/RaagaX.apk',
        permanent: false,
      },
      {
        source: '/releases/RaagaX.apk',
        destination: 'https://github.com/Astrionix/RaagaX/releases/download/v1.0.0/RaagaX.apk',
        permanent: false,
      },
    ];
  }
};

export default nextConfig;
