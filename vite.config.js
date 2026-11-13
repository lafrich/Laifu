import {defineConfig} from 'vite';
import {resolve} from 'node:path';
export default defineConfig({
  base:'./',
  build:{rollupOptions:{input:{home:resolve('index.html'),character:resolve('apps/laifu-character/index.html'),map:resolve('apps/laifu-map/index.html')}}}
});
