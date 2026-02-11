# SiftView — Development

Setup, build, test, and contribution guide for SiftView.

See [projectOverview.md](./projectOverview.md) for the product vision and [PLAN.md](./PLAN.md) for the implementation plan.

## Stack

- **Frontend:** React 18, TypeScript, Vite, CodeMirror 6
- **Backend:** Rust (Tauri 2)
- **Platforms:** Windows, macOS, Linux

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/) (for Tauri)
- Platform-specific: see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

## Setup

```bash
npm install
```

## Run (development)

Starts the Vite dev server and the Tauri app window:

```bash
npm run tauri dev
```

## Build (production)

```bash
npm run tauri build
```

Output is under `src-tauri/target/release/` (or `debug/` for unoptimized).

## Web-only (no Rust)

Run or build the web UI without Tauri:

```bash
npm run dev    # dev server at http://localhost:1420
npm run build  # output in dist/
```

In the browser, Open uses a file picker, Save triggers a download, and Format/Diff/Copy use in-page implementations.

## Testing

- **Frontend (Vitest + React Testing Library)**  
  - `npm test` — watch mode  
  - `npm run test:run` — single run  
  - Tests: `src/**/*.test.tsx` (App tab logic, TabBar behavior). EditorPane is mocked in App tests.

- **Backend (Rust)**  
  - `npm run test:rust` or `cargo test -p siftview` from repo root  
  - Tests in `src-tauri/src/lib.rs`: `detect_content` (extension + heuristic), `read_file` (success and error).

- **Run all**  
  - `npm run test:all` — runs frontend then Rust tests.

- **Capability validation**  
  - Tauri capability/permission identifiers must be lowercase ASCII, hyphens only, no leading/trailing hyphen, at most one colon.  
  - `npm run validate:capabilities` — validates `src-tauri/capabilities/*.json`.  
  - The same rules are tested in `scripts/validate-capabilities.test.js` (runs with `npm run test:run`).

## GitHub setup

### First-time repo creation

1. Create a new repo on GitHub (e.g. `SiftView`), then:

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/SiftView.git
   git push -u origin main
   ```

2. Update `README.md` URLs and `vite.config.ts` `base` if your repo name or username differs.

### Releases (desktop builds)

Push a tag to trigger builds and attach artifacts:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The [Build workflow](.github/workflows/build.yml) runs on push/PR and produces artifacts per platform. To publish to the Releases tab automatically, configure [Tauri signing](https://v2.tauri.app/start/distribution/updater/) and add the secret to the repo (optional).

### Web demo on GitHub Pages

1. In the repo: **Settings → Pages → Build and deployment → Source**: **GitHub Actions**.
2. Push to `main` (or run the “Deploy to GitHub Pages” workflow). The [pages workflow](.github/workflows/pages.yml) builds the web app and deploys it.
3. The app will be at **https://\<your-username\>.github.io/SiftView/** (replace `SiftView` with your repo name and update `base` in [vite.config.ts](./vite.config.ts) if needed).

## Versioning

**Source of truth:** `package.json` → `version`

Before release builds, the version is synced to `tauri.conf.json` and `Cargo.toml` via `npm run sync-version`. The `tauri:build` script runs this automatically.

**Release workflow:**
1. Bump `version` in `package.json` (e.g. `0.1.0` → `0.2.0`)
2. Run `npm run sync-version` (or let `tauri:build` do it)
3. Commit and push
4. Tag: `git tag v0.2.0 && git push origin v0.2.0`
5. Download artifacts from the Build workflow, or attach to a GitHub Release

The app displays the version in the status bar (e.g. `v0.1.0`). Desktop builds use Tauri’s `getVersion()` from config; the web build uses the version injected at build time from `package.json`.

## Test files

The `test-files/` folder contains sample files for manual testing. See [test-files/README.md](./test-files/README.md).

## Status

- [x] Single-pane editor with tabs
- [x] Open file from disk, content detection (JSON, CSV, XML, YAML, properties)
- [x] Format (JSON, CSV, XML, YAML, properties)
- [x] Display formatted (read-only preview)
- [x] Diff (side-by-side, inline)
- [x] Save / Save As, Copy, tab pinning, restore closed
- [x] Large file handling (5 MB cap)
