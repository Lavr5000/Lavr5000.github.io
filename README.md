# lavr5000.github.io

Single-file portfolio-landing of Denis Lavrov (construction automation + AI).

## Structure

```
index.html           — main page (React via UMD + inline JSX via Babel)
robot.glb            — 3D robot model (model-viewer)
scenarios.js         — StroyOps demo scenarios (voice → letter)
uploads/             — static images / screenshots
apartment-auditor/   — privacy policy for the Apartment Auditor RuStore app
favicon*.png         — favicons
.github/workflows/deploy-pages.yml — deploys repo root as-is to GitHub Pages
```

## Local preview

```bash
python -m http.server 8765 --bind 127.0.0.1
# open http://127.0.0.1:8765/
```

## History

- `master` — v3 (current, single-file, 3D robot, interactive demos)
- `archive/nextjs-v2` — previous Next.js version (preserved for reference)
