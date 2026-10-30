import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

// Layering: route handlers -> services -> repositories -> Prisma.
const onlyRepositoriesTouchTheDatabase = {
  files: ["src/**/*.{ts,tsx}"],
  ignores: ["src/server/repositories/**", "src/server/db/**"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "@prisma/client",
            message: "Only repositories use Prisma at runtime. Use `import type` elsewhere.",
            allowTypeImports: true,
          },
        ],
      },
    ],
  },
};

const routesCallServicesNotRepositories = {
  files: ["src/app/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["@/server/repositories/*"],
            message: "Routes and pages call services, never repositories.",
          },
          { group: ["@/server/db/*"], message: "Routes and pages never touch the database directly." },
        ],
        paths: [{ name: "@prisma/client", allowTypeImports: true }],
      },
    ],
  },
};

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript", "prettier"),
  {
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["error", "warn"] }],
      eqeqeq: "error",
    },
  },
  onlyRepositoriesTouchTheDatabase,
  { files: ["prisma/**", "scripts/**"], rules: { "no-console": "off" } },
  routesCallServicesNotRepositories,
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
