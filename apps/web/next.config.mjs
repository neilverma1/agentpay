import process from 'node:process';

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@workspace/ui',
    '@workspace/auth',
    '@workspace/email',
    '@workspace/db',
    '@workspace/rate-limit',
    '@workspace/storage',
    '@workspace/utils',
    '@t3-oss/env-nextjs',
  ],
  output: 'standalone',
  async rewrites() {
    const rawApiTarget =
      process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL;

    if (!rawApiTarget) {
      return [];
    }

    const apiTarget = normalizeApiBaseUrl(rawApiTarget);

    return {
      fallback: [
        {
          source: '/api/v1/:path*',
          destination: `${apiTarget}/api/:path*`,
        },
      ],
    };
  },
};

const normalizeApiBaseUrl = (value) => {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error('API rewrite target is empty. Set API_INTERNAL_URL in production.');
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    throw new Error(`Invalid API rewrite target URL: ${trimmed}`);
  }
};

export default nextConfig;
