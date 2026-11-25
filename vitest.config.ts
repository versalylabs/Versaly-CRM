import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
  resolve: { alias: [{ find: /^@\/lib\/(pipelineStages|utils)$/, replacement: path.resolve(__dirname, 'src/lib/$1') }, { find: '@', replacement: path.resolve(__dirname) }] },
});
