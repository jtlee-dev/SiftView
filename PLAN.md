# SiftView — Implementation Plan

## Phase 1: Foundation (current)

### 1.1 Project scaffold
- **Tauri 2** + **React** + **TypeScript** (single codebase, native on Win/macOS/Linux)
- **CodeMirror 6** as editor core (lightweight, extensible; better fit than Monaco for viewer-first)
- Package manager: npm

### 1.2 Directory layout (target)
```
SiftView/
├── src-tauri/           # Rust backend
│   ├── src/
│   │   ├── lib.rs
│   │   ├── main.rs
│   │   ├── commands/    # Tauri commands (file I/O, detect, diff)
│   │   └── detection/   # Content detection pipeline
│   └── Cargo.toml
├── src/                 # React frontend
│   ├── App.tsx
│   ├── components/
│   │   ├── EditorPane.tsx
│   │   ├── TabBar.tsx
│   │   └── ...
│   ├── hooks/
│   └── ...
├── projectOverview.md
└── PLAN.md
```

### 1.3 Core frontend (MVP)
- Single main pane with **tabs** (no sidebar by default)
- **TabBar**: new tab, close tab (no save prompt), optional pin
- **EditorPane**: CodeMirror 6, one buffer per tab; state: clean / dirty / ephemeral
- Minimal chrome: menu bar or compact toolbar, minimal status bar
- Frictionless close: close tab → discard; “undo” restores recently closed tab (in-memory)

### 1.4 Core backend (MVP)
- **File I/O**: open file (path), read content, optional streaming for large files later
- **Content detection**: extension + content sniffing → type (text, json, csv) + confidence
- **Diff**: two strings → computed diff (e.g. diff crate); return structured hunks for frontend
- Commands exposed via Tauri: `open_file`, `read_file`, `detect_content`, `compute_diff`

---

## Phase 2: Content intelligence

- **Detection pipeline** in Rust: by extension first, then heuristics (JSON start `{`/`[`, CSV comma/newline, etc.)
- **Segments**: split buffer into regions (e.g. header + JSON + CSV); each segment has type + confidence
- **Mixed-mode highlighting**: frontend requests highlight per segment; CodeMirror 6 language modes per range or overlay

---

## Phase 3: Diff & polish

- **Diff UI**: side-by-side and inline; open as tabs, not modals
- Diff against clipboard (backend: get clipboard text; same `compute_diff` path)
- **Formatting**: visual-only first (e.g. pretty-print JSON in view); “apply” writes back only on user confirm

---

## Phase 4: Later (post-MVP)

- Optional collapsible inspector panel
- Structure-aware diff (JSON/CSV)
- Pluggable detectors/formatters
- Large file streaming
- Plugin system (out of scope for MVP)

---

## Tech choices

| Area           | Choice              | Reason                                      |
|----------------|---------------------|---------------------------------------------|
| App shell      | Tauri 2             | Native backend, small binary, cross-platform |
| Frontend       | React + TypeScript  | Familiar, strong CodeMirror integration     |
| Editor         | CodeMirror 6        | Lighter than Monaco, good for viewing      |
| Diff (backend) | `similar` or `diff` | Rust crates for text diff                   |
| Styling        | CSS / Tailwind TBD  | Keep UI minimal; decide when building UI   |

---

## Success criteria for “get started”

1. App runs with `npm run tauri dev` (window with React UI).
2. Tab bar: add tab, close tab; one CodeMirror editor per tab.
3. Backend: at least one command (e.g. `read_file`) and `detect_content` stub called from frontend.
4. No save prompts on close; optional “recently closed” undo for tabs.

---

## Testing (implemented)

- **Frontend:** Vitest + React Testing Library. Tests for App (tabs: add, close, select, dirty state) and TabBar (render, active, onSelect, onClose, onNew). EditorPane mocked in App tests. Run: `npm run test:run`.
- **Backend:** Unit tests in `src-tauri/src/lib.rs` for `detect_content` (extension + heuristics) and `read_file` (success + error). Run: `npm run test:rust` or `cargo test`.
- **Policy:** Add or update tests for every new feature; keep `npm run test:all` green.

---

## Next steps (in order)

1. ~~**Open file** — Use Tauri dialog to pick a file; call `read_file`; open in new tab (or current). Add tests for “open file” flow (can mock Tauri invoke).~~ **Done.**
2. ~~**Wire detection** — Call `detect_content` when content or tab changes; show kind in status bar or inspector; optionally switch CodeMirror language by segment.~~ **Done.**
3. ~~**Basic diff** — Backend: `compute_diff` + `compute_diff_structured`; frontend: diff picker, side-by-side diff tab with collapsible unchanged.~~ **Done.**
4. ~~**Recently closed tabs** — On close, push tab onto stack (max 10); Restore button and Ctrl+Shift+T / Cmd+Shift+T restore most recent.~~ **Done.**
5. ~~**Mixed-mode segments** — Split buffer by blank lines; `detect_segments` in Rust; frontend stores segments, EditorPane applies per-segment line decorations (tint).~~ **Done.**
6. ~~**Formatting (visual)** — Pretty-print JSON (and optionally CSV) in view; Apply writes back only on confirm (Phase 3).~~ **Done.** Format + Display formatted + Save / Save As + Close all.
7. **Save / Save As** — Backend `write_file`; Save when tab has path and dirty; Save As opens save dialog, writes, updates tab path/label. **Done.**
8. **Close All** — Button closes all tabs and pushes them to recently closed (restore one-by-one). **Done.**
9. **Keyboard shortcuts** — Cmd/Ctrl+S Save (or Save As), Cmd/Ctrl+W close tab, Cmd/Ctrl+Shift+T restore tab. **Done.**
10. **Collapsible inspector** — Optional panel (toggle in status bar): label, path, type, lines, segments summary. **Done.**
11. **Tab pinning** — Pin/unpin per tab (📌 in tab bar); closing a pinned tab prompts “Close pinned tab?” **Done.**
12. **Inline diff view** — In diff tabs, toggle “Side-by-side” vs “Inline” (unified diff in read-only editor). **Done.**
13. **New tab shortcut + Copy** — Cmd/Ctrl+N new tab; Copy button copies active tab content (or inline diff) to clipboard. **Done.**
