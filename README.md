# CodeMath

The CodeMath company website, built with React, TanStack Start, and Vite.

## Requirements

- Node.js
- npm

## Local development

```sh
npm install
npm run dev
```

## Build and preview

```sh
npm run build
npm run preview
```

Run the test suite with `npm test` and lint the project with `npm run lint`.

## Deploying to Vercel

The Vite configuration includes Nitro's Vercel adapter for the TanStack Start
server. Import the repository in Vercel, use the repository root as the project
root, and build with `npm run build`. Leave the output directory unset so Nitro
can provide Vercel's deployment output; do not set it to `dist/client`.

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project
environment if the invoicing and client portal features need Supabase. Redeploy
after pushing configuration changes.
