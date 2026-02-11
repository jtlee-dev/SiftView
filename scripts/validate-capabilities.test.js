import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CAPABILITIES_DIR = path.join(__dirname, "..", "src-tauri", "capabilities");

/**
 * Tauri ACL identifier rules (must match scripts/validate-capabilities.js):
 * - Lowercase ASCII [a-z], hyphens [-], at most one colon
 * - No leading/trailing hyphen, no underscores
 */
function validateIdentifier(id) {
  if (typeof id !== "string") return "must be a string";
  if (id.startsWith("-") || id.endsWith("-")) return "no leading/trailing hyphen";
  if (id.includes("_")) return "no underscores (use hyphen)";
  const parts = id.split(":");
  if (parts.length > 2) return "at most one colon";
  for (const part of parts) {
    if (!/^[a-z][a-z-]*$/.test(part)) return "only lowercase letters and hyphens";
  }
  return null;
}

describe("Tauri capability files", () => {
  it("exist and are valid JSON", () => {
    const files = fs.readdirSync(CAPABILITIES_DIR).filter((f) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const content = fs.readFileSync(path.join(CAPABILITIES_DIR, file), "utf8");
      expect(() => JSON.parse(content)).not.toThrow();
    }
  });

  it("have valid capability and permission identifiers (ACL rules)", () => {
    const files = fs.readdirSync(CAPABILITIES_DIR).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const data = JSON.parse(fs.readFileSync(path.join(CAPABILITIES_DIR, file), "utf8"));
      const one = Array.isArray(data) ? data[0] : data.capabilities?.[0] ?? data;
      if (one.identifier) {
        const err = validateIdentifier(one.identifier);
        expect(err, `capability.identifier in ${file}`).toBeNull();
      }
      for (let i = 0; i < (one.permissions ?? []).length; i++) {
        const p = one.permissions[i];
        const id = typeof p === "string" ? p : p.identifier;
        if (id != null) {
          const err = validateIdentifier(id);
          expect(err, `permissions[${i}] "${id}" in ${file}`).toBeNull();
        }
      }
    }
  });
});
