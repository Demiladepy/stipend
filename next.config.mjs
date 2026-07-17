/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Privy optional peer deps we don't use (fiat onramp, Farcaster mini-app).
    config.resolve.alias = {
      ...config.resolve.alias,
      '@stripe/crypto': false,
      '@farcaster/mini-app-solana': false,
    };
    return config;
  },
};

export default nextConfig;
