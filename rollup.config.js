import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import { terser } from 'rollup-plugin-terser';
import typescript from '@rollup/plugin-typescript';

const external = [
  'http2',
  '@zalter/http2-client-node',
  '@stablelib/cbor',
  '@stablelib/ed25519'
];

const cjsConfig = {
  input: 'src/index.mts',
  output: {
    file: 'lib/cjs/index.js',
    format: 'cjs'
  },
  plugins: [
    typescript({
      tsconfig: './tsconfig.json',
      compilerOptions: {
        outDir: 'lib/cjs'
      }
    }),
    resolve({
      preferBuiltins: false
    }),
    commonjs(),
    terser()
  ],
  external
};

const esmConfig = {
  input: 'src/index.mts',
  output: {
    file: 'lib/esm/index.mjs',
    format: 'esm'
  },
  plugins: [
    typescript({
      tsconfig: './tsconfig.json',
      compilerOptions: {
        outDir: 'lib/esm'
      }
    }),
    terser()
  ],
  external
};

export default [
  cjsConfig,
  esmConfig
];