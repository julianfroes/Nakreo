import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// GitHub Pages sirve el sitio en https://<usuario>.github.io/<repo>/,
// por eso `base` debe coincidir con el nombre del repositorio.
// Se puede sobrescribir con VITE_BASE (p. ej. '/' para dominio propio).
export default defineConfig({
  base: process.env.VITE_BASE ?? '/nakreo/',
  plugins: [react(), tailwindcss()],
})
