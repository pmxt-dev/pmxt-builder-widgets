import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    // Resolve the workspace package to its TypeScript source (see tsconfig
    // paths) so demo dev picks up widget edits without a package rebuild.
    transpilePackages: ['pmxt-widgets'],
};

export default nextConfig;
