# SiftView

A lightweight, cross-platform text and file viewer for inspecting, comparing, and lightly editing text and mixed-format data. **Viewer-first, editor-second.**

See [projectOverview.md](./projectOverview.md) for the product vision and [PLAN.md](./PLAN.md) for the implementation plan.

## Try it

- **Desktop app** — Download the latest [Release](https://github.com/jtlee-dev/SiftView/releases) for your OS, or build from source below.
- **In your browser** — If this repo has GitHub Pages enabled, open **https://jtlee-dev.github.io/SiftView/** to use the web version (Open via file picker, Save as download, Format, Diff, Copy). No install required.

## Getting ready for GitHub

1. **Create a new repo** on GitHub (e.g. `SiftView`), then:

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/jtlee-dev/SiftView.git
   git push -u origin main
   ```

2. **Releases (desktop builds)**  
   Push a tag to build installers and attach them to a Release:

   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

   The [Build workflow](.github/workflows/build.yml) runs on push/PR and produces artifacts per platform. To publish to the Releases tab automatically, configure [Tauri signing](https://v2.tauri.app/start/distribution/updater/) and add the secret to the repo (optional).

3. **Web demo on GitHub Pages**  
   - In the repo: **Settings → Pages → Build and deployment → Source**: **GitHub Actions**.
   - Push to `main` (or run the “Deploy to GitHub Pages” workflow). The [pages workflow](.github/workflows/pages.yml) builds the web app and deploys it.
   - The app will be at **https://\<your-username\>.github.io/SiftView/** (replace `SiftView` with your repo name and update `base` in [vite.config.ts](./vite.config.ts) if needed).

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

## Frontend only (web / no Rust)

The same UI can run in a normal browser (e.g. for the GitHub Pages demo):

```bash
npm run dev    # dev server at http://localhost:1420
npm run build  # output in dist/
```

In the browser, Open uses a file picker, Save triggers a download, and Format/Diff/Copy use in-page implementations. For full file-system access and native shortcuts, use the desktop app.

## Testing

Tests are implemented early and should be kept green as you add features.

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

## MVP status

- [x] Single-pane editor with tabs
- [x] Frictionless tab close (no save prompt)
- [x] CodeMirror 6 editor with JSON highlighting
- [x] Backend: `read_file`, `detect_content` commands
- [x] Open file from disk (dialog + `read_file`)
- [x] Content detection: show kind in status bar; JSON syntax when detected
- [ ] Mixed-mode highlighting (segments)
- [ ] Basic diff (text-based)

## License

[MIT](./LICENSE)
