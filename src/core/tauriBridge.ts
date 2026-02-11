/**
 * Bridge for Tauri (desktop) vs web (browser). When running in a browser (e.g. GitHub Pages),
 * we use in-JS fallbacks so the UI works: file input for Open, download for Save, clipboard API, etc.
 */

declare global {
  interface Window {
    __TAURI__?: unknown;
  }
}

export function isTauri(): boolean {
  return typeof window !== "undefined" && !!window.__TAURI__;
}

// --- invoke: use Tauri when available, else web implementations
export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri()) {
    const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
    return tauriInvoke<T>(cmd, args ?? {});
  }
  return webInvoke(cmd, args ?? {}) as Promise<T>;
}

function webInvoke(cmd: string, args: Record<string, unknown>): Promise<unknown> {
  switch (cmd) {
    case "read_file":
      return Promise.reject(new Error("Open files via the Open button in browser mode."));
    case "write_file":
      return webWriteFile(String(args.path ?? "download.txt"), String(args.content ?? ""));
    case "detect_content":
      return Promise.resolve(webDetectContent(String(args.content ?? ""), (args.extension as string) ?? ""));
    case "detect_segments":
      return Promise.resolve(webDetectSegments(String(args.content ?? ""), (args.extension as string) ?? ""));
    case "format_json":
      return Promise.resolve(webFormatJson(String(args.content ?? "")));
    case "format_content_segmented":
      return Promise.resolve(webFormatContentSegmented(String(args.content ?? ""), (args.segments as { kind: string }[]) ?? []));
    case "compute_diff":
      return Promise.resolve(webComputeDiff(String(args.left ?? ""), String(args.right ?? "")));
    case "compute_diff_structured":
      return Promise.resolve(webComputeDiffStructured(String(args.left ?? ""), String(args.right ?? "")));
    default:
      return Promise.reject(new Error(`Unknown command: ${cmd}`));
  }
}

function webWriteFile(path: string, content: string): Promise<void> {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
  a.download = path.split(/[/\\]/).pop() ?? path;
  a.click();
  URL.revokeObjectURL(a.href);
  return Promise.resolve();
}

function webDetectContent(content: string, extension: string): { kind: string; confidence: number } {
  const ext = extension.toLowerCase();
  if (["json", "csv", "xml", "html", "yaml", "yml", "env", "properties"].includes(ext)) {
    const kind = ext === "yml" ? "yaml" : ext === "env" || ext === "properties" ? "properties" : ext;
    return { kind, confidence: 0.95 };
  }
  const t = content.trim();
  if ((t.startsWith("{") && t.includes('"')) || (t.startsWith("[") && t.includes('"'))) return { kind: "json", confidence: 0.85 };
  if (t.includes(",") && t.includes("\n") && t.split("\n")[0]?.includes(",")) return { kind: "csv", confidence: 0.7 };
  return { kind: "text", confidence: 0.5 };
}

function webDetectSegments(content: string, extension: string): { start_line: number; end_line: number; kind: string }[] {
  const lines = content.split("\n");
  if (lines.length === 0) {
    const kind = extension ? (extension === "yml" ? "yaml" : extension === "env" || extension === "properties" ? "properties" : extension) : "text";
    return [{ start_line: 1, end_line: 1, kind }];
  }
  const segments: { start_line: number; end_line: number; kind: string }[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i++;
      continue;
    }
    const line1 = i + 1;
    let kind = "text";
    if (line.trim().startsWith("{") || line.trim().startsWith("[")) kind = "json";
    else if (line.includes(",") && line.split(",").length >= 2) kind = "csv";
    if (segments.length > 0 && segments[segments.length - 1].kind === kind && segments[segments.length - 1].end_line + 1 === line1) {
      segments[segments.length - 1].end_line = line1;
    } else {
      segments.push({ start_line: line1, end_line: line1, kind });
    }
    i++;
  }
  return segments.length > 0 ? segments : [{ start_line: 1, end_line: lines.length || 1, kind: "text" }];
}

function webFormatJson(content: string): string {
  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    throw new Error("Invalid JSON");
  }
}

function webFormatContentSegmented(content: string, segments: { start_line: number; end_line: number; kind: string }[]): string {
  const lines = content.split("\n");
  if (lines.length === 0) return content;
  if (!segments.length) {
    try {
      return webFormatJson(content);
    } catch {
      return content;
    }
  }
  const out: string[] = [];
  for (const seg of segments) {
    const start = Math.max(0, seg.start_line - 1);
    const end = Math.min(lines.length, seg.end_line);
    const chunk = lines.slice(start, end).join("\n");
    if (seg.kind === "json") {
      try {
        out.push(webFormatJson(chunk));
      } catch {
        out.push(chunk);
      }
    } else {
      out.push(chunk);
    }
  }
  return out.join("\n");
}

