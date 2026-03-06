// eslint.config.mjs
// ESLint flat config for MMM-REnergy
// Run: npx eslint MMM-REnergy.js node_helper.js

import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        // MagicMirror² browser-side globals
        ...globals.browser,
        Module: "readonly",
        Log:    "readonly",
        // MagicMirror² node-side globals
        ...globals.node,
      },
    },
    rules: {
      // Code quality
      "no-unused-vars":     ["warn", { argsIgnorePattern: "^_" }],
      "no-console":          "off",        // Log.* is used instead
      "eqeqeq":             ["error", "always"],
      "no-var":              "error",
      "prefer-const":       "warn",

      // Style (keep consistent with MagicMirror core style)
      "indent":             ["warn", 2, { SwitchCase: 1 }],
      "quotes":             ["warn", "double"],
      "semi":               ["warn", "always"],
      "comma-dangle":       ["warn", "always-multiline"],
      "space-before-function-paren": ["warn", "always"],

      // Safety
      "no-eval":             "error",
      "no-implied-eval":     "error",
      "no-new-func":         "error",
    },
  },
];
