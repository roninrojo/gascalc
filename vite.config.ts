import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss()],
    server: { proxy: { '/api': `http://127.0.0.1:${env.PORT || 3001}` } },
    test: { include: ['tests/**/*.test.ts'] },
  };
});
