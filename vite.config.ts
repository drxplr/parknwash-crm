import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const cloud = (env.VITE_CRM_MODE ?? 'cloud') === 'cloud'
  let backendOrigin = ''
  if (command === 'build' && cloud) {
    if (
      !env.VITE_SUPABASE_URL ||
      !env.VITE_SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_')
    ) {
      throw new Error(
        'Cloud builds require a Supabase URL and a modern publishable key. Secret keys are forbidden.',
      )
    }
    const url = new URL(env.VITE_SUPABASE_URL)
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    ) {
      throw new Error('The Supabase URL must be an HTTPS origin without credentials or a path.')
    }
    backendOrigin = url.origin
  }
  const connections = backendOrigin
    ? `${backendOrigin} ${backendOrigin.replace('https:', 'wss:')}`
    : ''
  const policy = `default-src 'none'; script-src 'self'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ${connections}; manifest-src 'self'; base-uri 'none'; object-src 'none'; frame-src 'none'; form-action 'self'; upgrade-insecure-requests`
  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'crm-security-policy',
        apply: 'build',
        transformIndexHtml: () => [
          {
            tag: 'meta',
            attrs: { 'http-equiv': 'Content-Security-Policy', content: policy },
            injectTo: 'head-prepend',
          },
        ],
      },
    ],
  }
})
