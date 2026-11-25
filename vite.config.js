import { defineConfig } from 'vite';

// base './' lets the built game be hosted at any path (its own site, or in a subfolder).
// target esnext: src/main.js uses top-level await to load the art before the first frame.
export default defineConfig({ base: './', build: { target: 'esnext' } });
