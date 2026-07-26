# ⚡ Production Build Optimizations

To maintain optimal bundle sizes and fast TTFB/LCP metrics across production deployments, `next.config.js` leverages SWC compiler features and import modularization.

## Enabled Optimizations

1. **SWC Minification (`swcMinify: true`)**: Replaces Terser with Next.js SWC for faster build times and tighter JS minification.
2. **Modularize Imports (`modularizeImports`)**: Rewrites barrel file imports (`import { map } from 'lodash'`) to direct subpath imports (`import map from 'lodash/map'`).
3. **Console Stripping (`compiler.removeConsole`)**: Removes debug logs in production bundles while preserving `console.error`.

## Measuring Bundle Size

To run `@next/bundle-analyzer` locally:

```bash
ANALYZE=true npm run build