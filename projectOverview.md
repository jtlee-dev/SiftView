# SiftView — Project Overview

## What is SiftView?

**SiftView** is a lightweight, cross-platform text and file editor/viewer designed for inspecting, comparing, and lightly editing text and mixed-format data.

It prioritizes:
- clarity over complexity
- viewing over editing
- safety over accidental modification
- speed and low friction over heavy IDE features

SiftView competes with tools like Notepad++, Sublime Text, and lightweight viewers, but focuses on **intelligent content inspection**, **mixed-format rendering**, and **frictionless workflows**.

---

## Core Design Philosophy

### Viewer-first, editor-second
Opening a file should feel safe. Users should never feel like they might accidentally modify data unless they explicitly choose to.

### Smart but non-destructive
SiftView detects structure, formats content visually, and highlights meaning — but never rewrites underlying data unless the user confirms.

### Zero-friction exits
Closing tabs, closing the app, or discarding content should never involve repetitive save/cancel prompts. Undo is preferred over confirmation dialogs.

### Mixed formats are normal
Real-world data is often messy. Files and pasted content may contain multiple formats (text, CSV, JSON, logs, etc.) and SiftView should handle this gracefully.

---

## Supported Platforms

- Windows
- macOS
- Linux

Single codebase, native-feeling app on all platforms.

---

## High-Level Feature Set

### 1. Clean, Minimal Interface
- Single main editor pane with tabs
- Optional collapsible inspector panel
- Minimal menus and status bar
- No sidebars by default

### 2. Frictionless Tab Management
- Tabs can be closed instantly without save prompts
- Dirty tabs are discarded by default
- Undo support for recently closed tabs
- Optional pinning for tabs that should prompt on close

### 3. Intelligent Content Detection
SiftView detects content type using:
- file extensions
- content sniffing (heuristics)
- confidence-based detection

Supported formats (initial):
- Plain text
- JSON
- CSV
- XML / HTML (basic)
- Logs (best-effort)

### 4. Mixed-Mode Content Rendering
A single file or paste may contain multiple formats.

SiftView:
- splits content into logical segments
- applies per-segment syntax highlighting
- optionally enables per-segment formatting
- visually separates segments subtly (no heavy boxes)

Example:
- text header
- CSV block
- JSON block
→ each rendered appropriately in one buffer

### 5. Visual-First Formatting
- Formatting is applied visually by default
- Underlying text is not modified unless explicitly requested
- Formatting can be applied per-segment
- Formatting previews are shown before applying changes

### 6. Built-in Diff Tool
Diffing is a first-class feature.

Users can:
- diff two tabs
- diff a tab against clipboard content
- diff files directly

Diff modes:
- side-by-side
- inline
- structure-aware diff for JSON and CSV (future)

Diffs open as special tabs, not modal dialogs.

---

## User Experience Guidelines

### Tabs
Each tab has a state:
- Clean (unmodified)
- Dirty (modified)
- Ephemeral (pasted or temporary content)

Default behavior:
- Closing tabs does not prompt
- “Close All” closes everything immediately
- A single undo action can restore closed tabs

### Editing
- Lightweight text editing
- No IDE-style autocomplete by default
- Multi-cursor and column selection supported
- Designed to handle large files efficiently

---

## Architecture Overview

### Frontend
- Web-based UI (React / Solid / Svelte)
- Monaco Editor or CodeMirror 6 as the editor core
- Responsible for:
  - rendering
  - tabs
  - diff views
  - visual formatting overlays

### Backend
- Native backend (Rust via Tauri)
- Responsible for:
  - file I/O
  - large file streaming
  - content detection
  - diff computation
  - platform integrations (clipboard, filesystem)

---

## Core Internal Concepts

### Text Buffer
- Plain text source of truth
- Visual layers applied on top (highlighting, formatting)

### Detection Pipeline
1. Extension-based detection
2. Content-based heuristics
3. Confidence scoring
4. Optional segmentation into multiple content regions

### Segments
A segment is a contiguous region of text with:
- detected type (e.g. JSON, CSV)
- confidence score
- optional formatter and highlighter

---

## Extensibility (Future-Friendly)

SiftView is designed to support:
- pluggable detectors
- pluggable formatters
- additional diff strategies
- future plugin system (out of scope for MVP)

---

## MVP Scope

Initial implementation should focus on:
- single-pane editor with tabs
- frictionless tab closing
- basic content detection (text, JSON, CSV)
- mixed-mode highlighting
- basic diff (text-based)
- cross-platform builds

Advanced features (semantic diff, plugins, folder mode) come later.

---

## Non-Goals

To keep SiftView focused:
- No project management
- No build systems
- No debugging tools
- No heavy IDE features

---

## Summary

SiftView aims to be the tool you reach for when you want to:
- quickly inspect a file
- paste and understand messy data
- compare two things
- safely explore structured text

It should feel fast, calm, and trustworthy.
