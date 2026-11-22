/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  // Stały port: postęp kursu zapisuje się w localStorage przeglądarki, który jest przypisany do adresu
  // (łącznie z portem). Inny port = pusty postęp. strictPort zatrzymuje start zamiast po cichu zmienić port.
  server: { port: 5179, strictPort: true },
  preview: { port: 5179, strictPort: true },
  test: { globals: true, environment: 'node' },
});
