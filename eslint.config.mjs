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
  ignores: ["src/**/*-repository.ts", "src/server/db/**"],
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

// Modules: a module is entered only through its two doors, `@/modules/<name>` (input checks, types, screens: safe
// in the browser) and `@/modules/<name>/server` (services). Its repositories and other files stay private.
const intoAnotherModule = {
  group: ["@/modules/*/*", "!@/modules/*/server", "@/modules/*/server/*"],
  message: "Import a module through @/modules/<name> or @/modules/<name>/server, never its inner files.",
};

const climbIntoAnotherModule = {
  group: ["../../*", "!../../server/**"],
  message: "Reach another module through its doors, not by path.",
};

const anyModule = {
  group: ["@/modules/*", "@/modules/**"],
  message: "The shared kernel never imports a module.",
};

const routesCallServicesNotRepositories = {
  files: ["src/app/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          intoAnotherModule,
          { group: ["@/server/db/*"], message: "Routes and pages never touch the database directly." },
          {
            group: ["@/server/auth/*-repository"],
            message: "Routes and pages never touch the database directly.",
          },
        ],
        paths: [{ name: "@prisma/client", allowTypeImports: true }],
      },
    ],
  },
};

// Inside a module, its own files are reached by relative paths; another module only through its doors.
const modulesStayBehindTheirDoors = {
  files: ["src/modules/**/*.{ts,tsx}"],
  ignores: ["src/**/*-repository.ts"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [intoAnotherModule, climbIntoAnotherModule],
        paths: [{ name: "@prisma/client", allowTypeImports: true }],
      },
    ],
  },
};

// Repositories may use Prisma at runtime, but they are the files that most need to stay private, so they keep the
// same doors as the rest of their module (and the kernel's keep away from modules).
const repositoriesKeepTheirDoors = [
  {
    files: ["src/modules/**/*-repository.ts"],
    rules: { "no-restricted-imports": ["error", { patterns: [intoAnotherModule, climbIntoAnotherModule] }] },
  },
  {
    files: ["src/server/**/*-repository.ts"],
    rules: { "no-restricted-imports": ["error", { patterns: [anyModule] }] },
  },
];

// The shared kernel, lib, utils and config never depend on a feature. The worker's registry is where modules are
// put together, so it is the one exception.
const kernelNeverImportsModules = {
  files: [
    "src/server/**/*.{ts,tsx}",
    "src/lib/**/*.{ts,tsx}",
    "src/utils/**/*.{ts,tsx}",
    "src/config/**/*.{ts,tsx}",
  ],
  ignores: ["src/server/jobs/registry.ts", "src/**/*-repository.ts", "src/server/db/**"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [anyModule],
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
  modulesStayBehindTheirDoors,
  kernelNeverImportsModules,
  ...repositoriesKeepTheirDoors,
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
