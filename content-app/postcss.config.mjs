/* Empty on purpose.

   The CRA app one directory up has a postcss.config.js that loads Tailwind.
   PostCSS searches upward from the file being compiled, so without this file
   Next finds that one, tries to require tailwindcss, which is not a dependency
   here, and every stylesheet in this app fails to compile. This app uses plain
   CSS with custom properties and needs no plugins. */
const config = { plugins: {} };

export default config;
