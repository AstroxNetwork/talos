import react from '@vitejs/plugin-react-swc';
import wasm from 'vite-plugin-wasm';
import { createHtmlPlugin } from 'vite-plugin-html';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { vitePluginVersionMark } from 'vite-plugin-version-mark';
import path from 'path';
import topLevelAwait from 'vite-plugin-top-level-await';
import { defineConfig } from 'vite';
import mkcert from 'vite-plugin-mkcert';

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';
  const src = path.resolve(__dirname, 'src');
  console.log({ mode, isProd, src });
  return {
    esbuild: {
      drop: isProd ? ['console', 'debugger'] : undefined,
    },
    server:{
      port: 10086,
    },
    optimizeDeps: {
      esbuildOptions: {
        define: {
          global: 'globalThis',
        },
        supported: {
          bigint: true,
        },
      },
    },
    plugins: [
      react(),
      nodePolyfills(),
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
      createHtmlPlugin({
        minify: true,
      }),
      mkcert({ force: true, savePath: path.resolve(__dirname, '.certs') }),
    ],
    resolve: {
      alias: [{ find: '@', replacement: src }],
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
