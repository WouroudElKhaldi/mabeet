# Fonts

All five families are free under the SIL Open Font License 1.1. The files come from the Fontsource packages (Source
Sans 3 from Google Fonts), the Latin or Arabic subset only, and are loaded in `src/app/layout.tsx`, except Source Sans:
only the Whish simulator's page uses it (Whish's own font), so that page loads it.

| File                        | Family                  | Package                                 |
| --------------------------- | ----------------------- | --------------------------------------- |
| `inter-100-900.woff2`       | Inter                   | `@fontsource-variable/inter`            |
| `archivo-100-900.woff2`     | Archivo (weight, width) | `@fontsource-variable/archivo`          |
| `plex-arabic-400…700.woff2` | IBM Plex Sans Arabic    | `@fontsource/ibm-plex-sans-arabic`      |
| `kufi-100-900.woff2`        | Noto Kufi Arabic        | `@fontsource-variable/noto-kufi-arabic` |
| `source-sans-400-700.woff2` | Source Sans 3           | Google Fonts (`Source Sans 3`, latin)   |
