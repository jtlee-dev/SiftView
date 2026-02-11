/** Basename of a file path (cross-platform). */
export function basename(path: string): string {
  const last = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return last === -1 ? path : path.slice(last + 1);
}

/** File extension (e.g. "file.json" -> "json"). Returns empty string if no extension. */
export function getExtension(path: string): string {
  const name = basename(path);
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}
