/** @type {import('next').NextConfig} */
const isStaticExport = process.env.STATIC_EXPORT === 'true';

const nextConfig = {
  ...(isStaticExport ? { distDir: '.next_export', output: 'export', trailingSlash: true, outputFileTracing: false } : {}),
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
  }
};

export default nextConfig;
