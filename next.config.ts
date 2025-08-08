const nextConfig = {
  eslint: {
    // Attenzione: questo disabilita ESLint durante il build
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Attenzione: questo ignora gli errori TypeScript durante il build
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
