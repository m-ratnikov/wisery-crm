import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import tseslint from "typescript-eslint";
import sonarjs from "eslint-plugin-sonarjs";

export default defineConfig([
  ...nextVitals,
  ...nextTs,

  // Type-aware linting for our TypeScript sources. The async footgun rules
  // (no-floating-promises etc.) need type information, so this block turns on
  // the TS project service and scopes itself to files in the TS project graph.
  {
    files: ["**/*.{ts,tsx,mts}"],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { sonarjs },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-explicit-any": "error",
      // Cognitive complexity (nesting-aware) is the single complexity gate - ESLint
      // core's cyclomatic `complexity` is dropped as redundant. Cross-file duplication
      // is handled by jscpd, so sonarjs's duplication rules are not duplicated here.
      "sonarjs/cognitive-complexity": ["error", 15],
      "max-depth": ["error", 4],
      "max-params": ["error", 4],
      "no-duplicate-imports": "error",
    },
  },

  // Config and build scripts are not part of the TS project graph, so type-aware
  // rules cannot run on them - disable type-checking there to avoid parser errors.
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [tseslint.configs.disableTypeChecked],
  },

  prettier,

  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "drizzle/**", "next-env.d.ts"]),
]);
