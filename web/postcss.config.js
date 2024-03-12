import autoprefixer from 'autoprefixer';
import postcssNesting from 'postcss-nesting';

/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: [autoprefixer, postcssNesting],
};

export default config;
