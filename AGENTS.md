# Repository Guidelines

## Project Structure & Module Organization
- `src/pages/` contains Astro routes (e.g., `src/pages/index.astro`, `src/pages/edge/`).
- `src/components/` holds reusable Astro components using PascalCase file names.
- `src/layouts/` defines page layouts shared across routes.
- `src/assets/` and `public/` store static assets; use `public/` for files that should be served as-is.
- `src/styles/` includes global styling and Tailwind layers.
- `src/utils.ts` and `src/types.ts` centralize helpers and shared types.
- `netlify/edge-functions/` contains Netlify Edge Functions like `netlify/edge-functions/rewrite.js`.

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm run dev` (or `npm start`): run the local Astro dev server.
- `npm run build`: produce a production build in `dist/`.
- `npm run preview`: serve the production build locally for validation.

## Coding Style & Naming Conventions
- Indentation uses 4 spaces in Astro and TypeScript files; avoid tabs.
- Prefer ES module syntax and named exports for utilities.
- Astro components use PascalCase file names (e.g., `Header.astro`).
- Route files are kebab-case or lowercase (e.g., `image-cdn.astro`).
- No formatter or linter is configured; keep changes consistent with nearby code.

## Testing Guidelines
- No automated test framework is configured in this repo yet.
- When adding tests, document the framework and add scripts to `package.json`.
- If you add manual verification steps, include them in your PR description.

## Commit & Pull Request Guidelines
- Recent history follows Conventional Commits (e.g., `chore(deps): update tailwindcss`).
- Use concise, scoped messages when possible; include `deps` for dependency-only updates.
- PRs should include a short summary, testing notes, and screenshots for UI changes.
- Link relevant issues or Netlify deploy previews when applicable.

## Configuration & Environment Notes
- Environment variables are accessed via `import.meta.env` (example: `PUBLIC_DISABLE_UPLOADS`).
- Add new public variables with the `PUBLIC_` prefix and document them in the PR.
