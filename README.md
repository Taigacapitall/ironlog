# IronLog

Personal training log: exercise, series, reps, and the date/time you finished.
Data is stored server-side in **Netlify Blobs**, so it's the same log no
matter which device or browser you open the site from.

## Project structure

```
index.html                     — the site itself
netlify/functions/entries.js   — serverless function reading/writing Blobs
netlify.toml                   — tells Netlify where the functions live
package.json                   — declares the @netlify/blobs dependency
```

## Deploy to Netlify

**Easiest — drag and drop won't work here** (this project needs a Function,
not just static files), so use one of these instead:

1. **Git-based (recommended):** push this folder to a GitHub/GitLab repo,
   then in Netlify: *Add new site → Import an existing project* and pick
   the repo. Netlify will detect `netlify.toml` automatically. No build
   command is needed — leave the build command blank and publish directory
   as `.`.

2. **Netlify CLI:**
   ```bash
   npm install
   npx netlify-cli deploy --prod
   ```

Netlify Blobs itself needs zero setup — no database to provision, no API
keys to configure. It's automatically available to the function once
deployed.

## Test locally before deploying

```bash
npm install
npx netlify-cli dev
```

This runs the site *and* the function together (with a local Blobs
emulation) at `http://localhost:8888`. Opening `index.html` directly in a
browser (without `netlify dev`) will NOT work — the fetch calls to
`/.netlify/functions/entries` have nothing to talk to without Netlify's
dev server or a real deploy.
