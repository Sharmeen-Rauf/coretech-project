/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  swcMinify: true,
  compress: true,
  reactStrictMode: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cypbnnohtipwavcwukhl.supabase.co',
      },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "@supabase/supabase-js", "react-hot-toast"],
  },
};

export default nextConfig;
