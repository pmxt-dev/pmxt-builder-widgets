import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ['react', 'react-dom'],
    // tsup strips the per-file directives when bundling; without this every
    // Next.js App Router consumer crashes (createContext in a Server
    // Component).
    banner: { js: "'use client';" },
});
