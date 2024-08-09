import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import wasm from 'vite-plugin-wasm';
import { createHtmlPlugin } from 'vite-plugin-html';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { vitePluginVersionMark } from 'vite-plugin-version-mark';
import path from 'path';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig(({ mode }) => {
  console.log('mode', mode);
  const isProd = mode === 'production';
  return {
    esbuild: {
      drop: isProd ? ['console', 'debugger'] : undefined,
    },
    plugins: [
      react(),
      wasm(),
      topLevelAwait(),
      vitePluginVersionMark({
        name: 'staking',
        ifGitSHA: true,
        ifShortSHA: true,
        ifMeta: false,
        ifLog: false,
        ifGlobal: true,
      }),
      // legacy(),
      nodePolyfills(),
      createHtmlPlugin({
        minify: true,
      }),
      // mkcert({ force: true, savePath: path.resolve(__dirname, '.certs') }),
    ],
    resolve: {
      alias: [{ find: '@', replacement: path.resolve(__dirname, 'src') }],
    },
    css: {
      preprocessorOptions: {
        less: {
          javascriptEnabled: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          entryFileNames: 'js/[hash].js',
          chunkFileNames: 'js/[hash].js',
          assetFileNames: '[ext]/[hash].[ext]',
        },
      },
    },
  };
});
