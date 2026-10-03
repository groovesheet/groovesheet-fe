/* ESLint flat config.

   It exists partly for the usual reason and partly to stop a leak: the CRA app
   one directory up has an .eslintrc.js extending "react-app", and without a
   config here ESLint walks up, finds it, and fails the build with "Failed to
   load config react-app to extend from". A flat config in this directory ends
   the search.

   Rules are Next's own core-web-vitals plus its TypeScript set, loaded through
   FlatCompat because eslint-config-next is still eslintrc-shaped. */
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const config = [
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts", "public/**", "scripts/**"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      /* Off deliberately: it flags a plain apostrophe in JSX copy and wants
         &apos;, which is a rendering non-issue in React and would mean editing
         hand-tuned copy to satisfy a linter. */
      "react/no-unescaped-entities": "off",
    },
  },
];

export default config;
