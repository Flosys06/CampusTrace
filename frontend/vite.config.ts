import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

function serveWasmPlugin() {
  const handler = (req: any, res: any, next: any) => {
    if (req.url && req.url.startsWith('/ort-wasm/')) {
      const cleanUrl = req.url.split('?')[0]
      const publicDir = path.resolve(import.meta.dirname, 'public')
      const filePath = path.join(publicDir, cleanUrl.slice(1))
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(cleanUrl)
        let contentType = 'application/octet-stream'
        if (ext === '.wasm') contentType = 'application/wasm'
        else if (ext === '.mjs' || ext === '.js') contentType = 'application/javascript'
        else if (ext === '.json') contentType = 'application/json'

        res.setHeader('Content-Type', contentType)
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        return fs.createReadStream(filePath).pipe(res)
      }
    }
    next()
  }

  return {
    name: 'serve-wasm-files',
    configureServer(server: any) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server: any) {
      server.middlewares.use(handler)
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    serveWasmPlugin(),
    react(),
    tailwindcss(),
  ],
  optimizeDeps: {
    exclude: ['onnxruntime-web']
  },
  assetsInclude: ['**/*.onnx', '**/*.wasm'],
  server: {
    port: 5173,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      }
    }
  },
  preview: {
    port: 5173,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  }
})
