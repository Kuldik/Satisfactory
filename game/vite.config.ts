import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

/** Middleware plugin to serve 3D models from ../kits directory */
function serveKitsPlugin(): Plugin {
  const kitsDir = path.resolve(__dirname, '..', 'kits');
  return {
    name: 'serve-kits',
    configureServer(server) {
      server.middlewares.use('/kits', (req, res, next) => {
        const url = decodeURIComponent(req.url || '');
        const filePath = path.join(kitsDir, url);
        try {
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            // Set MIME types
            if (filePath.endsWith('.glb')) {
              res.setHeader('Content-Type', 'model/gltf-binary');
            } else if (filePath.endsWith('.fbx')) {
              res.setHeader('Content-Type', 'application/octet-stream');
            } else if (filePath.endsWith('.png')) {
              res.setHeader('Content-Type', 'image/png');
            } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
              res.setHeader('Content-Type', 'image/jpeg');
            }
            res.setHeader('Access-Control-Allow-Origin', '*');
            fs.createReadStream(filePath).pipe(res);
          } else {
            next();
          }
        } catch {
          next();
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), serveKitsPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@core': path.resolve(__dirname, './src/core'),
      '@systems': path.resolve(__dirname, './src/systems'),
      '@render': path.resolve(__dirname, './src/render'),
      '@ui': path.resolve(__dirname, './src/ui'),
      '@data': path.resolve(__dirname, './src/data'),
    },
  },
  assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.fbx'],
  server: {
    fs: {
      allow: ['..'], // Allow serving from parent directory (for kits)
    },
  },
})