function webComputeDiff(left: string, right: string): string {
  const l = left.split("\n");
  const r = right.split("\n");
  const lines: string[] = ["--- current", "+++ clipboard"];
  let i = 0,
    j = 0;
  while (i < l.length || j < r.length) {
    if (i < l.length && j < r.length && l[i] === r[j]) {
      lines.push(" " + l[i]);
      i++;
      j++;
    } else if (j < r.length && (i >= l.length || (i < l.length && l[i] !== r[j] && (i + 1 >= l.length || l[i + 1] !== r[j])))) {
      lines.push("+" + r[j]);
      j++;
    } else if (i < l.length) {
      lines.push("-" + l[i]);
      i++;
    }
  }
  return lines.join("\n");
}

function webComputeDiffStructured(
  left: string,
  right: string
): { left_label: string; right_label: string; blocks: Array<{ type: "unchanged"; count: number; lines: string[] } | { type: "changed"; old_lines: string[]; new_lines: string[] }> } {
  const l = left.split("\n");
  const r = right.split("\n");
  const blocks: Array<
    | { type: "unchanged"; count: number; lines: string[] }
    | { type: "changed"; old_lines: string[]; new_lines: string[] }
  > = [];
  let i = 0,
    j = 0;
  while (i < l.length || j < r.length) {
    if (i < l.length && j < r.length && l[i] === r[j]) {
      const unchanged: string[] = [];
      while (i < l.length && j < r.length && l[i] === r[j]) {
        unchanged.push(l[i]);
        i++;
        j++;
      }
      blocks.push({ type: "unchanged", count: unchanged.length, lines: unchanged });
    } else {
      const oldLines: string[] = [];
      const newLines: string[] = [];
      while (i < l.length && (j >= r.length || l[i] !== r[j])) {
        oldLines.push(l[i]);
        i++;
      }
      while (j < r.length && (i >= l.length || l[i] !== r[j])) {
        newLines.push(r[j]);
        j++;
      }
      if (oldLines.length || newLines.length) blocks.push({ type: "changed", old_lines: oldLines, new_lines: newLines });
    }
  }
  return { left_label: "current", right_label: "clipboard", blocks };
}

// --- Dialog: in web use file input / download / alert / confirm
export async function openDialog(options: { multiple?: boolean; directory?: boolean }): Promise<string | string[] | { path: string; content: string } | null> {
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    return open(options);
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = options.multiple ?? false;
    input.style.display = "none";
    input.onchange = async () => {
      const files = input.files;
      if (!files?.length) {
        resolve(null);
        return;
      }
      const file = files[0];
      try {
        const content = await file.text();
        resolve({ path: file.name, content });
      } catch {
        resolve(null);
      }
      input.remove();
    };
    input.oncancel = () => {
      resolve(null);
      input.remove();
    };
    document.body.appendChild(input);
    input.click();
  });
}

export async function saveDialog(options?: { defaultPath?: string }): Promise<string | null> {
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    return save(options ?? {});
  }
  const name = options?.defaultPath?.split(/[/\\]/).pop() ?? "untitled.txt";
  return window.prompt("Save as filename", name) ?? null;
}

export async function messageDialog(message: string, _options?: { title?: string; kind?: string }): Promise<void> {
  if (isTauri()) {
    const { message: msg } = await import("@tauri-apps/plugin-dialog");
    return msg(message, _options ?? {});
  }
  window.alert(message);
}

export async function ask(
  message: string,
  _options?: { title?: string; kind?: string; okLabel?: string; cancelLabel?: string }
): Promise<boolean> {
  if (isTauri()) {
    const { ask: askDialog } = await import("@tauri-apps/plugin-dialog");
    return askDialog(message, _options ?? {});
  }
  return window.confirm(message);
}

// --- Clipboard
export async function readText(): Promise<string> {
  if (isTauri()) {
    const { readText: rt } = await import("@tauri-apps/plugin-clipboard-manager");
    return rt();
  }
  return navigator.clipboard.readText();
}

export async function writeText(text: string): Promise<void> {
  if (isTauri()) {
    const { writeText: wt } = await import("@tauri-apps/plugin-clipboard-manager");
    return wt(text);
  }
  await navigator.clipboard.writeText(text);
}

// --- Global shortcut: in web use keydown
const webShortcuts = new Map<string, (e: { state: string }) => void>();

export async function registerShortcut(shortcut: string, callback: (e: { state: string }) => void): Promise<void> {
  if (isTauri()) {
    const { register } = await import("@tauri-apps/plugin-global-shortcut");
    return register(shortcut, callback);
  }
  webShortcuts.set(shortcut, callback);
  const key = shortcut === "CommandOrControl+N" ? "n" : shortcut.replace("CommandOrControl+", "").toLowerCase();
  const handler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === key) {
      e.preventDefault();
      callback({ state: "Pressed" });
    }
  };
  window.addEventListener("keydown", handler);
  (handler as unknown as { _cleanup?: () => void })._cleanup = () => window.removeEventListener("keydown", handler);
}

export async function unregisterShortcut(shortcut: string): Promise<void> {
  if (isTauri()) {
    const { unregister } = await import("@tauri-apps/plugin-global-shortcut");
    return unregister(shortcut);
  }
  webShortcuts.delete(shortcut);
}
