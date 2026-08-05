import { defineConfig } from 'vite';

// base: './' keeps asset URLs relative so the built site works when hosted
// from any path (root domain, subfolder, Netlify/Vercel/Cloudflare Pages, etc.)
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0, // keep fonts/logo as real files, never inlined
  },
});
