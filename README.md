# Medasium

Local-only medical care tracker (React + TypeScript + Vite + Tailwind/shadcn). No backend, no accounts; data lives in the browser's IndexedDB. India-first: IST, DD/MM/YYYY, mg/dL, °F, kg, +91.

Records vitals, **lab results** (tumour markers such as CA 19-9, CA-125, PSA; CBC, LFT, RFT, lipids, thyroid, HbA1c, vitamins, clotting, plus custom tests), medications, observations, appointments, photos and recurring care tasks.

```
npm install
npm run dev      # develop
npm test         # vitest (schema, import, scheduling, ranges)
npm run build    # regenerates schema + lab catalogue docs, typechecks, builds to dist/
```

## Static files for AI agents
Served from the site root after deploy (the in-app Import page shows the exact URLs):
- `agent/AGENTS.md`: short guide for turning random documents into an import file
- `schema/medasium.schema.json`: detailed JSON Schema (generated from `src/model/schema.ts`)
- `samples/sample-patient.json`: the sample patient ("Amma"). It is a plain, hand-editable Medasium JSON file; "Load sample patient" imports it through the normal import preview (validate, then merge or replace), only moving its dates so the history ends today. `npm test` validates it against both the app and the JSON Schema.

Change the model in `src/model/schema.ts` and the lab catalogue in `src/model/labs.ts` only; `npm run gen` rebuilds the JSON Schema and the lab catalogue table inside `AGENTS.md`.

## Deploy
`.github/workflows/deploy.yml` builds and publishes `dist/` to GitHub Pages on push to `main`. One-time setup: repo Settings → Pages → Source: **GitHub Actions**. The build uses a relative base, so any repo name or custom domain works.
