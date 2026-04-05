import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  shims: true,
  platform: 'node',
  target: 'node18',
  // Don't bundle native modules - they're loaded dynamically at runtime
  esbuildPlugins: [
    {
      name: 'native-module-external',
      setup(build) {
        // Mark all .node files as external
        build.onResolve({ filter: /\.node$/ }, (args) => {
          return { path: args.path, external: true };
        });
      },
    },
  ],
});
